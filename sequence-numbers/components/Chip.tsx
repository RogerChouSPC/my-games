import type { TeamColor } from '@/types/game';

export default function Chip({
  team,
  bumpy,
  inSequence,
  superSequence,
}: {
  team: TeamColor;
  bumpy: boolean;
  inSequence: boolean;
  superSequence?: boolean;
}) {
  const cls = ['chip', `chip-${team}`];
  if (bumpy) cls.push('bumpy');
  if (inSequence) cls.push('in-sequence');
  return (
    <div className={cls.join(' ')}>
      {inSequence && <span className={`chip-star${superSequence ? ' super' : ''}`}>★</span>}
    </div>
  );
}
