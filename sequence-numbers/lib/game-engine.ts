import type { RoomState, Card, TeamColor, ServerRoom } from '@/types/game';
import { buildBoard, sequenceLengthFor } from './board-layout';
import { buildDeck, shuffle } from './deck';
import { findCompletedSequences, findBumpyCells } from './sequences';

function teamOf(room: RoomState, playerId: string): TeamColor {
  const p = room.players.find((p) => p.id === playerId);
  return p!.team!;
}

function uniqueTeams(room: RoomState): TeamColor[] {
  return [...new Set(room.players.map((p) => p.team).filter(Boolean) as TeamColor[])];
}

// Does this player have any legal move with any card in hand?
export function hasAnyLegalMove(room: RoomState, playerId: string): boolean {
  const team = room.players.find((p) => p.id === playerId)?.team ?? null;
  const hand = room.hands[playerId] ?? [];
  const emptyPlayable = room.board.some((c) => c.owner === null && c.value !== 'FREE');
  const removableOpp = room.board.some(
    (c) => c.owner !== null && c.owner !== team && !c.inSequence && !c.shielded
  );
  const hasFreezeTarget = room.turnOrder.some((pid) => {
    if (pid === playerId) return false;
    const t = room.players.find((p) => p.id === pid);
    if (!t) return false;
    if (team && t.team && team === t.team) return false;
    return !(room.frozenPlayerIds ?? []).includes(pid);
  });
  const hasOwnUnshielded = room.board.some((c) => c.owner === team && !c.shielded);
  const hasAnyChip = room.board.some((c) => c.owner !== null);
  for (const card of hand) {
    if (card.kind === 'plus' && emptyPlayable) return true;
    if (card.kind === 'minus' && removableOpp) return true;
    if (card.kind === 'steal' && removableOpp) return true;
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
  const turnOrder = shuffle(playing.map((p) => p.id));
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
    lastMove: { index: cellIndex, playerId },
  };
  next = recomputeBoardFlags(next) as ServerRoom;
  next = drawOne(next, playerId);
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
    lastMove: { index: cellIndex, playerId },
  };
  next = recomputeBoardFlags(next) as ServerRoom;
  next = drawOne(next, playerId);
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
  if (!cell || cell.owner === null || cell.owner === myTeam || cell.inSequence || cell.shielded)
    return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'minus') return room;

  let next: ServerRoom = {
    ...room,
    board: room.board.map((c, i) => (i === cellIndex ? { ...c, owner: null } : c)),
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
    lastMove: { index: cellIndex, playerId },
  };
  next = recomputeBoardFlags(next) as ServerRoom;
  next = drawOne(next, playerId);
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
  };
  next = drawOne(next, playerId);
  next = advanceTurn(next) as ServerRoom;
  return next;
}

// Steal: flip one opponent chip (not in a sequence, not shielded) to your colour.
export function stealCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  cellIndex: number
): ServerRoom {
  if (room.roundWinner || room.roundTie) return room;
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'steal') return room;
  const cell = room.board[cellIndex];
  const myTeam = teamOf(room, playerId);
  if (!cell || cell.owner === null || cell.owner === myTeam || cell.inSequence || cell.shielded)
    return room;

  let next: ServerRoom = {
    ...room,
    board: room.board.map((c, i) => (i === cellIndex ? { ...c, owner: myTeam } : c)),
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
    lastMove: { index: cellIndex, playerId },
  };
  next = recomputeBoardFlags(next) as ServerRoom;
  next = drawOne(next, playerId);
  next = checkWin(next) as ServerRoom;
  next = checkDraw(next) as ServerRoom;
  if (next.phase === 'playing' && !next.roundWinner && !next.roundTie)
    next = advanceTurn(next) as ServerRoom;
  return next;
}

// Shield: protect one of your own chips from Minus/Steal for the rest of the game.
export function shieldCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  cellIndex: number
): ServerRoom {
  if (room.roundWinner || room.roundTie) return room;
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'shield') return room;
  const cell = room.board[cellIndex];
  const myTeam = teamOf(room, playerId);
  if (!cell || cell.owner !== myTeam || cell.shielded) return room; // own, not-yet-shielded chip

  let next: ServerRoom = {
    ...room,
    board: room.board.map((c, i) => (i === cellIndex ? { ...c, shielded: true } : c)),
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
  };
  next = drawOne(next, playerId);
  next = advanceTurn(next) as ServerRoom;
  return next;
}

// Reroll: swap the reroll card and one chosen card for two fresh ones. The chosen
// card returns to the deck (shuffled, for future players); the reroll card is spent.
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
  let next: ServerRoom = {
    ...room,
    hands: { ...room.hands, [playerId]: [...kept, ...drawn] },
    _deck: rest,
    deckCount: rest.length,
  };
  next = advanceTurn(next) as ServerRoom;
  return next;
}

// Bomb: destroy every chip in a 2x2 block (clamped to the board) — no exceptions.
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
    board: room.board.map((c, i) =>
      blast.has(i) && c.value !== 'FREE' ? { ...c, owner: null, shielded: false } : c
    ),
    hands: { ...room.hands, [playerId]: hand.filter((c) => c.id !== cardId) },
    lastMove: { index: row * size + col, playerId },
  };
  next = recomputeBoardFlags(next) as ServerRoom;
  next = drawOne(next, playerId);
  next = checkDraw(next) as ServerRoom;
  if (next.phase === 'playing' && !next.roundWinner && !next.roundTie)
    next = advanceTurn(next) as ServerRoom;
  return next;
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
