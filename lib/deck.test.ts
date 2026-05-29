import { describe, it, expect } from 'vitest';
import { buildDeck, shuffle } from './deck';
import { buildBoard } from './board-layout';

describe('buildDeck 8x8', () => {
  const board = buildBoard(8);
  const deck = buildDeck(board, { plusCards: 2, minusCards: 2 });
  it('has one number card per board number-cell (60) plus specials', () => {
    expect(deck.filter((c) => c.kind === 'number')).toHaveLength(60);
    expect(deck.filter((c) => c.kind === 'plus')).toHaveLength(2);
    expect(deck.filter((c) => c.kind === 'minus')).toHaveLength(2);
  });
  it('number card color matches its target board color', () => {
    const c = deck.find((c) => c.kind === 'number' && c.target === 19)!;
    expect(c.color).toBe(board.find((b) => b.value === 19)!.color);
  });
  it('every number card has an equation, specials do not', () => {
    expect(deck.filter((c) => c.kind === 'number').every((c) => !!c.equation)).toBe(true);
    expect(deck.filter((c) => c.kind !== 'number').every((c) => c.equation === null)).toBe(true);
  });
});

describe('shuffle', () => {
  it('keeps the same elements', () => {
    const a = [1, 2, 3, 4, 5];
    const b = shuffle(a);
    expect(b.sort()).toEqual(a.sort());
  });
});
