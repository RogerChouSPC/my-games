'use client';
import { useState } from 'react';
import type { ClientView, TeamColor } from '@/types/game';

const TEAM_LABEL: Record<TeamColor, string> = {
  red: 'Team Red',
  blue: 'Team Blue',
  green: 'Team Green',
  yellow: 'Team Yellow',
};

interface LobbyProps {
  view: ClientView;
  onAssign: (team: TeamColor) => void;
  onStart: () => void;
}

export default function Lobby({ view, onAssign, onStart }: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const isHost = view.myPlayerId === view.hostId;
  const allAssigned = view.players.every((p) => p.team !== null);
  const unassigned = view.players.filter((p) => p.team === null);

  const copyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const icon = (n: number) => `/icons/char_${String(n).padStart(2, '0')}.png`;

  return (
    <div className="page">
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span>🎯 Waiting Room</span>
      </div>

      <div className="room-code-bar">
        <div>
          <div className="code-label">Room Code</div>
          <div className="code-value">{view.code}</div>
        </div>
        <button className="copy-btn" onClick={copyLink}>
          {copied ? '✓ Copied' : '📋 Copy link'}
        </button>
      </div>

      <div className="settings-badge" style={{ marginBottom: 14, display: 'block' }}>
        {view.settings.boardSize}×{view.settings.boardSize} board · {view.settings.teamCount} teams ·{' '}
        {view.settings.sequencesToWin} seq to win · {view.settings.cardsPerPlayer} cards/player
      </div>

      {unassigned.length > 0 && (
        <div className="unassigned">
          <div className="field-label" style={{ marginBottom: 10 }}>
            👥 Not yet on a team
          </div>
          <div className="players-row" style={{ padding: 0 }}>
            {unassigned.map((p) => (
              <div key={p.id} className="player-pill">
                <img src={icon(p.icon)} alt={p.name} />
                <div>
                  <div className="pname">{p.name}</div>
                  <div className="pbadge">{p.id === view.hostId ? '👑 Host' : 'pick a team'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="teams-list">
        {view.teams.map((team) => {
          const members = view.players.filter((p) => p.team === team.color);
          const iAmHere = view.players.find((p) => p.id === view.myPlayerId)?.team === team.color;
          return (
            <div key={team.color} className={`team-card team-${team.color}`}>
              <div className="team-header">
                <div className="team-name">
                  <span className="team-dot" />
                  {TEAM_LABEL[team.color]}
                </div>
                <button
                  className="link"
                  onClick={() => onAssign(team.color)}
                  disabled={iAmHere}
                  style={{ opacity: iAmHere ? 0.4 : 1 }}
                >
                  {iAmHere ? 'You are here' : 'Join'}
                </button>
              </div>
              <div className="players-row">
                {members.length === 0 && <div className="empty-slot">＋ empty</div>}
                {members.map((p) => (
                  <div key={p.id} className="player-pill">
                    <img src={icon(p.icon)} alt={p.name} />
                    <div>
                      <div className="pname">{p.name}</div>
                      <div className="pbadge">{p.id === view.hostId ? '👑 Host' : 'player'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {isHost ? (
        <>
          <button className="primary-btn" disabled={!allAssigned} onClick={onStart}>
            ▶ Start Game
          </button>
          {!allAssigned && (
            <div className="waiting-note">All players must be on a team to start</div>
          )}
        </>
      ) : (
        <div className="waiting-note">Waiting for the host to start the game…</div>
      )}
    </div>
  );
}
