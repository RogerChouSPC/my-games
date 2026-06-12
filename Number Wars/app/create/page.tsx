'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Settings, BoardSize, GameMode, BoardTheme } from '@/types/game';
import { useSocket, getPlayerId, getSavedProfile, saveProfile } from '@/lib/client/useSocket';
import CharacterPicker from '@/components/CharacterPicker';

export default function CreateRoom() {
  const router = useRouter();
  const { emit, onJoined, connected } = useSocket();

  const [profile, setProfile] = useState<{ name: string; icon: number } | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [mode, setMode] = useState<GameMode>('teams');
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('desert');
  const [showAnswerLocations, setShowAnswerLocations] = useState(true);
  const [teamCount, setTeamCount] = useState<2 | 3 | 4>(2);
  const [sequencesToWin, setSequencesToWin] = useState(2);
  const [cardsPerPlayer, setCardsPerPlayer] = useState(3);
  const [cardsTouched, setCardsTouched] = useState(false);
  // Special-card counts per deck (0-4 each), tunable here and later in the lobby.
  const [special, setSpecial] = useState({
    plus: 2,
    minus: 2,
    freeze: 0,
    steal: 0,
    shield: 0,
    bomb: 0,
    reroll: 0,
  });

  useEffect(() => {
    const p = getSavedProfile();
    if (p) setProfile(p);
    else setShowPicker(true);
  }, []);

  // Cards-per-player default follows board size unless the host changed it.
  useEffect(() => {
    if (!cardsTouched) setCardsPerPlayer(boardSize === 8 ? 3 : 4);
  }, [boardSize, cardsTouched]);

  useEffect(() => {
    onJoined((code) => router.push(`/room/${code}`));
  }, [onJoined, router]);

  const create = () => {
    if (!profile) {
      setShowPicker(true);
      return;
    }
    const settings: Settings = {
      mode,
      boardSize,
      boardTheme,
      showAnswerLocations,
      teamCount,
      randomTeams: false,
      sequencesToWin,
      cardsPerPlayer,
      plusCards: special.plus,
      minusCards: special.minus,
      freezeCards: special.freeze,
      stealCards: special.steal,
      shieldCards: special.shield,
      bombCards: special.bomb,
      rerollCards: special.reroll,
      timerEnabled: false,
      timerSeconds: 30,
    };
    emit('create-room', {
      player: { id: getPlayerId(), name: profile.name, icon: profile.icon },
      settings,
    });
  };

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const bump = (k: keyof typeof special, d: number) =>
    setSpecial((s) => ({ ...s, [k]: clamp(s[k] + d, 0, 4) }));

  const SPECIALS: { key: keyof typeof special; icon: string; name: string; desc: string }[] = [
    { key: 'plus', icon: '🪂', name: 'Airdrop', desc: 'Drop a chip on any empty number' },
    { key: 'minus', icon: '🎯', name: 'Snipe', desc: 'Shoot one enemy chip off the board' },
    { key: 'freeze', icon: '🧊', name: 'Freeze', desc: "Skip an opponent's next turn" },
    { key: 'steal', icon: '🦹', name: 'Steal', desc: "Take a hidden card from an opponent's hand" },
    { key: 'shield', icon: '🛡️', name: 'Shield', desc: 'Secretly shield 2 of your chips (one-time)' },
    { key: 'bomb', icon: '💣', name: 'Bomb', desc: 'Blow up a 2×2 patch of chips' },
    { key: 'reroll', icon: '🔀', name: 'Reroll', desc: 'Swap this + one chosen card for 2 new' },
  ];

  return (
    <main className="page">
      {showPicker && (
        <CharacterPicker
          initialName={profile?.name}
          initialIcon={profile?.icon}
          onConfirm={(name, icon) => {
            saveProfile(name, icon);
            setProfile({ name, icon });
            setShowPicker(false);
          }}
        />
      )}

      <button className="link" onClick={() => router.push('/')} style={{ marginBottom: 8 }}>
        ← Back
      </button>

      <div className="logo">
        <div className="logo-icon">⚔️</div>
        <div className="logo-title" style={{ fontSize: 22 }}>
          Create Room
        </div>
      </div>

      <div className="card-panel">
        {/* Game mode */}
        <div className="field">
          <div className="field-label">Game Mode</div>
          <div className="opt-cards">
            <div className={`opt-card${mode === 'teams' ? ' active' : ''}`} onClick={() => setMode('teams')}>
              <div className="size" style={{ fontSize: 22 }}>👥</div>
              <div className="rule">Teams<br />2–4 teams</div>
            </div>
            <div className={`opt-card${mode === 'solo' ? ' active' : ''}`} onClick={() => setMode('solo')}>
              <div className="size" style={{ fontSize: 22 }}>⚔️</div>
              <div className="rule">Solo<br />each player alone</div>
            </div>
            <div className={`opt-card${mode === 'selftest' ? ' active' : ''}`} onClick={() => setMode('selftest')}>
              <div className="size" style={{ fontSize: 22 }}>🧪</div>
              <div className="rule">Self-test<br />play all sides</div>
            </div>
          </div>
        </div>

        {/* Your identity */}
        <div className="field">
          <div className="field-label">You</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {profile && (
              <img
                src={`/icons/char_${String(profile.icon).padStart(2, '0')}.png`}
                alt="you"
                style={{ width: 40, height: 40, borderRadius: 8 }}
              />
            )}
            <span style={{ fontWeight: 700 }}>{profile?.name ?? '...'}</span>
            <button className="link" onClick={() => setShowPicker(true)} style={{ marginLeft: 'auto' }}>
              change
            </button>
          </div>
        </div>

        {/* Number of teams / players / sides */}
        <div className="field">
          <div className="field-label">
            {mode === 'teams' ? 'Number of Teams' : mode === 'solo' ? 'Number of Players' : 'Number of Sides'}
          </div>
          <div className="chip-row">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                className={`pill${teamCount === n ? ' active' : ''}`}
                onClick={() => setTeamCount(n as 2 | 3 | 4)}
              >
                {n} {mode === 'teams' ? 'Teams' : mode === 'solo' ? 'Players' : 'Sides'}
              </button>
            ))}
          </div>
        </div>

        {/* Board size */}
        <div className="field">
          <div className="field-label">Board Size</div>
          <div className="opt-cards">
            <div className={`opt-card${boardSize === 8 ? ' active' : ''}`} onClick={() => setBoardSize(8)}>
              <div className="size">8 × 8</div>
              <div className="rule">Numbers 1–30<br />5 in a row = a Line Win</div>
            </div>
            <div className={`opt-card${boardSize === 9 ? ' active' : ''}`} onClick={() => setBoardSize(9)}>
              <div className="size">9 × 9</div>
              <div className="rule">Numbers 1–38<br />6 in a row = a Line Win</div>
            </div>
          </div>
        </div>

        {/* Sequences to win */}
        <div className="field">
          <div className="field-label">Line Wins to Win a Game</div>
          <div className="num-btns">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                className={`num-btn${sequencesToWin === n ? ' active' : ''}`}
                onClick={() => setSequencesToWin(n)}
              >
                <div className="n">{n}</div>
                <div className="lbl">seq</div>
              </button>
            ))}
          </div>
        </div>

        {/* Cards per player */}
        <div className="field">
          <div className="field-label">🃏 Cards per Player</div>
          <div className="field-hint">Default: 3 for 8×8 · 4 for 9×9 — Min 2 · Max 5</div>
          <div className="num-btns">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`num-btn${cardsPerPlayer === n ? ' active' : ''}`}
                onClick={() => {
                  setCardsTouched(true);
                  setCardsPerPlayer(n);
                }}
              >
                <div className="n">{n}</div>
                <div className="lbl">cards</div>
              </button>
            ))}
          </div>
        </div>

        <div className="divider" />

        {/* Special cards — same layout as the in-game settings panel */}
        <div className="field-label" style={{ marginBottom: 4 }}>
          Special Cards (per deck · Min 0 · Max 4)
        </div>
        {SPECIALS.map((s) => (
          <div className="settings-row" key={s.key}>
            <div>
              <div className="settings-row-label">
                {s.icon} {s.name}
              </div>
              <div className="settings-row-desc">{s.desc}</div>
            </div>
            <div className="stepper-ctrls">
              <button className="step-btn" onClick={() => bump(s.key, -1)}>
                −
              </button>
              <span className="stepper-val" style={{ textAlign: 'center' }}>
                {special[s.key]}
              </span>
              <button className="step-btn" onClick={() => bump(s.key, +1)}>
                +
              </button>
            </div>
          </div>
        ))}

        <div className="divider" />

        <button className="primary-btn" disabled={!connected || !profile} onClick={create}>
          {connected ? 'Create Room →' : 'Connecting…'}
        </button>
      </div>
    </main>
  );
}
