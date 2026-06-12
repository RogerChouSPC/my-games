'use client';
import { useEffect, useRef, useState } from 'react';
import type { Cell, BoardSize } from '@/types/game';
import Chip from './Chip';

interface BoardProps {
  cells: Cell[];
  size: BoardSize;
  targetable: Set<number>;
  lastMoveIndex: number | null;
  removalCells?: Set<number>;
  dangerPreview?: Set<number>; // cells a pending (unconfirmed) Bomb/Minus would hit
  shakeKey?: number; // bump to shake the whole board (Bomb impact)
  pendingShield?: number[];
  revealNumbers?: boolean;
  onPick: (index: number) => void;
}

export default function Board({
  cells,
  size,
  targetable,
  lastMoveIndex,
  removalCells,
  dangerPreview,
  shakeKey,
  pendingShield,
  revealNumbers,
  onPick,
}: BoardProps) {
  // Shake the board briefly whenever shakeKey changes (a bomb just went off).
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (!shakeKey) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 600);
    return () => clearTimeout(t);
  }, [shakeKey]);
  // Size the board to the largest square that fits its area in BOTH width and height,
  // measured in JS so it works on every browser (iOS Safari included — no container queries).
  // Also pin the app height to the *visible* viewport so the iOS address bar can't push the
  // board off-screen.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    const area = wrap?.parentElement;
    if (!wrap || !area) return;
    const gameWrap = wrap.closest('.game-wrap') as HTMLElement | null;
    const fit = () => {
      // Real visible height (excludes the iOS Safari toolbar); falls back to innerHeight.
      const vh = window.visualViewport?.height ?? window.innerHeight;
      if (gameWrap) gameWrap.style.height = vh + 'px';
      const aw = area.clientWidth - 8; // area horizontal padding (4px each side)
      const ah = area.clientHeight - 8; // area vertical padding
      // Reserve ~26px for the board frame (hint rows + padding + border above/below the grid).
      wrap.style.width = Math.max(0, Math.floor(Math.min(aw, ah - 26))) + 'px';
      // Force the grid to a perfect square in JS — Safari/WebKit doesn't size grid cells
      // from aspect-ratio the way Chromium does, so we set the height to match the width.
      const grid = wrap.querySelector('.board-grid') as HTMLElement | null;
      if (grid) grid.style.height = grid.clientWidth + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(area);
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('scroll', fit);
    };
  }, []);

  return (
    <div className="board-area">
      <div className={`board-wrap${shaking ? ' shaking' : ''}`} ref={wrapRef}>
        <div className="board-label-row">
          <div className="board-label">🎯 SNIPE REMOVES A CHIP</div>
          <div className="board-label">🪂 AIRDROP LANDS ANYWHERE</div>
        </div>
        <div
          className={`board-grid${targetable.size > 0 ? ' has-targets' : ''}`}
          style={{
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            gridTemplateRows: `repeat(${size}, 1fr)`,
          }}
        >
          {cells.map((cell) => {
            const row = Math.floor(cell.index / size);
            const topHalf = row < size / 2; // top half rendered upside-down like the physical board
            const isTarget = targetable.has(cell.index);
            const cellCls = ['cell'];
            if (isTarget) cellCls.push('targetable');
            if (cell.index === lastMoveIndex) cellCls.push('lastmove');
            if (removalCells?.has(cell.index)) cellCls.push('removed');
            if (dangerPreview?.has(cell.index)) cellCls.push('danger');
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
                      BASE
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
                {(cell.shielded || pendingShield?.includes(cell.index)) && (
                  <span className="shield-badge">🛡️</span>
                )}
                {removalCells?.has(cell.index) && <span className="chip-pop">💥</span>}
                {revealNumbers && cell.owner && cell.value !== 'FREE' && (
                  <span className={`chip-reveal-num${topHalf ? ' rot' : ''}`}>{cell.value}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="board-label-row" style={{ marginTop: 2 }}>
          <div className="board-label">🪂 AIRDROP LANDS ANYWHERE</div>
          <div className="board-label">🎯 SNIPE REMOVES A CHIP</div>
        </div>
      </div>
    </div>
  );
}
