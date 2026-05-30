'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Settings, BoardSize, GameMode } from '@/types/game';
import { useSocket, getPlayerId, getSavedProfile, saveProfile } from '@/lib/client/useSocket';
import CharacterPicker from '@/components/CharacterPicker';

export default function CreateRoom() {
  const router = useRouter();
  const { emit, onJoined, connected } = useSocket();

  const [profile, setProfile] = useState<{ name: string; icon: number } | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [mode, setMode] = useState<GameMode>('teams');
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  const [teamCount, setTeamCount] = useState<2 | 3 | 4>(2);
  const [sequencesToWin, setSequencesToWin] = useState(2);
  const [cardsPerPlayer, setCardsPerPlayer] = useState(3);
  const [cardsTouched, setCardsTouched] = useState(false);
  const [plusCards, setPlusCards] = useState(2);
  const [minusCards, setMinusCards] = useState(2);

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
      teamCount,
      sequencesToWin,
      cardsPerPlayer,
      plusCards,
      minusCards,
      // New special cards default to 0; the host tunes them in the lobby Settings panel.
      freezeCards: 0,
      stealCards: 0,
      shieldCards: 0,
      bombCards: 0,
      rerollCards: 0,
    };
    emit('create-room', {
      player: { id: getPlayerId(), name: profile.name, icon: profile.icon },
      settings,
    });
  };

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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
        <div className="logo-icon">🎯</div>
        <div className="logo-title" style={{ fontSize: 20 }}>
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
              <div className="rule">Numbers 1–30<br />5 in a row = sequence</div>
            </div>
            <div className={`opt-card${boardSize === 9 ? ' active' : ''}`} onClick={() => setBoardSize(9)}>
              <div className="size">9 × 9</div>
              <div className="rule">Numbers 1–38<br />6 in a row = sequence</div>
            </div>
          </div>
        </div>

        {/* Sequences to win */}
        <div className="field">
          <div className="field-label">Sequences to Win a Game</div>
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

        {/* Special cards */}
        <div className="field-label" style={{ marginBottom: 12 }}>
          Special Cards per Deck
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="stepper">
            <div className="stepper-label">➕ Plus (wild)</div>
            <div className="stepper-desc">Min 0 · Max 4</div>
            <div className="stepper-ctrls">
              <button className="step-btn" onClick={() => setPlusCards((v) => clamp(v - 1, 0, 4))}>
                −
              </button>
              <span className="stepper-val">{plusCards}</span>
              <button className="step-btn" onClick={() => setPlusCards((v) => clamp(v + 1, 0, 4))}>
                +
              </button>
            </div>
          </div>
          <div className="stepper">
            <div className="stepper-label">➖ Minus (remove)</div>
            <div className="stepper-desc">Min 0 · Max 4</div>
            <div className="stepper-ctrls">
              <button className="step-btn" onClick={() => setMinusCards((v) => clamp(v - 1, 0, 4))}>
                −
              </button>
              <span className="stepper-val">{minusCards}</span>
              <button className="step-btn" onClick={() => setMinusCards((v) => clamp(v + 1, 0, 4))}>
                +
              </button>
            </div>
          </div>
        </div>

        <div className="divider" />

        <button className="primary-btn" disabled={!connected || !profile} onClick={create}>
          {connected ? 'Create Room →' : 'Connecting…'}
        </button>
      </div>
    </main>
  );
}
