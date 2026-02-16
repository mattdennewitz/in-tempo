// ---------------------------------------------------------------------------
// Timing Offset Computation Model
// ---------------------------------------------------------------------------
// Pure functions that compute per-note timing offset from four layered factors:
//   1. Swing — shifts odd-indexed beats (offbeats) forward
//   2. Personality — per-performer rush/drag directional bias
//   3. Jitter — per-note random variation
//   4. Density looseness — extra spread proportional to ensemble density
//
// All functions are pure (RNG injected for jitter).
// Timing offset is in seconds; positive = late (drag), negative = early (rush).
// Total offset is clamped to [-50ms, +50ms] (half the lookahead window).
//
// Rubato types and computation are defined here for Plan 02 integration.
// ---------------------------------------------------------------------------

import { SeededRng } from './rng.ts';
import { intensityScale } from './velocity.ts';

export interface TimingConfig {
  enabled: boolean;
  intensity: 'subtle' | 'moderate' | 'expressive';
}

export interface TimingPersonality {
  rushDragBias: number;    // -1.0 to +1.0, typically generated in [-0.3, +0.3]
  timingJitter: number;    // 0.0-1.0 scale for per-note random variation
}

export interface TimingContext {
  beatIndex: number;               // global beat counter (for swing: odd = offbeat)
  noteIndexInPattern: number;      // position within pattern (reserved for future use)
  personality: TimingPersonality;   // per-performer rush/drag bias
  density: number;                  // ensemble density 0.0-1.0
  config: TimingConfig;             // timing humanization toggle + intensity
  secondsPerEighth: number;        // needed to convert swing fraction to seconds
}

export interface RubatoState {
  phase: number;    // current phase in radians, advances each beat
  period: number;   // oscillation period in beats (16-32)
}

/**
 * Compute swing offset for a single beat.
 * Even beats (downbeats) are unchanged; odd beats (offbeats) shift forward.
 *
 * @param beatIndex - Global beat counter (0-based)
 * @param secondsPerEighth - Duration of one eighth note in seconds
 * @param scale - Intensity scale factor (0.0-1.0)
 * @returns Timing offset in seconds (0 for even beats, positive for odd)
 */
export function computeSwingOffset(
  beatIndex: number,
  secondsPerEighth: number,
  scale: number,
): number {
  if (beatIndex % 2 === 0) return 0;
  return 0.15 * scale * secondsPerEighth;
}

/**
 * Compute total timing offset for a single note.
 * Layers: swing + personality + jitter + density looseness.
 * Result clamped to [-0.050, +0.050] (50ms).
 *
 * Returns 0 when humanization is disabled.
 */
export function computeTimingOffset(ctx: TimingContext, rng: SeededRng): number {
  if (!ctx.config.enabled) return 0;

  const scale = intensityScale(ctx.config.intensity);

  // Layer 1: Swing (offbeats shifted forward)
  const swing = computeSwingOffset(ctx.beatIndex, ctx.secondsPerEighth, scale);

  // Layer 2: Personality (directional rush/drag bias)
  const personality = ctx.personality.rushDragBias * 0.040 * scale;

  // Layer 3: Per-note random jitter
  const jitter =
    (rng.random() - 0.5) * 2 * ctx.personality.timingJitter * 0.040 * scale;

  // Layer 4: Density looseness (more performers = looser timing)
  const densityLooseness = ctx.density * 0.005 * scale;

  // Sum and clamp
  const total = swing + personality + jitter + densityLooseness;
  return Math.max(-0.050, Math.min(0.050, total));
}

/**
 * Compute rubato tempo multiplier from oscillation phase.
 * Returns a value around 1.0 (+/- 3% at max scale).
 */
export function computeRubatoMultiplier(
  rubato: RubatoState,
  scale: number,
): number {
  return 1.0 + Math.sin(rubato.phase) * 0.03 * scale;
}

/**
 * Advance rubato phase by one beat step.
 * Pure function: returns new state, does not mutate input.
 */
export function advanceRubato(rubato: RubatoState): RubatoState {
  const step = (2 * Math.PI) / rubato.period;
  const TWO_PI = 2 * Math.PI;
  let newPhase = rubato.phase + step;
  if (newPhase >= TWO_PI) {
    newPhase -= TWO_PI;
  }
  return { phase: newPhase, period: rubato.period };
}

/**
 * Generate a random timing personality for a performer.
 */
export function generateTimingPersonality(rng: SeededRng): TimingPersonality {
  return {
    rushDragBias: (rng.random() - 0.5) * 0.6,   // [-0.3, +0.3)
    timingJitter: 0.3 + rng.random() * 0.7,      // [0.3, 1.0)
  };
}
