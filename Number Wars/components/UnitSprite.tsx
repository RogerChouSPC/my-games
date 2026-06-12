'use client';
import type { TeamColor } from '@/types/game';

export type UnitTier = 'squad' | 'tank' | 'jet';

// Sprite body tones (military shades, from Roger's approved sheet) and the bright
// team hexes used for the translucent ring + glow.
export const UNIT_BODY: Record<TeamColor, string> = {
  red: '#d32f2f',
  blue: '#1e3a5c',
  green: '#3a5232',
  purple: '#6d3fa3',
};
export const UNIT_RING: Record<TeamColor, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  purple: '#ab47bc',
};

// One helmeted soldier head (44x48 design units), drawn at x/y with scale s.
function Head({ x, y, s, body }: { x: number; y: number; s: number; body: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="6" cy="28" r="4.5" fill="#f4ece4" stroke="#23211f" strokeWidth="2.4" />
      <circle cx="38" cy="28" r="4.5" fill="#f4ece4" stroke="#23211f" strokeWidth="2.4" />
      <circle cx="22" cy="28" r="14.5" fill="#f8f3ec" stroke="#23211f" strokeWidth="2.6" />
      <rect x="19.5" y="38.5" width="5" height="3" rx="1.5" fill="#23211f" />
      <path
        d="M5.5 26 Q4 7 22 7 Q40 7 38.5 26 Q38.8 29 35 28.2 Q28.5 23.5 22 23.5 Q15.5 23.5 9 28.2 Q5.2 29 5.5 26 Z"
        fill={body}
        stroke="#23211f"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </g>
  );
}

// Army piece: squad (chip) → tank (Line Win) → jet (Full Row, scores 2).
export default function UnitSprite({ tier, team }: { tier: UnitTier; team: TeamColor }) {
  const body = UNIT_BODY[team];
  if (tier === 'squad') {
    return (
      <svg viewBox="0 0 102 96" aria-label={`${team} squad`}>
        <Head x={29} y={0} s={1} body={body} />
        <Head x={3} y={44} s={1} body={body} />
        <Head x={55} y={44} s={1} body={body} />
      </svg>
    );
  }
  if (tier === 'tank') {
    return (
      <svg viewBox="0 0 88 112" aria-label={`${team} tank`}>
        <rect x="40" y="2" width="8" height="36" rx="2.5" fill="#f8f3ec" stroke="#23211f" strokeWidth="2.6" />
        <rect x="37.5" y="0" width="13" height="11" rx="2.5" fill="#f8f3ec" stroke="#23211f" strokeWidth="2.6" />
        <path
          d="M16 12 L72 12 L82 24 L82 92 L72 104 L16 104 L6 92 L6 24 Z"
          fill="#f8f3ec"
          stroke="#23211f"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M6 24 L16 12 L22 12 L22 104 L16 104 L6 92 Z"
          fill="#ece7de"
          stroke="#23211f"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M82 24 L72 12 L66 12 L66 104 L72 104 L82 92 Z"
          fill="#ece7de"
          stroke="#23211f"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <rect x="28" y="17" width="9" height="11" rx="2" fill={body} stroke="#23211f" strokeWidth="2.4" />
        <rect x="51" y="17" width="9" height="11" rx="2" fill={body} stroke="#23211f" strokeWidth="2.4" />
        <path
          d="M31 38 L57 38 L66 49 L66 72 L57 83 L31 83 L22 72 L22 49 Z"
          fill={body}
          stroke="#23211f"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="44" cy="59" r="8.5" fill="none" stroke="#23211f" strokeWidth="2.6" />
        <rect x="30" y="89" width="28" height="9" rx="4" fill="#ece7de" stroke="#23211f" strokeWidth="2.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 96 124" aria-label={`${team} jet`}>
      <path
        d="M47 90 L22 112 L22 119 L44 109 L52 109 L74 119 L74 112 L49 90 Z"
        fill="#f8f3ec"
        stroke="#23211f"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M48 34 L6 80 L6 90 L42 75 L54 75 L90 90 L90 80 Z"
        fill="#f8f3ec"
        stroke="#23211f"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M48 2 Q55 16 56 32 L56 96 Q56 110 48 119 Q40 110 40 96 L40 32 Q41 16 48 2 Z"
        fill={body}
        stroke="#23211f"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M48 16 Q52.5 21 52.5 32 Q52.5 41 48 44 Q43.5 41 43.5 32 Q43.5 21 48 16 Z"
        fill="#ffffff"
        opacity=".85"
        stroke="#23211f"
        strokeWidth="2"
      />
    </svg>
  );
}
