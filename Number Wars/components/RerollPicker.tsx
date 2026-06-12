'use client';
import type { Card } from '@/types/game';

// Icons for special cards shown inside the picker (numbers show their equation).
const SPECIAL_FACE: Partial<Record<Card['kind'], { icon: string; label: string; accent: string }>> = {
  plus: { icon: '🪂', label: 'AIRDROP', accent: '#ffd54f' },
  minus: { icon: '🎯', label: 'SNIPE', accent: '#ff5252' },
  freeze: { icon: '🧊', label: 'FREEZE', accent: '#80d8ff' },
  steal: { icon: '🥷', label: 'STEAL', accent: '#ce93d8' },
  shield: { icon: '🛡️', label: 'SHIELD', accent: '#fff176' },
  bomb: { icon: '💣', label: 'BOMB', accent: '#ff7043' },
  reroll: { icon: '🔀', label: 'REROLL', accent: '#80cbc4' },
};

// Popup shown after selecting a Reroll card: pick which other card to trade in.
// Both the Reroll and the chosen card go back to the deck; you draw 2 fresh ones.
export default function RerollPicker({
  hand,
  rerollCardId,
  onPick,
  onCancel,
}: {
  hand: Card[];
  rerollCardId: string;
  onPick: (swapCardId: string) => void;
  onCancel: () => void;
}) {
  const choices = hand.filter((c) => c.id !== rerollCardId);
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal target-picker" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 34, marginBottom: 6 }}>🔀</div>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Reroll — trade a card</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          Pick the card to trade away. It and the Reroll go back to the deck, and you draw 2 fresh
          cards. You still play your turn afterwards.
        </div>
        <div className="reroll-pick-row">
          {choices.map((card) => {
            const sp = SPECIAL_FACE[card.kind];
            return (
              <button key={card.id} className="reroll-pick-card" onClick={() => onPick(card.id)}>
                {sp ? (
                  <>
                    <span style={{ fontSize: 24 }}>{sp.icon}</span>
                    <span className="rp-label" style={{ color: sp.accent }}>
                      {sp.label}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="rp-header" style={{ background: card.color ?? '#333' }} />
                    <span className="rp-eq">{card.equation}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        <button className="ghost-btn" style={{ marginTop: 14 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
