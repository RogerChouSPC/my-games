'use client';
import { useState } from 'react';

interface CharacterPickerProps {
  initialName?: string;
  initialIcon?: number;
  errorMsg?: string;
  onConfirm: (name: string, icon: number) => void;
}

const ICONS = Array.from({ length: 30 }, (_, i) => i + 1);

export default function CharacterPicker({
  initialName = '',
  initialIcon = 1,
  errorMsg,
  onConfirm,
}: CharacterPickerProps) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);

  const src = (n: number) => `/icons/char_${String(n).padStart(2, '0')}.png`;

  return (
    <div className="overlay">
      <div className="modal">
        <div className="card-title">Choose Your Character</div>
        <div className="field-hint" style={{ marginBottom: 14 }}>
          Enter your name and pick your icon
        </div>

        {errorMsg && (
          <div
            className="error-banner"
            style={{ marginBottom: 14, fontSize: 13, padding: '8px 12px' }}
          >
            {errorMsg}
          </div>
        )}

        <input
          className="text-input"
          style={{ marginBottom: 14 }}
          placeholder="Your name..."
          value={name}
          maxLength={14}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="char-grid">
          {ICONS.map((n) => (
            <div
              key={n}
              className={`char-item${n === icon ? ' selected' : ''}`}
              onClick={() => setIcon(n)}
            >
              <img src={src(n)} alt={`Character ${n}`} />
            </div>
          ))}
        </div>

        <button
          className="primary-btn"
          disabled={name.trim().length === 0}
          onClick={() => onConfirm(name.trim(), icon)}
        >
          ✓ Continue
        </button>
      </div>
    </div>
  );
}
