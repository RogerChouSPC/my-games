const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
];

function ownedBy(owners: (string | null)[], freeIdx: Set<number>, i: number, team: string): boolean {
  return owners[i] === team || freeIdx.has(i);
}

export function linesThrough(index: number, size: number, needLen: number): number[][] {
  const row = Math.floor(index / size);
  const col = index % size;
  const lines: number[][] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    for (let k = -(needLen - 1); k <= needLen - 1; k++) {
      const r = row + dr * k;
      const c = col + dc * k;
      if (r >= 0 && r < size && c >= 0 && c < size) line.push(r * size + c);
    }
    lines.push(line);
  }
  return lines;
}

// Every full line on the board (each row, column, and both diagonal families) once.
function allLines(size: number): number[][] {
  const lines: number[][] = [];
  for (let r = 0; r < size; r++) {
    const l: number[] = [];
    for (let c = 0; c < size; c++) l.push(r * size + c);
    lines.push(l);
  }
  for (let c = 0; c < size; c++) {
    const l: number[] = [];
    for (let r = 0; r < size; r++) l.push(r * size + c);
    lines.push(l);
  }
  // down-right diagonals (start on top row, then left column)
  for (let c = 0; c < size; c++) {
    const l: number[] = [];
    for (let r = 0, cc = c; r < size && cc < size; r++, cc++) l.push(r * size + cc);
    lines.push(l);
  }
  for (let r = 1; r < size; r++) {
    const l: number[] = [];
    for (let rr = r, c = 0; rr < size && c < size; rr++, c++) l.push(rr * size + c);
    lines.push(l);
  }
  // down-left diagonals (start on top row, then right column)
  for (let c = 0; c < size; c++) {
    const l: number[] = [];
    for (let r = 0, cc = c; r < size && cc >= 0; r++, cc--) l.push(r * size + cc);
    lines.push(l);
  }
  for (let r = 1; r < size; r++) {
    const l: number[] = [];
    for (let rr = r, c = size - 1; rr < size && c >= 0; rr++, c--) l.push(rr * size + c);
    lines.push(l);
  }
  return lines;
}

// Maximal consecutive owned (or FREE) runs of length >= needLen within one line.
function runsInLine(
  line: number[],
  owners: (string | null)[],
  freeIdx: Set<number>,
  team: string,
  needLen: number
): number[][] {
  const runs: number[][] = [];
  let cur: number[] = [];
  for (const i of line) {
    if (ownedBy(owners, freeIdx, i, team)) cur.push(i);
    else {
      if (cur.length >= needLen) runs.push(cur);
      cur = [];
    }
  }
  if (cur.length >= needLen) runs.push(cur);
  return runs;
}

export function countOwnedInLine(
  line: number[],
  owners: (string | null)[],
  freeIdx: Set<number>,
  team: string
): number {
  let best = 0;
  let run = 0;
  for (const i of line) {
    if (ownedBy(owners, freeIdx, i, team)) {
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

// Completed sequences for a team, each as a maximal qualifying run of cells.
export function findCompletedSequences(
  owners: (string | null)[],
  freeIdx: Set<number>,
  size: number,
  needLen: number,
  team: string
): number[][] {
  const runs: number[][] = [];
  for (const line of allLines(size)) {
    for (const run of runsInLine(line, owners, freeIdx, team, needLen)) runs.push(run);
  }
  return runs;
}

// Score: a full-length line (size in a row) counts as 2 sequences; any other qualifying run = 1.
export function countSequences(
  owners: (string | null)[],
  freeIdx: Set<number>,
  size: number,
  needLen: number,
  team: string
): number {
  let count = 0;
  for (const run of findCompletedSequences(owners, freeIdx, size, needLen, team)) {
    count += run.length >= size ? 2 : 1;
  }
  return count;
}

// All cells that belong to a completed sequence (for the gold glow + star).
export function sequenceCells(
  owners: (string | null)[],
  freeIdx: Set<number>,
  size: number,
  needLen: number,
  team: string
): Set<number> {
  const cells = new Set<number>();
  for (const run of findCompletedSequences(owners, freeIdx, size, needLen, team)) {
    run.forEach((i) => cells.add(i));
  }
  return cells;
}

// Cells one move away from a needLen sequence (the bumpy "warning" side).
export function findBumpyCells(
  owners: (string | null)[],
  freeIdx: Set<number>,
  size: number,
  needLen: number,
  team: string
): Set<number> {
  const bumpy = new Set<number>();
  for (let start = 0; start < size * size; start++) {
    const row = Math.floor(start / size);
    const col = start % size;
    for (const [dr, dc] of DIRS) {
      const seg: number[] = [];
      for (let k = 0; k < needLen; k++) {
        const r = row + dr * k;
        const c = col + dc * k;
        if (r < 0 || r >= size || c < 0 || c >= size) {
          seg.length = 0;
          break;
        }
        seg.push(r * size + c);
      }
      if (seg.length !== needLen) continue;
      const owned = seg.filter((i) => ownedBy(owners, freeIdx, i, team));
      const empty = seg.filter((i) => owners[i] === null && !freeIdx.has(i));
      if (owned.length === needLen - 1 && empty.length === 1) {
        owned.forEach((i) => {
          if (!freeIdx.has(i)) bumpy.add(i);
        });
      }
    }
  }
  return bumpy;
}
