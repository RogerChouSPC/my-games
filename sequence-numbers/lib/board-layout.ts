import type { BoardSize, Cell } from '@/types/game';

const PALETTE = ['#c62828', '#7b1fa2', '#1976d2', '#388e3c', '#f57c00', '#00838f', '#00bcd4'];

export function colorFor(value: number | 'FREE'): string {
  if (value === 'FREE') return '#111111';
  return PALETTE[value % PALETTE.length];
}

// Logical layout, row-major, top-left = index 0. 0 means FREE corner.
// 8x8: numbers 1..30 each appear exactly twice (60 cells) + 4 FREE corners.
const LAYOUT_8: number[] = [
   0,  4, 14, 27,  2, 16,  5,  0,
  10, 13,  9, 21,  1, 19, 23, 24,
  17,  6, 18,  8,  3, 29, 22, 28,
  30, 25, 26, 20, 15, 11, 12,  7,
  20, 18, 22, 19,  6,  5, 27, 10,
  16, 24, 17,  1, 14, 11, 29, 25,
  15,  2, 13, 21, 12,  4, 26,  8,
   0,  7,  3, 23, 30, 28,  9,  0,
];

// 9x9: numbers 1..37 appear twice, 38 appears 3 times (77 cells) + 4 FREE corners.
const LAYOUT_9: number[] = [
   0,  4, 14, 27,  2, 16,  5, 32,  0,
  10, 13,  9, 21,  1, 19, 23, 24, 36,
  17,  6, 18,  8,  3, 29, 22, 28, 33,
  30, 25, 26, 20, 15, 11, 12,  7, 37,
  31, 36, 34, 38, 38, 38, 34, 32, 31,
  20, 18, 22, 19,  6,  5, 27, 10, 37,
  16, 24, 17,  1, 14, 11, 29, 25, 33,
  15,  2, 13, 21, 12,  4, 26,  8, 35,
   0,  7,  3, 23, 30, 28,  9, 35,  0,
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
