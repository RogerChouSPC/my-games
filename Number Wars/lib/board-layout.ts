import type { BoardSize, Cell } from '@/types/game';

const PALETTE = ['#c62828', '#7b1fa2', '#1976d2', '#388e3c', '#f57c00', '#00838f', '#00bcd4'];

export function colorFor(value: number | 'FREE'): string {
  if (value === 'FREE') return '#111111';
  return PALETTE[value % PALETTE.length];
}

// Logical layout, row-major, top-left = index 0. 0 means a FREE BASE corner.
// PERMANENT layouts (generated 2026-06-12): randomized once with the constraint
// that copies of the same number are at least 3 cells apart (Chebyshev distance),
// so a pair never sits in the same neighbourhood.
// 8x8: numbers 1..30 each appear exactly twice (60 cells) + 4 FREE BASE corners.
const LAYOUT_8: number[] = [
   0, 18, 28, 11, 10, 12, 22,  0,
  17, 16,  3, 29,  4,  5, 21, 24,
   2,  1, 27, 26, 24, 19, 23, 30,
  14, 21, 11,  2, 10, 15, 20, 25,
  13,  3, 17,  4, 25,  9, 18, 14,
  28,  9, 19, 26, 12, 16,  6, 23,
  22, 29, 30,  6,  1,  5, 20,  7,
   0, 13, 27,  8,  7, 15,  8,  0,
];

// 9x9: numbers 1..37 appear twice, 38 appears 3 times (77 cells) + 4 FREE BASE corners.
const LAYOUT_9: number[] = [
   0, 38, 11, 16, 21, 11, 24, 37,  0,
  13, 14, 20, 22, 18, 29,  8, 38,  9,
  23, 17, 29, 15,  7, 35, 36, 17,  1,
  22, 21, 26, 23, 10, 31, 30, 28, 34,
  27, 25, 32, 24, 33,  4,  6, 20, 27,
  19, 30,  5, 38,  2, 18, 15,  5, 37,
   2, 26, 28, 19, 16,  8,  7, 31,  9,
  12, 14,  3, 32, 33,  6, 36,  4,  3,
   0, 25, 10, 12, 13, 34, 35,  1,  0,
];

export function buildBoard(size: BoardSize): Cell[] {
  const layout = size === 8 ? LAYOUT_8 : LAYOUT_9;
  return layout.map((n, index) => {
    const value: number | 'FREE' = n === 0 ? 'FREE' : n;
    return {
      index,
      value,
      color: colorFor(value),
      owner: null,
      bumpy: false,
      inSequence: false,
    };
  });
}

export function sequenceLengthFor(size: BoardSize): number {
  return size === 8 ? 5 : 6;
}
