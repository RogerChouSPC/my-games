'use client';
import type { ClientView, TeamColor } from '@/types/game';

const TEAM_HEX: Record<TeamColor, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  yellow: '#ffca28',
};
const TEAM_EMOJI: Record<TeamColor, string> = {
  red: '🔴',
  blue: '🔵',
  green: '🟢',
  yellow: '🟡',
};

interface BetweenGamesProps {
  view: ClientView;
  onNextGame: () => void;
  onLastGame: () => void;
}

export default function BetweenGames({ view, onNextGame, onLastGame }: BetweenGamesProps) {
  const isHost = view.myPlayerId === view.hostId;
  const ranked = [...view.teams].sort((a, b) => b.gameWins - a.gameWins);
  const lastWinner = ranked[0];

  return (
    <div className="center-screen">
      <div className="logo">
        <div className="logo-icon">🏆</div>
        <div className="logo-title" style={{ fontSize: 18 }}>
          Round Over
        </div>
        <div className="logo-sub">
          {TEAM_EMOJI[lastWinner.color]} {lastWinner.color.toUpperCase()} took the round
        </div>
      </div>

      <div className="score-board card-panel">
        <div className="field-label" style={{ marginBottom: 12 }}>
          Total game wins
        </div>
        {ranked.map((t) => (
          <div
            key={t.color}
            className="score-line"
            style={{ background: 'var(--bg)', borderLeft: `4px solid ${TEAM_HEX[t.color]}` }}
          >
            <span style={{ color: TEAM_HEX[t.color], fontWeight: 700 }}>
              {TEAM_EMOJI[t.color]} {t.color}
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: TEAM_HEX[t.color] }}>
              {t.gameWins} {t.gameWins === 1 ? 'win' : 'wins'}
            </span>
          </div>
        ))}
      </div>

      {isHost ? (
        <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 18 }}>
          <button className="primary-btn" onClick={onNextGame}>
            ▶ Next Game
          </button>
          <button className="ghost-btn" onClick={onLastGame}>
            🏁 Last Game!
          </button>
        </div>
      ) : (
        <div className="waiting-note" style={{ marginTop: 18 }}>
          Waiting for the host to start the next game…
        </div>
      )}
      {isHost && (
        <div className="waiting-note">
          “Last Game!” plays one final round, then crowns the champion.
        </div>
      )}
    </div>
  );
}
