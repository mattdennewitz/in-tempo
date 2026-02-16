import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeVelocity,
  generateVelocityPersonality,
  intensityScale,
  type VelocityContext,
  type VelocityConfig,
  type VelocityPersonality,
} from './velocity.ts';
import { SeededRng } from './rng.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<VelocityContext> = {}): VelocityContext {
  return {
    noteIndexInPattern: 1,
    totalNotesInPattern: 8,
    currentRep: 1,
    totalReps: 1,
    personality: { baseLoudness: 0.85, jitterAmount: 0.05 },
    config: { enabled: true, intensity: 'moderate' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeVelocity
// ---------------------------------------------------------------------------

describe('computeVelocity', () => {
  it('returns exactly 1.0 when humanization is disabled', () => {
    const ctx = makeContext({
      config: { enabled: false, intensity: 'moderate' },
    });
    expect(computeVelocity(ctx)).toBe(1.0);
  });

  it('returns a value in [0.3, 1.0] when enabled', () => {
    const ctx = makeContext();
    // Run multiple times to cover random jitter
    for (let i = 0; i < 100; i++) {
      const v = computeVelocity(ctx);
      expect(v).toBeGreaterThanOrEqual(0.3);
      expect(v).toBeLessThanOrEqual(1.0);
    }
  });

  it('floors at 0.3: extreme low personality with subtle intensity still >= 0.3', () => {
    const ctx = makeContext({
      noteIndexInPattern: 3, // non-accent
      currentRep: 1,
      totalReps: 5, // early rep = low contour
      personality: { baseLoudness: 0.7, jitterAmount: 0.12 },
      config: { enabled: true, intensity: 'subtle' },
    });
    for (let i = 0; i < 200; i++) {
      expect(computeVelocity(ctx)).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('caps at 1.0: high personality + accent + peak contour + expressive still <= 1.0', () => {
    const ctx = makeContext({
      noteIndexInPattern: 0, // accent
      currentRep: 3,
      totalReps: 5, // near peak contour
      personality: { baseLoudness: 1.0, jitterAmount: 0.12 },
      config: { enabled: true, intensity: 'expressive' },
    });
    for (let i = 0; i < 200; i++) {
      expect(computeVelocity(ctx)).toBeLessThanOrEqual(1.0);
    }
  });

  it('accent: noteIndexInPattern=0 produces higher average velocity than noteIndexInPattern=3', () => {
    const base = {
      totalNotesInPattern: 8,
      currentRep: 1,
      totalReps: 1,
      personality: { baseLoudness: 0.85, jitterAmount: 0.05 } as VelocityPersonality,
      config: { enabled: true, intensity: 'expressive' } as VelocityConfig,
    };

    let accentSum = 0;
    let nonAccentSum = 0;
    const N = 500;

    for (let i = 0; i < N; i++) {
      accentSum += computeVelocity({ ...base, noteIndexInPattern: 0 });
      nonAccentSum += computeVelocity({ ...base, noteIndexInPattern: 3 });
    }

    expect(accentSum / N).toBeGreaterThan(nonAccentSum / N);
  });

  it('personality: baseLoudness=0.9 produces higher average than baseLoudness=0.7', () => {
    const base = {
      noteIndexInPattern: 1,
      totalNotesInPattern: 8,
      currentRep: 1,
      totalReps: 1,
      config: { enabled: true, intensity: 'moderate' } as VelocityConfig,
    };

    let loudSum = 0;
    let softSum = 0;
    const N = 500;

    for (let i = 0; i < N; i++) {
      loudSum += computeVelocity({
        ...base,
        personality: { baseLoudness: 0.9, jitterAmount: 0.05 },
      });
      softSum += computeVelocity({
        ...base,
        personality: { baseLoudness: 0.7, jitterAmount: 0.05 },
      });
    }

    expect(loudSum / N).toBeGreaterThan(softSum / N);
  });

  it('contour: mid-repetition (rep 3 of 5) produces higher average than first rep', () => {
    const base = {
      noteIndexInPattern: 1,
      totalNotesInPattern: 8,
      personality: { baseLoudness: 0.85, jitterAmount: 0.05 } as VelocityPersonality,
      config: { enabled: true, intensity: 'expressive' } as VelocityConfig,
      totalReps: 5,
    };

    let midSum = 0;
    let firstSum = 0;
    const N = 500;

    for (let i = 0; i < N; i++) {
      midSum += computeVelocity({ ...base, currentRep: 3 });
      firstSum += computeVelocity({ ...base, currentRep: 1 });
    }

    expect(midSum / N).toBeGreaterThan(firstSum / N);
  });

  it('intensity scaling: expressive produces wider velocity spread than subtle', () => {
    const rng = new SeededRng(42);
    const base = {
      noteIndexInPattern: 1,
      totalNotesInPattern: 8,
      currentRep: 1,
      totalReps: 1,
      personality: { baseLoudness: 0.85, jitterAmount: 0.1 } as VelocityPersonality,
    };

    const N = 500;
    const expressiveValues: number[] = [];
    const subtleValues: number[] = [];

    for (let i = 0; i < N; i++) {
      expressiveValues.push(
        computeVelocity({ ...base, config: { enabled: true, intensity: 'expressive' } }, rng),
      );
      subtleValues.push(
        computeVelocity({ ...base, config: { enabled: true, intensity: 'subtle' } }, rng),
      );
    }

    const stdDev = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length);
    };

    expect(stdDev(expressiveValues)).toBeGreaterThan(stdDev(subtleValues));
  });
});

// ---------------------------------------------------------------------------
// intensityScale
// ---------------------------------------------------------------------------

describe('intensityScale', () => {
  it('returns 0.4 for subtle', () => {
    expect(intensityScale('subtle')).toBe(0.4);
  });

  it('returns 0.7 for moderate', () => {
    expect(intensityScale('moderate')).toBe(0.7);
  });

  it('returns 1.0 for expressive', () => {
    expect(intensityScale('expressive')).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// generateVelocityPersonality
// ---------------------------------------------------------------------------

describe('generateVelocityPersonality', () => {
  it('generates baseLoudness in [0.35, 1.0]', () => {
    for (let i = 0; i < 100; i++) {
      const p = generateVelocityPersonality();
      expect(p.baseLoudness).toBeGreaterThanOrEqual(0.35);
      expect(p.baseLoudness).toBeLessThanOrEqual(1.0);
    }
  });

  it('generates jitterAmount in [0.1, 0.4]', () => {
    for (let i = 0; i < 100; i++) {
      const p = generateVelocityPersonality();
      expect(p.jitterAmount).toBeGreaterThanOrEqual(0.1);
      expect(p.jitterAmount).toBeLessThanOrEqual(0.4);
    }
  });
});
