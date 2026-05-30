# Special Cards + Settings Panel — Design

**Date:** 2026-05-30
**Status:** Approved for spec review
**Author:** Roger + Claude

## Goal

Expand Sequence Numbers with a richer set of **special cards**, a host-facing
**Settings panel** to tune the deck and board, and a **themed animation** for
every card so plays feel dramatic. All changes stay server-authoritative and
test-covered.

## Scope

In scope:
- 5 new special cards: **Freeze, Steal, Shield, Bomb, Reroll** (Plus & Minus already exist).
- A **Settings panel** (host-only, in the lobby) with a special-card count table,
  board size, sequences-to-win, and cards-per-hand.
- An **Exit** button in the lobby that returns to the homepage.
- A shared **card-effect animation** system; one themed animation per card.

Out of scope (explicitly dropped / deferred):
- **Double Move** card — removed at Roger's request.
- Changing game **mode** or **team count** after room creation (those stay as created).
- A "thaw"/counter card for Freeze (possible future idea).

## The cards

All special cards **use the player's turn** (one action per turn), draw a
replacement card, then pass the turn — matching how Plus/Minus already behave.

| Card | Target | Effect |
|---|---|---|
| ➕ Plus *(exists)* | empty cell | Place your chip on any empty number cell (wild). |
| ➖ Minus *(exists)* | opponent cell | Remove an opponent chip that is **not** in a completed sequence **and not shielded**. |
| 🧊 Freeze | a **player** | That opponent's **next turn is skipped**. |
| 🦹 Steal | opponent cell | Flip an opponent chip (not in a sequence, **not shielded**) to **your** color. |
| 🛡️ Shield | your own cell | Permanently protect one of **your** chips for the rest of the game. |
| 💣 Bomb | a 2×2 area | **Destroy every chip** in the chosen 2×2 — including sequence-locked and shielded chips. |
| 🔀 Reroll | none | Discard your whole hand, draw a fresh full hand. |

### Rules & edge cases

- **Eligible Freeze target** = a player not on your team (in solo mode, any other
  player) who is **not already frozen**. No stacking; no freezing yourself/teammates.
- **Shield** protects against **Minus** and **Steal** only. **Bomb ignores shields**
  (destroys all). Shielded chips show a 🛡️ badge and last the whole game.
- **Bomb** anchor = the tapped cell is the **top-left** of the 2×2; the area is
  clamped so it always fits on the board. It clears `owner` (and `shielded`/`inSequence`)
  on all four cells, then the board is recomputed — so a team's sequence count can
  **drop** if their sequence was bombed. (Board freezes on a win, so you cannot bomb
  after the game is already won.)
- **Steal** can complete a sequence for you (and could even win) via the normal recompute.
- **Reroll** draws up to `cardsPerPlayer` cards; if the deck is short, draw what remains.
- **"Stuck" / discard interaction** (a player with no legal move must discard):
  a card counts as a legal move when —
  - Freeze: an eligible opponent exists.
  - Steal: a stealable opponent chip exists (opponent-owned, not in sequence, not shielded).
  - Shield: you own at least one un-shielded chip.
  - Bomb: at least one owned chip exists anywhere on the board.
  - Reroll: the deck has at least one card.

## Animations

Each play broadcasts a **transient card-effect event** to every client (reusing the
existing ephemeral broadcast pattern used by emoji reactions and the "super sequence"
celebration). Each client plays the matching themed animation locally.

| Card | ~3s themed animation | Lasting visual |
|---|---|---|
| 🧊 Freeze | victim icon encased in ice + "FROZEN!" frost | ice cube on the icon until their skipped turn → **shatters** |
| 🦹 Steal | chip spins/flips from their color to yours + "STOLEN!" | chip now your color |
| 🛡️ Shield | shield bubble pops over your chip + "SHIELDED!" | 🛡️ badge on chip, all game |
| 💣 Bomb | explosion + screen shake over the 2×2 + "BOOM!" | chips gone |
| 🔀 Reroll | cards whirl/shuffle + "REROLL!" | fresh hand |
| ➕ Plus / ➖ Minus | **quick ~0.6s** sparkle / poof (not a full overlay — these are played often) | place / remove chip |

The 5 power cards get the dramatic ~3-second overlay; Plus/Minus get a quick
flourish so frequent play isn't slowed. (Override available if Roger wants full
overlays on Plus/Minus.)

## Settings panel

- A **⚙️ Settings** button on the lobby/Waiting Room page (host-only), placed by the
  `8×8 board · 2 teams · …` summary line. Opens a modal panel.
- Editable in the **lobby, before the game starts** (deck is built at game start):
  - **Board size:** 8×8 / 9×9
  - **Sequences to win:** 1–4
  - **Cards per hand:** 2–5
  - **Special-card counts** (table, min 0 / max 4 each):

| Card | Default |
|---|---|
| ➕ Plus | **2** |
| ➖ Minus | **2** |
| 🧊 Freeze | 0 |
| 🦹 Steal | 0 |
| 🛡️ Shield | 0 |
| 💣 Bomb | 0 |
| 🔀 Reroll | 0 |

- Mode and team count remain as set at room creation.
- A **🚪 Exit** button on the lobby page navigates back to the homepage (`/`).

## Data model changes

- `CardKind`: add `'freeze' | 'steal' | 'shield' | 'bomb' | 'reroll'`.
- `Cell`: add `shielded: boolean`.
- `RoomState`: add `frozenPlayerIds: string[]` (synced to clients for the ice).
- `Settings`: add `freezeCards`, `stealCards`, `shieldCards`, `bombCards`, `rerollCards` (each 0–4).
- New transient client event: a **card-effect** payload `{ kind, ...details }` (like the existing `superEvent`/`reaction`), not part of persistent room state.

## Engine functions (server-authoritative)

One function per card, following the existing `playMinusCard` pattern (validate turn
→ validate target → mutate immutably → `recomputeBoardFlags` → `drawOne` → win/draw
check where relevant → `advanceTurn`):

- `freezeCard(room, playerId, targetPlayerId)` — adds target to `frozenPlayerIds`, advances turn.
- `stealCard(room, playerId, cellIndex)` — flips an eligible opponent cell to the player's team.
- `shieldCard(room, playerId, cellIndex)` — marks one of the player's own cells `shielded`.
- `bombCard(room, playerId, anchorIndex)` — clears the clamped 2×2.
- `rerollCard(room, playerId)` — replaces the hand with `cardsPerPlayer` fresh cards.
- `advanceTurn` — updated to **skip + unfreeze** a frozen player (emit a "shatter" effect),
  bounded by `turnOrder.length` to avoid loops.

Each new socket event (`play-freeze`, `play-steal`, `play-shield`, `play-bomb`,
`play-reroll`) re-validates identity/turn server-side via the existing
`resolveActor`/`applyAndBroadcast` helpers.

## Client targeting modes

- **Cell-target** (highlight board cells, existing flow): Plus, Minus, Steal, Shield, Bomb.
  - Steal highlights stealable opponent cells; Shield highlights your own chips; Bomb
    highlights 2×2 anchors and previews the blast square.
- **Player-target** (highlight opponents in the PlayerStrip, new): Freeze.
- **No-target** (play immediately, optional confirm): Reroll.

## Testing

Per-card unit tests in `lib/game-engine.test.ts`, e.g.:
- Freeze skips exactly one turn; can't target a teammate; ice clears after the skip.
- Steal converts an eligible chip; refuses sequence-locked/shielded chips.
- Shield blocks a later Minus/Steal on the same chip.
- Bomb clears a 2×2 including sequence/shielded chips; clamps at edges; sequence counts recompute.
- Reroll replaces the hand and respects a short deck.
- `buildDeck` includes the configured count of each special card.

## Build order (all shipped together, built + tested one at a time)

1. **Settings panel** + special-card counts + **Exit** button (delivers the 8×8/9×9 button request).
2. **Shared card-effect animation** system (the broadcaster + client player).
3. **Freeze** → **Steal** → **Shield** → **Reroll** → **Bomb**.
