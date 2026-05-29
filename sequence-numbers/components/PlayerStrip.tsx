'use client';
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
}

export default function PlayerStrip({ players, activePlayerId }: PlayerStripProps) {
  return (
    <div className="players-strip">
      {players.map((p) => (
        <div
          key={p.id}
          className={`player-chip${p.id === activePlayerId ? ' active-turn' : ''}${
            p.connected ? '' : ' disconnected'
          }`}
        >
          {p.team && <span className="player-team-dot" style={{ background: TEAM_HEX[p.team] }} />}
          <div
            className="avatar-wrap"
            style={{ borderColor: p.team ? TEAM_HEX[p.team] : 'transparent' }}
          >
            <img src={`/icons/char_${String(p.icon).padStart(2, '0')}.png`} alt={p.name} />
          </div>
          <span className="nlbl">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
