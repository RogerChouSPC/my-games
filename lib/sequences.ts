const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
];

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

function ownedBy(owners: (string | null)[], freeIdx: Set<number>, i: number, team: string): boolean {
  return owners[i] === team || freeIdx.has(i);
}

// Longest run of team-owned (or FREE) cells in a line.
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
    } else {
      run = 0;
    }
  }
  return best;
}

// All completed sequences (each as a list of cell indices) for a team.
export function findCompletedSequences(
  owners: (string | null)[],
  freeIdx: Set<number>,
  size: number,
  needLen: number,
  team: string
): number[][] {
  const found: number[][] = [];
  const seen = new Set<string>();
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
      if (seg.length === needLen && seg.every((i) => ownedBy(owners, freeIdx, i, team))) {
        const key = seg.join(',');
        if (!seen.has(key)) {
          seen.add(key);
          found.push([...seg]);
        }
      }
    }
  }
  return found;
}

// Cells that sit in a window of needLen where the team owns exactly needLen-1
// and the remaining single cell is empty → one move from a sequence (bumpy side).
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
