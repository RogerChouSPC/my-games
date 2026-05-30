import { describe, it, expect } from 'vitest';
import {
  startGame,
  playNumberCard,
  playPlusCard,
  playMinusCard,
  swapDeadCard,
  discardCard,
  freezeCard,
  stealCard,
  shieldCard,
  rerollCard,
  bombCard,
  hasAnyLegalMove,
  nextGame,
  nextRound,
  declareLastGame,
  finalize,
} from './game-engine';
import type { RoomState, ServerRoom } from '@/types/game';

function baseRoom(): RoomState {
  return {
    code: 'TEST',
    phase: 'lobby',
    settings: {
      mode: 'teams',
      boardSize: 8,
      teamCount: 2,
      sequencesToWin: 2,
      cardsPerPlayer: 3,
      plusCards: 2,
      minusCards: 2,
      freezeCards: 0,
      stealCards: 0,
      shieldCards: 0,
      bombCards: 0,
      rerollCards: 0,
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
    roundWinner: null,
    roundWinnerGif: null,
    roundTie: false,
    superCount: 0,
    frozenPlayerIds: [],
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
  it('cannot remove a chip that is part of a completed sequence', () => {
    let r = startGame(baseRoom(), 'p1');
    r.board = r.board.map((c) => ({ ...c, owner: null, bumpy: false, inSequence: false }));
    r.settings = { ...r.settings, sequencesToWin: 2 }; // one sequence shouldn't end the game
    // red (p1) builds a 5-in-a-row completed sequence across cells 24..28
    const place = (idx: number) => {
      const cell = r.board[idx];
      const card = { id: 'c' + idx, kind: 'number' as const, target: cell.value as number, equation: '1+1', color: '#000' };
      r.hands['p1'] = [card, ...(r.hands['p1'] ?? [])];
      r.currentTurn = r.turnOrder.indexOf('p1');
      r = playNumberCard(r, 'p1', 'c' + idx, idx);
    };
    [24, 25, 26, 27, 28].forEach(place);
    expect([24, 25, 26, 27, 28].every((i) => r.board[i].inSequence)).toBe(true);
    // blue (p2) tries to minus a chip inside red's completed sequence — must be refused
    const minus = { id: 'm', kind: 'minus' as const, target: null, equation: null, color: null };
    r.hands['p2'] = [minus, ...(r.hands['p2'] ?? [])];
    r.currentTurn = r.turnOrder.indexOf('p2');
    r = playMinusCard(r, 'p2', 'm', 26);
    expect(r.board[26].owner).toBe('red'); // locked — still red
  });
});

describe('freezeCard', () => {
  const freeze = () => ({ id: 'f', kind: 'freeze' as const, target: null, equation: null, color: null });

  it("skips the frozen opponent's next turn, then thaws them", () => {
    let r = startGame(baseRoom(), 'p1');
    r.turnOrder = ['p1', 'p2'];
    r.currentTurn = 0;
    r.hands['p1'] = [freeze()];
    r = freezeCard(r, 'p1', 'f', 'p2');
    // p1 spent their turn; p2 is frozen so their turn is skipped → back to p1, p2 thawed.
    expect(r.turnOrder[r.currentTurn]).toBe('p1');
    expect(r.frozenPlayerIds).not.toContain('p2');
    expect(r.hands['p1'].find((c) => c.id === 'f')).toBeUndefined();
  });

  it('cannot freeze a teammate (and does not consume the card)', () => {
    let r = startGame(baseRoom(), 'p1');
    r.players = r.players.map((p) => ({ ...p, team: 'red' })); // both on red
    r.turnOrder = ['p1', 'p2'];
    r.currentTurn = 0;
    r.hands['p1'] = [freeze()];
    r = freezeCard(r, 'p1', 'f', 'p2');
    expect(r.frozenPlayerIds).toEqual([]);
    expect(r.hands['p1'].find((c) => c.id === 'f')).toBeDefined();
  });

  it('cannot freeze a player who is already frozen', () => {
    let r = startGame(baseRoom(), 'p1');
    r.turnOrder = ['p1', 'p2'];
    r.currentTurn = 0;
    r.frozenPlayerIds = ['p2'];
    r.hands['p1'] = [freeze()];
    r = freezeCard(r, 'p1', 'f', 'p2');
    expect(r.hands['p1'].find((c) => c.id === 'f')).toBeDefined(); // refused, card kept
  });
});

describe('stealCard', () => {
  const steal = () => ({ id: 's', kind: 'steal' as const, target: null, equation: null, color: null });
  it('flips an opponent chip (not in a sequence) to your colour', () => {
    let r = startGame(baseRoom(), 'p1'); // p1 is red
    r.turnOrder = ['p1', 'p2'];
    r.currentTurn = 0;
    const idx = r.board.findIndex((c) => c.value !== 'FREE');
    r.board[idx].owner = 'blue';
    r.hands['p1'] = [steal()];
    r = stealCard(r, 'p1', 's', idx);
    expect(r.board[idx].owner).toBe('red');
  });
  it('cannot steal a shielded chip', () => {
    let r = startGame(baseRoom(), 'p1');
    r.turnOrder = ['p1', 'p2'];
    r.currentTurn = 0;
    const idx = r.board.findIndex((c) => c.value !== 'FREE');
    r.board[idx].owner = 'blue';
    r.board[idx].shielded = true;
    r.hands['p1'] = [steal()];
    r = stealCard(r, 'p1', 's', idx);
    expect(r.board[idx].owner).toBe('blue'); // protected
  });
});

describe('shieldCard', () => {
  const shield = () => ({ id: 'sh', kind: 'shield' as const, target: null, equation: null, color: null });
  it('shields your own chip so Minus cannot remove it', () => {
    let r = startGame(baseRoom(), 'p1');
    r.turnOrder = ['p1', 'p2'];
    r.currentTurn = 0;
    const idx = r.board.findIndex((c) => c.value !== 'FREE');
    r.board[idx].owner = 'red'; // p1's own chip
    r.hands['p1'] = [shield()];
    r = shieldCard(r, 'p1', 'sh', idx);
    expect(r.board[idx].shielded).toBe(true);
    // p2 (blue) now tries to remove it — must be blocked by the shield
    r.currentTurn = r.turnOrder.indexOf('p2');
    r.hands['p2'] = [{ id: 'm', kind: 'minus', target: null, equation: null, color: null }];
    r = playMinusCard(r, 'p2', 'm', idx);
    expect(r.board[idx].owner).toBe('red');
  });
});

describe('rerollCard', () => {
  const reroll = () => ({ id: 'rr', kind: 'reroll' as const, target: null, equation: null, color: null });
  const num = (id: string, target: number) => ({ id, kind: 'number' as const, target, equation: `${target}+0`, color: '#000' });

  it('swaps the reroll card and one chosen card for two fresh ones; keeps the rest; passes the turn', () => {
    let r = startGame(baseRoom(), 'p1');
    r.turnOrder = ['p1', 'p2'];
    r.currentTurn = 0;
    r.hands['p1'] = [reroll(), num('n1', 5), num('n2', 9)];
    const size = r.hands['p1'].length; // 3
    r = rerollCard(r, 'p1', 'rr', 'n1');
    expect(r.hands['p1'].find((c) => c.id === 'rr')).toBeUndefined(); // reroll consumed
    expect(r.hands['p1'].find((c) => c.id === 'n2')).toBeDefined(); // untouched card stays
    expect(r.hands['p1'].length).toBe(size); // removed 2, drew 2 → same size
    expect(r.turnOrder[r.currentTurn]).toBe('p2');
  });

  it('returns the chosen card to the deck (so the board stays fillable)', () => {
    let r = startGame(baseRoom(), 'p1');
    r.turnOrder = ['p1', 'p2'];
    r.currentTurn = 0;
    const deckBefore = r._deck.length;
    r.hands['p1'] = [reroll(), num('n1', 5), num('n2', 9)];
    r = rerollCard(r, 'p1', 'rr', 'n1');
    // deck gained the chosen card (n1) then 2 were drawn → net deck change is -1 (reroll spent)
    expect(r._deck.length).toBe(deckBefore - 1);
  });
});

describe('bombCard', () => {
  const bomb = () => ({ id: 'b', kind: 'bomb' as const, target: null, equation: null, color: null });
  it('clears every chip in the 2x2 — including shielded and in-sequence chips', () => {
    let r = startGame(baseRoom(), 'p1');
    r.turnOrder = ['p1', 'p2'];
    r.currentTurn = 0;
    r.board = r.board.map((c) => ({ ...c, owner: null, inSequence: false, shielded: false }));
    const size = r.settings.boardSize; // 8
    const anchor = 9; // row1,col1 → 2x2 of 9,10,17,18
    const cells = [anchor, anchor + 1, anchor + size, anchor + size + 1];
    cells.forEach((i, k) => (r.board[i].owner = k % 2 ? 'red' : 'blue'));
    r.board[anchor].shielded = true;
    r.board[anchor + 1].inSequence = true;
    r.hands['p1'] = [bomb()];
    r = bombCard(r, 'p1', 'b', anchor);
    cells.forEach((i) => expect(r.board[i].owner).toBe(null));
    expect(r.board[anchor].shielded).toBe(false);
  });
  it('clamps the 2x2 to stay on the board at an edge anchor', () => {
    let r = startGame(baseRoom(), 'p1');
    r.turnOrder = ['p1', 'p2'];
    r.currentTurn = 0;
    r.board = r.board.map((c) => ({ ...c, owner: null }));
    r.board[15].owner = 'blue'; // row1,col7 (last column)
    r.hands['p1'] = [bomb()];
    r = bombCard(r, 'p1', 'b', 15);
    expect(r.board[15].owner).toBe(null); // clamped 2x2 still covers it
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
    // Win freezes the board (phase stays 'playing') with roundWinner set, awaiting the host.
    expect(r.phase).toBe('playing');
    expect(r.roundWinner).toBe('red');
    expect(r.teams.find((t) => t.color === 'red')!.gameWins).toBe(1);
    expect([24, 25, 26, 27, 28].every((i) => r.board[i].inSequence)).toBe(true);
  });

  it('nextRound moves a frozen win to the score screen (or final on last game)', () => {
    let r = startGame(baseRoom(), 'p1');
    r = { ...r, roundWinner: 'red' };
    const after = nextRound(r);
    expect(after.phase).toBe('between');
    expect(after.roundWinner).toBe(null);

    const lastGame = nextRound({ ...r, isLastGame: true, roundWinner: 'red' });
    expect(lastGame.phase).toBe('final');
    expect(lastGame.winners).toBe('red');
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

describe('discard + tie', () => {
  it('hasAnyLegalMove is false when all number cards are dead and no specials', () => {
    let r = startGame(baseRoom(), 'p1');
    // Fill every non-FREE cell so no placement is possible.
    r.board = r.board.map((c) => (c.value === 'FREE' ? c : { ...c, owner: 'blue' }));
    r.hands['p1'] = [
      { id: 'n1', kind: 'number', target: 5, equation: '5 + 0', color: '#000' },
      { id: 'n2', kind: 'number', target: 9, equation: '9 + 0', color: '#000' },
    ];
    expect(hasAnyLegalMove(r, 'p1')).toBe(false);
  });

  it('discardCard removes a card, draws a replacement, and passes the turn when stuck', () => {
    let r = startGame(baseRoom(), 'p1');
    r.board = r.board.map((c) => (c.value === 'FREE' ? c : { ...c, owner: 'blue' }));
    r.hands['p1'] = [{ id: 'n1', kind: 'number', target: 5, equation: '5 + 0', color: '#000' }];
    const deckBefore = r._deck.length;
    r = discardCard(r, 'p1', 'n1');
    expect(r.hands['p1'].find((c) => c.id === 'n1')).toBeUndefined();
    // drew one replacement (deck shrinks) and turn advanced to p2
    expect(r._deck.length).toBe(deckBefore - 1);
    expect(r.turnOrder[r.currentTurn]).toBe('p2');
  });

  it('ends in a tie (no points) when the board is full with no winner', () => {
    let r = startGame(baseRoom(), 'p1');
    r.settings = { ...r.settings, sequencesToWin: 99 }; // unreachable, so no win
    // Leave exactly one empty cell, give p1 the matching card, then play it to fill the board.
    const target = 5;
    const lastIdx = r.board.findIndex((c) => c.value === target);
    r.board = r.board.map((c, i) =>
      c.value === 'FREE' || i === lastIdx ? c : { ...c, owner: 'blue' }
    );
    r.board[lastIdx] = { ...r.board[lastIdx], owner: null };
    r.hands['p1'] = [{ id: 'x', kind: 'number', target, equation: '5 + 0', color: '#000' }];
    r.currentTurn = r.turnOrder.indexOf('p1');
    r = playNumberCard(r, 'p1', 'x', lastIdx);
    expect(r.roundTie).toBe(true);
    expect(r.roundWinner).toBe(null);
    expect(r.teams.every((t) => t.gameWins === 0)).toBe(true);
  });
});
