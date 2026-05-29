'use client';
import type { Card, Cell } from '@/types/game';

interface HandCardsProps {
  hand: Card[];
  board: Cell[];
  selectedCardId: string | null;
  myTurn: boolean;
  onSelect: (cardId: string) => void;
  onSwapDead: (cardId: string) => void;
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
  onSelect,
  onSwapDead,
}: HandCardsProps) {
  return (
    <div className="hand-area">
      <div className="hand-label">
        {myTurn ? '🃏 Tap a card, then tap the matching circle on the board' : '🃏 Your hand'}
      </div>
      <div className="hand-cards">
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
                onClick={() => myTurn && onSelect(card.id)}
              >
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
              className={`hand-card${active ? ' active' : ''}${dead ? ' dead' : ''}`}
              onClick={() => myTurn && !dead && onSelect(card.id)}
            >
              {dead && (
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
