export type TeamColor = 'red' | 'blue' | 'green' | 'purple';
export type BoardSize = 8 | 9;
export type Phase = 'lobby' | 'playing' | 'between' | 'final';

// teams    = players grouped into 2-4 teams (manual assignment)
// solo     = each player is their own side, auto-assigned a color (1v1 up to 4 players)
// selftest = a single person controls every side (hotseat, for testing)
export type GameMode = 'teams' | 'solo' | 'selftest';

export type BoardTheme = 'desert' | 'ruins' | 'city';

export interface Settings {
  mode: GameMode;
  boardSize: BoardSize;
  boardTheme: BoardTheme; // which battlefield artwork the board uses
  showAnswerLocations: boolean; // false = hard mode: number cards don't highlight their cells
  teamCount: 2 | 3 | 4; // teams: # teams · solo: # players · selftest: # sides
  randomTeams: boolean; // teams mode: true = sides drawn randomly (balanced) at game start
  sequencesToWin: number; // 1..4
  cardsPerPlayer: number; // 2..5
  plusCards: number; // 0..4 (per deck)
  minusCards: number; // 0..4 (per deck)
  freezeCards: number; // 0..4 (per deck)
  stealCards: number; // 0..4 (per deck)
  shieldCards: number; // 0..4 (per deck)
  bombCards: number; // 0..4 (per deck)
  rerollCards: number; // 0..4 (per deck)
  timerEnabled: boolean; // per-player move timer on/off
  timerSeconds: number; // 10..120 seconds per turn (when enabled)
}

export interface Player {
  id: string; // stable id stored in browser localStorage
  name: string;
  icon: number; // 1..30
  team: TeamColor | null;
  connected: boolean;
  isSeat?: boolean; // synthetic seat in self-test mode (controlled by the host)
}

export type CardKind = 'number' | 'plus' | 'minus' | 'freeze' | 'steal' | 'shield' | 'bomb' | 'reroll';

// Special cards (everything except number cards) carry no target/equation/color.
export const SPECIAL_KINDS = ['plus', 'minus', 'freeze', 'steal', 'shield', 'bomb', 'reroll'] as const;

export interface Card {
  id: string;
  kind: CardKind;
  target: number | null; // answer for number cards; null for plus/minus
  equation: string | null; // e.g. "9 × 2"; null for plus/minus
  color: string | null; // hex for header bar; null for plus/minus
}

export type CellOwner = TeamColor | null;

export interface Cell {
  index: number;
  value: number | 'FREE'; // target number or FREE corner
  color: string; // hex
  owner: CellOwner; // which team's chip sits here
  bumpy: boolean; // showing bumpy (near-sequence) side
  inSequence: boolean; // locked into a completed sequence
  superSequence?: boolean; // part of a full-length line (scores 2) → gold star
  shielded?: boolean; // protected from Minus/Bomb for the rest of the game
}

export interface TeamState {
  color: TeamColor;
  sequencesThisGame: number;
  gameWins: number;
}

// One entry in the "last plays" feed. value = a number card's answer; null for specials.
export interface RecentPlay {
  playerId: string;
  kind: CardKind;
  value: number | null;
}

export interface RoomState {
  code: string;
  phase: Phase;
  settings: Settings;
  players: Player[];
  teams: TeamState[];
  board: Cell[];
  hands: Record<string, Card[]>; // playerId → cards (server sends only own hand to each client)
  deckCount: number; // remaining cards (count only, deck hidden)
  turnOrder: string[]; // playerIds
  currentTurn: number; // index into turnOrder
  lastMove: { index: number; playerId: string; kind: 'place' | 'remove' | 'bomb' } | null;
  hostId: string;
  isLastGame: boolean;
  winners: TeamColor | null; // overall champion, set in 'final'
  roundWinner: TeamColor | null; // team that just won this game; board freezes until host continues
  roundWinnerPlayerId: string | null; // the player who placed the winning chip (goes first next game)
  roundWinnerGif: string | null; // random celebration gif shown centre-board on a win
  roundTie: boolean; // game ended with no winner (board/deck exhausted); no points awarded
  superCount: number; // total full-length-line ("super") sequences on the board
  frozenPlayerIds: string[]; // players whose next turn is skipped (Freeze card); ice shatters on skip
  recentPlays: RecentPlay[]; // last few cards played (newest last), capped at 5

  turnEndsAt?: number | null; // epoch ms the current turn auto-resolves (when the timer is on)
}

// Server-only state extends RoomState with the live deck (never sent to clients).
export interface ServerRoom extends RoomState {
  _deck: Card[];
}

// Socket payload sent to each client (their own hand only).
export interface ClientView extends Omit<RoomState, 'hands'> {
  myHand: Card[];
  myPlayerId: string;
  handCounts: Record<string, number>; // playerId → number of cards (for Steal's blind pick)
}

export interface PlayerInput {
  id: string;
  name: string;
  icon: number;
}
