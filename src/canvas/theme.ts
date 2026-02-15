// InTempo visual identity: color palette, typography, layout metrics

export const PALETTE = {
  salmon: '#E8735A',
  cream: '#FDF6EE',
  navy: '#1B2838',
  salmonLight: '#F2A995',
  salmonMuted: '#D4907E',
  warmGray: '#B8AFA6',
  coolGray: '#8C9196',
  paleGold: '#E8D5B5',
  offWhite: '#FAF8F5',
} as const;

/** State-specific colors for performer cards */
export const STATE_COLORS = {
  playing: {
    fill: PALETTE.offWhite,
    accent: PALETTE.salmon,
    text: PALETTE.navy,
    label: PALETTE.coolGray,
  },
  silent: {
    fill: 'rgba(184, 175, 166, 0.15)', // warmGray at low opacity
    accent: PALETTE.warmGray,
    text: PALETTE.coolGray,
    label: PALETTE.coolGray,
  },
  complete: {
    fill: 'rgba(184, 175, 166, 0.08)',
    accent: 'rgba(184, 175, 166, 0.4)',
    text: PALETTE.coolGray,
    label: PALETTE.coolGray,
  },
} as const;

export const FONT_STACK = "'GT Canon Mono Trial', 'SF Mono', 'Menlo', 'Monaco', monospace";

// Layout constants for performer grid
export const CELL_WIDTH = 140;
export const CELL_HEIGHT = 72;
export const CELL_GAP = 8;
export const COLS = 4;
export const CELL_RADIUS = 6;
