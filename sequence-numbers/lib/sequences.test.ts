import { describe, it, expect } from 'vitest';
import { linesThrough, countOwnedInLine, findCompletedSequences, findBumpyCells } from './sequences';

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
