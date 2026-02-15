import { useRef, useEffect } from 'react';
import type { PerformerState } from '../audio/types.ts';
import { setupCanvas, renderPerformers, canvasHeight } from './renderer.ts';
import { COLS, CELL_WIDTH, CELL_GAP } from './theme.ts';

interface PerformerCanvasProps {
  performers: PerformerState[];
}

const MAX_WIDTH = 640;
const gridWidth = COLS * CELL_WIDTH + (COLS - 1) * CELL_GAP;

export function PerformerCanvas({ performers }: PerformerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const performersRef = useRef<PerformerState[]>(performers);
  const rafRef = useRef<number>(0);

  // Keep ref in sync with latest props (no re-render needed for rAF)
  performersRef.current = performers;

  const height = canvasHeight(Math.max(performers.length, 1));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx = setupCanvas(canvas);

    const onResize = () => {
      ctx = setupCanvas(canvas);
    };
    window.addEventListener('resize', onResize);

    const loop = () => {
      const rect = canvas.getBoundingClientRect();
      renderPerformers(ctx, performersRef.current, rect.width, rect.height);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        maxWidth: `${MAX_WIDTH}px`,
        height: `${height}px`,
        minWidth: `${gridWidth}px`,
      }}
    />
  );
}
