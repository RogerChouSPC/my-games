# Settings Panel + Exit Button — Implementation Plan (Phase 1 of special-cards work)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a host-only Settings panel to the lobby (edit board size, sequences-to-win, cards-per-hand, Plus/Minus counts) plus an Exit-to-home button.

**Architecture:** A pure, unit-tested `applySettingsUpdate(current, patch)` sanitizer in the engine layer; a host-only `update-settings` socket handler that uses it and re-broadcasts; a `SettingsModal` client component opened from the lobby. Mode and team count stay fixed at creation. This is the foundation; later phases add one special-card row each.

**Tech Stack:** Next.js 15 / React 19, Socket.io, TypeScript, Vitest.

---

### Task 1: `applySettingsUpdate` sanitizer (pure, tested)

**Files:**
- Create: `lib/settings.ts`
- Test: `lib/settings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { applySettingsUpdate } from './settings';
import type { Settings } from '@/types/game';

const base: Settings = {
  mode: 'teams', boardSize: 8, teamCount: 2,
  sequencesToWin: 2, cardsPerPlayer: 3, plusCards: 2, minusCards: 2,
};

describe('applySettingsUpdate', () => {
  it('updates valid fields and clamps counts to 0..4', () => {
    const next = applySettingsUpdate(base, { plusCards: 9, minusCards: -3, boardSize: 9 });
    expect(next.plusCards).toBe(4);
    expect(next.minusCards).toBe(0);
    expect(next.boardSize).toBe(9);
  });
  it('clamps sequencesToWin to 1..4 and cardsPerPlayer to 2..5', () => {
    expect(applySettingsUpdate(base, { sequencesToWin: 99 }).sequencesToWin).toBe(4);
    expect(applySettingsUpdate(base, { cardsPerPlayer: 1 }).cardsPerPlayer).toBe(2);
  });
  it('ignores invalid board size and never changes mode or teamCount', () => {
    const next = applySettingsUpdate(base, { boardSize: 7 as never, mode: 'solo', teamCount: 4 });
    expect(next.boardSize).toBe(8);
    expect(next.mode).toBe('teams');
    expect(next.teamCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- -t applySettingsUpdate`
Expected: FAIL — `applySettingsUpdate is not a function`.

- [ ] **Step 3: Implement minimal code**

```ts
import type { Settings, BoardSize } from '@/types/game';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

// Apply a host's lobby settings change. mode and teamCount are fixed at creation,
// so they're ignored here; everything else is clamped to its valid range.
export function applySettingsUpdate(current: Settings, patch: Partial<Settings>): Settings {
  const next = { ...current };
  if (patch.boardSize === 8 || patch.boardSize === 9) next.boardSize = patch.boardSize as BoardSize;
  if (typeof patch.sequencesToWin === 'number') next.sequencesToWin = clamp(patch.sequencesToWin, 1, 4);
  if (typeof patch.cardsPerPlayer === 'number') next.cardsPerPlayer = clamp(patch.cardsPerPlayer, 2, 5);
  if (typeof patch.plusCards === 'number') next.plusCards = clamp(patch.plusCards, 0, 4);
  if (typeof patch.minusCards === 'number') next.minusCards = clamp(patch.minusCards, 0, 4);
  return next;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- -t applySettingsUpdate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/settings.ts lib/settings.test.ts
git commit -m "feat: add applySettingsUpdate settings sanitizer"
```

---

### Task 2: `update-settings` socket handler (host + lobby only)

**Files:**
- Modify: `server/rooms.ts` (import + new handler near the other host-only handlers, ~line 175)

- [ ] **Step 1: Add the import** to the existing `game-engine`/lib imports block at the top of `server/rooms.ts`:

```ts
import { applySettingsUpdate } from '../lib/settings';
```

- [ ] **Step 2: Add the handler** right after the `assign-team` handler (after line ~175):

```ts
socket.on('update-settings', ({ code, settings }: { code: string; settings: Partial<Settings> }) => {
  const room = rooms.get(code);
  if (!room || room.phase !== 'lobby' || !isHost(room)) return; // host-only, lobby-only
  room.settings = applySettingsUpdate(room.settings, settings ?? {});
  broadcast(io, room);
});
```

(`Settings` is already imported in `server/rooms.ts`.)

- [ ] **Step 3: Verify build/types**

Run: `npm run build`
Expected: Compiles successfully (no TS errors).

- [ ] **Step 4: Commit**

```bash
git add server/rooms.ts
git commit -m "feat: host can update lobby settings over socket"
```

---

### Task 3: `SettingsModal` component

**Files:**
- Create: `components/SettingsModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';
import { useState } from 'react';
import type { ClientView, Settings, BoardSize } from '@/types/game';

interface Props {
  view: ClientView;
  onSave: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function SettingsModal({ view, onSave, onClose }: Props) {
  const s = view.settings;
  const [boardSize, setBoardSize] = useState<BoardSize>(s.boardSize);
  const [sequencesToWin, setSequencesToWin] = useState(s.sequencesToWin);
  const [cardsPerPlayer, setCardsPerPlayer] = useState(s.cardsPerPlayer);
  const [plusCards, setPlusCards] = useState(s.plusCards);
  const [minusCards, setMinusCards] = useState(s.minusCards);

  const save = () => {
    onSave({ boardSize, sequencesToWin, cardsPerPlayer, plusCards, minusCards });
    onClose();
  };

  const Stepper = ({ label, desc, value, set }: { label: string; desc: string; value: number; set: (v: number) => void }) => (
    <div className="settings-row">
      <div><div className="settings-row-label">{label}</div><div className="settings-row-desc">{desc}</div></div>
      <div className="stepper-ctrls">
        <button className="step-btn" onClick={() => set(clamp(value - 1, 0, 4))}>−</button>
        <span className="stepper-val">{value}</span>
        <button className="step-btn" onClick={() => set(clamp(value + 1, 0, 4))}>+</button>
      </div>
    </div>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
        <div className="card-title" style={{ fontSize: 18, marginBottom: 12 }}>⚙️ Game Settings</div>

        <div className="field-label">Board Size</div>
        <div className="opt-cards" style={{ marginBottom: 12 }}>
          <div className={`opt-card${boardSize === 8 ? ' active' : ''}`} onClick={() => setBoardSize(8)}>
            <div className="size">8 × 8</div><div className="rule">1–30 · 5 in a row</div>
          </div>
          <div className={`opt-card${boardSize === 9 ? ' active' : ''}`} onClick={() => setBoardSize(9)}>
            <div className="size">9 × 9</div><div className="rule">1–38 · 6 in a row</div>
          </div>
        </div>

        <div className="field-label">Sequences to Win</div>
        <div className="num-btns" style={{ marginBottom: 12 }}>
          {[1, 2, 3, 4].map((n) => (
            <button key={n} className={`num-btn${sequencesToWin === n ? ' active' : ''}`} onClick={() => setSequencesToWin(n)}>
              <div className="n">{n}</div><div className="lbl">seq</div>
            </button>
          ))}
        </div>

        <div className="field-label">Cards per Player</div>
        <div className="num-btns" style={{ marginBottom: 12 }}>
          {[2, 3, 4, 5].map((n) => (
            <button key={n} className={`num-btn${cardsPerPlayer === n ? ' active' : ''}`} onClick={() => setCardsPerPlayer(n)}>
              <div className="n">{n}</div><div className="lbl">cards</div>
            </button>
          ))}
        </div>

        <div className="field-label" style={{ marginBottom: 8 }}>Special Cards (per deck · min 0 · max 4)</div>
        <Stepper label="➕ Plus (wild)" desc="Place a chip on any empty number" value={plusCards} set={setPlusCards} />
        <Stepper label="➖ Minus (remove)" desc="Remove an opponent chip" value={minusCards} set={setMinusCards} />

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="ghost-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add styles** to `app/globals.css` (after the `.stepper` rules):

```css
.settings-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid rgba(255,255,255,.08); }
.settings-row-label { font-weight: 700; font-size: 13px; }
.settings-row-desc { font-size: 10px; color: var(--muted); }
.lobby-top-bar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 8px; }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 4: Commit**

```bash
git add components/SettingsModal.tsx app/globals.css
git commit -m "feat: add SettingsModal component"
```

---

### Task 4: Wire Settings + Exit buttons into the lobby

**Files:**
- Modify: `components/Lobby.tsx`
- Modify: `app/room/[code]/page.tsx` (the `view.phase === 'lobby'` branch, ~line 95)

- [ ] **Step 1: Extend `LobbyProps` and add buttons/modal in `components/Lobby.tsx`.**

Update the imports and interface:

```tsx
import SettingsModal from './SettingsModal';
import type { ClientView, TeamColor, Settings } from '@/types/game';

interface LobbyProps {
  view: ClientView;
  onAssign: (team: TeamColor) => void;
  onStart: () => void;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  onExit: () => void;
}
```

Update the function signature:

```tsx
export default function Lobby({ view, onAssign, onStart, onUpdateSettings, onExit }: LobbyProps) {
```

Add modal state next to the other `useState` calls:

```tsx
const [showSettings, setShowSettings] = useState(false);
```

Add a top bar with Exit (+ host-only Settings) right after the opening `<div className="page">`:

```tsx
<div className="lobby-top-bar">
  {isHost && (
    <button className="ghost-btn" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => setShowSettings(true)}>
      ⚙️ Settings
    </button>
  )}
  <button className="ghost-btn" style={{ width: 'auto', padding: '6px 12px' }} onClick={onExit}>
    🚪 Exit
  </button>
</div>
```

Render the modal at the end of the returned JSX, before the final closing `</div>`:

```tsx
{showSettings && isHost && (
  <SettingsModal view={view} onSave={onUpdateSettings} onClose={() => setShowSettings(false)} />
)}
```

- [ ] **Step 2: Wire the props in `app/room/[code]/page.tsx`.** Replace the lobby render:

```tsx
if (view.phase === 'lobby') {
  return (
    <Lobby
      view={view}
      onAssign={(team: TeamColor) => emit('assign-team', { code, playerId: myId, team })}
      onStart={() => emit('start-game', { code })}
      onUpdateSettings={(patch) => emit('update-settings', { code, settings: patch })}
      onExit={() => router.push('/')}
    />
  );
}
```

- [ ] **Step 3: Verify build + full test run**

Run: `npm run build && npm test`
Expected: Build compiles; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/Lobby.tsx "app/room/[code]/page.tsx"
git commit -m "feat: lobby Settings panel + Exit button"
```

---

### Task 5: Manual verification

- [ ] Build the app (`npm run build`), start it (`npm run start`), open `http://localhost:3000`, create a room.
- [ ] Confirm a host sees **⚙️ Settings** and **🚪 Exit** at the top of the Waiting Room.
- [ ] Open Settings, change board size to 9×9 and Plus to 4, Save → the lobby summary line updates.
- [ ] Click Exit → returns to the homepage.
- [ ] Confirm a non-host does **not** see the Settings button.

## Self-review notes
- Spec coverage: board size + seq + cards/hand + Plus/Minus counts editable in lobby ✓; Exit→home ✓; host-only ✓. (New special-card rows arrive in their own later phases.)
- Types: `applySettingsUpdate(Settings, Partial<Settings>)` consistent across Task 1/2; `onUpdateSettings(Partial<Settings>)` consistent across Task 4.
