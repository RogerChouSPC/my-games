import type { Card, Cell, Settings } from '@/types/game';
import { SPECIAL_KINDS } from '@/types/game';
import { makeEquation } from './equations';

let _id = 0;
const nextId = (): string => `card_${_id++}`;

type SpecialCounts = Pick<
  Settings,
  'plusCards' | 'minusCards' | 'freezeCards' | 'stealCards' | 'shieldCards' | 'bombCards' | 'rerollCards'
>;

// Which settings count drives how many of each special card go in the deck.
const SPECIAL_COUNT_KEY = {
  plus: 'plusCards',
  minus: 'minusCards',
  freeze: 'freezeCards',
  steal: 'stealCards',
  shield: 'shieldCards',
  bomb: 'bombCards',
  reroll: 'rerollCards',
} as const;

// One number card per number-cell on the board (so the board is exactly fillable),
// each carrying a freshly-generated equation, plus the configured special cards.
export function buildDeck(board: Cell[], settings: SpecialCounts): Card[] {
  const cards: Card[] = [];
  for (const cell of board) {
    if (cell.value === 'FREE') continue;
    cards.push({
      id: nextId(),
      kind: 'number',
      target: cell.value,
      equation: makeEquation(cell.value),
      color: cell.color,
    });
  }
  for (const kind of SPECIAL_KINDS) {
    const count = settings[SPECIAL_COUNT_KEY[kind]];
    for (let i = 0; i < count; i++) {
      cards.push({ id: nextId(), kind, target: null, equation: null, color: null });
    }
  }
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
