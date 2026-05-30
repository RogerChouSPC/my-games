'use client';
import type { Cell, BoardSize } from '@/types/game';
import Chip from './Chip';

interface BoardProps {
  cells: Cell[];
  size: BoardSize;
  targetable: Set<number>;
  lastMoveIndex: number | null;
  onPick: (index: number) => void;
}

export default function Board({ cells, size, targetable, lastMoveIndex, onPick }: BoardProps) {
  return (
    <div className="board-area">
      <div className="board-wrap">
        <div className="board-label-row">
          <div className="board-label">− MINUS REMOVE CHIP</div>
          <div className="board-label">+ PLUS ARE WILD</div>
        </div>
        <div
          className={`board-grid${targetable.size > 0 ? ' has-targets' : ''}`}
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        >
          {cells.map((cell) => {
            const row = Math.floor(cell.index / size);
            const topHalf = row < size / 2; // top half rendered upside-down like the physical board
            const isTarget = targetable.has(cell.index);
            const cellCls = ['cell'];
            if (isTarget) cellCls.push('targetable');
            if (cell.index === lastMoveIndex) cellCls.push('lastmove');
            const circleCls = ['circle'];
            if (cell.value === 'FREE') circleCls.push('free');
            else circleCls.push('under');
            if (topHalf) circleCls.push('rot');
            return (
              <div
                key={cell.index}
                className={cellCls.join(' ')}
                onClick={() => isTarget && onPick(cell.index)}
              >
                <div
                  className={circleCls.join(' ')}
                  style={{ background: cell.value === 'FREE' ? undefined : cell.color }}
                >
                  {cell.value === 'FREE' ? (
                    <>
                      FREE
                      <br />
                      SPACE
                    </>
                  ) : (
                    cell.value
                  )}
                </div>
                {cell.owner && (
                  <Chip
                    team={cell.owner}
                    bumpy={cell.bumpy}
                    inSequence={cell.inSequence}
                    superSequence={cell.superSequence}
                  />
                )}
                {cell.shielded && <span className="shield-badge">🛡️</span>}
              </div>
            );
          })}
        </div>
        <div className="board-label-row" style={{ marginTop: 2 }}>
          <div className="board-label">+ PLUS ARE WILD</div>
          <div className="board-label">− MINUS REMOVE CHIP</div>
        </div>
      </div>
    </div>
  );
}
