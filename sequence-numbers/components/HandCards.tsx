'use client';
import type { Card, Cell, TeamColor } from '@/types/game';

interface HandCardsProps {
  hand: Card[];
  board: Cell[];
  selectedCardId: string | null;
  myTurn: boolean;
  teamColor: TeamColor | null;
  discardMode: boolean;
  onSelect: (cardId: string) => void;
  onSwapDead: (cardId: string) => void;
  onDiscard: (cardId: string) => void;
}

// A number card is dead if every board cell with its target is already owned.
function isDead(card: Card, board: Cell[]): boolean {
  if (card.kind !== 'number') return false;
  const cells = board.filter((c) => c.value === card.target);
  return cells.length > 0 && cells.every((c) => c.owner !== null);
}

export default function HandCards({
  hand,
  board,
  selectedCardId,
  myTurn,
  teamColor,
  discardMode,
  onSelect,
  onSwapDead,
  onDiscard,
}: HandCardsProps) {
  // The little team chip shown on the right edge of every card.
  const teamPiece = teamColor ? <span className={`card-team-piece ${teamColor}`} /> : null;

  const label = discardMode
    ? '🚫 No moves available — tap a card to discard it and draw a new one'
    : myTurn
      ? '🃏 Tap a card, then tap the matching circle on the board'
      : '🃏 Tap a card to preview your options — wait for your turn to place';

  const handleTap = (card: Card, dead: boolean) => {
    if (discardMode) {
      onDiscard(card.id);
      return;
    }
    if (card.kind === 'number' && dead) return;
    onSelect(card.id);
  };

  return (
    <div className="hand-area">
      <div className={`hand-label${discardMode ? ' discard' : ''}`}>{label}</div>
      <div className={`hand-cards${discardMode ? ' discardable' : ''}`}>
        {hand.map((card) => {
          const active = card.id === selectedCardId;
          const dead = isDead(card, board);

          if (card.kind === 'plus' || card.kind === 'minus') {
            const sym = card.kind === 'plus' ? '+' : '−';
            const accent = card.kind === 'plus' ? '#ffd700' : '#ff5252';
            const corner = card.kind === 'plus' ? '★' : '✕';
            return (
              <div
                key={card.id}
                className={`hand-card${active ? ' active' : ''}`}
                style={{ background: '#111' }}
                onClick={() => handleTap(card, dead)}
              >
                {teamPiece}
                <div className="card-corner-tl">
                  {sym}
                  <br />
                  <span style={{ fontSize: 8, color: accent }}>{corner}</span>
                </div>
                <div className="card-corner-br">
                  {sym}
                  <br />
                  <span style={{ fontSize: 8, color: accent }}>{corner}</span>
                </div>
                <div className="card-body" style={{ padding: '18px 6px' }}>
                  <div className="card-eq" style={{ color: accent, fontSize: 26 }}>
                    {sym}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={card.id}
              className={`hand-card${active ? ' active' : ''}${dead && !discardMode ? ' dead' : ''}`}
              onClick={() => handleTap(card, dead)}
            >
              {teamPiece}
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
              <div className="card-header" style={{ background: card.color ?? '#333' }}>
                <span style={{ color: '#fff', fontSize: 10 }}>●</span>
              </div>
              <div className="card-body">
                <div className="card-eq">{card.equation}</div>
              </div>
              <div className="card-footer">
                <span style={{ color: card.color ?? '#333', fontSize: 10 }}>●</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
