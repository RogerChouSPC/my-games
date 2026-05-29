import type { Card, Cell, Settings } from '@/types/game';
import { makeEquation } from './equations';

let _id = 0;
const nextId = (): string => `card_${_id++}`;

// One number card per number-cell on the board (so the board is exactly fillable),
// each carrying a freshly-generated equation, plus the configured plus/minus cards.
export function buildDeck(board: Cell[], settings: Pick<Settings, 'plusCards' | 'minusCards'>): Card[] {
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
  for (let i = 0; i < settings.plusCards; i++) {
    cards.push({ id: nextId(), kind: 'plus', target: null, equation: null, color: null });
  }
  for (let i = 0; i < settings.minusCards; i++) {
    cards.push({ id: nextId(), kind: 'minus', target: null, equation: null, color: null });
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
