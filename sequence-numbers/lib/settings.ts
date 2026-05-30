import type { Settings, BoardSize } from '@/types/game';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

// Apply a host's lobby settings change. mode and teamCount are fixed at creation,
// so they're ignored here; everything else is clamped to its valid range.
export function applySettingsUpdate(current: Settings, patch: Partial<Settings>): Settings {
  const next = { ...current };
  if (patch.boardSize === 8 || patch.boardSize === 9) next.boardSize = patch.boardSize as BoardSize;
  if (typeof patch.sequencesToWin === 'number') next.sequencesToWin = clamp(patch.sequencesToWin, 1, 4);
  if (typeof patch.cardsPerPlayer === 'number') next.cardsPerPlayer = clamp(patch.cardsPerPlayer, 2, 5);
  if (typeof patch.plusCards === 'number') next.plusCards = clamp(patch.plusCards, 0, 4);
  if (typeof patch.minusCards === 'number') next.minusCards = clamp(patch.minusCards, 0, 4);
  if (typeof patch.freezeCards === 'number') next.freezeCards = clamp(patch.freezeCards, 0, 4);
  if (typeof patch.stealCards === 'number') next.stealCards = clamp(patch.stealCards, 0, 4);
  if (typeof patch.shieldCards === 'number') next.shieldCards = clamp(patch.shieldCards, 0, 4);
  if (typeof patch.bombCards === 'number') next.bombCards = clamp(patch.bombCards, 0, 4);
  if (typeof patch.rerollCards === 'number') next.rerollCards = clamp(patch.rerollCards, 0, 4);
  if (typeof patch.timerEnabled === 'boolean') next.timerEnabled = patch.timerEnabled;
  if (typeof patch.timerSeconds === 'number') next.timerSeconds = clamp(patch.timerSeconds, 10, 120);
  return next;
}
