'use client';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { TeamState, Player } from '@/types/game';

const TEAM_HEX: Record<string, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  purple: '#ab47bc',
};
const TEAM_NAME: Record<string, string> = {
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
  purple: 'Purple',
};

interface TopBarProps {
  teams: TeamState[];
  sequencesToWin: number;
  activePlayer: Player | null;
  myTurn: boolean;
  selfTest?: boolean;
  turnEndsAt?: number | null;
  onEndGame?: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
  onHelp?: () => void;
  leftSlot?: ReactNode; // player character icons, shown on the same row as the controls
  playedSlot?: ReactNode; // "Played cards" toggle, sits with the control icons
}

export default function TopBar({
  teams,
  sequencesToWin,
  activePlayer,
  myTurn,
  selfTest,
  turnEndsAt,
  onEndGame,
  muted,
  onToggleMute,
  onHelp,
  leftSlot,
  playedSlot,
}: TopBarProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!turnEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [turnEndsAt]);
  const remaining = turnEndsAt ? Math.max(0, Math.ceil((turnEndsAt - now) / 1000)) : null;

  // Whose turn it is is shown by the big flashing banner + player strip, so the top
  // bar no longer needs a persistent turn label — just the timer (when on) + controls.
  return (
    <div className="topbar">
      <div className="topbar-main">
        <div className="topbar-left">
          {leftSlot}
          {remaining !== null && (
            <span className={`turn-timer${remaining <= 10 ? ' low' : ''}`}>⏱ {remaining}s</span>
          )}
        </div>
        <div className="topbar-actions">
          {playedSlot}
          {onHelp && (
            <button className="icon-btn" onClick={onHelp} title="How to play">
              ?
            </button>
          )}
          {onToggleMute && (
            <button className="icon-btn" onClick={onToggleMute} title={muted ? 'Unmute sounds' : 'Mute sounds'}>
              {muted ? '🔇' : '🔊'}
            </button>
          )}
          {onEndGame && (
            <button className="end-btn" onClick={onEndGame} title="End the game">
              ⏹ End
            </button>
          )}
        </div>
      </div>
      <div className={`score-row teams-${teams.length}`}>
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
                {t.sequencesThisGame}/{sequencesToWin}
              </span>
              <span className="tsc-label">LINE WINS</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
