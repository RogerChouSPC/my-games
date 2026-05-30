'use client';
import { useEffect, useRef, useState } from 'react';

const EMOJIS = ['😂', '😢', '😮', '🔥', '👏', '😤', '🎉'];
const COOLDOWN_MS = 3000; // matches the server's anti-spam limit

export default function EmojiPanel({ onReact }: { onReact: (emoji: string) => void }) {
  const [cooling, setCooling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const react = (e: string) => {
    if (cooling) return;
    onReact(e);
    setCooling(true);
    timer.current = setTimeout(() => setCooling(false), COOLDOWN_MS);
  };

  return (
    <div className={`emoji-panel${cooling ? ' cooling' : ''}`}>
      {EMOJIS.map((e) => (
        <button key={e} className="emoji-btn" onClick={() => react(e)} disabled={cooling}>
          {e}
        </button>
      ))}
    </div>
  );
}
