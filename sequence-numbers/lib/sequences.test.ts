import { describe, it, expect } from 'vitest';
import {
  linesThrough,
  countOwnedInLine,
  findCompletedSequences,
  findBumpyCells,
  countSequences,
} from './sequences';

function grid(size: number): (string | null)[] {
  return new Array(size * size).fill(null);
}

describe('linesThrough', () => {
  it('returns 4 directions for a cell', () => {
    expect(linesThrough(27, 8, 5)).toHaveLength(4);
  });
});

describe('countOwnedInLine', () => {
  it('counts the longest consecutive owned run', () => {
    const owners = grid(8);
    [24, 25, 26].forEach((i) => (owners[i] = 'red'));
    const line = [24, 25, 26, 27, 28];
    expect(countOwnedInLine(line, owners, new Set(), 'red')).toBe(3);
  });
});

describe('findCompletedSequences', () => {
  it('detects a horizontal 5-in-a-row', () => {
    const owners = grid(8);
    [24, 25, 26, 27, 28].forEach((i) => (owners[i] = 'red'));
    const seqs = findCompletedSequences(owners, new Set(), 8, 5, 'red');
    expect(seqs.length).toBeGreaterThanOrEqual(1);
    expect(seqs[0]).toEqual(expect.arrayContaining([24, 25, 26, 27, 28]));
  });
  it('treats FREE corner as part of a line', () => {
    const owners = grid(8);
    [57, 58, 59, 60].forEach((i) => (owners[i] = 'red'));
    const freeIdx = new Set<number>([56, 63]);
    const seqs = findCompletedSequences(owners, freeIdx, 8, 5, 'red');
    expect(seqs.length).toBeGreaterThanOrEqual(1);
  });
  it('does not detect a sequence for the wrong team', () => {
    const owners = grid(8);
    [24, 25, 26, 27, 28].forEach((i) => (owners[i] = 'red'));
    expect(findCompletedSequences(owners, new Set(), 8, 5, 'blue')).toHaveLength(0);
  });
});

describe('findBumpyCells', () => {
  it('flags cells one short of a sequence', () => {
    const owners = grid(8);
    [24, 25, 26, 27].forEach((i) => (owners[i] = 'red'));
    const bumpy = findBumpyCells(owners, new Set(), 8, 5, 'red');
    [24, 25, 26, 27].forEach((i) => expect(bumpy.has(i)).toBe(true));
  });
  it('does not flag when only 3 in a row', () => {
    const owners = grid(8);
    [24, 25, 26].forEach((i) => (owners[i] = 'red'));
    expect(findBumpyCells(owners, new Set(), 8, 5, 'red').size).toBe(0);
  });
  it('flags when 3 chips plus a FREE corner make 4', () => {
    const owners = grid(8);
    // bottom row: 56 FREE, then 57,58,59 red, 60 empty -> 4 (incl FREE) in window 56..60
    [57, 58, 59].forEach((i) => (owners[i] = 'red'));
    const bumpy = findBumpyCells(owners, new Set([56, 63]), 8, 5, 'red');
    [57, 58, 59].forEach((i) => expect(bumpy.has(i)).toBe(true));
  });
});

describe('countSequences', () => {
  it('counts an exact 5-in-a-row as 1', () => {
    const owners = grid(8);
    [24, 25, 26, 27, 28].forEach((i) => (owners[i] = 'red'));
    expect(countSequences(owners, new Set(), 8, 5, 'red')).toBe(1);
  });
  it('counts a 6- or 7-in-a-row as 1 (not overlapping windows)', () => {
    const owners = grid(8);
    [24, 25, 26, 27, 28, 29].forEach((i) => (owners[i] = 'red'));
    expect(countSequences(owners, new Set(), 8, 5, 'red')).toBe(1);
  });
  it('counts a full 8-long line as 2 sequences', () => {
    const owners = grid(8);
    // full row 3: indices 24..31
    for (let i = 24; i <= 31; i++) owners[i] = 'red';
    expect(countSequences(owners, new Set(), 8, 5, 'red')).toBe(2);
  });
  it('counts a full row that uses two FREE corners as 2', () => {
    const owners = grid(8);
    // top row 0..7 with corners 0 & 7 FREE, middle 1..6 owned -> full line of 8
    for (let i = 1; i <= 6; i++) owners[i] = 'red';
    expect(countSequences(owners, new Set([0, 7]), 8, 5, 'red')).toBe(2);
  });
  it('9x9: a full 9-long line counts as 2', () => {
    const owners = grid(9);
    for (let i = 9; i <= 17; i++) owners[i] = 'blue'; // row 1, full width
    expect(countSequences(owners, new Set(), 9, 6, 'blue')).toBe(2);
  });
});

// Reproductions of Roger's reported board states (bottom-corner red row; vertical blue column).
describe('reported board scenarios', () => {
  it('8x8: 4 reds next to the bottom-right FREE corner already make a sequence', () => {
    const owners = grid(8);
    [59, 60, 61, 62].forEach((i) => (owners[i] = 'red')); // row 7, cols 3-6
    const free = new Set([56, 63]);
    // window [59,60,61,62,63(FREE)] = 4 red + free = 5 -> a completed sequence
    expect(findCompletedSequences(owners, free, 8, 5, 'red').length).toBeGreaterThanOrEqual(1);
  });
  it('8x8: 3 reds + empty + bottom-right FREE corner shows bumpy', () => {
    const owners = grid(8);
    [60, 61, 62].forEach((i) => (owners[i] = 'red')); // 59 empty, 63 FREE
    const bumpy = findBumpyCells(owners, new Set([56, 63]), 8, 5, 'red');
    [60, 61, 62].forEach((i) => expect(bumpy.has(i)).toBe(true));
  });
  it('9x9: a vertical 6-in-a-row (column 3, rows 3..8) is a sequence, not bumpy', () => {
    const owners = grid(9);
    [30, 39, 48, 57, 66, 75].forEach((i) => (owners[i] = 'blue')); // col 3, rows 3..8
    const seqs = findCompletedSequences(owners, new Set(), 9, 6, 'blue');
    // all 6 cells belong to one detected run, so the real recompute marks them
    // inSequence (gold) and suppresses bumpy on them.
    expect(seqs.some((run) => [30, 39, 48, 57, 66, 75].every((i) => run.includes(i)))).toBe(true);
  });
  it('9x9: a vertical 5 + empty (column 3, rows 3..7) is only bumpy', () => {
    const owners = grid(9);
    [30, 39, 48, 57, 66].forEach((i) => (owners[i] = 'blue')); // 75 empty
    expect(findCompletedSequences(owners, new Set(), 9, 6, 'blue')).toHaveLength(0);
    expect([30, 39, 48, 57, 66].every((i) => findBumpyCells(owners, new Set(), 9, 6, 'blue').has(i))).toBe(true);
  });
});
