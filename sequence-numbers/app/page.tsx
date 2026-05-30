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
    <main className="center-screen">
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

      <div className="logo">
        <div className="logo-icon">⚔️</div>
        <div className="logo-title">NUMBER WARS</div>
        <div className="logo-sub">Math Strategy Game</div>
      </div>

      <div className="card-panel">
        <div className="field-label">Your Character</div>
        <button className="char-edit-row" onClick={() => setShowPicker(true)}>
          {profile ? (
            <>
              <img src={icon(profile.icon)} alt="you" />
              <span className="char-edit-name">{profile.name}</span>
              <span className="char-edit-action">✏️ Change</span>
            </>
          ) : (
            <span className="char-edit-action">＋ Choose your character &amp; name</span>
          )}
        </button>

        <div className="divider" />

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
