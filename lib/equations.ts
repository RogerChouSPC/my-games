function rnd(n: number): number {
  return Math.floor(Math.random() * n);
}

// Build a random math equation (within 2-digit operands) that evaluates to `target`.
export function makeEquation(target: number): string {
  const forms: (() => string | null)[] = [
    // addition: a + b = target
    () => {
      const a = rnd(target + 1);
      return `${a} + ${target - a}`;
    },
    // subtraction: a - b = target
    () => {
      const a = target + 1 + rnd(20);
      return `${a} - ${a - target}`;
    },
    // multiplication: a × b = target (only if factorable with small factors)
    () => {
      if (target === 0) return `0 × ${1 + rnd(9)}`;
      for (let a = 2; a <= target; a++) {
        if (target % a === 0 && target / a <= 12 && a <= 12) return `${a} × ${target / a}`;
      }
      return null;
    },
    // division: (target × b) ÷ b = target
    () => {
      if (target === 0) return null;
      const b = 2 + rnd(8);
      if (target * b > 99) return null; // keep operands within 2 digits
      return `${target * b} ÷ ${b}`;
    },
  ];

  const shuffled = [...forms].sort(() => Math.random() - 0.5);
  for (const f of shuffled) {
    const eq = f();
    if (eq) return eq;
  }
  return `${target} + 0`;
}

export function evalEquation(eq: string): number {
  const [a, op, b] = eq.split(' ');
  const x = Number(a);
  const y = Number(b);
  switch (op) {
    case '+':
      return x + y;
    case '-':
      return x - y;
    case '×':
      return x * y;
    case '÷':
      return x / y;
    default:
      throw new Error(`bad op ${op}`);
  }
}
