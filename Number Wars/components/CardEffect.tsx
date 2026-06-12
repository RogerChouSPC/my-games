'use client';
import { useEffect, useState } from 'react';
import type { CardEffectEvent, CardEffectKind } from '@/lib/client/useSocket';

// Themed overlay shown to everyone when a power card is played.
const EFFECTS: Record<
  CardEffectKind,
  { icon: string; cls: string; color: string; title: (e: CardEffectEvent) => string; dur?: number }
> = {
  freeze: { icon: '🧊', cls: 'fx-freeze', color: '#80d8ff', title: (e) => `${e.byName} FROZE ${e.targetName ?? 'a player'}!` },
  steal: {
    icon: '🦹',
    cls: 'fx-steal',
    color: '#ce93d8',
    title: (e) => (e.targetName ? `${e.byName} stole a card from ${e.targetName}!` : `${e.byName} STOLE a card!`),
  },
  shield: { icon: '🛡️', cls: 'fx-shield', color: '#fff176', title: () => 'SHIELDED!' },
  bomb: { icon: '💥', cls: 'fx-bomb', color: '#ff7043', title: () => 'BOOM!' },
  reroll: { icon: '🔀', cls: 'fx-reroll', color: '#80cbc4', title: () => 'REROLL!' },
  shieldblock: { icon: '🛡️', cls: 'fx-shield', color: '#fff176', title: () => 'BLOCKED!' },
  plus: { icon: '⭐', cls: 'fx-shield', color: '#ffd700', title: (e) => `${e.byName} played a WILD ＋!`, dur: 1600 },
  skip: { icon: '❄️', cls: 'fx-freeze', color: '#80d8ff', title: (e) => `${e.targetName ?? 'A player'}'s turn skipped — frozen!`, dur: 2200 },
};

export default function CardEffect({ event }: { event: CardEffectEvent | null }) {
  const [active, setActive] = useState<CardEffectEvent | null>(null);

  useEffect(() => {
    if (!event) return;
    setActive(event);
    const t = setTimeout(() => setActive(null), EFFECTS[event.kind]?.dur ?? 3000);
    return () => clearTimeout(t);
  }, [event]);

  if (!active) return null;
  const fx = EFFECTS[active.kind];
  if (!fx) return null;

  return (
    <div className="card-fx-overlay">
      <div className={`card-fx ${fx.cls}`} style={{ color: fx.color }}>
        <div className="card-fx-icon">{fx.icon}</div>
        <div className="card-fx-title">{fx.title(active)}</div>
      </div>
    </div>
  );
}
