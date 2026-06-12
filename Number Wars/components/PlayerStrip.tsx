'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Player } from '@/types/game';

const TEAM_HEX: Record<string, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  yellow: '#ffca28',
};

const MAX_VISIBLE = 6;

interface PlayerStripProps {
  players: Player[]; // already ordered as the turn queue: index 0 = player up now
  frozenIds?: string[];
  targetPlayers?: Set<string>; // opponents you can tap (Freeze or Steal)
  onTargetPlayer?: (playerId: string) => void;
}

export default function PlayerStrip({
  players,
  frozenIds = [],
  targetPlayers,
  onTargetPlayer,
}: PlayerStripProps) {
  const visible = players.slice(0, MAX_VISIBLE);
  const extra = players.length - visible.length;

  // FLIP: when the queue reorders (a turn passes), slide each avatar from its old
  // spot to its new one so players visibly "move down the line".
  const refs = useRef(new Map<string, HTMLDivElement>());
  const prevLeft = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    refs.current.forEach((el, id) => {
      const left = el.getBoundingClientRect().left;
      const old = prevLeft.current.get(id);
      if (old != null && Math.abs(old - left) > 0.5) {
        el.animate(
          [{ transform: `translateX(${old - left}px)` }, { transform: 'translateX(0)' }],
          { duration: 360, easing: 'cubic-bezier(.2,.7,.2,1)' }
        );
      }
    });
    const m = new Map<string, number>();
    refs.current.forEach((el, id) => m.set(id, el.getBoundingClientRect().left));
    prevLeft.current = m;
  });

  // Brief shatter on an avatar when a player thaws (leaves frozenIds).
  const [shattering, setShattering] = useState<string[]>([]);
  const prevFrozen = useRef<string[]>([]);
  useEffect(() => {
    const justThawed = prevFrozen.current.filter((id) => !frozenIds.includes(id));
    prevFrozen.current = frozenIds;
    if (justThawed.length === 0) return;
    setShattering((s) => [...s, ...justThawed]);
    const t = setTimeout(
      () => setShattering((s) => s.filter((id) => !justThawed.includes(id))),
      700
    );
    return () => clearTimeout(t);
  }, [frozenIds]);

  return (
    <div className="players-strip">
      {visible.map((p, idx) => {
        const isTarget = !!targetPlayers?.has(p.id);
        const frozen = frozenIds.includes(p.id);
        const shatter = shattering.includes(p.id);
        const active = idx === 0; // leftmost is up now
        return (
          <div
            key={p.id}
            ref={(el) => {
              if (el) refs.current.set(p.id, el);
              else refs.current.delete(p.id);
            }}
            className={`player-chip${active ? ' active-turn' : ''}${
              p.connected ? '' : ' disconnected'
            }${isTarget ? ' player-target' : ''}`}
            onClick={() => {
              if (isTarget) onTargetPlayer?.(p.id);
            }}
          >
            {active && <span className="now-tag">NOW</span>}
            {p.team && <span className="player-team-dot" style={{ background: TEAM_HEX[p.team] }} />}
            <div
              className="avatar-wrap"
              style={{ borderColor: p.team ? TEAM_HEX[p.team] : 'transparent' }}
            >
              <img src={`/icons/char_${String(p.icon).padStart(2, '0')}.png`} alt={p.name} />
              {frozen && <span className="ice-cube" />}
            </div>
            {shatter && <span className="ice-shatter">🧊</span>}
            <span className="nlbl">{p.name}</span>
          </div>
        );
      })}
      {extra > 0 && (
        <div className="player-chip overflow" key="overflow" title={`${extra} more player(s)`}>
          <div className="avatar-wrap overflow-ava">+{extra}</div>
          <span className="nlbl">more</span>
        </div>
      )}
    </div>
  );
}
