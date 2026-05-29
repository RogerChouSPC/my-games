import { describe, it, expect } from 'vitest';
import {
  startGame,
  playNumberCard,
  playPlusCard,
  playMinusCard,
  swapDeadCard,
  nextGame,
  declareLastGame,
  finalize,
} from './game-engine';
import type { RoomState, ServerRoom } from '@/types/game';

function baseRoom(): RoomState {
  return {
    code: 'TEST',
    phase: 'lobby',
    settings: {
      boardSize: 8,
      teamCount: 2,
      sequencesToWin: 2,
      cardsPerPlayer: 3,
      plusCards: 2,
      minusCards: 2,
    },
    players: [
      { id: 'p1', name: 'A', icon: 1, team: 'red', connected: true },
      { id: 'p2', name: 'B', icon: 2, team: 'blue', connected: true },
    ],
    teams: [
      { color: 'red', sequencesThisGame: 0, gameWins: 0 },
      { color: 'blue', sequencesThisGame: 0, gameWins: 0 },
    ],
    board: [],
    hands: {},
    deckCount: 0,
    turnOrder: [],
    currentTurn: 0,
    lastMove: null,
    hostId: 'p1',
    isLastGame: false,
    winners: null,
  };
}

describe('startGame', () => {
  it('builds board, deals hands, sets phase playing', () => {
    const r = startGame(baseRoom());
    expect(r.phase).toBe('playing');
    expect(r.board).toHaveLength(64);
    expect(r.hands['p1']).toHaveLength(3);
    expect(r.hands['p2']).toHaveLength(3);
    expect([...r.turnOrder].sort()).toEqual(['p1', 'p2']);
    expect(r._deck.length).toBe(64 - 4 - 2 * 3 + 2 + 2); // 60 + 4 specials - 6 dealt
  });
  it('honours firstPlayerId', () => {
    const r = startGame(baseRoom(), 'p2');
    expect(r.turnOrder[r.currentTurn]).toBe('p2');
  });
});

describe('playNumberCard', () => {
  it('places chip on a matching empty cell, refills hand, advances turn', () => {
    let r = startGame(baseRoom(), 'p1');
    const target = r.board.find((c) => c.value !== 'FREE')!.value as number;
    const card = { id: 'x', kind: 'number' as const, target, equation: '1 + 1', color: '#000' };
    r.hands['p1'] = [card, ...r.hands['p1'].slice(1)];
    const cellIndex = r.board.findIndex((c) => c.value === target && c.owner === null);
    r = playNumberCard(r, 'p1', 'x', cellIndex);
    expect(r.board[cellIndex].owner).toBe('red');
    expect(r.hands['p1']).toHaveLength(3);
    expect(r.turnOrder[r.currentTurn]).toBe('p2');
    expect(r.lastMove).toEqual({ index: cellIndex, playerId: 'p1' });
  });
  it('ignores a play when it is not your turn', () => {
    let r = startGame(baseRoom(), 'p1');
    const before = JSON.stringify(r.board);
    const card = r.hands['p2'][0];
    const idx = r.board.findIndex((c) => c.value === card.target && c.owner === null);
    r = playNumberCard(r, 'p2', card.id, idx);
    expect(JSON.stringify(r.board)).toBe(before);
  });
});

describe('playPlusCard', () => {
  it('places a chip on any empty non-free cell', () => {
    let r = startGame(baseRoom(), 'p1');
    const card = { id: 'w', kind: 'plus' as const, target: null, equation: null, color: null };
    r.hands['p1'] = [card, ...r.hands['p1'].slice(1)];
    const empty = r.board.findIndex((c) => c.value !== 'FREE' && c.owner === null);
    r = playPlusCard(r, 'p1', 'w', empty);
    expect(r.board[empty].owner).toBe('red');
  });
});

describe('playMinusCard', () => {
  it('removes an opponent chip not in a sequence', () => {
    let r = startGame(baseRoom(), 'p1');
    const idx = r.board.findIndex((c) => c.value !== 'FREE');
    r.board[idx].owner = 'blue';
    const card = { id: 'm', kind: 'minus' as const, target: null, equation: null, color: null };
    r.hands['p1'] = [card, ...r.hands['p1'].slice(1)];
    r = playMinusCard(r, 'p1', 'm', idx);
    expect(r.board[idx].owner).toBe(null);
  });
  it('cannot remove your own chip', () => {
    let r = startGame(baseRoom(), 'p1');
    const idx = r.board.findIndex((c) => c.value !== 'FREE');
    r.board[idx].owner = 'red';
    const card = { id: 'm', kind: 'minus' as const, target: null, equation: null, color: null };
    r.hands['p1'] = [card, ...r.hands['p1'].slice(1)];
    r = playMinusCard(r, 'p1', 'm', idx);
    expect(r.board[idx].owner).toBe('red');
  });
});

describe('bumpy + win', () => {
  it('marks bumpy at 4 in a row, then wins on the 5th', () => {
    let r = startGame(baseRoom(), 'p1');
    // Force a clean board and a known horizontal row for red (indices 24..28).
    r.board = r.board.map((c) => ({ ...c, owner: null, bumpy: false, inSequence: false }));
    r.settings = { ...r.settings, sequencesToWin: 1 };
    const place = (idx: number, pid: string) => {
      const cell = r.board[idx];
      const card = { id: 'c' + idx, kind: 'number' as const, target: cell.value as number, equation: '1+1', color: '#000' };
      r.hands[pid] = [card, ...(r.hands[pid] ?? [])];
      r.currentTurn = r.turnOrder.indexOf(pid);
      r = playNumberCard(r, pid, 'c' + idx, idx);
    };
    [24, 25, 26, 27].forEach((i) => place(i, 'p1'));
    expect([24, 25, 26, 27].every((i) => r.board[i].bumpy)).toBe(true);
    place(28, 'p1');
    expect(r.phase).toBe('between');
    expect(r.teams.find((t) => t.color === 'red')!.gameWins).toBe(1);
  });
});

describe('swapDeadCard', () => {
  it('swaps a card whose board cells are all taken, no turn advance', () => {
    let r = startGame(baseRoom(), 'p1');
    const target = 19;
    r.board = r.board.map((c) => (c.value === target ? { ...c, owner: 'blue' } : c));
    const card = { id: 'd', kind: 'number' as const, target, equation: '1+1', color: '#000' };
    r.hands['p1'] = [card, ...r.hands['p1'].slice(1)];
    const turnBefore = r.currentTurn;
    r = swapDeadCard(r, 'p1', 'd');
    expect(r.hands['p1'].find((c) => c.id === 'd')).toBeUndefined();
    expect(r.currentTurn).toBe(turnBefore);
  });
});

describe('multi-game flow', () => {
  it('nextGame resets sequences and seats winning team first', () => {
    const r = baseRoom();
    r.phase = 'between';
    r.teams[0].gameWins = 1;
    const started = nextGame(r, 'red');
    expect(started.phase).toBe('playing');
    expect(started.teams.every((t) => t.sequencesThisGame === 0)).toBe(true);
    const firstPlayer = started.turnOrder[started.currentTurn];
    expect(started.players.find((p) => p.id === firstPlayer)!.team).toBe('red');
  });
  it('declareLastGame sets the flag', () => {
    expect(declareLastGame(baseRoom()).isLastGame).toBe(true);
  });
  it('finalize picks the team with most wins', () => {
    const r = baseRoom();
    r.teams[1].gameWins = 3;
    r.teams[0].gameWins = 1;
    expect(finalize(r).winners).toBe('blue');
    expect(finalize(r).phase).toBe('final');
  });
});
