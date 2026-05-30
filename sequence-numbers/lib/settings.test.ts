import { describe, it, expect } from 'vitest';
import { applySettingsUpdate } from './settings';
import type { Settings } from '@/types/game';

const base: Settings = {
  mode: 'teams',
  boardSize: 8,
  teamCount: 2,
  sequencesToWin: 2,
  cardsPerPlayer: 3,
  plusCards: 2,
  minusCards: 2,
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
