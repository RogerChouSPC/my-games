'use client';

// Hooded assassin for the Steal card — drawn in the game's bold-outline style.
// (The ninja emoji this replaces renders as an empty box on Windows 10.)
// Sized in `em` so it drops into text anywhere and scales with font-size.
export default function AssassinIcon({ size }: { size?: number | string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      style={{
        width: size ?? '1em',
        height: size ?? '1em',
        display: 'inline-block',
        verticalAlign: '-0.12em',
      }}
      role="img"
      aria-label="assassin"
    >
      {/* hood */}
      <path
        d="M32 3 Q9 12 9 37 Q9 51 16 59 L48 59 Q55 51 55 37 Q55 12 32 3 Z"
        fill="#3a3548"
        stroke="#23211f"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* hood peak crease */}
      <path
        d="M32 3 Q26.5 13 28.5 21 L35.5 21 Q37.5 13 32 3 Z"
        fill="#2c2838"
        stroke="#23211f"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* shadowed face, rimmed in the Steal purple */}
      <path d="M19 29 Q32 21 45 29 Q47 44 32 51 Q17 44 19 29 Z" fill="#141220" stroke="#8e24aa" strokeWidth="2" />
      {/* glowing eyes */}
      <rect x="22.5" y="33.5" width="8" height="3.6" rx="1.8" fill="#e8f1ff" transform="rotate(7 26.5 35.3)" />
      <rect x="33.5" y="33.5" width="8" height="3.6" rx="1.8" fill="#e8f1ff" transform="rotate(-7 37.5 35.3)" />
      {/* dagger held low across the cloak */}
      <g transform="rotate(-16 32 55)">
        <rect x="13" y="52.5" width="24" height="4.5" rx="2.2" fill="#cfd2d6" stroke="#23211f" strokeWidth="2" />
        <path d="M36.5 50 L47 54.8 L36.5 59.5 Z" fill="#cfd2d6" stroke="#23211f" strokeWidth="2" strokeLinejoin="round" />
        <rect x="8.5" y="51" width="5.5" height="7.5" rx="2.2" fill="#8e24aa" stroke="#23211f" strokeWidth="2" />
      </g>
    </svg>
  );
}
