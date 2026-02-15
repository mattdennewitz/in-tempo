import type { PerformerState } from '../audio/types.ts';
import { STATE_COLORS, FONT_STACK, CELL_WIDTH, CELL_HEIGHT, CELL_GAP, COLS, CELL_RADIUS } from './theme.ts';

/**
 * Set up canvas for retina/HiDPI displays.
 * Sets physical pixel dimensions and scales context accordingly.
 */
export function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  return ctx;
}

/**
 * Calculate required canvas height for a given number of performers.
 */
export function canvasHeight(performerCount: number): number {
  const rows = Math.ceil(performerCount / COLS);
  return rows * CELL_HEIGHT + (rows - 1) * CELL_GAP;
}

/**
 * Draw a rounded rectangle path.
 */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Render the performer grid onto the canvas.
 * Pure draw function -- no React state or side effects.
 */
export function renderPerformers(
  ctx: CanvasRenderingContext2D,
  performers: PerformerState[],
  width: number,
  height: number,
): void {
  // Clear
  ctx.clearRect(0, 0, width, height);

  if (performers.length === 0) return;

  // Center the grid horizontally
  const gridWidth = COLS * CELL_WIDTH + (COLS - 1) * CELL_GAP;
  const offsetX = Math.max(0, (width - gridWidth) / 2);

  // Resolve font availability once per frame
  const fontAvailable = typeof document !== 'undefined' &&
    document.fonts?.check?.(`16px ${FONT_STACK}`);
  const activeFont = fontAvailable ? FONT_STACK : "Georgia, 'Times New Roman', serif";

  const ACCENT_WIDTH = 4;

  for (let i = 0; i < performers.length; i++) {
    const p = performers[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = offsetX + col * (CELL_WIDTH + CELL_GAP);
    const y = row * (CELL_HEIGHT + CELL_GAP);

    const colors = STATE_COLORS[p.status];

    // Card background
    roundedRect(ctx, x, y, CELL_WIDTH, CELL_HEIGHT, CELL_RADIUS);
    ctx.fillStyle = colors.fill;
    ctx.fill();

    // Left accent bar
    ctx.save();
    roundedRect(ctx, x, y, ACCENT_WIDTH + CELL_RADIUS, CELL_HEIGHT, CELL_RADIUS);
    ctx.clip();
    ctx.fillStyle = colors.accent;
    ctx.fillRect(x, y, ACCENT_WIDTH + CELL_RADIUS, CELL_HEIGHT);
    ctx.restore();

    // Performer ID label
    const textX = x + ACCENT_WIDTH + 10;
    ctx.font = `500 11px ${activeFont}`;
    ctx.fillStyle = colors.label;
    ctx.textBaseline = 'top';
    ctx.fillText(`P${p.id + 1}`, textX, y + 10);

    // Pattern number (large)
    ctx.font = `500 22px ${activeFont}`;
    ctx.fillStyle = colors.text;
    ctx.textBaseline = 'bottom';
    const displayText =
      p.status === 'complete' ? 'done' :
      p.status === 'silent' ? 'silent' :
      `P ${p.currentPattern}`;
    ctx.fillText(displayText, textX, y + CELL_HEIGHT - 12);
  }
}
