'use client';
import { useState } from 'react';
import type { ClientView, Settings, BoardSize } from '@/types/game';

interface Props {
  view: ClientView;
  onSave: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function Stepper({
  label,
  desc,
  value,
  set,
}: {
  label: string;
  desc: string;
  value: number;
  set: (v: number) => void;
}) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-row-label">{label}</div>
        <div className="settings-row-desc">{desc}</div>
      </div>
      <div className="stepper-ctrls">
        <button className="step-btn" onClick={() => set(clamp(value - 1, 0, 4))}>
          −
        </button>
        <span className="stepper-val">{value}</span>
        <button className="step-btn" onClick={() => set(clamp(value + 1, 0, 4))}>
          +
        </button>
      </div>
    </div>
  );
}

export default function SettingsModal({ view, onSave, onClose }: Props) {
  const s = view.settings;
  const [boardSize, setBoardSize] = useState<BoardSize>(s.boardSize);
  const [sequencesToWin, setSequencesToWin] = useState(s.sequencesToWin);
  const [cardsPerPlayer, setCardsPerPlayer] = useState(s.cardsPerPlayer);
  const [plusCards, setPlusCards] = useState(s.plusCards);
  const [minusCards, setMinusCards] = useState(s.minusCards);
  const [freezeCards, setFreezeCards] = useState(s.freezeCards);
  const [stealCards, setStealCards] = useState(s.stealCards);
  const [shieldCards, setShieldCards] = useState(s.shieldCards);
  const [bombCards, setBombCards] = useState(s.bombCards);
  const [rerollCards, setRerollCards] = useState(s.rerollCards);
  const [timerEnabled, setTimerEnabled] = useState(s.timerEnabled);
  const [timerSeconds, setTimerSeconds] = useState(s.timerSeconds);

  const save = () => {
    onSave({
      boardSize,
      sequencesToWin,
      cardsPerPlayer,
      plusCards,
      minusCards,
      freezeCards,
      stealCards,
      shieldCards,
      bombCards,
      rerollCards,
      timerEnabled,
      timerSeconds,
    });
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 420, textAlign: 'left' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-title" style={{ fontSize: 18, marginBottom: 12 }}>
          ⚙️ Game Settings
        </div>

        <div className="field-label">Board Size</div>
        <div className="opt-cards" style={{ marginBottom: 12 }}>
          <div className={`opt-card${boardSize === 8 ? ' active' : ''}`} onClick={() => setBoardSize(8)}>
            <div className="size">8 × 8</div>
            <div className="rule">1–30 · 5 = Line Win</div>
          </div>
          <div className={`opt-card${boardSize === 9 ? ' active' : ''}`} onClick={() => setBoardSize(9)}>
            <div className="size">9 × 9</div>
            <div className="rule">1–38 · 6 = Line Win</div>
          </div>
        </div>

        <div className="field-label">Line Wins to Win</div>
        <div className="num-btns" style={{ marginBottom: 12 }}>
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

        <div className="field-label">Cards per Player</div>
        <div className="num-btns" style={{ marginBottom: 12 }}>
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`num-btn${cardsPerPlayer === n ? ' active' : ''}`}
              onClick={() => setCardsPerPlayer(n)}
            >
              <div className="n">{n}</div>
              <div className="lbl">cards</div>
            </button>
          ))}
        </div>

        <div className="field-label" style={{ marginBottom: 8 }}>
          Special Cards (per deck · min 0 · max 4)
        </div>
        <Stepper label="➕ Plus (wild)" desc="Place a chip on any empty number" value={plusCards} set={setPlusCards} />
        <Stepper label="➖ Minus (remove)" desc="Remove an opponent chip" value={minusCards} set={setMinusCards} />
        <Stepper label="🧊 Freeze" desc="Skip an opponent's next turn" value={freezeCards} set={setFreezeCards} />
        <Stepper label="🦹 Steal" desc="Take a hidden card from an opponent's hand" value={stealCards} set={setStealCards} />
        <Stepper label="🛡️ Shield" desc="Secretly shield 2 of your chips (one-time)" value={shieldCards} set={setShieldCards} />
        <Stepper label="💣 Bomb" desc="Blow up a 2×2 patch of chips" value={bombCards} set={setBombCards} />
        <Stepper label="🔀 Reroll" desc="Swap this + one chosen card for 2 new" value={rerollCards} set={setRerollCards} />

        <div className="field-label" style={{ marginTop: 16, marginBottom: 8 }}>
          Move Timer
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">⏱ Turn timer</div>
            <div className="settings-row-desc">
              {timerEnabled
                ? `${timerSeconds}s per move — auto-plays a random move if time runs out`
                : 'Off — players take as long as they like'}
            </div>
          </div>
          <button
            type="button"
            className={`toggle${timerEnabled ? ' on' : ''}`}
            onClick={() => setTimerEnabled((v) => !v)}
            aria-pressed={timerEnabled}
            aria-label="Toggle move timer"
          >
            <span className="toggle-knob" />
          </button>
        </div>
        {timerEnabled && (
          <div style={{ marginTop: 10 }}>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={timerSeconds}
              onChange={(e) => setTimerSeconds(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ textAlign: 'center', fontWeight: 800, color: 'var(--accent)' }}>
              {timerSeconds} seconds
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
