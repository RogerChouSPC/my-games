'use client';
import type { Player } from '@/types/game';

const TEAM_HEX: Record<string, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  yellow: '#ffca28',
};

interface Props {
  mode: 'steal' | 'freeze';
  players: Player[]; // eligible opponents
  handCounts?: Record<string, number>; // card counts (Steal only)
  onPick: (playerId: string) => void;
  onCancel: () => void;
}

// Popup that lists the opponents you can target with a Steal or Freeze card.
export default function TargetPicker({ mode, players, handCounts, onPick, onCancel }: Props) {
  const title = mode === 'steal' ? '🦹 Steal — pick an opponent' : '🧊 Freeze — pick an opponent';
  const sub =
    mode === 'steal' ? 'Take one card from their hand.' : 'Skip their next turn.';
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal target-picker" onClick={(e) => e.stopPropagation()}>
        <div className="card-title" style={{ fontSize: 18, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{sub}</div>

        {players.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>
            No opponents available to target.
          </div>
        ) : (
          <div className="target-list">
            {players.map((p) => (
              <button key={p.id} className="target-opt" onClick={() => onPick(p.id)}>
                <div
                  className="target-avatar"
                  style={{ borderColor: p.team ? TEAM_HEX[p.team] : 'transparent' }}
                >
                  <img src={`/icons/char_${String(p.icon).padStart(2, '0')}.png`} alt={p.name} />
                </div>
                <div className="target-info">
                  <div className="target-name">{p.name}</div>
                  {p.team && (
                    <div className="target-team" style={{ color: TEAM_HEX[p.team] }}>
                      {p.team} team
                    </div>
                  )}
                </div>
                {mode === 'steal' && handCounts && (
                  <div className="target-count">{handCounts[p.id] ?? 0} 🃏</div>
                )}
              </button>
            ))}
          </div>
        )}

        <button className="ghost-btn" onClick={onCancel} style={{ marginTop: 6 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
