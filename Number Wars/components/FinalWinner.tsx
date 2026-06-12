'use client';
import type { ClientView, TeamColor } from '@/types/game';

const TEAM_HEX: Record<TeamColor, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  yellow: '#ffca28',
};

const CONFETTI_COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#e040fb', '#7c4dff'];

interface FinalWinnerProps {
  view: ClientView;
  onPlayAgain: () => void;
}

export default function FinalWinner({ view, onPlayAgain }: FinalWinnerProps) {
  const isHost = view.myPlayerId === view.hostId;
  const champ = view.winners;
  const champTeam = view.teams.find((t) => t.color === champ);
  const members = view.players.filter((p) => p.team === champ);
  const icon = (n: number) => `/icons/char_${String(n).padStart(2, '0')}.png`;

  return (
    <div className="center-screen" style={{ position: 'relative' }}>
      <div className="confetti-wrap">
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className="confetti"
            style={{
              left: `${(i * 2.5) % 100}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDuration: `${2 + (i % 5) * 0.6}s`,
              animationDelay: `${(i % 7) * 0.3}s`,
            }}
          />
        ))}
      </div>

      <div style={{ position: 'relative', textAlign: 'center', zIndex: 2 }}>
        <div style={{ fontSize: 13, color: '#ffd700', letterSpacing: 3, marginBottom: 6 }}>
          🎊 CHAMPIONS 🎊
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: champ ? TEAM_HEX[champ] : '#fff',
            textTransform: 'uppercase',
          }}
        >
          {champ} Team
        </div>

        <div className="champ-avatars">
          {members.map((p, i) => (
            <img
              key={p.id}
              src={icon(p.icon)}
              alt={p.name}
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
          {members.map((p) => p.name).join(' & ')} — {champTeam?.gameWins}{' '}
          {champTeam?.gameWins === 1 ? 'game win' : 'game wins'}
        </div>

        <div style={{ fontSize: 26, marginBottom: 18 }}>🎆 🏆 🎆</div>

        {isHost ? (
          <button className="primary-btn" onClick={onPlayAgain}>
            🔄 Play Again
          </button>
        ) : (
          <div className="waiting-note">Thanks for playing! Host can start a new session.</div>
        )}
      </div>
    </div>
  );
}
