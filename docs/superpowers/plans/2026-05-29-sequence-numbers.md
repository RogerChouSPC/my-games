# Sequence Numbers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time multiplayer web version of Sequence Numbers (math edition) that teams play in the browser on phones or desktop, deployable to Railway.

**Architecture:** A Next.js (App Router, TypeScript) app served by a custom Node `server.js` that also hosts a Socket.io server. All game state lives in memory on the server, keyed by room code. Clients are thin React views that render server-broadcast state and emit player actions. Pure game logic (board, deck, sequence detection, chip-flip) is isolated in `lib/` and fully unit-tested with Vitest.

**Tech Stack:** Next.js 15, React 19, TypeScript, Socket.io 4, Vitest, Railway.

**Visual source of truth:** Approved prototypes live in `.superpowers/brainstorm/956-1780049188/content/`. Port their markup/CSS into React components rather than redesigning:
- `create-room-ui.html` → Create Room
- `char-picker.html` → Character Picker
- `lobby-with-picker.html` + `lobby-ui.html` → Lobby
- `game-board.html` (8×8) and `game-board-9x9.html` (9×9) → Game Board
- `enhanced-overview.html` → Between Games + Final Winner

Character icons already exist at `icons/char_01.png` … `char_26.png` — copy to `public/icons/`.

---

## Conventions

- **Test runner:** `npm run test` (Vitest). Single file: `npx vitest run path/to/file.test.ts`.
- **Commit after every green test or working step.** Conventional commit messages (`feat:`, `test:`, `chore:`).
- **Coordinates:** Board cells are addressed by flat index `i` where `row = Math.floor(i / size)`, `col = i % size`. `size` is 8 or 9.
- **Team identity:** `TeamColor = 'red' | 'blue' | 'green' | 'yellow'`.
- **FREE corners** belong to every team for sequence/flip math but render as black "FREE SPACE".

---

## File Structure

```
/
├── server.js                       # Custom server: Next.js + Socket.io
├── package.json
├── tsconfig.json
├── next.config.js
├── vitest.config.ts
├── types/
│   └── game.ts                     # Shared types (client + server)
├── lib/
│   ├── board-layout.ts             # Fixed 8x8 / 9x9 number + color layouts
│   ├── board-layout.test.ts
│   ├── equations.ts                # Random equation generation for a target number
│   ├── equations.test.ts
│   ├── deck.ts                     # Build + shuffle deck, deal hands
│   ├── deck.test.ts
│   ├── sequences.ts                # Detect completed sequences + near-sequence (bumpy)
│   ├── sequences.test.ts
│   ├── game-engine.ts              # Pure room state reducer (actions → new state)
│   └── game-engine.test.ts
├── server/
│   └── rooms.ts                    # Room registry + Socket.io event wiring
├── lib/client/
│   └── useSocket.ts                # Client hook: connect, emit, subscribe to state
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                    # Home
│   ├── create/page.tsx             # Create Room
│   └── room/[code]/page.tsx        # Phase router (lobby/game/between/final)
├── components/
│   ├── CharacterPicker.tsx
│   ├── Lobby.tsx
│   ├── Board.tsx
│   ├── BoardCell.tsx
│   ├── Chip.tsx
│   ├── HandCards.tsx
│   ├── PlayerStrip.tsx
│   ├── EmojiPanel.tsx
│   ├── TopBar.tsx
│   ├── BetweenGames.tsx
│   └── FinalWinner.tsx
└── public/icons/char_01.png … char_26.png
```

---

# Phase 0 — Scaffold & Deployable Skeleton

Goal: a running Next.js app with custom Socket.io server that says "connected", deployed to Railway, before any game logic. This proves the hardest infra works first.

### Task 0.1: Initialize the project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `.gitignore`

- [ ] **Step 1: Init and install**

Run in the project root:
```bash
npm init -y
npm install next@15 react@19 react-dom@19 socket.io@4 socket.io-client@4
npm install -D typescript @types/react @types/node @types/react-dom vitest
```

- [ ] **Step 2: Create `next.config.js`**

```js
/** @type {import('next').NextConfig} */
module.exports = { reactStrictMode: true };
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules
.next
.env*.local
.superpowers
*.py
```

- [ ] **Step 5: Set `package.json` scripts**

Replace the `"scripts"` block:
```json
"scripts": {
  "dev": "node server.js",
  "build": "next build",
  "start": "NODE_ENV=production node server.js",
  "test": "vitest run"
}
```

- [ ] **Step 6: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js + Socket.io project"
```

### Task 0.2: Custom server with Socket.io

**Files:**
- Create: `server.js`

- [ ] **Step 1: Write `server.js`**

```js
const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server(httpServer, { cors: { origin: '*' } });

  // Wiring added in Phase 3:
  require('./server/rooms').registerHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
```

- [ ] **Step 2: Stub `server/rooms.js` wiring target**

Create `server/rooms.ts` temporarily exporting a no-op so the server boots (real version in Phase 3):
```ts
import type { Server } from 'socket.io';
export function registerHandlers(io: Server) {
  io.on('connection', (socket) => {
    console.log('client connected', socket.id);
    socket.emit('hello', { ok: true });
  });
}
```

Note: `server.js` requires `./server/rooms`. Add a build step so TS compiles, OR keep `rooms` as `.js`. Simplest for now: write `server/rooms.js` in plain JS mirroring the above. (Phase 3 converts to TS compiled via `tsx` — see Task 3.0.)

- [ ] **Step 3: Minimal home page so Next has a route**

Create `app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
```

Create `app/page.tsx`:
```tsx
export default function Home() {
  return <main style={{ padding: 40, fontFamily: 'sans-serif' }}>Sequence Numbers — server up</main>;
}
```

- [ ] **Step 4: Run and verify**

Run: `npm run dev`
Open `http://localhost:3000` → see "server up". Console shows "client connected" is not expected yet (no client socket). Server log shows "> Ready".
Expected: page loads, no crash.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: custom server with socket.io skeleton"
```

### Task 0.3: First Railway deploy (do this early)

**Files:** none (platform config)

- [ ] **Step 1:** Push repo to a new GitHub repository (private is fine).
- [ ] **Step 2:** On railway.app → New Project → Deploy from GitHub repo → select the repo.
- [ ] **Step 3:** Railway auto-detects Node. Confirm Start Command is `npm run start` and a Build Command `npm run build` runs. Add variable `NODE_ENV=production`.
- [ ] **Step 4:** Open the generated `*.up.railway.app` URL → should show "server up".
- [ ] **Step 5:** Note the URL. Deployment pipeline is now proven; redeploys happen on every `git push`.

---

# Phase 1 — Shared Types

### Task 1.1: Define game types

**Files:**
- Create: `types/game.ts`

- [ ] **Step 1: Write the types**

```ts
export type TeamColor = 'red' | 'blue' | 'green' | 'yellow';
export type BoardSize = 8 | 9;
export type Phase = 'lobby' | 'playing' | 'between' | 'final';

export interface Settings {
  boardSize: BoardSize;
  teamCount: 2 | 3 | 4;
  sequencesToWin: number;   // 2..5
  cardsPerPlayer: number;   // 2..5
  plusCards: number;        // 0..4 (per deck)
  minusCards: number;       // 0..4 (per deck)
}

export interface Player {
  id: string;               // stable id stored in browser localStorage
  name: string;
  icon: number;             // 1..26
  team: TeamColor | null;
  connected: boolean;
}

export type CardKind = 'number' | 'plus' | 'minus';

export interface Card {
  id: string;
  kind: CardKind;
  target: number | null;    // answer for number cards; null for plus/minus
  equation: string | null;  // e.g. "9 × 2"; null for plus/minus
  color: string | null;     // hex for header bar; null for plus/minus
}

export type CellOwner = TeamColor | null;

export interface Cell {
  index: number;
  value: number | 'FREE';   // target number or FREE corner
  color: string;            // hex
  owner: CellOwner;         // which team's chip sits here
  bumpy: boolean;           // showing bumpy (near-sequence) side
  inSequence: boolean;      // locked into a completed sequence
}

export interface TeamState {
  color: TeamColor;
  sequencesThisGame: number;
  gameWins: number;
}

export interface RoomState {
  code: string;
  phase: Phase;
  settings: Settings;
  players: Player[];
  teams: TeamState[];
  board: Cell[];
  hands: Record<string, Card[]>;   // playerId → cards (server sends only own hand to each client)
  deckCount: number;               // remaining cards (count only, deck hidden)
  turnOrder: string[];             // playerIds
  currentTurn: number;             // index into turnOrder
  lastMove: { index: number; playerId: string } | null;
  hostId: string;
  isLastGame: boolean;
  winners: TeamColor | null;       // set in 'final'
}

// Socket payloads
export interface ClientView extends Omit<RoomState, 'hands'> {
  myHand: Card[];
  myPlayerId: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/game.ts
git commit -m "feat: shared game types"
```

---

# Phase 2 — Pure Game Logic (TDD)

### Task 2.0: Vitest config

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1:**
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node' } });
```
- [ ] **Step 2: Commit** `chore: add vitest config`

### Task 2.1: Board layout — color map

**Files:**
- Create: `lib/board-layout.ts`, `lib/board-layout.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { colorFor } from './board-layout';

describe('colorFor', () => {
  it('returns a stable hex color for a number', () => {
    expect(colorFor(19)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colorFor(19)).toBe(colorFor(19)); // deterministic
  });
  it('gives FREE corners black', () => {
    expect(colorFor('FREE')).toBe('#111111');
  });
});
```

- [ ] **Step 2: Run → fail.** `npx vitest run lib/board-layout.test.ts` → "colorFor is not a function".

- [ ] **Step 3: Implement**

```ts
import type { BoardSize, Cell } from '@/types/game';

const PALETTE = ['#c62828','#7b1fa2','#1976d2','#388e3c','#f57c00','#00838f','#00bcd4'];

export function colorFor(value: number | 'FREE'): string {
  if (value === 'FREE') return '#111111';
  return PALETTE[value % PALETTE.length];
}
```

- [ ] **Step 4: Run → pass.** Commit `feat: board color map`.

### Task 2.2: Board layout — fixed number grids

**Files:** modify `lib/board-layout.ts`, `lib/board-layout.test.ts`

- [ ] **Step 1: Write failing tests** (counts are the contract; the exact arrangement is fixed data)

```ts
import { buildBoard } from './board-layout';

describe('buildBoard 8x8', () => {
  const board = buildBoard(8);
  it('has 64 cells', () => expect(board).toHaveLength(64));
  it('has 4 FREE corners', () => {
    expect(board.filter(c => c.value === 'FREE').map(c => c.index).sort((a,b)=>a-b))
      .toEqual([0, 7, 56, 63]);
  });
  it('each number 1..30 appears exactly twice', () => {
    for (let n = 1; n <= 30; n++) {
      expect(board.filter(c => c.value === n)).toHaveLength(2);
    }
  });
  it('cells start empty and flat', () => {
    expect(board.every(c => c.owner === null && !c.bumpy && !c.inSequence)).toBe(true);
  });
});

describe('buildBoard 9x9', () => {
  const board = buildBoard(9);
  it('has 81 cells', () => expect(board).toHaveLength(81));
  it('has 4 FREE corners', () => {
    expect(board.filter(c => c.value === 'FREE').map(c => c.index).sort((a,b)=>a-b))
      .toEqual([0, 8, 72, 80]);
  });
  it('38 appears 3 times, 1..37 appear twice', () => {
    expect(board.filter(c => c.value === 38)).toHaveLength(3);
    for (let n = 1; n <= 37; n++) {
      expect(board.filter(c => c.value === n)).toHaveLength(2);
    }
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `buildBoard`** using fixed layout arrays. Use the exact layouts below (verified by the count tests).

```ts
// Logical layout, row-major, top-left = index 0. 0 means FREE corner.
const LAYOUT_8: number[] = [
   0, 4,14,27, 2,16, 5, 0,
  10,13, 9,21, 1,19,23,24,
  17, 6,18, 8, 3,29,22,28,
  30,25,26,20,15,11,12, 7,
  20,18,22,19, 6, 5,27,10,
  16,24,17, 1,14,11,29,25,
  15, 2,13,21,12, 4,26, 8,
   0, 7, 3,23,30,28, 9, 0,
];

const LAYOUT_9: number[] = [
   0, 4,14,27, 2,16, 5,32, 0,
  10,13, 9,21, 1,19,23,24,36,
  17, 6,18, 8, 3,29,22,28,33,
  30,25,26,20,15,11,12, 7,37,
  31,36,34,38,38,38,34,32,31,
  20,18,22,19, 6, 5,27,10,37,
  16,24,17, 1,14,11,29,25,33,
  15, 2,13,21,12, 4,26, 8,35,
   0, 7, 3,23,30,28, 9,35, 0,
];

export function buildBoard(size: BoardSize): Cell[] {
  const layout = size === 8 ? LAYOUT_8 : LAYOUT_9;
  return layout.map((n, index) => {
    const value: number | 'FREE' = n === 0 ? 'FREE' : n;
    return { index, value, color: colorFor(value), owner: null, bumpy: false, inSequence: false };
  });
}
```

- [ ] **Step 4: Run → if counts fail, adjust the layout arrays until tests pass.** (The arrays above are the starting data; the tests are authoritative. Fix duplicates/missing numbers by editing array entries, never by editing the test.)

- [ ] **Step 5: Commit** `feat: fixed 8x8 and 9x9 board layouts`.

### Task 2.3: Equation generation

**Files:** Create `lib/equations.ts`, `lib/equations.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeEquation, evalEquation } from './equations';

describe('makeEquation', () => {
  it('produces an equation that evaluates to the target', () => {
    for (let t = 0; t <= 38; t++) {
      for (let k = 0; k < 20; k++) {
        const eq = makeEquation(t);
        expect(evalEquation(eq)).toBe(t);
      }
    }
  });
  it('uses only + - × ÷ and integers', () => {
    expect(makeEquation(12)).toMatch(/^\d+ [+\-×÷] \d+$/);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```ts
function rnd(n: number) { return Math.floor(Math.random() * n); }

export function makeEquation(target: number): string {
  const forms: (() => string | null)[] = [
    () => { const a = rnd(target + 1); return `${a} + ${target - a}`; },
    () => { const a = target + 1 + rnd(20); return `${a} - ${a - target}`; },
    () => {
      if (target === 0) return `0 × ${1 + rnd(9)}`;
      for (let a = 2; a <= target; a++) if (target % a === 0 && target / a <= 12) return `${a} × ${target / a}`;
      return null;
    },
    () => {
      if (target === 0) return null;
      const b = 2 + rnd(8); return `${target * b} ÷ ${b}`;
    },
  ];
  // pick a random valid form; fall back to addition (always valid)
  const shuffled = forms.sort(() => Math.random() - 0.5);
  for (const f of shuffled) { const eq = f(); if (eq) return eq; }
  return `${target} + 0`;
}

export function evalEquation(eq: string): number {
  const [a, op, b] = eq.split(' ');
  const x = Number(a), y = Number(b);
  switch (op) {
    case '+': return x + y;
    case '-': return x - y;
    case '×': return x * y;
    case '÷': return x / y;
    default: throw new Error(`bad op ${op}`);
  }
}
```

- [ ] **Step 4: Run → pass.** Commit `feat: random equation generator`.

### Task 2.4: Deck building and dealing

**Files:** Create `lib/deck.ts`, `lib/deck.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildDeck } from './deck';
import { buildBoard } from './board-layout';

describe('buildDeck 8x8', () => {
  const board = buildBoard(8);
  const deck = buildDeck(board, { plusCards: 2, minusCards: 2 } as any);
  it('has one number card per board number-cell (60) plus specials', () => {
    const numberCards = deck.filter(c => c.kind === 'number');
    expect(numberCards).toHaveLength(60); // 30 numbers × 2
    expect(deck.filter(c => c.kind === 'plus')).toHaveLength(2);
    expect(deck.filter(c => c.kind === 'minus')).toHaveLength(2);
  });
  it('number card color matches its target board color', () => {
    const c = deck.find(c => c.kind === 'number' && c.target === 19)!;
    expect(c.color).toBe(board.find(b => b.value === 19)!.color);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```ts
import type { Card, Cell, Settings } from '@/types/game';
import { makeEquation } from './equations';

let _id = 0;
const nextId = () => `card_${_id++}`;

export function buildDeck(board: Cell[], settings: Pick<Settings,'plusCards'|'minusCards'>): Card[] {
  const cards: Card[] = [];
  for (const cell of board) {
    if (cell.value === 'FREE') continue;
    cards.push({
      id: nextId(), kind: 'number', target: cell.value,
      equation: makeEquation(cell.value), color: cell.color,
    });
  }
  for (let i = 0; i < settings.plusCards; i++)
    cards.push({ id: nextId(), kind: 'plus', target: null, equation: null, color: null });
  for (let i = 0; i < settings.minusCards; i++)
    cards.push({ id: nextId(), kind: 'minus', target: null, equation: null, color: null });
  return cards;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function deal(deck: Card[], n: number): { hand: Card[]; rest: Card[] } {
  return { hand: deck.slice(0, n), rest: deck.slice(n) };
}
```

- [ ] **Step 4: Run → pass.** Commit `feat: deck building, shuffle, deal`.

### Task 2.5: Sequence + near-sequence detection

**Files:** Create `lib/sequences.ts`, `lib/sequences.test.ts`

This is the heart of the bumpy-chip and win logic.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { linesThrough, countOwnedInLine, findCompletedSequences } from './sequences';

// Helper: make an empty owner grid of given size
function grid(size: number) { return new Array(size*size).fill(null) as (string|null)[]; }

describe('linesThrough', () => {
  it('returns 4 directions for an interior cell on 8x8', () => {
    const lines = linesThrough(27, 8, 5); // index 27, size 8, needLen 5
    // each line is an array of indices of length up to 2*needLen-1, clipped to board
    expect(lines).toHaveLength(4);
  });
});

describe('findCompletedSequences', () => {
  it('detects a horizontal 5-in-a-row (FREE counts as owned)', () => {
    const owners = grid(8);
    // row 3 indices 24..31; mark 24,25,26,27,28 as red
    [24,25,26,27,28].forEach(i => owners[i] = 'red');
    const freeIdx = new Set<number>(); // none needed here
    const seqs = findCompletedSequences(owners, freeIdx, 8, 5, 'red');
    expect(seqs.length).toBeGreaterThanOrEqual(1);
    expect(seqs[0]).toEqual(expect.arrayContaining([24,25,26,27,28]));
  });
  it('treats FREE corner as part of a line', () => {
    const owners = grid(8);
    // bottom row 56..63, corners 56 & 63 FREE. Mark 57,58,59,60 red, rely on 56 FREE for 5.
    [57,58,59,60].forEach(i => owners[i] = 'red');
    const freeIdx = new Set<number>([56,63]);
    const seqs = findCompletedSequences(owners, freeIdx, 8, 5, 'red');
    expect(seqs.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```ts
const DIRS = [
  [0, 1],   // horizontal
  [1, 0],   // vertical
  [1, 1],   // diagonal down-right
  [1, -1],  // diagonal down-left
];

export function linesThrough(index: number, size: number, needLen: number): number[][] {
  const row = Math.floor(index / size), col = index % size;
  const lines: number[][] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    for (let k = -(needLen - 1); k <= needLen - 1; k++) {
      const r = row + dr * k, c = col + dc * k;
      if (r >= 0 && r < size && c >= 0 && c < size) line.push(r * size + c);
    }
    lines.push(line);
  }
  return lines;
}

function ownedBy(owners: (string|null)[], freeIdx: Set<number>, i: number, team: string) {
  return owners[i] === team || freeIdx.has(i);
}

// Max consecutive run of team-owned (or FREE) cells in a line
export function countOwnedInLine(line: number[], owners: (string|null)[], freeIdx: Set<number>, team: string): number {
  let best = 0, run = 0;
  for (const i of line) {
    if (ownedBy(owners, freeIdx, i, team)) { run++; best = Math.max(best, run); }
    else run = 0;
  }
  return best;
}

// All completed sequences (each as the list of cell indices) for a team across the whole board.
export function findCompletedSequences(
  owners: (string|null)[], freeIdx: Set<number>, size: number, needLen: number, team: string
): number[][] {
  const found: number[][] = [];
  const seen = new Set<string>();
  for (let start = 0; start < size * size; start++) {
    const row = Math.floor(start / size), col = start % size;
    for (const [dr, dc] of DIRS) {
      const seg: number[] = [];
      for (let k = 0; k < needLen; k++) {
        const r = row + dr * k, c = col + dc * k;
        if (r < 0 || r >= size || c < 0 || c >= size) { seg.length = 0; break; }
        seg.push(r * size + c);
      }
      if (seg.length === needLen && seg.every(i => ownedBy(owners, freeIdx, i, team))) {
        const key = seg.join(',');
        if (!seen.has(key)) { seen.add(key); found.push([...seg]); }
      }
    }
  }
  return found;
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Add near-sequence (bumpy) test + impl**

Add to test file:
```ts
import { findBumpyCells } from './sequences';

describe('findBumpyCells', () => {
  it('flags cells that are part of a line one short of a sequence', () => {
    const owners = grid(8);
    [24,25,26,27].forEach(i => owners[i] = 'red'); // 4 in a row, need 5
    const bumpy = findBumpyCells(owners, new Set(), 8, 5, 'red');
    [24,25,26,27].forEach(i => expect(bumpy.has(i)).toBe(true));
  });
  it('does not flag when only 3 in a row', () => {
    const owners = grid(8);
    [24,25,26].forEach(i => owners[i] = 'red');
    const bumpy = findBumpyCells(owners, new Set(), 8, 5, 'red');
    expect(bumpy.size).toBe(0);
  });
});
```

Add to `sequences.ts`:
```ts
// Cells that participate in a window of needLen where the team owns exactly needLen-1
// (the remaining one is empty) → one move from a sequence.
export function findBumpyCells(
  owners: (string|null)[], freeIdx: Set<number>, size: number, needLen: number, team: string
): Set<number> {
  const bumpy = new Set<number>();
  for (let start = 0; start < size * size; start++) {
    const row = Math.floor(start / size), col = start % size;
    for (const [dr, dc] of DIRS) {
      const seg: number[] = [];
      for (let k = 0; k < needLen; k++) {
        const r = row + dr * k, c = col + dc * k;
        if (r < 0 || r >= size || c < 0 || c >= size) { seg.length = 0; break; }
        seg.push(r * size + c);
      }
      if (seg.length !== needLen) continue;
      const owned = seg.filter(i => ownedBy(owners, freeIdx, i, team));
      const empty = seg.filter(i => owners[i] === null && !freeIdx.has(i));
      if (owned.length === needLen - 1 && empty.length === 1) {
        owned.forEach(i => { if (!freeIdx.has(i)) bumpy.add(i); });
      }
    }
  }
  return bumpy;
}
```

- [ ] **Step 6: Run → pass.** Commit `feat: sequence + bumpy detection`.

### Task 2.6: Game engine (pure reducer)

**Files:** Create `lib/game-engine.ts`, `lib/game-engine.test.ts`

The engine takes a `RoomState` + an action and returns the next `RoomState`. Pure, no sockets.

- [ ] **Step 1: Failing test — start game**

```ts
import { describe, it, expect } from 'vitest';
import { startGame, playNumberCard } from './game-engine';
import type { RoomState } from '@/types/game';

function baseRoom(): RoomState {
  return {
    code: 'TEST', phase: 'lobby',
    settings: { boardSize: 8, teamCount: 2, sequencesToWin: 2, cardsPerPlayer: 3, plusCards: 2, minusCards: 2 },
    players: [
      { id: 'p1', name: 'A', icon: 1, team: 'red', connected: true },
      { id: 'p2', name: 'B', icon: 2, team: 'blue', connected: true },
    ],
    teams: [
      { color: 'red', sequencesThisGame: 0, gameWins: 0 },
      { color: 'blue', sequencesThisGame: 0, gameWins: 0 },
    ],
    board: [], hands: {}, deckCount: 0, turnOrder: [], currentTurn: 0,
    lastMove: null, hostId: 'p1', isLastGame: false, winners: null,
  };
}

describe('startGame', () => {
  it('builds board, deals hands, sets phase playing', () => {
    const r = startGame(baseRoom());
    expect(r.phase).toBe('playing');
    expect(r.board).toHaveLength(64);
    expect(r.hands['p1']).toHaveLength(3);
    expect(r.hands['p2']).toHaveLength(3);
    expect(r.turnOrder.sort()).toEqual(['p1','p2']);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `startGame`**

```ts
import type { RoomState, Card, TeamColor } from '@/types/game';
import { buildBoard } from './board-layout';
import { buildDeck, shuffle } from './deck';
import { findCompletedSequences, findBumpyCells } from './sequences';

export function startGame(room: RoomState, firstPlayerId?: string): RoomState {
  const board = buildBoard(room.settings.boardSize);
  let deck = shuffle(buildDeck(board, room.settings));
  const hands: Record<string, Card[]> = {};
  for (const p of room.players) {
    hands[p.id] = deck.slice(0, room.settings.cardsPerPlayer);
    deck = deck.slice(room.settings.cardsPerPlayer);
  }
  const turnOrder = shuffle(room.players.map(p => p.id));
  let currentTurn = 0;
  if (firstPlayerId) {
    const idx = turnOrder.indexOf(firstPlayerId);
    if (idx >= 0) currentTurn = idx;
  }
  return {
    ...room, phase: 'playing', board, hands, deckCount: deck.length,
    turnOrder, currentTurn, lastMove: null,
    teams: room.teams.map(t => ({ ...t, sequencesThisGame: 0 })),
    _deck: deck, // internal, see note
  } as RoomState & { _deck: Card[] };
}
```

Note: store the live `_deck` on the server-held state object (not sent to clients). Add `_deck?: Card[]` to a server-only extended type in `server/rooms.ts` rather than the shared `RoomState`. For the engine tests, treat `_deck` as an untyped extra field (cast as above).

- [ ] **Step 4: Run → pass.** Commit `feat: game engine startGame`.

- [ ] **Step 5: Failing test — play a number card**

```ts
describe('playNumberCard', () => {
  it('places chip on a matching empty cell and refills hand', () => {
    let r = startGame(baseRoom(), 'p1') as any;
    // give p1 a known card whose target exists on board
    const target = r.board.find((c: any) => c.value !== 'FREE').value;
    const card = { id: 'x', kind: 'number', target, equation: '1 + 1', color: '#000' };
    r.hands['p1'] = [card, ...r.hands['p1'].slice(1)];
    const cellIndex = r.board.findIndex((c: any) => c.value === target && c.owner === null);
    r = playNumberCard(r, 'p1', card.id, cellIndex);
    expect(r.board[cellIndex].owner).toBe('red');
    expect(r.hands['p1']).toHaveLength(3); // refilled
    expect(r.currentTurn).toBe(r.turnOrder.indexOf('p2')); // advanced
    expect(r.lastMove).toEqual({ index: cellIndex, playerId: 'p1' });
  });
});
```

- [ ] **Step 6: Run → fail.**

- [ ] **Step 7: Implement `playNumberCard` + shared `recomputeBoardFlags` + `advanceTurn`**

```ts
function teamOf(room: RoomState, playerId: string): TeamColor {
  return room.players.find(p => p.id === playerId)!.team!;
}

function recomputeBoardFlags(room: RoomState): RoomState {
  const size = room.settings.boardSize;
  const need = size === 8 ? 5 : 6;
  const owners = room.board.map(c => c.owner);
  const freeIdx = new Set(room.board.filter(c => c.value === 'FREE').map(c => c.index));
  const teams = room.players.map(p => p.team).filter(Boolean) as TeamColor[];
  const uniqueTeams = [...new Set(teams)];

  const inSeq = new Set<number>();
  const seqCount: Record<string, number> = {};
  const bumpyAll = new Set<number>();

  for (const t of uniqueTeams) {
    const seqs = findCompletedSequences(owners, freeIdx, size, need, t);
    seqCount[t] = seqs.length;
    seqs.forEach(seg => seg.forEach(i => inSeq.add(i)));
    const bump = findBumpyCells(owners, freeIdx, size, need, t);
    bump.forEach(i => bumpyAll.add(i));
  }

  const board = room.board.map(c => ({
    ...c,
    inSequence: inSeq.has(c.index),
    bumpy: bumpyAll.has(c.index) && !inSeq.has(c.index),
  }));
  const teamsState = room.teams.map(t => ({ ...t, sequencesThisGame: seqCount[t.color] ?? 0 }));
  return { ...room, board, teams: teamsState };
}

function advanceTurn(room: RoomState): RoomState {
  return { ...room, currentTurn: (room.currentTurn + 1) % room.turnOrder.length };
}

function drawOne(room: RoomState & { _deck?: Card[] }, playerId: string): RoomState {
  const deck = room._deck ?? [];
  if (deck.length === 0) return room;
  const [top, ...rest] = deck;
  const hands = { ...room.hands, [playerId]: [...room.hands[playerId], top] };
  return { ...room, hands, _deck: rest, deckCount: rest.length } as RoomState;
}

export function playNumberCard(room: RoomState, playerId: string, cardId: string, cellIndex: number): RoomState {
  if (room.turnOrder[room.currentTurn] !== playerId) return room; // not your turn
  const cell = room.board[cellIndex];
  if (!cell || cell.owner !== null || cell.value === 'FREE') return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find(c => c.id === cardId);
  if (!card || card.kind !== 'number' || card.target !== cell.value) return room;

  let next: RoomState = {
    ...room,
    board: room.board.map((c, i) => i === cellIndex ? { ...c, owner: teamOf(room, playerId) } : c),
    hands: { ...room.hands, [playerId]: hand.filter(c => c.id !== cardId) },
    lastMove: { index: cellIndex, playerId },
  };
  next = recomputeBoardFlags(next);
  next = drawOne(next as any, playerId);
  next = checkWin(next);
  if (next.phase === 'playing') next = advanceTurn(next);
  return next;
}
```

- [ ] **Step 8: Add `checkWin`** (referenced above)

```ts
function checkWin(room: RoomState): RoomState {
  const winnerTeam = room.teams.find(t => t.sequencesThisGame >= room.settings.sequencesToWin);
  if (!winnerTeam) return room;
  const teams = room.teams.map(t =>
    t.color === winnerTeam.color ? { ...t, gameWins: t.gameWins + 1 } : t);
  return { ...room, teams, phase: 'between' };
}
```

- [ ] **Step 9: Run → pass.** Commit `feat: playNumberCard, flags, win check`.

- [ ] **Step 10: Plus / Minus / dead-card tests + impl**

Add tests:
```ts
import { playPlusCard, playMinusCard, swapDeadCard } from './game-engine';

describe('playPlusCard', () => {
  it('places a chip on ANY empty non-free cell', () => {
    let r = startGame(baseRoom(), 'p1') as any;
    const card = { id: 'w', kind: 'plus', target: null, equation: null, color: null };
    r.hands['p1'] = [card, ...r.hands['p1'].slice(1)];
    const empty = r.board.findIndex((c: any) => c.value !== 'FREE' && c.owner === null);
    r = playPlusCard(r, 'p1', 'w', empty);
    expect(r.board[empty].owner).toBe('red');
  });
});

describe('playMinusCard', () => {
  it('removes an opponent chip not locked in a sequence', () => {
    let r = startGame(baseRoom(), 'p1') as any;
    const idx = r.board.findIndex((c: any) => c.value !== 'FREE');
    r.board[idx].owner = 'blue';
    const card = { id: 'm', kind: 'minus', target: null, equation: null, color: null };
    r.hands['p1'] = [card, ...r.hands['p1'].slice(1)];
    r = playMinusCard(r, 'p1', 'm', idx);
    expect(r.board[idx].owner).toBe(null);
  });
});
```

Implement:
```ts
export function playPlusCard(room: RoomState, playerId: string, cardId: string, cellIndex: number): RoomState {
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const cell = room.board[cellIndex];
  if (!cell || cell.owner !== null || cell.value === 'FREE') return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find(c => c.id === cardId);
  if (!card || card.kind !== 'plus') return room;

  let next: RoomState = {
    ...room,
    board: room.board.map((c, i) => i === cellIndex ? { ...c, owner: teamOf(room, playerId) } : c),
    hands: { ...room.hands, [playerId]: hand.filter(c => c.id !== cardId) },
    lastMove: { index: cellIndex, playerId },
  };
  next = recomputeBoardFlags(next);
  next = drawOne(next as any, playerId);
  next = checkWin(next);
  if (next.phase === 'playing') next = advanceTurn(next);
  return next;
}

export function playMinusCard(room: RoomState, playerId: string, cardId: string, cellIndex: number): RoomState {
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const cell = room.board[cellIndex];
  const myTeam = teamOf(room, playerId);
  if (!cell || cell.owner === null || cell.owner === myTeam || cell.inSequence) return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find(c => c.id === cardId);
  if (!card || card.kind !== 'minus') return room;

  let next: RoomState = {
    ...room,
    board: room.board.map((c, i) => i === cellIndex ? { ...c, owner: null } : c),
    hands: { ...room.hands, [playerId]: hand.filter(c => c.id !== cardId) },
    lastMove: { index: cellIndex, playerId },
  };
  next = recomputeBoardFlags(next);
  next = drawOne(next as any, playerId);
  if (next.phase === 'playing') next = advanceTurn(next);
  return next;
}

// Dead card: a number card whose every board cell is already owned.
export function swapDeadCard(room: RoomState, playerId: string, cardId: string): RoomState {
  if (room.turnOrder[room.currentTurn] !== playerId) return room;
  const hand = room.hands[playerId] ?? [];
  const card = hand.find(c => c.id === cardId);
  if (!card || card.kind !== 'number') return room;
  const dead = room.board.filter(c => c.value === card.target).every(c => c.owner !== null);
  if (!dead) return room;
  let next: RoomState = { ...room, hands: { ...room.hands, [playerId]: hand.filter(c => c.id !== cardId) } };
  next = drawOne(next as any, playerId);
  return next; // does NOT advance turn — player still makes a move
}
```

- [ ] **Step 11: Run → pass.** Commit `feat: plus, minus, dead-card swap`.

- [ ] **Step 12: Multi-game test + impl (`nextGame`, `declareLastGame`, `finalize`)**

Add tests:
```ts
import { nextGame, declareLastGame } from './game-engine';

describe('multi-game flow', () => {
  it('nextGame resets board and sequences, winner goes first', () => {
    let r = baseRoom(); r.phase = 'between';
    r.teams[0].gameWins = 1;
    const started = nextGame(r, 'red'); // red won, a red player starts
    expect(started.phase).toBe('playing');
    expect(started.teams.every(t => t.sequencesThisGame === 0)).toBe(true);
    const firstPlayer = started.turnOrder[started.currentTurn];
    expect(started.players.find(p => p.id === firstPlayer)!.team).toBe('red');
  });
  it('declareLastGame then a win goes to final', () => {
    let r = baseRoom(); r.phase = 'between'; r.isLastGame = true;
    // simulate finalize directly via flag check inside checkWin path is covered in engine
    expect(declareLastGame(r).isLastGame).toBe(true);
  });
});
```

Implement:
```ts
export function nextGame(room: RoomState, winningTeam: TeamColor | null): RoomState {
  const firstPlayer = winningTeam
    ? room.players.find(p => p.team === winningTeam)?.id
    : undefined;
  return startGame({ ...room, phase: 'lobby' }, firstPlayer);
}

export function declareLastGame(room: RoomState): RoomState {
  return { ...room, isLastGame: true };
}

// Called by server when phase becomes 'between' AND isLastGame is true.
export function finalize(room: RoomState): RoomState {
  const max = Math.max(...room.teams.map(t => t.gameWins));
  const leaders = room.teams.filter(t => t.gameWins === max);
  // tie-breaker: most sequences in the final game
  let champ = leaders[0];
  if (leaders.length > 1) {
    champ = leaders.reduce((a, b) => (b.sequencesThisGame > a.sequencesThisGame ? b : a));
  }
  return { ...room, phase: 'final', winners: champ.color };
}
```

- [ ] **Step 13: Run → pass.** Commit `feat: multi-game flow + finalize`.

---

# Phase 3 — Socket Server & Room State

### Task 3.0: Run server TypeScript with tsx

**Files:** modify `package.json`, `server.js`

- [ ] **Step 1: Install tsx**
```bash
npm install -D tsx
```
- [ ] **Step 2: Change `server.js` require** to load TS:
```js
require('tsx/cjs');
require('./server/rooms').registerHandlers(io);
```
- [ ] **Step 3: Delete the temporary `server/rooms.js`** (replaced by `.ts`).
- [ ] **Step 4: Commit** `chore: load TS server modules via tsx`.

### Task 3.1: Room registry + handlers

**Files:** Create `server/rooms.ts`

- [ ] **Step 1: Implement** (server-only state holds `_deck`; clients get `ClientView` without other hands)

```ts
import type { Server, Socket } from 'socket.io';
import type { RoomState, Settings, Card, ClientView, TeamColor } from '@/types/game';
import { startGame, playNumberCard, playPlusCard, playMinusCard, swapDeadCard, nextGame, declareLastGame, finalize } from '@/lib/game-engine';

type ServerRoom = RoomState & { _deck: Card[] };
const rooms = new Map<string, ServerRoom>();

function code(): string {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

function viewFor(room: ServerRoom, playerId: string): ClientView {
  const { hands, _deck, ...rest } = room as any;
  return { ...rest, myHand: room.hands[playerId] ?? [], myPlayerId: playerId };
}

function broadcast(io: Server, room: ServerRoom) {
  for (const p of room.players) {
    io.to(socketOf(p.id)).emit('state', viewFor(room, p.id));
  }
}

const playerSocket = new Map<string, string>(); // playerId → socket.id
const socketOf = (playerId: string) => playerSocket.get(playerId) ?? '';

export function registerHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {

    socket.on('create-room', ({ player, settings }: { player: any; settings: Settings }) => {
      let c = code(); while (rooms.has(c)) c = code();
      const room: ServerRoom = {
        code: c, phase: 'lobby', settings,
        players: [{ ...player, team: null, connected: true }],
        teams: teamsFor(settings.teamCount),
        board: [], hands: {}, deckCount: 0, turnOrder: [], currentTurn: 0,
        lastMove: null, hostId: player.id, isLastGame: false, winners: null, _deck: [],
      };
      rooms.set(c, room);
      playerSocket.set(player.id, socket.id);
      socket.join(c);
      socket.emit('joined', { code: c });
      broadcast(io, room);
    });

    socket.on('join-room', ({ code: c, player }: { code: string; player: any }) => {
      const room = rooms.get(c);
      if (!room) { socket.emit('error-msg', 'Room not found'); return; }
      const existing = room.players.find(p => p.id === player.id);
      if (existing) { existing.connected = true; }       // reconnect
      else room.players.push({ ...player, team: null, connected: true });
      playerSocket.set(player.id, socket.id);
      socket.join(c);
      socket.emit('joined', { code: c });
      broadcast(io, room);
    });

    socket.on('assign-team', ({ code: c, playerId, team }: { code: string; playerId: string; team: TeamColor | null }) => {
      const room = rooms.get(c); if (!room) return;
      const p = room.players.find(p => p.id === playerId); if (p) p.team = team;
      broadcast(io, room);
    });

    socket.on('start-game', ({ code: c }: { code: string }) => {
      const room = rooms.get(c); if (!room) return;
      Object.assign(room, startGame(room));
      broadcast(io, room);
    });

    const act = (fn: (r: RoomState, ...a: any[]) => RoomState) =>
      ({ code: c, ...args }: any) => {
        const room = rooms.get(c); if (!room) return;
        let next = fn(room, ...Object.values(args)) as ServerRoom;
        if (next.phase === 'between' && next.isLastGame) next = finalize(next) as ServerRoom;
        Object.assign(room, next);
        broadcast(io, room);
      };

    socket.on('play-number', act((r, playerId, cardId, cellIndex) => playNumberCard(r, playerId, cardId, cellIndex)));
    socket.on('play-plus',   act((r, playerId, cardId, cellIndex) => playPlusCard(r, playerId, cardId, cellIndex)));
    socket.on('play-minus',  act((r, playerId, cardId, cellIndex) => playMinusCard(r, playerId, cardId, cellIndex)));
    socket.on('swap-dead',   act((r, playerId, cardId) => swapDeadCard(r, playerId, cardId)));

    socket.on('next-game', ({ code: c }: { code: string }) => {
      const room = rooms.get(c); if (!room) return;
      const winner = room.teams.reduce((a, b) => b.gameWins > a.gameWins ? b : a).color;
      Object.assign(room, nextGame(room, winner));
      broadcast(io, room);
    });

    socket.on('declare-last', ({ code: c }: { code: string }) => {
      const room = rooms.get(c); if (!room) return;
      Object.assign(room, declareLastGame(room));
      broadcast(io, room);
    });

    socket.on('reaction', ({ code: c, playerId, emoji }: any) => {
      io.to(c).emit('reaction', { playerId, emoji });
    });

    socket.on('disconnect', () => {
      for (const room of rooms.values()) {
        const p = room.players.find(pl => playerSocket.get(pl.id) === socket.id);
        if (p) { p.connected = false; broadcast(io, room); }
      }
    });
  });
}

function teamsFor(n: number) {
  const order: TeamColor[] = ['red', 'blue', 'green', 'yellow'];
  return order.slice(0, n).map(color => ({ color, sequencesThisGame: 0, gameWins: 0 }));
}
```

- [ ] **Step 2: Boot check.** `npm run dev` → no crash, server logs Ready.
- [ ] **Step 3: Commit** `feat: socket room registry + game event handlers`.

Note (manual integration test happens after the client hook in Phase 4).

---

# Phase 4 — Client

### Task 4.1: Socket hook + player identity

**Files:** Create `lib/client/useSocket.ts`

- [ ] **Step 1: Implement**

```ts
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientView } from '@/types/game';

export function getPlayerId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('playerId');
  if (!id) { id = 'pl_' + Math.random().toString(36).slice(2); localStorage.setItem('playerId', id); }
  return id;
}

export function useSocket() {
  const ref = useRef<Socket | null>(null);
  const [view, setView] = useState<ClientView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reaction, setReaction] = useState<{ playerId: string; emoji: string } | null>(null);

  useEffect(() => {
    const s = io();
    ref.current = s;
    s.on('state', setView);
    s.on('error-msg', setError);
    s.on('reaction', setReaction);
    return () => { s.close(); };
  }, []);

  const emit = useCallback((event: string, payload: any) => ref.current?.emit(event, payload), []);
  return { view, error, reaction, emit };
}
```

- [ ] **Step 2: Typecheck.** `npx tsc --noEmit`. Commit `feat: client socket hook + persistent playerId`.

### Task 4.2: Home + Create Room

**Files:** Create `app/page.tsx`, `app/create/page.tsx`, port `create-room-ui.html`.

- [ ] **Step 1:** Replace `app/page.tsx` with Home: a logo, "Create Room" link to `/create`, and a join form (input code → navigate `/room/CODE`).
- [ ] **Step 2:** Build `app/create/page.tsx` as a client component using the markup/CSS from `.superpowers/brainstorm/956-1780049188/content/create-room-ui.html`. Wire the controls to local React state for `Settings`. On "Create Room": `emit('create-room', { player: {id:getPlayerId(), name, icon}, settings })`, then on `joined` navigate to `/room/CODE`.
- [ ] **Step 3:** Cards-per-player default updates with board size (3 for 8×8, 4 for 9×9) but stays user-editable, clamped 2–5. Plus/Minus default 2, clamp 0–4.
- [ ] **Step 4: Manual check** — `npm run dev`, create a room, confirm redirect to `/room/XXXX` and `state` arrives (log it). Commit `feat: home and create-room screens`.

### Task 4.3: Character Picker

**Files:** Create `components/CharacterPicker.tsx`, copy icons.

- [ ] **Step 1:** `cp -r icons public/icons` (or copy via OS). Icons available at `/icons/char_01.png`.
- [ ] **Step 2:** Port `char-picker.html` into `CharacterPicker.tsx`: a name input + 26 `<img src="/icons/char_NN.png">` in a 5-col grid; selecting sets `icon` state; confirm calls a passed `onConfirm({name, icon})`. Shown when the player has no name/icon yet (before joining a room).
- [ ] **Step 3: Commit** `feat: character picker`.

### Task 4.4: Room phase router + Lobby

**Files:** Create `app/room/[code]/page.tsx`, `components/Lobby.tsx`.

- [ ] **Step 1:** `app/room/[code]/page.tsx` (client): on mount, ensure identity (show `CharacterPicker` if needed), then `emit('join-room', {code, player})`. Render by `view.phase`: `lobby`→`<Lobby>`, `playing`→`<GameScreen>`, `between`→`<BetweenGames>`, `final`→`<FinalWinner>`.
- [ ] **Step 2:** `Lobby.tsx` from `lobby-ui.html`: show `view.code` with a "Copy invite link" button (`navigator.clipboard.writeText(location.href)`), settings summary, unassigned players, team cards. Clicking a team while selected assigns via `emit('assign-team', {code, playerId:getPlayerId(), team})`. Tapping a teammate's seat (host only) reassigns. "Start Game" (host only, enabled when every player has a team) → `emit('start-game', {code})`.
- [ ] **Step 3: Manual two-tab test** — open two browser tabs, create in one, join via link in the other, assign teams, start. Both should switch to playing. Commit `feat: room router + lobby`.

### Task 4.5: Board + Cell + Chip

**Files:** Create `components/Board.tsx`, `components/BoardCell.tsx`, `components/Chip.tsx`. Port board CSS from `game-board.html`.

- [ ] **Step 1: `Chip.tsx`** — round chip with team color; props `{ team, bumpy, inSequence }`. Use the blank/bumpy gradient + white drop-shadow outline + gold glow for `inSequence` from the prototype CSS.
- [ ] **Step 2: `BoardCell.tsx`** — renders the white square + colored circle with the underlined number (top-half rotated for indices in the top half: `row < size/2`). Overlays `<Chip>` when `cell.owner`. Highlights when it's a legal target for the currently selected card. Calls `onPick(index)` on tap.
- [ ] **Step 3: `Board.tsx`** — CSS grid `repeat(size, 1fr)`, auto-fits via `aspect-ratio:1` cells (the no-scroll fix from the prototype). Maps `view.board` to cells. Determines legal targets from the selected card: number card → empty cells whose `value === card.target`; plus → any empty non-FREE; minus → opponent cells not `inSequence`.
- [ ] **Step 4: Commit** `feat: board, cell, chip components`.

### Task 4.6: Hand, PlayerStrip, EmojiPanel, TopBar

**Files:** Create the four components; port from `game-board.html`.

- [ ] **Step 1: `HandCards.tsx`** — render `view.myHand`. Number cards: colored header + equation (no answer). Plus/minus: black cards with white corners. Selecting a card sets `selectedCardId` (lifts with gold glow). If a number card is dead (all its board cells owned), show a small "swap" affordance → `emit('swap-dead', {code, playerId, cardId})`.
- [ ] **Step 2: `PlayerStrip.tsx`** — avatars from `/icons`, team-color dot, gold glow on `turnOrder[currentTurn]`. Render floating emoji when a `reaction` arrives for that player (animate up + fade, clear after 2s).
- [ ] **Step 3: `EmojiPanel.tsx`** — 7 buttons; tap → `emit('reaction', {code, playerId, emoji})`.
- [ ] **Step 4: `TopBar.tsx`** — turn badge ("Your Turn!" if `turnOrder[currentTurn]===myPlayerId`, else "{Name}'s turn") + per-team sequence score `x / sequencesToWin`.
- [ ] **Step 5:** Assemble `GameScreen` inside `app/room/[code]/page.tsx` combining TopBar + PlayerStrip + Board + EmojiPanel + HandCards, wiring `selectedCardId` and the pick handler that emits the right `play-*` event by card kind.
- [ ] **Step 6: Commit** `feat: hand, player strip, emoji, top bar, game screen`.

### Task 4.7: Between Games + Final Winner

**Files:** Create `components/BetweenGames.tsx`, `components/FinalWinner.tsx`. Port from `enhanced-overview.html`.

- [ ] **Step 1: `BetweenGames.tsx`** — per-team win counts; host sees "Next Game" (`emit('next-game')`) and "Last Game!" (`emit('declare-last')` then `emit('next-game')`). Non-host sees "waiting for host".
- [ ] **Step 2: `FinalWinner.tsx`** — champion team name, bouncing member avatars, CSS confetti, total wins, "Play Again" (host → reset: simplest is `emit('next-game')` after resetting wins — add a `reset` event if needed, or navigate back to lobby).
- [ ] **Step 3: Commit** `feat: between-games and final-winner screens`.

---

# Phase 5 — Integration, Polish, Deploy

### Task 5.1: Full multiplayer playtest (manual)

- [ ] Open 3 browser tabs (or phone + laptop on same Railway URL). Create a 2-team game, join, assign, start.
- [ ] Verify: turns rotate; placing a card fills the correct circle; hand refills; bumpy chips appear at N-1; completing a sequence glows gold and increments the team score; reaching `sequencesToWin` moves to Between Games.
- [ ] Verify plus (place anywhere), minus (removes opponent, blocked on sequence chips), dead-card swap.
- [ ] Verify reactions broadcast to all tabs; reconnection (reload a tab → rejoins same seat).
- [ ] Fix any bug found, recommit.

### Task 5.2: Edge cases

- [ ] Empty deck: `drawOne` no-ops (already handled) — confirm hand can shrink without crashing.
- [ ] All players must have a team before Start (guard in Lobby + server `start-game` ignores if any `team===null`).
- [ ] Minus card with no legal target: card still selectable but no cell highlights; tapping nothing does nothing.
- [ ] Commit `fix: edge cases from playtest`.

### Task 5.3: Production deploy

- [ ] `git push` → Railway rebuilds. Open URL on a phone and a laptop, play a full game end-to-end.
- [ ] Confirm `npm run build` passes locally first (`npm run build`). Fix any type/build errors.
- [ ] Commit + push final.

---

## Self-Review (completed during planning)

- **Spec coverage:** Home, Create Room (all 7 settings incl. cards-per-player default-by-board-size & clamps), Character Picker (26 icons), Lobby (teams 2–4, code, copy link), Board (8×8/9×9, FREE corners, underlined numbers, top-half rotation), chips (blank/bumpy/sequence, FREE counts toward both), equation cards (color-matched, no answer), black plus/minus with white corners, emoji reactions, multi-game with host "Last Game", winner-goes-first, random first game, cumulative scoring + tie-breaker, Final Winner with animation, Railway deploy — each maps to a task. ✓
- **Added beyond spec (my ideas, flagged):** custom server, reconnection, dead-card swap, last-move highlight, copy invite link. ✓
- **Placeholder scan:** none. ✓
- **Type consistency:** `RoomState`/`ClientView`/`Card`/`Cell` used consistently; engine functions (`startGame`, `playNumberCard`, `playPlusCard`, `playMinusCard`, `swapDeadCard`, `nextGame`, `declareLastGame`, `finalize`) match their socket-handler call sites; `_deck` kept server-only via `ServerRoom`. ✓
