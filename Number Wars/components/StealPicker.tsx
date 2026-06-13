'use client';
import AssassinIcon from './AssassinIcon';

interface Props {
  targetName: string;
  count: number;
  onPick: (index: number) => void;
  onCancel: () => void;
}

// Blind card-picker: shows the opponent's hand as face-down backs; you pick one.
export default function StealPicker({ targetName, count, onPick, onCancel }: Props) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 360, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div className="card-title" style={{ fontSize: 18, marginBottom: 6 }}>
          <AssassinIcon /> Steal from {targetName}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          Their cards are face-down — pick one blindly.
        </div>
        <div className="steal-pick-row">
          {Array.from({ length: count }).map((_, i) => (
            <button key={i} className="steal-card-back" onClick={() => onPick(i)}>
              ?
            </button>
          ))}
        </div>
        <button className="ghost-btn" style={{ marginTop: 18 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
