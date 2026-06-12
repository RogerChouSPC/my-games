'use client';
import type { Player, RecentPlay } from '@/types/game';
import { colorFor } from '@/lib/board-layout';

const TEAM_HEX: Record<string, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  purple: '#ab47bc',
};

// Symbol + accent for each special card (number cards show their number instead).
const SPECIAL: Record<string, { face: string; color: string }> = {
  plus: { face: '🪂', color: '#ffd54f' },
  minus: { face: '🎯', color: '#ff5252' },
  freeze: { face: '🧊', color: '#80d8ff' },
  steal: { face: '🥷', color: '#ce93d8' },
  shield: { face: '🛡️', color: '#fff176' },
  bomb: { face: '💣', color: '#ff7043' },
  reroll: { face: '🔀', color: '#80cbc4' },
};

// The last few cards played, newest first, each tagged with the player who played it.
export default function RecentPlays({ plays, players }: { plays: RecentPlay[]; players: Player[] }) {
  const recent = [...(plays ?? [])].slice(-5).reverse(); // newest first
  return (
    <div className="recent-plays">
      <div className="recent-plays-lbl">Last plays</div>
      <div className="recent-plays-row">
        {recent.length === 0 && <span className="recent-empty">No plays yet</span>}
        {recent.map((p, i) => {
          const pl = players.find((x) => x.id === p.playerId);
          const isNum = p.kind === 'number' && p.value != null;
          const sp = SPECIAL[p.kind];
          return (
            <div className="recent-item" key={`${i}-${p.playerId}-${p.kind}-${p.value}`}>
              <div
                className="recent-face"
                style={{ background: isNum ? colorFor(p.value as number) : '#1a1a2e' }}
              >
                {isNum ? (
                  <span className="recent-num">{p.value}</span>
                ) : (
                  <span className="recent-sym" style={{ color: sp?.color }}>
                    {sp?.face}
                  </span>
                )}
              </div>
              {pl && (
                <img
                  className="recent-ava"
                  src={`/icons/char_${String(pl.icon).padStart(2, '0')}.png`}
                  alt={pl.name}
                  title={pl.name}
                  style={{ borderColor: pl.team ? TEAM_HEX[pl.team] : '#666' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
