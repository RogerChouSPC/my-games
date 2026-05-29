import { describe, it, expect } from 'vitest';
import { makeEquation, evalEquation } from './equations';

describe('makeEquation / evalEquation', () => {
  it('produces an equation that evaluates to the target for 0..38', () => {
    for (let t = 0; t <= 38; t++) {
      for (let k = 0; k < 30; k++) {
        const eq = makeEquation(t);
        expect(evalEquation(eq)).toBe(t);
      }
    }
  });
  it('uses only + - × ÷ between two integers', () => {
    for (let k = 0; k < 50; k++) {
      expect(makeEquation(12)).toMatch(/^\d+ [+\-×÷] \d+$/);
    }
  });
});
