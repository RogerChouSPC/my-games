import { describe, it, expect } from 'vitest';
import { colorFor, numberOutline, buildBoard } from './board-layout';

describe('colorFor (war range buckets)', () => {
  it('colors 1-10 green', () => {
    expect(colorFor(1)).toBe('#43a047');
    expect(colorFor(10)).toBe('#43a047');
  });
  it('colors 11-20 red', () => {
    expect(colorFor(11)).toBe('#e53935');
    expect(colorFor(20)).toBe('#e53935');
  });
  it('colors 21-30 yellow', () => {
    expect(colorFor(21)).toBe('#fdd835');
    expect(colorFor(30)).toBe('#fdd835');
  });
  it('colors 31-38 blue', () => {
    expect(colorFor(31)).toBe('#1e88e5');
    expect(colorFor(38)).toBe('#1e88e5');
  });
  it('gives FREE corners black', () => {
    expect(colorFor('FREE')).toBe('#111111');
  });
});

describe('numberOutline', () => {
  it('yellow numbers get a dark outline, all others light', () => {
    expect(numberOutline(colorFor(24))).toBe('dark');
    expect(numberOutline(colorFor(5))).toBe('light');
    expect(numberOutline(colorFor(15))).toBe('light');
    expect(numberOutline(colorFor(33))).toBe('light');
  });
});

describe('buildBoard 8x8', () => {
  const board = buildBoard(8);
  it('has 64 cells', () => expect(board).toHaveLength(64));
  it('has 4 FREE corners at the corners', () => {
    expect(board.filter((c) => c.value === 'FREE').map((c) => c.index).sort((a, b) => a - b)).toEqual([
      0, 7, 56, 63,
    ]);
  });
  it('each number 1..30 appears exactly twice', () => {
    for (let n = 1; n <= 30; n++) {
      expect(board.filter((c) => c.value === n)).toHaveLength(2);
    }
  });
  it('has no numbers above 30', () => {
    expect(board.filter((c) => typeof c.value === 'number' && (c.value as number) > 30)).toHaveLength(0);
  });
  it('cells start empty and flat', () => {
    expect(board.every((c) => c.owner === null && !c.bumpy && !c.inSequence)).toBe(true);
  });
});

describe('buildBoard 9x9', () => {
  const board = buildBoard(9);
  it('has 81 cells', () => expect(board).toHaveLength(81));
  it('has 4 FREE corners at the corners', () => {
    expect(board.filter((c) => c.value === 'FREE').map((c) => c.index).sort((a, b) => a - b)).toEqual([
      0, 8, 72, 80,
    ]);
  });
  it('38 appears 3 times, 1..37 appear twice', () => {
    expect(board.filter((c) => c.value === 38)).toHaveLength(3);
    for (let n = 1; n <= 37; n++) {
      expect(board.filter((c) => c.value === n)).toHaveLength(2);
    }
  });
});
