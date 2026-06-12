'use client';
import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import type { ClientView, TeamColor, Settings } from '@/types/game';
import SettingsModal from './SettingsModal';

const TEAM_NAME: Record<TeamColor, string> = {
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
  purple: 'Purple',
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
  const [infoCard, setInfoCard] = useState<string | null>(null); // special card whose help is open
  const mode = view.settings.mode;
  const isHost = view.myPlayerId === view.hostId;
  const realPlayers = view.players.filter((p) => !p.isSeat);
  const unassigned = realPlayers.filter((p) => p.team === null);
  const sidesInPlay = new Set(realPlayers.map((p) => p.team).filter(Boolean));

  // teams: every configured team must have a player (manual) OR an even split (random).
  // solo: at least two players. selftest: always.
  const canStart =
    mode === 'selftest'
      ? true
      : mode === 'solo'
        ? realPlayers.length >= 2
        : view.settings.randomTeams
          ? realPlayers.length >= view.settings.teamCount &&
            realPlayers.length % view.settings.teamCount === 0
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
    purple: '#ab47bc',
  };

  const modeNoun = mode === 'teams' ? 'Teams' : mode === 'solo' ? 'Players' : 'Sides';
  const specialCards = [
    {
      key: 'plus', icon: '🪂', label: 'AIRDROP', name: 'Airdrop', accent: '#ffd54f', n: view.settings.plusCards,
      desc: 'Drop a chip on ANY open number — no matching equation needed. Great for completing a line.',
    },
    {
      key: 'minus', icon: '🎯', label: 'SNIPE', name: 'Snipe', accent: '#ff5252', n: view.settings.minusCards,
      desc: 'Shoot one enemy chip off the board. A hidden Shield on that chip will block the shot.',
    },
    {
      key: 'freeze', icon: '🧊', label: 'FREEZE', name: 'Freeze', accent: '#80d8ff', n: view.settings.freezeCards,
      desc: 'Pick an opponent — their next turn is skipped. The ice shatters once their turn passes.',
    },
    {
      key: 'steal', icon: '🥷', label: 'STEAL', name: 'Steal', accent: '#ce93d8', n: view.settings.stealCards,
      desc: 'Take a face-down card from an opponent’s hand into yours. You still play a card afterwards.',
    },
    {
      key: 'shield', icon: '🛡️', label: 'SHIELD', name: 'Shield', accent: '#fff176', n: view.settings.shieldCards,
      desc: 'Secretly protect up to 2 of your own chips. Each shield blocks one Snipe or Bomb, then breaks.',
    },
    {
      key: 'bomb', icon: '💣', label: 'BOMB', name: 'Bomb', accent: '#ff7043', n: view.settings.bombCards,
      desc: 'Blow up a 2×2 area, clearing every chip inside it. Shielded chips survive (their shield breaks).',
    },
    {
      key: 'reroll', icon: '🔀', label: 'REROLL', name: 'Reroll', accent: '#80cbc4', n: view.settings.rerollCards,
      desc: 'Swap one of your cards for two fresh ones. You still play a card afterwards.',
    },
  ];
  const openInfo = specialCards.find((c) => c.key === infoCard) ?? null;

  // ---- Team setup (teams mode): random draw vs choose-your-own ----
  const randomTeams = mode === 'teams' && view.settings.randomTeams;
  const playerCount = realPlayers.length;
  const teamsBalanced = playerCount >= view.settings.teamCount && playerCount % view.settings.teamCount === 0;

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
        <div className="gs-cards">
          <span className="gs-cards-lbl">Special cards in deck · tap to learn</span>
          <div className="gs-cards-row">
            {specialCards.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`gs-card${c.n === 0 ? ' off' : ''}`}
                onClick={() => setInfoCard(c.key)}
                aria-label={`${c.name} — how to use`}
              >
                <div className="mini-card" style={{ borderColor: c.n > 0 ? c.accent : undefined }}>
                  <span className="mini-card-icon">{c.icon}</span>
                  <span className="mini-card-label" style={{ color: c.n > 0 ? c.accent : undefined }}>
                    {c.label}
                  </span>
                  <span className="mini-card-help">?</span>
                </div>
                <span className="gs-card-count">×{c.n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* How-to-use popup for a tapped special card */}
      {openInfo && (
        <div className="overlay" onClick={() => setInfoCard(null)}>
          <div
            className="modal card-help-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-help-art" style={{ borderColor: openInfo.accent }}>
              <span className="card-help-icon">{openInfo.icon}</span>
              <span className="card-help-tag" style={{ color: openInfo.accent }}>
                {openInfo.label}
              </span>
            </div>
            <div className="card-help-name">{openInfo.name}</div>
            <div className="card-help-count">
              {openInfo.n > 0 ? `${openInfo.n} in this deck` : 'Not in this deck'}
            </div>
            <div className="card-help-desc">{openInfo.desc}</div>
            <button className="primary-btn" onClick={() => setInfoCard(null)}>
              Got it
            </button>
          </div>
        </div>
      )}

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
          {/* Team setup (teams mode): random draw vs choose-your-own */}
          {mode === 'teams' && (
            <div className="team-setup">
              <div className="team-setup-head">
                <div className="settings-row-label">🎲 Random teams</div>
                {isHost ? (
                  <button
                    type="button"
                    className={`toggle${randomTeams ? ' on' : ''}`}
                    onClick={() => onUpdateSettings({ randomTeams: !randomTeams })}
                    aria-pressed={randomTeams}
                    aria-label="Toggle random teams"
                  >
                    <span className="toggle-knob" />
                  </button>
                ) : (
                  <span className="team-setup-state">{randomTeams ? 'ON' : 'OFF'}</span>
                )}
              </div>
              <div className="settings-row-desc">
                {randomTeams
                  ? 'Nobody picks — sides are drawn randomly when the game starts. Teams must be even (e.g. 2-2, 3-3-3).'
                  : 'Each player joins the team they want below.'}
              </div>
            </div>
          )}

          {randomTeams ? (
            /* Random mode: one shared pool; teams are revealed at game start. */
            <div className="unassigned">
              <div className="field-label" style={{ marginBottom: 10 }}>
                🎲 Players ({playerCount}) — teams drawn at start
              </div>
              <div className="players-row" style={{ padding: 0 }}>
                {realPlayers.map((p) => (
                  <div key={p.id} className="player-pill">
                    <img src={icon(p.icon)} alt={p.name} />
                    <div>
                      <div className="pname">{p.name}</div>
                      <div className="pbadge">{p.id === view.hostId ? '👑 Host' : 'ready'}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`balance-note${teamsBalanced ? ' ok' : ''}`}>
                {teamsBalanced
                  ? `✓ Even split: ${view.settings.teamCount} teams of ${playerCount / view.settings.teamCount}`
                  : `Need an even split across ${view.settings.teamCount} teams — ${playerCount} player${playerCount === 1 ? '' : 's'} won’t divide evenly.`}
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
                : randomTeams
                  ? `Need an even number of players for ${view.settings.teamCount} teams before you can start`
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
