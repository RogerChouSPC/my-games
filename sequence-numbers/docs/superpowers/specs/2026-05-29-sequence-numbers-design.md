# Sequence Numbers — Web App Design Spec
**Date:** 2026-05-29  
**Status:** Approved

---

## Overview

A real-time multiplayer web game based on Sequence Numbers (math edition). Players are split into teams and take turns placing chips on a board by solving math equations on their cards. The first team to form the required number of five-or-six-in-a-row sequences wins the game. Sessions run multiple games with cumulative scoring until the host declares the last game.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend + Backend | Next.js (App Router) | Single repo, SSR, React UI |
| Real-time | Socket.io | Battle-tested for turn-based multiplayer |
| Hosting | Railway | Free tier, persistent WebSocket connections, one-command deploy |
| Language | TypeScript | Type safety for game state |

---

## Screens

### 1. Home
- "Create Room" button → goes to Create Room
- "Join Room" input → enter 4-character code → joins lobby

### 2. Create Room (host only)
Settings the host configures before the room opens:
- **Your name** (text input)
- **Number of teams:** 2 / 3 / 4
- **Board size:** 8×8 or 9×9
- **Sequences to win a game:** 2 / 3 / 4 / 5
- **Cards per player:** 2–5 (default: 3 for 8×8, 4 for 9×9)
- **Plus cards per deck:** 0–4 (default: 2) — wild, place chip anywhere
- **Minus cards per deck:** 0–4 (default: 2) — remove any opponent chip

### 3. Character Picker (every player on join)
- Enter display name
- Choose one of 26 hero icons (from `icons/char_01.png` – `char_26.png`)
- Confirm → enters lobby

### 4. Lobby / Waiting Room
- Displays room code (copy button)
- Shows game settings summary
- Unassigned players section
- Team cards (Red / Blue / Green / Yellow) — host drags players into teams
- "Start Game" button (host only, enabled when all players assigned)

### 5. Game Board
**Layout (top → bottom):**
- Top bar: turn indicator (pulsing dot + team colour) + per-team sequence score
- Player strip: avatar row with team dot, gold glow on active player, floating emoji reactions
- Board: full-width, square, auto-scales to screen
- Emoji panel: 😂 😢 😮 🔥 👏 😤 🎉 (tap to broadcast reaction)
- Hand cards: math equation cards (see Card Design below)

**Board:**
- 8×8: numbers 1–30, each appearing twice, 4 FREE SPACE corners, 5-in-a-row = 1 sequence
- 9×9: numbers 1–38 (38 appears 3×, 1–37 appear twice), 4 FREE SPACE corners, 6-in-a-row = 1 sequence
- Top half of board displayed upside-down (matching physical game)
- All numbers underlined

**Chip states:**
- **Blank side** (smooth gradient) — normal placed chip
- **Bumpy side** (dot texture + colour glow) — team has N-1 chips in a line (one away from sequence). Auto-flips to bumpy; flips back to blank if opponent breaks the line
- FREE SPACE counts as a chip for flip calculation
- Completed sequence: gold outline glow on all chips in the line

### 6. Between Games
- Shows per-team win count
- "Next Game" button (host)
- "Last Game!" button (host) — flags the current game as final

### 7. Final Winner Screen
- Champion team name + all member avatars bouncing
- Confetti animation
- Total game wins shown
- "Play Again" button — resets scores, returns to lobby

---

## Card Design

**Equation cards (coloured):**
- White card body
- Coloured header bar matching the board circle colour for that answer number (e.g. answer 19 = purple header, answer 6 = orange header)
- Large math equation in centre — no answer shown (e.g. `9 × 2`, `30 - 1`, `6 ÷ 2`)
- Colour label (e.g. "purple") as hint
- Equations randomly generated each round within 2-digit range using +, −, ×, ÷

**Plus card (wild):**
- Black card, gold "+" centre, white corner symbols
- Lets player place chip on any open board space

**Minus card (remove):**
- Black card, red "−" centre, white corner symbols
- Lets player remove any opponent chip (cannot remove a chip that is part of a completed sequence)

---

## Game Rules

### Turn order
- Game 1: random player goes first
- Subsequent games: winner of the previous game goes first

### On your turn
1. Tap a card from your hand
2. Tap the matching board space (or any space for Plus card / any opponent chip for Minus card)
3. A new card is drawn automatically to refill hand

### Chip flip logic (bumpy side)
- After every chip placement, check all 8 lines (horizontal, vertical, 4 diagonals) through that cell
- If any line contains exactly (sequence_length − 1) of your team's chips + 0 or more FREE SPACES (totalling sequence_length − 1): flip all chips in that line to bumpy
- If an opponent places a chip that breaks a bumpy line below threshold: flip affected chips back to blank

### Winning a game
- First team to complete the required number of sequences wins the game
- Sequence = sequence_length chips in a row (FREE SPACE counts as any team's chip)
- A chip can belong to at most one completed sequence

### Multi-game session
- After each game, scores accumulate
- Host chooses "Next Game" or "Last Game"
- After the last game completes, Final Winner screen shows the team with the most game wins
- Tie-breaker: most sequences in the final game

---

## Real-time Architecture

```
Client (Next.js)  ←→  Socket.io Server (Next.js API route)
                            ↕
                       Room State (in-memory, per room)
```

**Room state includes:**
- Room code, settings, phase (lobby / playing / between-games / finished)
- Players list (id, name, icon, team)
- Board state (64 or 81 cells: empty / team + blank / team + bumpy / sequence)
- Deck (remaining cards)
- Each player's hand
- Turn order, current turn index
- Per-team sequence count and game win count

**Socket events (key):**
- `create-room`, `join-room`, `assign-team`, `start-game`
- `play-card`, `place-chip`, `remove-chip`
- `send-reaction`
- `next-game`, `declare-last-game`
- `game-state` (broadcast after every state change)

---

## File Structure

```
/
├── app/
│   ├── page.tsx                  # Home screen
│   ├── room/
│   │   ├── create/page.tsx       # Create Room
│   │   └── [code]/
│   │       ├── page.tsx          # Lobby / Game (switches by phase)
│   │       └── layout.tsx
│   └── api/
│       └── socket/route.ts       # Socket.io server
├── components/
│   ├── Board.tsx                 # Game board (8x8 or 9x9)
│   ├── BoardCell.tsx             # Individual cell with chip overlay
│   ├── HandCards.tsx             # Player's card hand
│   ├── PlayerStrip.tsx           # Avatar row
│   ├── EmojiPanel.tsx            # Reaction buttons
│   ├── Lobby.tsx                 # Waiting room
│   ├── CharacterPicker.tsx       # Icon selection modal
│   ├── CreateRoom.tsx            # Room settings form
│   ├── BetweenGames.tsx          # Score screen
│   └── FinalWinner.tsx           # Champion screen
├── lib/
│   ├── game-logic.ts             # Sequence detection, chip flip logic, card generation
│   ├── board-layout.ts           # Fixed board number/colour layouts for 8x8 and 9x9
│   ├── deck.ts                   # Deck generation, shuffling, equation generation
│   └── socket-server.ts          # Room state management, event handlers
├── public/
│   └── icons/                    # char_01.png – char_26.png
└── styles/
    └── globals.css
```

---

## Deployment

1. Push to GitHub
2. Connect repo to Railway
3. Railway auto-detects Next.js, sets `npm run build && npm start`
4. Set environment variable: `NODE_ENV=production`
5. Share the Railway URL with players — no other setup needed
