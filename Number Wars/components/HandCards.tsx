'use client';
import type { ReactNode } from 'react';
import type { Card, Cell, TeamColor } from '@/types/game';
import AssassinIcon from './AssassinIcon';
import UnitSprite, { UNIT_RING } from './UnitSprite';

interface HandCardsProps {
  hand: Card[];
  board: Cell[];
  selectedCardId: string | null;
  myTurn: boolean;
  teamColor: TeamColor | null; // your team — tints the hand block and shows a team chip
  discardMode: boolean;
  armedHint?: string | null; // overrides the helper label while a Bomb/Minus awaits its confirm tap
  hideAnswers?: boolean; // hard mode: number cards don't highlight their cells
  onSelect: (cardId: string) => void;
  onSwapDead: (cardId: string) => void;
  onDiscard: (cardId: string) => void;
}

// Flash-card arithmetic (matches the physical reference deck): both numbers
// stacked in big colored digits, the sign left of the bottom number, and an
// answer line underneath — all in the card's color.
function EquationStack({ equation, color }: { equation: string | null; color: string }) {
  const parts = (equation ?? '').split(' ');
  if (parts.length !== 3) return <div className="card-eq">{equation}</div>;
  const [a, op, b] = parts;
  const sign = op === '-' ? '−' : op; // true minus sign reads better than a hyphen
  return (
    <div className="card-eq-stack" style={{ color, borderColor: color }}>
      <span className="eq-row">{a}</span>
      <span className="eq-row">
        {op === '÷' ? (
          // Hand-drawn divide glyph: the font's ÷ merges into a + at bold sizes.
          <span className="eq-div" role="img" aria-label="divided by">
            <i />
            <b />
            <i />
          </span>
        ) : (
          <span className="eq-sign">{sign}</span>
        )}
        <span>{b}</span>
      </span>
    </div>
  );
}

// Flash-card display color: the yellow bucket is too pale on a white card.
function cardInk(color: string | null): string {
  if (!color) return '#333';
  return color === '#fdd835' ? '#f9a825' : color;
}

// A number card is dead if every board cell with its target is already owned.
function isDead(card: Card, board: Cell[]): boolean {
  if (card.kind !== 'number') return false;
  const cells = board.filter((c) => c.value === card.target);
  return cells.length > 0 && cells.every((c) => c.owner !== null);
}

// Visuals for the icon-based special cards (everything except number cards).
const NEW_SPECIAL: Partial<Record<Card['kind'], { icon: ReactNode; label: string; accent: string }>> = {
  plus: { icon: '🪂', label: 'AIRDROP', accent: '#ffd54f' },
  minus: { icon: '🎯', label: 'SNIPE', accent: '#ff5252' },
  freeze: { icon: '🧊', label: 'FREEZE', accent: '#80d8ff' },
  steal: { icon: <AssassinIcon />, label: 'STEAL', accent: '#ce93d8' },
  shield: { icon: '🛡️', label: 'SHIELD', accent: '#fff176' },
  bomb: { icon: '💣', label: 'BOMB', accent: '#ff7043' },
  reroll: { icon: '🔀', label: 'REROLL', accent: '#80cbc4' },
};

export default function HandCards({
  hand,
  board,
  selectedCardId,
  myTurn,
  teamColor,
  discardMode,
  armedHint,
  hideAnswers,
  onSelect,
  onSwapDead,
  onDiscard,
}: HandCardsProps) {
  const ring = teamColor ? UNIT_RING[teamColor] : null;
  const selected = hand.find((c) => c.id === selectedCardId) ?? null;
  const label = armedHint
    ? armedHint
    : discardMode
    ? '🚫 No moves available — tap a card to discard it and draw a new one'
    : selected?.kind === 'freeze'
      ? '🧊 Tap an opponent in the bar above to freeze them'
      : selected?.kind === 'reroll'
        ? '🔀 Choose which card to trade in the popup'
        : selected?.kind === 'shield'
          ? '🛡️ Tap up to 2 of YOUR chips to shield (hidden from enemies)'
          : selected?.kind === 'steal'
            ? '🗡️ Tap an opponent in the bar above to steal a card'
            : selected?.kind === 'bomb'
              ? '💣 Tap a spot to blow up that 2×2 patch'
              : selected?.kind === 'plus'
                ? '🪂 Airdrop: tap ANY open circle to drop a chip there'
                : selected?.kind === 'minus'
                  ? '🎯 Snipe: tap an enemy chip to shoot it off the board'
                  : myTurn
        ? hideAnswers
          ? '🧮 Solve the equation and find your number on the board!'
          : '🃏 Tap a card, then tap the matching circle on the board'
        : '🃏 Tap a card to preview your options — wait for your turn to place';

  const handleTap = (card: Card, dead: boolean) => {
    if (discardMode) {
      onDiscard(card.id);
      return;
    }
    // Reroll swaps are chosen in a popup (RerollPicker), not by tapping the hand.
    if (card.kind === 'number' && dead) return;
    onSelect(card.id);
  };

  return (
    <div
      className="hand-area"
      style={
        ring
          ? {
              borderTop: `3px solid ${ring}`,
              background: `linear-gradient(180deg, ${ring}26, var(--panel) 46%)`,
            }
          : undefined
      }
    >
      <div className={`hand-label${discardMode ? ' discard' : ''}`}>{label}</div>
      <div className="hand-main">
      <div className={`hand-cards${discardMode ? ' discardable' : ''}`}>
        {hand.map((card) => {
          const active = card.id === selectedCardId;
          const dead = isDead(card, board);

          const sp = NEW_SPECIAL[card.kind];
          if (sp) {
            return (
              <div
                key={card.id}
                className={`hand-card${active ? ' active' : ''}`}
                style={{ background: '#111' }}
                onClick={() => handleTap(card, false)}
              >
                <div className="card-body" style={{ flexDirection: 'column', gap: 4, padding: '14px 6px' }}>
                  <div style={{ fontSize: 26 }}>{sp.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: sp.accent, letterSpacing: 1 }}>
                    {sp.label}
                  </div>
                </div>
              </div>
            );
          }

          const ink = cardInk(card.color);
          const parts = (card.equation ?? '').split(' ');
          return (
            <div
              key={card.id}
              className={`hand-card${active ? ' active' : ''}${dead && !discardMode ? ' dead' : ''}`}
              onClick={() => handleTap(card, dead)}
            >
              {dead && !discardMode && (
                <span
                  className="swap-tag"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (myTurn) onSwapDead(card.id);
                  }}
                >
                  swap
                </span>
              )}
              {parts.length === 3 && (
                <>
                  <span className="corner-badge" style={{ background: ink }} />
                  <span className="corner-badge corner-badge-br" style={{ background: ink }} />
                </>
              )}
              <div className="card-body">
                <EquationStack equation={card.equation} color={ink} />
              </div>
            </div>
          );
        })}
      </div>
        {teamColor && ring && (
          <div
            className={`hand-team${myTurn ? ' active-turn' : ''}`}
            style={{ '--ring': ring } as React.CSSProperties}
          >
            <span className="hand-team-chip">
              <UnitSprite tier="squad" team={teamColor} />
            </span>
            <span className="hand-team-name">{teamColor}</span>
            <span className="hand-team-sub">★ SQUAD ★</span>
          </div>
        )}
      </div>
    </div>
  );
}
