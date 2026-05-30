'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length === 4) router.push(`/room/${c}`);
  };

  return (
    <main className="center-screen">
      <div className="logo">
        <div className="logo-icon">⚔️</div>
        <div className="logo-title">NUMBER WARS</div>
        <div className="logo-sub">Math Strategy Game</div>
      </div>

      <div className="card-panel">
        <button className="primary-btn" onClick={() => router.push('/create')}>
          🎮 Create Room
        </button>

        <div className="divider" />

        <div className="field-label">Join with a code</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="text-input"
            placeholder="ABCD"
            maxLength={4}
            value={code}
            style={{ textTransform: 'uppercase', letterSpacing: 4, fontWeight: 700 }}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <button className="ghost-btn" style={{ width: 'auto', padding: '0 20px' }} onClick={join}>
            Join
          </button>
        </div>
      </div>
    </main>
  );
}
