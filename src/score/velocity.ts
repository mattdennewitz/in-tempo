// ---------------------------------------------------------------------------
// Velocity Computation Model
// ---------------------------------------------------------------------------
// Pure functions that compute per-note velocity from four layered factors:
//   1. Jitter — small per-note random variation
//   2. Personality — per-performer base loudness
//   3. Metric accent — first note of pattern iteration gets a boost
//   4. Phrase contour — bell curve across repetitions
//
// All functions are pure (aside from Math.random for jitter).
// Velocity is normalized to 0.0-1.0; callers scale to target range.
// ---------------------------------------------------------------------------

export interface VelocityPersonality {
  /** Per-performer average dynamic level (0.7-1.0) */
  baseLoudness: number;
  /** How much random variation per note (0.02-0.12) */
  jitterAmount: number;
}

export interface VelocityConfig {
  enabled: boolean;
  intensity: 'subtle' | 'moderate' | 'expressive';
}

export interface VelocityContext {
  /** Which note within the pattern (0-based) */
  noteIndexInPattern: number;
  /** How many notes in the current pattern */
  totalNotesInPattern: number;
  /** Which repetition (1-based) */
  currentRep: number;
  /** Total planned repetitions */
  totalReps: number;
  personality: VelocityPersonality;
  config: VelocityConfig;
}

/**
 * Map intensity label to a numeric scale factor.
 * Multiplies all variation ranges.
 */
export function intensityScale(
  intensity: 'subtle' | 'moderate' | 'expressive',
): number {
  switch (intensity) {
    case 'subtle':
      return 0.4;
    case 'moderate':
      return 0.7;
    case 'expressive':
      return 1.0;
  }
}

/**
 * Phrase contour: bell curve across repetitions.
 * Crescendo to peak around 60% through, then decrescendo.
 * Returns a multiplicative factor around 1.0.
 */
function phraseContour(
  currentRep: number,
  totalReps: number,
  scale: number,
): number {
  if (totalReps <= 1) return 1.0;
  const progress = (currentRep - 1) / (totalReps - 1); // 0.0 to 1.0
  const peak = 0.6;
  const curve = 1.0 - Math.pow((progress - peak) / 0.6, 2);
  const maxDeviation = 0.15 * scale;
  return 1.0 + curve * maxDeviation;
}

/**
 * Compute velocity for a single note.
 * Returns a value clamped to [0.3, 1.0].
 * When humanization is disabled, returns exactly 1.0.
 */
export function computeVelocity(ctx: VelocityContext): number {
  if (!ctx.config.enabled) return 1.0;

  const scale = intensityScale(ctx.config.intensity);

  // Layer 1: Per-note random jitter (uniform distribution)
  const jitter =
    1.0 + (Math.random() - 0.5) * 2 * ctx.personality.jitterAmount * scale;

  // Layer 2: Performer personality (base loudness)
  const personality = ctx.personality.baseLoudness;

  // Layer 3: Metric accent (first note of pattern iteration gets boost)
  const accent =
    ctx.noteIndexInPattern === 0 ? 1.0 + 0.08 * scale : 1.0;

  // Layer 4: Phrase contour (bell curve across repetitions)
  const contour = phraseContour(ctx.currentRep, ctx.totalReps, scale);

  return Math.max(0.3, Math.min(1.0, personality * jitter * accent * contour));
}

/**
 * Generate a random velocity personality for a performer.
 */
export function generateVelocityPersonality(): VelocityPersonality {
  return {
    baseLoudness: 0.7 + Math.random() * 0.3, // [0.7, 1.0)
    jitterAmount: 0.02 + Math.random() * 0.1, // [0.02, 0.12)
  };
}
