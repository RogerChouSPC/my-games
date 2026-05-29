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

// Recompute inSequence + bumpy flags and per-team sequence counts from board ownership.
function recomputeBoardFlags(room: RoomState): RoomState {
  const size = room.settings.boardSize;
  const need = sequenceLengthFor(size);
  const owners = room.board.map((c) => c.owner);
  const freeIdx = new Set(room.board.filter((c) => c.value === 'FREE').map((c) => c.index));

  const inSeq = new Set<number>();
  const bumpyAll = new Set<number>();
  const seqCount: Record<string, number> = {};

  for (const t of uniqueTeams(room)) {
    const seqs = findCompletedSequences(owners, freeIdx, size, need, t);
    seqCount[t] = seqs.length;
    seqs.forEach((seg) => seg.forEach((i) => inSeq.add(i)));
    findBumpyCells(owners, freeIdx, size, need, t).forEach((i) => bumpyAll.add(i));
  }

  const board = room.board.map((c) => ({
    ...c,
    inSequence: inSeq.has(c.index),
    bumpy: bumpyAll.has(c.index) && !inSeq.has(c.index),
  }));
  const teams = room.teams.map((t) => ({ ...t, sequencesThisGame: seqCount[t.color] ?? 0 }));
  return { ...room, board, teams };
}

function advanceTurn(room: RoomState): RoomState {
  return { ...room, currentTurn: (room.currentTurn + 1) % room.turnOrder.length };
}

function drawOne(room: ServerRoom, playerId: string): ServerRoom {
  const deck = room._deck ?? [];
  if (deck.length === 0) return room;
  const [top, ...rest] = deck;
  const hands = { ...room.hands, [playerId]: [...(room.hands[playerId] ?? []), top] };
  return { ...room, hands, _deck: rest, deckCount: rest.length };
}

function checkWin(room: RoomState): RoomState {
  const winnerTeam = room.teams.find((t) => t.sequencesThisGame >= room.settings.sequencesToWin);
  if (!winnerTeam) return room;
  const teams = room.teams.map((t) =>
    t.color === winnerTeam.color ? { ...t, gameWins: t.gameWins + 1 } : t
  );
  return { ...room, teams, phase: 'between' };
}

export function startGame(room: RoomState, firstPlayerId?: string): ServerRoom {
  const size = room.settings.boardSize;
  const board = buildBoard(size);
  let deck = shuffle(buildDeck(board, room.settings));
  const hands: Record<string, Card[]> = {};
  for (const p of room.players) {
    hands[p.id] = deck.slice(0, room.settings.cardsPerPlayer);
    deck = deck.slice(room.settings.cardsPerPlayer);
  }
  const turnOrder = shuffle(room.players.map((p) => p.id));
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
  if (next.phase === 'playing') next = advanceTurn(next) as ServerRoom;
  return next;
}

export function playPlusCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  cellIndex: number
): ServerRoom {
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
  if (next.phase === 'playing') next = advanceTurn(next) as ServerRoom;
  return next;
}

export function playMinusCard(
  room: ServerRoom,
  playerId: string,
  cardId: string,
  cellIndex: number
): ServerRoom {
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const cell = room.board[cellIndex];
  const myTeam = teamOf(room, playerId);
  if (!cell || cell.owner === null || cell.owner === myTeam || cell.inSequence) return room;
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
  if (next.phase === 'playing') next = advanceTurn(next) as ServerRoom;
  return next;
}

// A number card is "dead" when every board cell with its target is already owned.
export function swapDeadCard(room: ServerRoom, playerId: string, cardId: string): ServerRoom {
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

export function nextGame(room: RoomState, winningTeam: TeamColor | null): ServerRoom {
  const firstPlayer = winningTeam ? room.players.find((p) => p.team === winningTeam)?.id : undefined;
  return startGame({ ...room, phase: 'lobby' }, firstPlayer);
}

export function declareLastGame(room: RoomState): RoomState {
  return { ...room, isLastGame: true };
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
