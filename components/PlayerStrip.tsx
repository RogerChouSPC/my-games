'use client';
import { useEffect, useState } from 'react';
import type { Player } from '@/types/game';
import type { ReactionEvent } from '@/lib/client/useSocket';

const TEAM_HEX: Record<string, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  yellow: '#ffca28',
};

interface PlayerStripProps {
  players: Player[];
  activePlayerId: string | null;
  reaction: ReactionEvent | null;
}

export default function PlayerStrip({ players, activePlayerId, reaction }: PlayerStripProps) {
  // Track the latest reaction per player so it floats up then clears.
  const [bubbles, setBubbles] = useState<Record<string, { emoji: string; key: number }>>({});

  useEffect(() => {
    if (!reaction) return;
    setBubbles((b) => ({ ...b, [reaction.playerId]: { emoji: reaction.emoji, key: reaction.key } }));
    const t = setTimeout(() => {
      setBubbles((b) => {
        const copy = { ...b };
        if (copy[reaction.playerId]?.key === reaction.key) delete copy[reaction.playerId];
        return copy;
      });
    }, 2000);
    return () => clearTimeout(t);
  }, [reaction]);

  return (
    <div className="players-strip">
      {players.map((p) => {
        const bubble = bubbles[p.id];
        return (
          <div
            key={p.id}
            className={`player-chip${p.id === activePlayerId ? ' active-turn' : ''}${
              p.connected ? '' : ' disconnected'
            }`}
          >
            {p.team && (
              <span className="player-team-dot" style={{ background: TEAM_HEX[p.team] }} />
            )}
            <div
              className="avatar-wrap"
              style={{ borderColor: p.team ? TEAM_HEX[p.team] : 'transparent' }}
            >
              <img src={`/icons/char_${String(p.icon).padStart(2, '0')}.png`} alt={p.name} />
            </div>
            <span className="nlbl">{p.name}</span>
            {bubble && (
              <span className="reaction-bubble" key={bubble.key}>
                {bubble.emoji}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
