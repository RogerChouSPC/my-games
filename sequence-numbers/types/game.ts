export type TeamColor = 'red' | 'blue' | 'green' | 'yellow';
export type BoardSize = 8 | 9;
export type Phase = 'lobby' | 'playing' | 'between' | 'final';

export interface Settings {
  boardSize: BoardSize;
  teamCount: 2 | 3 | 4;
  sequencesToWin: number; // 1..4
  cardsPerPlayer: number; // 2..5
  plusCards: number; // 0..4 (per deck)
  minusCards: number; // 0..4 (per deck)
}

export interface Player {
  id: string; // stable id stored in browser localStorage
  name: string;
  icon: number; // 1..26
  team: TeamColor | null;
  connected: boolean;
}

export type CardKind = 'number' | 'plus' | 'minus';

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
  hands: Record<string, Card[]>; // playerId → cards (server sends only own hand to each client)
  deckCount: number; // remaining cards (count only, deck hidden)
  turnOrder: string[]; // playerIds
  currentTurn: number; // index into turnOrder
  lastMove: { index: number; playerId: string } | null;
  hostId: string;
  isLastGame: boolean;
  winners: TeamColor | null; // set in 'final'
}

// Server-only state extends RoomState with the live deck (never sent to clients).
export interface ServerRoom extends RoomState {
  _deck: Card[];
}

// Socket payload sent to each client (their own hand only).
export interface ClientView extends Omit<RoomState, 'hands'> {
  myHand: Card[];
  myPlayerId: string;
}

export interface PlayerInput {
  id: string;
  name: string;
  icon: number;
}
