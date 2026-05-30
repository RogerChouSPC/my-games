'use client';
import type { CSSProperties } from 'react';
import type { TeamState, Player } from '@/types/game';

const TEAM_HEX: Record<string, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  yellow: '#ffca28',
};
const TEAM_EMOJI: Record<string, string> = {
  red: '🔴',
  blue: '🔵',
  green: '🟢',
  yellow: '🟡',
};
const TEAM_NAME: Record<string, string> = {
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
  yellow: 'Yellow',
};

interface TopBarProps {
  teams: TeamState[];
  sequencesToWin: number;
  activePlayer: Player | null;
  myTurn: boolean;
  selfTest?: boolean;
  onEndGame?: () => void;
}

export default function TopBar({
  teams,
  sequencesToWin,
  activePlayer,
  myTurn,
  selfTest,
  onEndGame,
}: TopBarProps) {
  const turnColor = activePlayer?.team ? TEAM_HEX[activePlayer.team] : '#888';
  // In self-test the host plays every side, so name the active side instead of "Your Turn".
  const label = selfTest
    ? `Playing: ${activePlayer?.name ?? '...'}`
    : myTurn
      ? 'Your Turn!'
      : `${activePlayer?.name ?? '...'}'s turn`;
  return (
    <div className="topbar">
      <div
        className="turn-badge"
        style={{ borderColor: turnColor, background: `${turnColor}22` }}
      >
        <span className="turn-dot" style={{ background: turnColor }} />
        <span className="turn-text" style={{ color: turnColor }}>
          {label}
        </span>
      </div>
      <div className="score-row">
        {teams.map((t) => {
          // Glow when a team is exactly one Line Win away from winning the game.
          const oneAway =
            t.sequencesThisGame >= 1 && t.sequencesThisGame === sequencesToWin - 1;
          return (
            <div
              key={t.color}
              className={`team-score-card${oneAway ? ' one-away' : ''}`}
              style={{ color: TEAM_HEX[t.color], ['--team' as string]: TEAM_HEX[t.color] } as CSSProperties}
              title={`${TEAM_NAME[t.color]} Team — ${t.sequencesThisGame} of ${sequencesToWin} Line Wins`}
            >
              <span className="tsc-top">
                {TEAM_EMOJI[t.color]} {t.sequencesThisGame}/{sequencesToWin}
              </span>
              <span className="tsc-label">LINE WINS</span>
            </div>
          );
        })}
        {onEndGame && (
          <button className="end-btn" onClick={onEndGame} title="End the game">
            ⏹ End
          </button>
        )}
      </div>
    </div>
  );
}
