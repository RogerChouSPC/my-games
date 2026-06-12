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

- **Clean artwork approach**: Roger supplies each theme as plain terrain art with NO
  painted grid lines, NO FREE BASE medallions, NO frame labels. The game draws its own
  perfectly even grid, frame, and FREE BASE medallions on top — alignment is exact by
  construction and one image per theme serves both 8×8 and 9×9.
  - Expected assets (square PNG, ≥1024×1024) in `board theme/clean/`:
    `desert.png`, `ruins.png`, `city.png` → copied to `public/board-themes/`.
  - App-drawn overlay: thin semi-transparent dark grid lines (`#00000035`, ~1.5px),
    a dark frame border, and corner FREE BASE medallions recreating the artwork style
    (black disc, gold "FREE BASE" text).
  - Fallback: the grid-straightened originals in `board theme/fixed/` (with the
    calibration insets recorded in git history) remain usable if a clean image is
    missing — but the clean approach is the plan of record.
- New setting `boardTheme: 'desert' | 'ruins' | 'city'` (default `'desert'`).
  - Host picks on the Create Room page (3 preview thumbnails) and can change it in the
    lobby SettingsModal. Must be added to the `applySettingsUpdate` whitelist
    (`lib/settings.ts`) or lobby edits will be silently dropped.
- Rendering (`components/Board.tsx`, `app/globals.css`):
  - `.board-wrap` displays the theme image (`background-size: cover`); remove the gray
    frame/cell backgrounds. Cells become transparent hit areas with app-drawn grid lines.
  - FREE corners: app renders the FREE BASE medallion (replaces the current
    `.circle.free` black circle — same concept, war styling).
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
