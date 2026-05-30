'use client';
import { useEffect, useState } from 'react';
import type { CardEffectEvent, CardEffectKind } from '@/lib/client/useSocket';

// Themed ~3-second overlay shown to everyone when a power card is played.
const EFFECTS: Record<
  CardEffectKind,
  { icon: string; cls: string; color: string; title: (e: CardEffectEvent) => string }
> = {
  freeze: { icon: '🧊', cls: 'fx-freeze', color: '#80d8ff', title: (e) => `${e.targetName ?? 'A player'} is FROZEN!` },
  steal: { icon: '🦹', cls: 'fx-steal', color: '#ce93d8', title: (e) => `${e.byName} STOLE a card!` },
  shield: { icon: '🛡️', cls: 'fx-shield', color: '#fff176', title: () => 'SHIELDED!' },
  bomb: { icon: '💥', cls: 'fx-bomb', color: '#ff7043', title: () => 'BOOM!' },
  reroll: { icon: '🔀', cls: 'fx-reroll', color: '#80cbc4', title: () => 'REROLL!' },
};

export default function CardEffect({ event }: { event: CardEffectEvent | null }) {
  const [active, setActive] = useState<CardEffectEvent | null>(null);

  useEffect(() => {
    if (!event) return;
    setActive(event);
    const t = setTimeout(() => setActive(null), 3000);
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
