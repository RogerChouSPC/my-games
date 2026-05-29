'use client';
import { useEffect, useState } from 'react';
import type { SuperEvent } from '@/lib/client/useSocket';

// Brief celebration when a full-length line (8 on 8x8, 9 on 9x9) is completed.
// Shows a random GIF from public/super-sequence, or a built-in banner if none exist.
export default function SuperSequence({ event }: { event: SuperEvent | null }) {
  const [active, setActive] = useState<SuperEvent | null>(null);

  useEffect(() => {
    if (!event) return;
    setActive(event);
    const t = setTimeout(() => setActive(null), 3500);
    return () => clearTimeout(t);
  }, [event]);

  if (!active) return null;

  return (
    <div className="gif-overlay">
      <div className="gif-card">
        <div className="gif-title">⭐ SUPER SEQUENCE! ⭐</div>
        {active.gif ? (
          <img src={active.gif} alt="Super sequence!" className="gif-img" />
        ) : (
          <div className="gif-fallback">🎆🏆🎆</div>
        )}
      </div>
    </div>
  );
}
