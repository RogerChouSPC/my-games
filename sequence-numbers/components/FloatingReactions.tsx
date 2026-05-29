'use client';
import { useEffect, useState } from 'react';
import type { ReactionEvent } from '@/lib/client/useSocket';

interface FloatItem {
  key: number;
  emoji: string;
  left: number; // % across the screen
  bottom: number; // % up from the bottom
}

// Floats reaction emoji at random spots over the board, drifting up and fading.
export default function FloatingReactions({ reaction }: { reaction: ReactionEvent | null }) {
  const [items, setItems] = useState<FloatItem[]>([]);

  useEffect(() => {
    if (!reaction) return;
    const item: FloatItem = {
      key: reaction.key,
      emoji: reaction.emoji,
      left: 12 + Math.random() * 76, // 12%..88%
      bottom: 28 + Math.random() * 42, // land within the board area
    };
    setItems((prev) => [...prev, item]);
    const t = setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.key !== item.key));
    }, 2600);
    return () => clearTimeout(t);
  }, [reaction]);

  return (
    <div className="board-reactions">
      {items.map((i) => (
        <span
          key={i.key}
          className="board-reaction"
          style={{ left: `${i.left}%`, bottom: `${i.bottom}%` }}
        >
          {i.emoji}
        </span>
      ))}
    </div>
  );
}
