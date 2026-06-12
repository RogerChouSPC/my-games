# War Theme — Design

Date: 2026-06-12
Status: approved by Roger (visual demo reviewed in brainstorm companion on all 3 battlefields)

## Summary

Re-skin Number Wars as a full war game: painted battlefield boards, war-colored numbers,
army pieces (infantry squad → tank → fighter jet) instead of plain chips, a Purple team
replacing Yellow, and a new host setting "Show Answer's Location" that can turn off
target highlighting for a mental-math challenge.

No win-rule changes: a full row (8-in-a-row on 8×8 / 9-in-a-row on 9×9) already counts
as 2 line wins and fires the SUPER LINE WIN celebration — the jet tier re-skins that
existing mechanic. FREE BASE corners already count for every team's lines.

## 1. Battlefields (board backgrounds)

- Three artworks × two sizes = **6 board images**. Originals in `board theme/{8x8,9x9}/`;
  the originals have unevenly painted grid blocks (AI artifact), so they were
  **grid-straightened** (painted lines detected per row/column, all blocks re-sliced to
  uniform spacing) into `board theme/fixed/`:
  `desert-8.png, desert-9.png, ruins-8.png, ruins-9.png, city-8.png, city-9.png`.
  These fixed images are the production assets — copy them to `public/board-themes/`.
- New setting `boardTheme: 'desert' | 'ruins' | 'city'` (default `'desert'`).
  - Host picks on the Create Room page (3 preview thumbnails) and can change it in the
    lobby SettingsModal. Must be added to the `applySettingsUpdate` whitelist
    (`lib/settings.ts`) or lobby edits will be silently dropped.
- Rendering (`components/Board.tsx`, `app/globals.css`):
  - `.board-wrap` displays the theme image (`background-size: 100% 100%`); remove the
    gray frame/cell backgrounds. Cells become transparent hit areas; the artwork's
    baked-in grid lines do the visual work.
  - The grid overlay is inset from the wrap edge to match each artwork's painted frame.
    **Calibrated insets** (verified vs the fixed images with screenshot overlays;
    store as constants keyed by theme+size):

    | Board     | top  | right | bottom | left |
    |-----------|------|-------|--------|------|
    | desert-8  | 3.3% | 2.9%  | 3.0%   | 3.4% |
    | ruins-8   | 2.3% | 2.3%  | 2.3%   | 2.3% |
    | city-8    | 5.6% | 1.5%  | 1.4%   | 5.7% |
    | desert-9  | 3.3% | 2.5%  | 2.6%   | 3.4% |
    | ruins-9   | 2.0% | 2.0%  | 2.0%   | 2.0% |
    | city-9    | 3.0% | 2.4%  | 2.5%   | 3.0% |

    (city-8 has coordinate labels baked into its top/left frame; city-9 does not.)
  - FREE corners: artwork already shows "FREE BASE" medallions — render no circle there,
    keep the (non-interactive) cell.
  - Keep: targetable yellow outline, danger preview, removal brackets, bomb shake,
    last-move marker, shield badge, top-half number rotation.

## 2. War-colored numbers

- Number color buckets (replaces the 7-color `value % 7` palette in `lib/board-layout.ts`):
  - 1–10 → green `#43a047`, white outline
  - 11–20 → red `#e53935`, white outline
  - 21–30 → yellow `#fdd835`, **black** outline
  - 31–38 → blue `#1e88e5`, white outline (only occurs on 9×9 boards)
- `colorFor(value)` returns the bucket hex; `cell.color` keeps working as today.
  The outline color is derived client-side: yellow bucket → black, otherwise white.
- Board display: the solid colored circle is replaced by a translucent dark disc
  (`#00000042`, inset ~14% of the cell) with the bold colored, outlined digit on top —
  readable on all three artworks (validated in demo).
- Cards (`HandCards`, `RerollPicker`): unchanged layout; the header/footer color now
  comes from the same bucket (it already copies `cell.color` via `lib/deck.ts`), so a
  card's color always matches its number's color on the board.
- Update `lib/deck.test.ts` / board-layout tests for the new palette.

## 3. Army pieces (replaces chips)

- Style: flat bold-outline vector recreations of Roger's sprite sheet (approved in demo).
  Implemented as inline SVG symbols in a new `components/UnitSprite.tsx` — no image
  files, sharp at all sizes, tinted per team via CSS variable.
- Tiers map to existing per-cell flags (`types/game.ts`):
  - default → **infantry squad** (3 helmeted heads)
  - `inSequence` → **tank** (white hull, team turret)
  - `superSequence` → **fighter jet** (team fuselage, white wings)
- Each piece stands on its team's circle at 50% opacity (replaces the solid CSS chip).
- Team body colors (military tones from the sheet): red `#d32f2f`, blue `#1e3a5c`,
  green `#3a5232`, purple `#6d3fa3`. Ring colors stay the bright team hexes.
- State styling:
  - `bumpy` (one-away): pulsing brighter ring instead of the dotted texture.
  - `inSequence`/`superSequence`: keep the gold glow pulse; **drop the ★ star** — the
    tank/jet itself is the signal.
  - Tier upgrade animation: quick scale-pop when a cell's tier rises; new short
    "upgrade" synth in `lib/client/sounds.ts` for squad→tank (jet keeps the existing
    'super' sound + SUPER LINE WIN overlay).
- `components/Chip.tsx` is replaced/rewritten around `UnitSprite`.

## 4. Purple team (replaces Yellow)

- `TeamColor`: `'yellow'` → `'purple'` across the codebase (type, server engine, CSS
  classes `.team-yellow`→`.team-purple`, chip/unit classes, and the `TEAM_HEX` constant
  duplicated in 8 components). Purple hex: `#ab47bc`.
- All UI text "Yellow" → "Purple". Game logic is color-name agnostic otherwise.
- Update any tests referencing 'yellow'.

## 5. "Show Answer's Location" toggle

- New setting `showAnswerLocations: boolean` (default `true` — current behavior).
  Added to: `Settings` type, Create Room page (toggle), lobby SettingsModal,
  `applySettingsUpdate` whitelist. Room-wide rule (fair for all players).
- When **off** and a **number card** is selected:
  - No `targetable` highlights and no dimming of other cells.
  - The client still computes valid targets internally: tapping a correct empty cell
    plays normally; tapping any other cell triggers a local shake + new "wrong" buzz
    sound (no server round-trip).
  - Hand hint label changes to "🧮 Solve the equation and find the number on the board!"
- Special cards (Airdrop/Snipe/Bomb/etc.) always show their highlights — no math to solve.
- Dead-card "swap" tag stays visible regardless of the toggle (prevents unexplained
  stuck states).

## 6. Out of scope / unchanged

- Win rules, scoring, super-sequence ×2, timers, special-card logic, sounds (except the
  two new ones), reconnect, lobby flow, QR join.
- The old `sequence-numbers` visual theme is fully replaced; no theme on/off switch.
- HowToPlay text gets a light touch-up to mention squads/tanks/jets and the battlefields.

## Testing

- Unit tests: new `colorFor` buckets, `applySettingsUpdate` accepts `boardTheme` +
  `showAnswerLocations`, team rename, deck/card color invariant still holds.
- Visual: Playwright screenshots of all 3 themes × both sizes for grid alignment;
  manual self-test game to verify tier upgrades and the hard-mode toggle.
