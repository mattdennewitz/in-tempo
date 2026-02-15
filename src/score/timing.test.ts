import { describe, it, expect } from 'vitest';
import { SeededRng } from './rng.ts';
import {
  computeSwingOffset,
  computeTimingOffset,
  computeRubatoMultiplier,
  advanceRubato,
  generateTimingPersonality,
  type TimingContext,
  type RubatoState,
} from './timing.ts';

describe('computeSwingOffset', () => {
  it('returns 0 for even beats (downbeats)', () => {
    expect(computeSwingOffset(0, 0.25, 1.0)).toBe(0);
    expect(computeSwingOffset(2, 0.25, 1.0)).toBe(0);
    expect(computeSwingOffset(4, 0.25, 1.0)).toBe(0);
  });

  it('returns positive value for odd beats proportional to scale', () => {
    const offset = computeSwingOffset(1, 0.25, 1.0);
    expect(offset).toBeGreaterThan(0);
    // 0.15 * 1.0 * 0.25 = 0.0375 (37.5ms)
    expect(offset).toBeCloseTo(0.0375, 4);
  });

  it('scales with intensity', () => {
    const full = computeSwingOffset(1, 0.25, 1.0);
    const half = computeSwingOffset(1, 0.25, 0.5);
    expect(half).toBeCloseTo(full * 0.5, 6);
  });
});

describe('computeTimingOffset', () => {
  const baseCtx = (overrides: Partial<TimingContext> = {}): TimingContext => ({
    beatIndex: 0,
    noteIndexInPattern: 0,
    personality: { rushDragBias: 0, timingJitter: 0 },
    density: 0,
    config: { enabled: true, intensity: 'expressive' },
    secondsPerEighth: 0.25,
    ...overrides,
  });

  it('returns exactly 0 when config.enabled = false', () => {
    const rng = new SeededRng(42);
    const ctx = baseCtx({ config: { enabled: false, intensity: 'expressive' } });
    expect(computeTimingOffset(ctx, rng)).toBe(0);
  });

  it('positive rushDragBias produces positive offset (drag)', () => {
    const rng = new SeededRng(42);
    const ctx = baseCtx({
      personality: { rushDragBias: 0.3, timingJitter: 0 },
    });
    const offset = computeTimingOffset(ctx, rng);
    expect(offset).toBeGreaterThan(0);
  });

  it('negative rushDragBias produces negative offset (rush)', () => {
    const rng = new SeededRng(42);
    const ctx = baseCtx({
      personality: { rushDragBias: -0.3, timingJitter: 0 },
    });
    const offset = computeTimingOffset(ctx, rng);
    expect(offset).toBeLessThan(0);
  });

  it('jitter produces variation across notes', () => {
    const ctx = baseCtx({
      personality: { rushDragBias: 0, timingJitter: 1.0 },
    });
    const offsets = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const rng = new SeededRng(i + 1);
      offsets.add(computeTimingOffset(ctx, rng));
    }
    // With different seeds, jitter should produce different values
    expect(offsets.size).toBeGreaterThan(1);
  });

  it('total offset never exceeds +50ms even with max stacking', () => {
    // Odd beat (swing) + max personality + max jitter + max density
    const rng = new SeededRng(42);
    const ctx = baseCtx({
      beatIndex: 1, // odd = swing
      personality: { rushDragBias: 1.0, timingJitter: 1.0 },
      density: 1.0,
      config: { enabled: true, intensity: 'expressive' },
    });
    // Run many times with different seeds to catch edge cases
    for (let seed = 1; seed <= 100; seed++) {
      const r = new SeededRng(seed);
      const offset = computeTimingOffset(ctx, r);
      expect(offset).toBeLessThanOrEqual(0.050);
    }
  });

  it('total offset never goes below -50ms', () => {
    // Even beat (no swing) + max negative personality + max jitter
    const ctx = baseCtx({
      beatIndex: 0,
      personality: { rushDragBias: -1.0, timingJitter: 1.0 },
      density: 0,
      config: { enabled: true, intensity: 'expressive' },
    });
    for (let seed = 1; seed <= 100; seed++) {
      const r = new SeededRng(seed);
      const offset = computeTimingOffset(ctx, r);
      expect(offset).toBeGreaterThanOrEqual(-0.050);
    }
  });
});

describe('computeRubatoMultiplier', () => {
  it('returns ~1.0 when phase = 0', () => {
    const rubato: RubatoState = { phase: 0, period: 16 };
    const result = computeRubatoMultiplier(rubato, 1.0);
    expect(result).toBeCloseTo(1.0, 6);
  });

  it('returns > 1.0 when phase = PI/2 (peak of sine)', () => {
    const rubato: RubatoState = { phase: Math.PI / 2, period: 16 };
    const result = computeRubatoMultiplier(rubato, 1.0);
    expect(result).toBeGreaterThan(1.0);
    // 1.0 + sin(PI/2) * 0.03 * 1.0 = 1.03
    expect(result).toBeCloseTo(1.03, 4);
  });

  it('returns < 1.0 when phase = 3*PI/2 (trough of sine)', () => {
    const rubato: RubatoState = { phase: (3 * Math.PI) / 2, period: 16 };
    const result = computeRubatoMultiplier(rubato, 1.0);
    expect(result).toBeLessThan(1.0);
    expect(result).toBeCloseTo(0.97, 4);
  });
});

describe('advanceRubato', () => {
  it('advances phase correctly', () => {
    const rubato: RubatoState = { phase: 0, period: 16 };
    const next = advanceRubato(rubato);
    const expectedPhase = (2 * Math.PI) / 16;
    expect(next.phase).toBeCloseTo(expectedPhase, 6);
    expect(next.period).toBe(16);
  });

  it('wraps phase at 2*PI', () => {
    // Phase just below 2*PI, advance should wrap
    const rubato: RubatoState = { phase: 2 * Math.PI - 0.01, period: 16 };
    const next = advanceRubato(rubato);
    // Should wrap: (2*PI - 0.01 + 2*PI/16) mod 2*PI
    expect(next.phase).toBeGreaterThanOrEqual(0);
    expect(next.phase).toBeLessThan(2 * Math.PI);
  });

  it('returns new object (pure function)', () => {
    const rubato: RubatoState = { phase: 0, period: 16 };
    const next = advanceRubato(rubato);
    expect(next).not.toBe(rubato);
    expect(rubato.phase).toBe(0); // original unchanged
  });
});

describe('generateTimingPersonality', () => {
  it('produces rushDragBias in [-0.3, 0.3)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = new SeededRng(seed);
      const p = generateTimingPersonality(rng);
      expect(p.rushDragBias).toBeGreaterThanOrEqual(-0.3);
      expect(p.rushDragBias).toBeLessThan(0.3);
    }
  });

  it('produces timingJitter in [0.3, 1.0)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = new SeededRng(seed);
      const p = generateTimingPersonality(rng);
      expect(p.timingJitter).toBeGreaterThanOrEqual(0.3);
      expect(p.timingJitter).toBeLessThan(1.0);
    }
  });

  it('is deterministic for same seed', () => {
    const p1 = generateTimingPersonality(new SeededRng(42));
    const p2 = generateTimingPersonality(new SeededRng(42));
    expect(p1.rushDragBias).toBe(p2.rushDragBias);
    expect(p1.timingJitter).toBe(p2.timingJitter);
  });
});
