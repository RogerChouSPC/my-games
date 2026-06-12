'use client';
import { useEffect, useRef, useState } from 'react';
import type { TeamColor } from '@/types/game';
import UnitSprite, { UNIT_RING, type UnitTier } from './UnitSprite';

// A team's army piece on a cell: squad by default, tank when its line won,
// jet when it's part of a full row (scores 2). Pops briefly on promotion.
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
  const tier: UnitTier = superSequence ? 'jet' : inSequence ? 'tank' : 'squad';

  const prevTier = useRef(tier);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (prevTier.current === tier) return;
    prevTier.current = tier;
    setPop(true);
    const t = setTimeout(() => setPop(false), 550);
    return () => clearTimeout(t);
  }, [tier]);

  const cls = ['unit'];
  if (bumpy) cls.push('bumpy');
  if (tier === 'tank') cls.push('in-sequence');
  if (tier === 'jet') cls.push('super');
  if (pop) cls.push('pop');

  return (
    <div className={cls.join(' ')} style={{ '--ring': UNIT_RING[team] } as React.CSSProperties}>
      <span className="unit-ring" />
      <UnitSprite tier={tier} team={team} />
    </div>
  );
}
