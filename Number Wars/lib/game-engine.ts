import type { RoomState, Card, TeamColor, ServerRoom, RecentPlay } from '@/types/game';
import { buildBoard, sequenceLengthFor } from './board-layout';
import { buildDeck, shuffle } from './deck';
import { findCompletedSequences, findBumpyCells } from './sequences';

function teamOf(room: RoomState, playerId: string): TeamColor {
  const p = room.players.find((p) => p.id === playerId);
  return p!.team!;
}

// Append a card to the "last plays" feed (newest last), keeping only the most recent 5.
function appendPlay(room: RoomState, playerId: string, card: Card): RecentPlay[] {
  const entry: RecentPlay = {
    playerId,
    kind: card.kind,
    value: card.kind === 'number' ? card.target : null,
  };
  return [...(room.recentPlays ?? []), entry].slice(-5);
}

function uniqueTeams(room: RoomState): TeamColor[] {
  return [...new Set(room.players.map((p) => p.team).filter(Boolean) as TeamColor[])];
}

// Does this player have any legal move with any card in hand?
export function hasAnyLegalMove(room: RoomState, playerId: string): boolean {
  const team = room.players.find((p) => p.id === playerId)?.team ?? null;
  const hand = room.hands[playerId] ?? [];
  const emptyPlayable = room.board.some((c) => c.owner === null && c.value !== 'FREE');
  const removableOpp = room.board.some((c) => c.owner !== null && c.owner !== team);
  const hasFreezeTarget = room.turnOrder.some((pid) => {
    if (pid === playerId) return false;
    const t = room.players.find((p) => p.id === pid);
    if (!t) return false;
    if (team && t.team && team === t.team) return false;
    return !(room.frozenPlayerIds ?? []).includes(pid);
  });
  const hasOwnUnshielded = room.board.some((c) => c.owner === team && !c.shielded);
  const hasAnyChip = room.board.some((c) => c.owner !== null);
  const hasStealTarget = room.turnOrder.some((pid) => {
    if (pid === playerId) return false;
    const t = room.players.find((p) => p.id === pid);
    if (!t) return false;
    if (team && t.team && team === t.team) return false;
    return (room.hands[pid]?.length ?? 0) >= 2; // can't take a player's last card
  });
  for (const card of hand) {
    if (card.kind === 'plus' && emptyPlayable) return true;
    if (card.kind === 'minus' && removableOpp) return true;
    if (card.kind === 'steal' && hasStealTarget) return true;
    if (card.kind === 'shield' && hasOwnUnshielded) return true;
    if (card.kind === 'bomb' && hasAnyChip) return true;
    if (card.kind === 'reroll' && hand.length > 1) return true;
    if (card.kind === 'freeze' && hasFreezeTarget) return true;
    if (card.kind === 'number' && room.board.some((c) => c.owner === null && c.value === card.target))
      return true;
  }
  return false;
}

// The game is a draw when nobody has won and no further progress is possible:
// the board is full, or the deck is empty and no player can move.
function isDraw(room: RoomState): boolean {
  if (room.roundWinner || room.roundTie) return false;
  if (room.teams.some((t) => t.sequencesThisGame >= room.settings.sequencesToWin)) return false;
  const boardFull = !room.board.some((c) => c.owner === null && c.value !== 'FREE');
  const deck = (room as ServerRoom)._deck;
  const deckEmpty = !deck || deck.length === 0;
  const anyoneCanMove = room.turnOrder.some((pid) => hasAnyLegalMove(room, pid));
  return boardFull || (deckEmpty && !anyoneCanMove);
}

// Recompute inSequence + bumpy flags and per-team sequence counts from board ownership.
function recomputeBoardFlags(room: RoomState): RoomState {
  const size = room.settings.boardSize;
  const need = sequenceLengthFor(size);
  const owners = room.board.map((c) => c.owner);
  const freeIdx = new Set(room.board.filter((c) => c.value === 'FREE').map((c) => c.index));

  const inSeq = new Set<number>();
  const superSeq = new Set<number>(); // cells in a full-length line (scores 2) → gold star
  const bumpyAll = new Set<number>();
  const seqCount: Record<string, number> = {};
  let superCount = 0;

  for (const t of uniqueTeams(room)) {
    const runs = findCompletedSequences(owners, freeIdx, size, need, t);
    seqCount[t] = runs.reduce((n, run) => n + (run.length >= size ? 2 : 1), 0);
    superCount += runs.filter((run) => run.length >= size).length;
    for (const run of runs) {
      for (const i of run) {
        inSeq.add(i);
        if (run.length >= size) superSeq.add(i);
      }
    }
    findBumpyCells(owners, freeIdx, size, need, t).forEach((i) => bumpyAll.add(i));
  }

  const board = room.board.map((c) => ({
    ...c,
    inSequence: inSeq.has(c.index),
    superSequence: superSeq.has(c.index),
    bumpy: bumpyAll.has(c.index) && !inSeq.has(c.index),
  }));
  const teams = room.teams.map((t) => ({ ...t, sequencesThisGame: seqCount[t.color] ?? 0 }));
  return { ...room, board, teams, superCount };
}

function advanceTurn(room: RoomState): RoomState {
  const n = room.turnOrder.length;
  if (n === 0) return room;
  let frozen = room.frozenPlayerIds ?? [];
  let idx = room.currentTurn;
  // Walk forward to the next player; any frozen player along the way is skipped
  // and thawed (their ice shatters as their turn passes).
  for (let step = 0; step < n; step++) {
    idx = (idx + 1) % n;
    const pid = room.turnOrder[idx];
    if (frozen.includes(pid)) {
      frozen = frozen.filter((f) => f !== pid);
      continue;
    }
    return { ...room, currentTurn: idx, frozenPlayerIds: frozen };
  }
  return { ...room, currentTurn: idx, frozenPlayerIds: frozen };
}

function drawOne(room: ServerRoom, playerId: string): ServerRoom {
  const deck = room._deck ?? [];
  if (deck.length === 0) return room;
  const [top, ...rest] = deck;
  const hands = { ...room.hands, [playerId]: [...(room.hands[playerId] ?? []), top] };
  return { ...room, hands, _deck: rest, deckCount: rest.length };
}

// Refill a player back up to a full hand (cardsPerPlayer), or until the deck runs out.
// A player who's been stolen from (and is short cards) recovers when they next play.
function drawToFull(room: ServerRoom, playerId: string): ServerRoom {
  const target = room.settings.cardsPerPlayer;
  let next = room;
  while ((next.hands[playerId]?.length ?? 0) < target && (next._deck?.length ?? 0) > 0) {
    next = drawOne(next, playerId);
  }
  return next;
}

function checkWin(room: RoomState): RoomState {
  if (room.roundWinner) return room; // already won, awaiting host
  const winnerTeam = room.teams.find((t) => t.sequencesThisGame >= room.settings.sequencesToWin);
  if (!winnerTeam) return room;
  const teams = room.teams.map((t) =>
    t.color === winnerTeam.color ? { ...t, gameWins: t.gameWins + 1 } : t
  );
  // Freeze on the board (phase stays 'playing') until the host presses Next.
  return { ...room, teams, roundWinner: winnerTeam.color };
}

// After a move, if nobody won and the game can't continue, freeze as a tie.
function checkDraw(room: RoomState): RoomState {
  if (room.roundWinner || room.roundTie) return room;
  return isDraw(room) ? { ...room, roundTie: true } : room;
}

// Host advances from a frozen board (a win or a tie): to the score screen, or the
// final champion screen if this was the last game.
export function nextRound(room: RoomState): RoomState {
  if (!room.roundWinner && !room.roundTie) return room;
  const cleared = { ...room, roundWinner: null, roundWinnerGif: null, roundTie: false };
  return room.isLastGame ? finalize(cleared) : { ...cleared, phase: 'between' };
}

export function startGame(room: RoomState, firstPlayerId?: string): ServerRoom {
  const size = room.settings.boardSize;
  const board = buildBoard(size);
  let deck = shuffle(buildDeck(board, room.settings));
  // In self-test, synthetic seats are the players; otherwise everyone plays.
  const seatPlayers = room.players.filter((p) => p.isSeat);
  const playing = seatPlayers.length > 0 ? seatPlayers : room.players;
  const hands: Record<string, Card[]> = {};
  for (const p of playing) {
    hands[p.id] = deck.slice(0, room.settings.cardsPerPlayer);
    deck = deck.slice(room.settings.cardsPerPlayer);
  }
  // Turn order ALTERNATES teams (e.g. Red, Blue, Red, Blue) so one team never plays
  // twice in a row. Group players by team, shuffle within each team and the team
  // order for variety, then deal them out round-robin across the teams.
  const byTeam = new Map<string, string[]>();
  for (const p of playing) {
    const key = p.team ?? p.id; // solo / self-test: each side is its own team
    if (!byTeam.has(key)) byTeam.set(key, []);
    byTeam.get(key)!.push(p.id);
  }
  const queues = shuffle([...byTeam.values()].map((ids) => shuffle(ids)));
  const turnOrder: string[] = [];
  for (let i = 0; queues.some((q) => i < q.length); i++) {
    for (const q of queues) if (i < q.length) turnOrder.push(q[i]);
  }
  let currentTurn = 0;
  if (firstPlayerId) {
    const idx = turnOrder.indexOf(firstPlayerId);
    if (idx >= 0) currentTurn = idx;
  }
  return {
    ...room,
    phase: 'playing',
    board,
    hands,
    deckCount: deck.length,
    turnOrder,
    currentTurn,
    lastMove: null,
    roundWinner: null,
    roundWinnerGif: null,
    roundTie: false,
    superCount: 0,
    frozenPlayerIds: [],
    recentPlays: [],
    teams: room.teams.map((t) => ({ ...t, sequencesThisGame: 0 })),
    _deck: deck,
  };
}

export function playNumberCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  cellIndex: number
): ServerRoom {
  if (room.roundWinner || room.roundTie) return room; // board frozen after a win/tie
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const cell = room.board[cellIndex];
  if (!cell || cell.owner !== null || cell.value === 'FREE') return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'number' || card.target !== cell.value) return room;

  let next: ServerRoom = {
    ...room,
    board: room.board.map((c, i) => (i === cellIndex ? { ...c, owner: teamOf(room, playerId) } : c)),
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
    lastMove: { index: cellIndex, playerId, kind: 'place' },
    recentPlays: appendPlay(room, playerId, card),
  };
  next = recomputeBoardFlags(next) as ServerRoom;
  next = drawToFull(next, playerId);
  next = checkWin(next) as ServerRoom;
  next = checkDraw(next) as ServerRoom;
  if (next.phase === 'playing' && !next.roundWinner && !next.roundTie)
    next = advanceTurn(next) as ServerRoom;
  return next;
}

export function playPlusCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  cellIndex: number
): ServerRoom {
  if (room.roundWinner || room.roundTie) return room; // board frozen after a win/tie
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const cell = room.board[cellIndex];
  if (!cell || cell.owner !== null || cell.value === 'FREE') return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'plus') return room;

  let next: ServerRoom = {
    ...room,
    board: room.board.map((c, i) => (i === cellIndex ? { ...c, owner: teamOf(room, playerId) } : c)),
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
    lastMove: { index: cellIndex, playerId, kind: 'place' },
    recentPlays: appendPlay(room, playerId, card),
  };
  next = recomputeBoardFlags(next) as ServerRoom;
  next = drawToFull(next, playerId);
  next = checkWin(next) as ServerRoom;
  next = checkDraw(next) as ServerRoom;
  if (next.phase === 'playing' && !next.roundWinner && !next.roundTie)
    next = advanceTurn(next) as ServerRoom;
  return next;
}

export function playMinusCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  cellIndex: number
): ServerRoom {
  if (room.roundWinner || room.roundTie) return room; // board frozen after a win/tie
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const cell = room.board[cellIndex];
  const myTeam = teamOf(room, playerId);
  // Minus may target any opponent chip — including one that's part of a Line Win.
  if (!cell || cell.owner === null || cell.owner === myTeam) return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'minus') return room;

  // Hidden shield: the attack fizzles — the chip survives, the shield breaks
  // (one-time), the card is spent and the turn ends. (Attacking blind is the gamble.)
  if (cell.shielded) {
    let blocked: ServerRoom = {
      ...room,
      board: room.board.map((c, i) => (i === cellIndex ? { ...c, shielded: false } : c)),
      hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
      recentPlays: appendPlay(room, playerId, card),
    };
    blocked = drawToFull(blocked, playerId);
    blocked = advanceTurn(blocked) as ServerRoom;
    return blocked;
  }

  let next: ServerRoom = {
    ...room,
    board: room.board.map((c, i) => (i === cellIndex ? { ...c, owner: null } : c)),
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
    lastMove: { index: cellIndex, playerId, kind: 'remove' },
    recentPlays: appendPlay(room, playerId, card),
  };
  next = recomputeBoardFlags(next) as ServerRoom;
  next = drawToFull(next, playerId);
  next = checkDraw(next) as ServerRoom;
  if (next.phase === 'playing' && !next.roundWinner && !next.roundTie)
    next = advanceTurn(next) as ServerRoom;
  return next;
}

// A number card is "dead" when every board cell with its target is already owned.
export function swapDeadCard(room: ServerRoom, playerId: string, cardId: string): ServerRoom {
  if (room.roundWinner || room.roundTie) return room; // board frozen after a win/tie
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'number') return room;
  const dead = room.board.filter((c) => c.value === card.target).every((c) => c.owner !== null);
  if (!dead) return room;
  let next: ServerRoom = {
    ...room,
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
  };
  next = drawOne(next, playerId);
  return next; // does NOT advance turn — player still makes a move this turn
}

// When a player has no legal move at all, they discard one card, draw a
// replacement, and their turn passes. The client only offers this when stuck;
// the server re-checks hasAnyLegalMove to stay authoritative.
export function discardCard(room: ServerRoom, playerId: string, cardId: string): ServerRoom {
  if (room.roundWinner || room.roundTie) return room; // board frozen after a win/tie
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  if (hasAnyLegalMove(room, playerId)) return room; // only allowed when truly stuck
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) return room;
  let next: ServerRoom = {
    ...room,
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
  };
  next = drawOne(next, playerId);
  next = advanceTurn(next) as ServerRoom;
  return next;
}

// Play a Freeze card: skip one opponent's next turn. Targets a player, not a cell.
export function freezeCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  targetId: string
): ServerRoom {
  if (room.roundWinner || room.roundTie) return room; // board frozen after a win/tie
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'freeze') return room;
  const me = room.players.find((p) => p.id === playerId);
  const target = room.players.find((p) => p.id === targetId);
  if (!me || !target || targetId === playerId) return room; // not yourself
  if (me.team && target.team && me.team === target.team) return room; // not a teammate
  if (!room.turnOrder.includes(targetId)) return room; // must be an active player
  const frozen = room.frozenPlayerIds ?? [];
  if (frozen.includes(targetId)) return room; // no stacking a second freeze

  let next: ServerRoom = {
    ...room,
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
    frozenPlayerIds: [...frozen, targetId],
    recentPlays: appendPlay(room, playerId, card),
  };
  next = drawToFull(next, playerId);
  next = advanceTurn(next) as ServerRoom;
  return next;
}

// Steal: take one (blindly chosen) card from a chosen opponent's hand into yours.
// Targets a player, not a cell. The victim is left one card down.
export function stealCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  targetPlayerId: string,
  cardIndex: number
): ServerRoom {
  if (room.roundWinner || room.roundTie) return room;
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'steal') return room;
  const me = room.players.find((p) => p.id === playerId);
  const target = room.players.find((p) => p.id === targetPlayerId);
  if (!me || !target || targetPlayerId === playerId) return room; // not yourself
  if (me.team && target.team && me.team === target.team) return room; // not a teammate
  if (!room.turnOrder.includes(targetPlayerId)) return room; // an active player
  const victimHand = room.hands[targetPlayerId] ?? [];
  if (victimHand.length <= 1) return room; // can't take a player's last card
  const idx = Math.max(0, Math.min(Math.floor(cardIndex), victimHand.length - 1));
  const stolen = victimHand[idx];

  // Spend the steal card, take the chosen card; the victim is down one card.
  // Does NOT end your turn — you still play a card afterward.
  const myHand = [...hand.filter((c) => c.id !== cardId), stolen];
  const newVictimHand = victimHand.filter((_, i) => i !== idx);
  return {
    ...room,
    hands: { ...room.hands, [playerId]: myHand, [targetPlayerId]: newVictimHand },
    recentPlays: appendPlay(room, playerId, card),
  }; // no advanceTurn — the player still makes a move this turn
}

// Shield: secretly protect up to 2 of your own chips. A shield is hidden from
// opponents and absorbs one Minus/Bomb hit (then breaks). Targets your own chips.
export function shieldCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  cellIndices: number[]
): ServerRoom {
  if (room.roundWinner || room.roundTie) return room;
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'shield') return room;
  const myTeam = teamOf(room, playerId);
  const valid = [...new Set(cellIndices)]
    .filter((i) => {
      const c = room.board[i];
      return c && c.owner === myTeam && !c.shielded && c.value !== 'FREE';
    })
    .slice(0, 2);
  if (valid.length === 0) return room; // nothing valid to shield

  let next: ServerRoom = {
    ...room,
    board: room.board.map((c, i) => (valid.includes(i) ? { ...c, shielded: true } : c)),
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
    recentPlays: appendPlay(room, playerId, card),
  };
  next = drawToFull(next, playerId);
  next = advanceTurn(next) as ServerRoom;
  return next;
}

// Reroll: swap the reroll card and one chosen card for two fresh ones. The chosen
// card returns to the deck (shuffled, for future players); the reroll card is spent.
// Does NOT end your turn — you still play a card afterward.
export function rerollCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  swapCardId: string
): ServerRoom {
  if (room.roundWinner || room.roundTie) return room;
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const hand = room.hands[playerId] ?? [];
  const reroll = hand.find((c) => c.id === cardId);
  const swap = hand.find((c) => c.id === swapCardId);
  if (!reroll || reroll.kind !== 'reroll' || !swap || swapCardId === cardId) return room;
  const kept = hand.filter((c) => c.id !== cardId && c.id !== swapCardId);
  const deck = shuffle([...(room._deck ?? []), swap]); // chosen card returns to the deck
  const drawn = deck.slice(0, 2);
  const rest = deck.slice(2);
  return {
    ...room,
    hands: { ...room.hands, [playerId]: [...kept, ...drawn] },
    _deck: rest,
    deckCount: rest.length,
    recentPlays: appendPlay(room, playerId, reroll),
  }; // no advanceTurn — the player still makes a move this turn
}

// Bomb: clear a 2x2 block (clamped to the board). Shielded chips survive the blast
// (their shield breaks); everything else in the area is destroyed.
export function bombCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  anchorIndex: number
): ServerRoom {
  if (room.roundWinner || room.roundTie) return room;
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'bomb') return room;
  const size = room.settings.boardSize;
  if (anchorIndex < 0 || anchorIndex >= size * size) return room;
  const row = Math.min(Math.floor(anchorIndex / size), size - 2);
  const col = Math.min(anchorIndex % size, size - 2);
  const blast = new Set([
    row * size + col,
    row * size + col + 1,
    (row + 1) * size + col,
    (row + 1) * size + col + 1,
  ]);

  let next: ServerRoom = {
    ...room,
    board: room.board.map((c, i) => {
      if (!blast.has(i) || c.value === 'FREE') return c;
      if (c.shielded) return { ...c, shielded: false }; // shield absorbs the blast; chip survives
      return { ...c, owner: null, shielded: false }; // destroyed
    }),
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
    lastMove: { index: row * size + col, playerId, kind: 'bomb' },
    recentPlays: appendPlay(room, playerId, card),
  };
  next = recomputeBoardFlags(next) as ServerRoom;
  next = drawToFull(next, playerId);
  next = checkDraw(next) as ServerRoom;
  if (next.phase === 'playing' && !next.roundWinner && !next.roundTie)
    next = advanceTurn(next) as ServerRoom;
  return next;
}

// Auto-resolve the current player's turn with a random legal move (used by the per-turn
// timer). Picks a random turn-ending play + random target; otherwise discards or passes.
export function autoMove(room: ServerRoom, playerId: string): ServerRoom {
  if (room.roundWinner || room.roundTie) return room;
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
  const hand = room.hands[playerId] ?? [];
  const myTeam = teamOf(room, playerId);
  const isOpp = (pid: string): boolean => {
    if (pid === playerId) return false;
    const t = room.players.find((p) => p.id === pid);
    if (!t) return false;
    return !(myTeam && t.team && myTeam === t.team);
  };
  const moves: Array<() => ServerRoom> = [];
  for (const card of hand) {
    if (card.kind === 'number') {
      const cells = room.board.filter((c) => c.owner === null && c.value === card.target);
      if (cells.length) moves.push(() => playNumberCard(room, playerId, card.id, pick(cells).index));
    } else if (card.kind === 'plus') {
      const cells = room.board.filter((c) => c.owner === null && c.value !== 'FREE');
      if (cells.length) moves.push(() => playPlusCard(room, playerId, card.id, pick(cells).index));
    } else if (card.kind === 'minus') {
      const cells = room.board.filter((c) => c.owner !== null && c.owner !== myTeam && !c.inSequence);
      if (cells.length) moves.push(() => playMinusCard(room, playerId, card.id, pick(cells).index));
    } else if (card.kind === 'shield') {
      const own = room.board.filter((c) => c.owner === myTeam && !c.shielded && c.value !== 'FREE');
      if (own.length)
        moves.push(() => shieldCard(room, playerId, card.id, shuffle(own).slice(0, 2).map((c) => c.index)));
    } else if (card.kind === 'bomb') {
      const owned = room.board.filter((c) => c.owner !== null);
      if (owned.length) moves.push(() => bombCard(room, playerId, card.id, pick(owned).index));
    } else if (card.kind === 'freeze') {
      const targets = room.turnOrder.filter(
        (pid) => isOpp(pid) && !(room.frozenPlayerIds ?? []).includes(pid)
      );
      if (targets.length) moves.push(() => freezeCard(room, playerId, card.id, pick(targets)));
    }
    // reroll & steal are free actions (don't end a turn) — not used to auto-resolve.
  }
  if (moves.length > 0) return pick(moves)();
  // No turn-ending play: discard if genuinely stuck, otherwise just pass the turn.
  if (hand.length > 0 && !hasAnyLegalMove(room, playerId)) {
    return discardCard(room, playerId, pick(hand).id);
  }
  return advanceTurn(room) as ServerRoom;
}

export function nextGame(room: RoomState, winningTeam: TeamColor | null): ServerRoom {
  const firstPlayer = winningTeam ? room.players.find((p) => p.team === winningTeam)?.id : undefined;
  return startGame({ ...room, phase: 'lobby' }, firstPlayer);
}

export function declareLastGame(room: RoomState): RoomState {
  return { ...room, isLastGame: true };
}

// Host ends the whole session immediately → jump to the final champion screen.
export function endGame(room: RoomState): RoomState {
  return finalize({ ...room, roundWinner: null, roundWinnerGif: null });
}

// Champion = most game wins; tie-break by most sequences in the final game.
export function finalize(room: RoomState): RoomState {
  const max = Math.max(...room.teams.map((t) => t.gameWins));
  const leaders = room.teams.filter((t) => t.gameWins === max);
  let champ = leaders[0];
  if (leaders.length > 1) {
    champ = leaders.reduce((a, b) => (b.sequencesThisGame > a.sequencesThisGame ? b : a));
  }
  return { ...room, phase: 'final', winners: champ.color };
}
