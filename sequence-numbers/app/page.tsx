'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CharacterPicker from '@/components/CharacterPicker';
import { getSavedProfile, saveProfile } from '@/lib/client/useSocket';

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [profile, setProfile] = useState<{ name: string; icon: number } | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    setProfile(getSavedProfile());
  }, []);

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length === 4) router.push(`/room/${c}`);
  };

  const icon = (n: number) => `/icons/char_${String(n).padStart(2, '0')}.png`;

  return (
    <main className="home-screen">
      {showPicker && (
        <CharacterPicker
          initialName={profile?.name}
          initialIcon={profile?.icon}
          onConfirm={(name, ic) => {
            saveProfile(name, ic);
            setProfile({ name, icon: ic });
            setShowPicker(false);
          }}
        />
      )}

      <div className="home-hero">
        <div className="nw-crest">⚔️</div>
        <h1 className="nw-title">
          NUMBER<span className="nw-title-war">WARS</span>
        </h1>
        <div className="nw-battleline" />
        <div className="nw-tagline">MATH · STRATEGY · DOMINATION</div>
      </div>

      <div className="home-card">
        <div className="home-section-label">Your Fighter</div>
        <button className="fighter-card" onClick={() => setShowPicker(true)}>
          {profile ? (
            <>
              <span className="fighter-avatar">
                <img src={icon(profile.icon)} alt="you" />
              </span>
              <span className="fighter-name">{profile.name}</span>
              <span className="fighter-change">✏️ Change</span>
            </>
          ) : (
            <>
              <span className="fighter-avatar empty">＋</span>
              <span className="fighter-name muted">Choose your fighter &amp; name</span>
              <span className="fighter-change">Set up</span>
            </>
          )}
        </button>

        <button className="battle-btn" onClick={() => router.push('/create')}>
          <span className="battle-btn-icon">🎮</span> Create Battle Room
        </button>

        <div className="home-join">
          <div className="home-section-label">Join with a code</div>
          <div className="home-join-row">
            <input
              className="code-input"
              placeholder="ABCD"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
            <button className="join-btn" onClick={join}>
              Join ⚔
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
