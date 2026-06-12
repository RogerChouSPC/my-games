# Game Feel Update — Design

Date: 2026-06-12
Status: Approved by Roger (chat)

Three bundles of UX improvements identified by a three-reviewer audit, followed by
first public deployment to Render's free tier.

## 1. Sound + turn alert

- New `lib/client/sounds.ts`: synthesizes ~8 short retro-style effects with the Web
  Audio API (no asset files): card whoosh, bomb boom, freeze ice-crack, shield ting,
  steal swipe, reroll shuffle, line-win chime, super-line-win fanfare, turn-start ding.
- Sounds are triggered client-side from existing socket events (`card-effect`,
  `super-sequence`, state changes); no server changes needed.
- Mute toggle (🔊/🔇) in `TopBar`, persisted to `localStorage` (`nw-muted`).
- Turn alert: when `activePlayerId` becomes the local player, play the ding and flash
  the screen edge in the player's team color for ~1s (CSS keyframe on a fixed
  full-screen overlay border).
- Audio context unlocks on first user tap (mobile autoplay policy).

## 2. Action impact pack

- Bomb: board container gets a 0.5s shake animation when a bomb `card-effect` fires.
- Chip removal (Minus/Bomb): removed chips animate out (scale + rotate + fade ~0.3s)
  instead of disappearing instantly.
- `lastMove`/recent-plays: `freeze`, `steal`, `reroll` actions get visible banners
  broadcast to all players ("Alice froze Bob! ❄️", "Charlie stole a card from Dana 🦹",
  "Bob's turn skipped — frozen ❄️"). Implemented via the existing `card-effect`
  event payloads where possible; extend payload with actor/target names if missing.
- RecentPlays feed shows an emoji icon per card kind (💣 🧊 🦹 🛡️ 🔀 ➕ ➖).
- Shield self-confirmation: after playing Shield, the shield badge shows on the
  owner's chips for 2s then fades (still permanently hidden from opponents).
- Plus card: gold "WILD!" card-effect overlay when played.

## 3. Safety + onboarding

- Two-tap confirm for Bomb and Minus: first tap targets a cell and highlights exactly
  the chips that would be destroyed (red preview); second tap on the same cell
  confirms. Tapping elsewhere retargets; tapping the card again cancels.
- `HowToPlay` modal: 3 short illustrated steps (make lines to win / number cards place
  chips / action cards attack & defend). Auto-shows once per device
  (`localStorage` `nw-howto-seen`), reachable any time from a "?" button on the home
  page and in the room top bar.
- Reconnect banner: "Reconnecting…" on socket `disconnect`, "Reconnected ✓" (2s) on
  `connect`. Client-only, in the room page.
- Touch targets: settings stepper buttons and emoji buttons enlarged toward 44px;
  `touch-action: manipulation` + `user-select: none` on interactive elements to kill
  double-tap zoom.
- Stronger valid-target glow: thicker outline + inner shadow/background tint on
  `.cell.targetable`.

## 4. Deployment (after the above ships)

- Add `CURRENT-LINK.txt` to `.gitignore`.
- Commit the `sequence-numbers` → `Number Wars` folder rename at the repo root and
  push all pending commits to `RogerChouSPC/my-games`.
- Deploy on Render free tier (build `npm run build`, start `npm run start`,
  root directory `Number Wars`). Code audit found no blockers: PORT, socket URL, and
  QR link are all environment-relative already.

## Out of scope (possible later)

New action cards (Swap/Peek), colorblind chip patterns, landscape layout rework,
recorded sound assets.

## Testing

- Existing vitest suite must stay green; add/extend engine tests only if engine types
  change (e.g., card-effect payload fields).
- Manual smoke via dev server (and Playwright if needed): play each card, verify
  sound/animation/banner, confirm two-tap bomb flow, How-to-play modal, mute persistence.
