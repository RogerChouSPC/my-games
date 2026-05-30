'use client';
import { useEffect, useRef, useState } from 'react';
import type { Player } from '@/types/game';

const TEAM_HEX: Record<string, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  yellow: '#ffca28',
};

interface PlayerStripProps {
  players: Player[];
  activePlayerId: string | null;
  frozenIds?: string[];
  freezeTargets?: Set<string>;
  onFreezeTarget?: (playerId: string) => void;
}

export default function PlayerStrip({
  players,
  activePlayerId,
  frozenIds = [],
  freezeTargets,
  onFreezeTarget,
}: PlayerStripProps) {
  const [shattering, setShattering] = useState<string[]>([]);
  const prevFrozen = useRef<string[]>([]);

  // When a player thaws (leaves frozenIds), play a brief shatter on their avatar.
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
      {players.map((p) => {
        const isTarget = !!freezeTargets?.has(p.id);
        const frozen = frozenIds.includes(p.id);
        const shatter = shattering.includes(p.id);
        return (
          <div
            key={p.id}
            className={`player-chip${p.id === activePlayerId ? ' active-turn' : ''}${
              p.connected ? '' : ' disconnected'
            }${isTarget ? ' freeze-target' : ''}`}
            onClick={() => {
              if (isTarget) onFreezeTarget?.(p.id);
            }}
          >
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
    </div>
  );
}
