'use client';
import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import type { ClientView, TeamColor, Settings } from '@/types/game';
import SettingsModal from './SettingsModal';

const TEAM_NAME: Record<TeamColor, string> = {
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
  yellow: 'Yellow',
};

interface LobbyProps {
  view: ClientView;
  onAssign: (team: TeamColor) => void;
  onStart: () => void;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  onExit: () => void;
  onEditCharacter: () => void;
}

export default function Lobby({
  view,
  onAssign,
  onStart,
  onUpdateSettings,
  onExit,
  onEditCharacter,
}: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const mode = view.settings.mode;
  const isHost = view.myPlayerId === view.hostId;
  const realPlayers = view.players.filter((p) => !p.isSeat);
  const unassigned = realPlayers.filter((p) => p.team === null);
  const sidesInPlay = new Set(realPlayers.map((p) => p.team).filter(Boolean));

  // teams: every configured team must have a player. solo: at least two players. selftest: always.
  const canStart =
    mode === 'selftest'
      ? true
      : mode === 'solo'
        ? realPlayers.length >= 2
        : unassigned.length === 0 && sidesInPlay.size === view.settings.teamCount;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    QRCode.toDataURL(window.location.href, { width: 360, margin: 1 })
      .then(setQr)
      .catch(() => setQr(''));
  }, []);

  const copyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const icon = (n: number) => `/icons/char_${String(n).padStart(2, '0')}.png`;
  const myTeam = realPlayers.find((p) => p.id === view.myPlayerId)?.team ?? null;
  const TEAM_HEX: Record<TeamColor, string> = {
    red: '#ef5350',
    blue: '#42a5f5',
    green: '#66bb6a',
    yellow: '#ffca28',
  };

  const modeNoun = mode === 'teams' ? 'Teams' : mode === 'solo' ? 'Players' : 'Sides';
  const specialCards = (
    [
      ['➕', view.settings.plusCards],
      ['➖', view.settings.minusCards],
      ['🧊', view.settings.freezeCards],
      ['🦹', view.settings.stealCards],
      ['🛡️', view.settings.shieldCards],
      ['💣', view.settings.bombCards],
      ['🔀', view.settings.rerollCards],
    ] as const
  ).filter(([, n]) => n > 0);

  return (
    <div className="page">
      <div className="lobby-top-bar">
        <button
          className="ghost-btn"
          style={{ width: 'auto', padding: '6px 12px' }}
          onClick={onEditCharacter}
        >
          ✏️ Character
        </button>
        {isHost && (
          <button
            className="ghost-btn"
            style={{ width: 'auto', padding: '6px 12px' }}
            onClick={() => setShowSettings(true)}
          >
            ⚙️ Settings
          </button>
        )}
        <button className="ghost-btn" style={{ width: 'auto', padding: '6px 12px' }} onClick={onExit}>
          🚪 Exit
        </button>
      </div>

      {showSettings && isHost && (
        <SettingsModal view={view} onSave={onUpdateSettings} onClose={() => setShowSettings(false)} />
      )}

      <div className="card-title">⚔️ Waiting Room</div>

      {myTeam && (
        <div className="my-team-line" style={{ color: TEAM_HEX[myTeam] }}>
          <span className="pieces">
            <span className={`mini-chip ${myTeam}`} />
            <span className={`mini-chip ${myTeam}`} />
          </span>
          You&apos;re on {myTeam} Team
        </div>
      )}

      <div className="room-code-bar">
        <div>
          <div className="code-label">Room Code</div>
          <div className="code-value">{view.code}</div>
        </div>
        <button className="copy-btn" onClick={copyLink}>
          {copied ? '✓ Copied' : '📋 Copy link'}
        </button>
      </div>

      {/* Scan-to-join QR (hidden in self-test, where nobody else joins) */}
      {mode !== 'selftest' && qr && (
        <div className="qr-card">
          <img src={qr} alt="Scan to join" className="qr-img" />
          <div className="qr-title">📷 Scan to join</div>
          <div className="qr-sub">
            Point a phone camera here — or share code <strong>{view.code}</strong>
          </div>
        </div>
      )}

      <div className="game-settings">
        <div className="gs-grid">
          <div className="gs-stat">
            <span className="gs-val">
              {view.settings.boardSize}×{view.settings.boardSize}
            </span>
            <span className="gs-lbl">Board</span>
          </div>
          <div className="gs-stat">
            <span className="gs-val">{view.settings.sequencesToWin}</span>
            <span className="gs-lbl">Line Wins</span>
          </div>
          <div className="gs-stat">
            <span className="gs-val">{view.settings.cardsPerPlayer}</span>
            <span className="gs-lbl">Cards / Hand</span>
          </div>
          <div className="gs-stat">
            <span className="gs-val">{view.settings.teamCount}</span>
            <span className="gs-lbl">{modeNoun}</span>
          </div>
          <div className="gs-stat">
            <span className="gs-val">
              {view.settings.timerEnabled ? `${view.settings.timerSeconds}s` : 'Off'}
            </span>
            <span className="gs-lbl">Timer</span>
          </div>
        </div>
        {specialCards.length > 0 && (
          <div className="gs-cards">
            <span className="gs-cards-lbl">Special cards</span>
            {specialCards.map(([ic, n]) => (
              <span key={ic} className="gs-card-item">
                {ic}
                <span className="gs-card-n">×{n}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ---- Self-test ---- */}
      {mode === 'selftest' ? (
        <div className="card-panel" style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🧪</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Self-test mode</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            You&apos;ll control all {view.settings.teamCount} sides yourself, taking each turn in
            order. Great for trying out the game.
          </div>
        </div>
      ) : (
        <>
          {mode === 'teams' && unassigned.length > 0 && (
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
              const members = realPlayers.filter((p) => p.team === team.color);
              const iAmHere =
                realPlayers.find((p) => p.id === view.myPlayerId)?.team === team.color;
              const showJoin = mode === 'teams';
              if (mode === 'solo' && members.length === 0) return null;
              return (
                <div key={team.color} className={`team-card team-${team.color}`}>
                  <div className="team-card-main">
                    <div className="team-header">
                      <div className="team-name">
                        <span className="team-dot" />
                        {mode === 'teams' ? `Team ${TEAM_NAME[team.color]}` : TEAM_NAME[team.color]}
                      </div>
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
                  {showJoin && (
                    <button
                      className={`team-join-btn team-join-${team.color}`}
                      onClick={() => onAssign(team.color)}
                      disabled={iAmHere}
                    >
                      {iAmHere ? '✓ Joined' : 'Join'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {isHost ? (
        <>
          <button className="primary-btn" disabled={!canStart} onClick={onStart}>
            {mode === 'selftest' ? '▶ Start Self-Test' : '▶ Start Game'}
          </button>
          {!canStart && (
            <div className="waiting-note">
              {mode === 'solo'
                ? 'Need at least 2 players to start'
                : 'Every team must have at least one player before you can start'}
            </div>
          )}
        </>
      ) : (
        <div className="waiting-note">Waiting for the host to start the game…</div>
      )}
    </div>
  );
}
