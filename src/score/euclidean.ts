/**
 * Euclidean pattern factory - generates 20-40 fresh rhythmic patterns
 * using Bjorklund's algorithm with C-major pentatonic pitches (C D E G A).
 *
 * Progressive arc: early patterns sparser, later denser, last ~5 simplify.
 * Mix of single-pitch rhythmic pulses (~40%) and melodic patterns (~60%).
 * ~30% chance of interlocking complementary pairs.
 */

import type { ScoreNote, Pattern } from '../audio/types.ts';
import { bjorklund, rotatePattern } from './bjorklund.ts';

// C-major pentatonic scale degrees (semitones from C): C D E G A
const PENTATONIC_DEGREES = [0, 2, 4, 7, 9];

// All C-major pentatonic MIDI values in C3-C6 range (48-84)
const PENTATONIC_PITCHES: number[] = [];
for (let midi = 48; midi <= 84; midi++) {
  if (PENTATONIC_DEGREES.includes(midi % 12)) {
    PENTATONIC_PITCHES.push(midi);
  }
}

/**
 * Convert a binary Euclidean rhythm to ScoreNote[], assigning pitches.
 *
 * @param rhythm Binary array (1 = pulse, 0 = rest)
 * @param melodic If true, assign different pitches per pulse; otherwise single pitch
 * @param progress 0.0-1.0 arc position (affects pitch range)
 */
function rhythmToNotes(
  rhythm: number[],
  melodic: boolean,
  progress: number,
): ScoreNote[] {
  // Select pitch range based on progress: start lower, expand upward
  const minIndex = 0;
  const maxIndex = Math.min(
    PENTATONIC_PITCHES.length - 1,
    Math.floor(PENTATONIC_PITCHES.length * (0.4 + progress * 0.6)),
  );

  const singlePitch = PENTATONIC_PITCHES[
    Math.floor(Math.random() * (maxIndex - minIndex + 1)) + minIndex
  ];

  return rhythm.map((step) => {
    if (step === 0) {
      return { midi: 0, duration: 1 };
    }

    if (melodic) {
      const pitch = PENTATONIC_PITCHES[
        Math.floor(Math.random() * (maxIndex - minIndex + 1)) + minIndex
      ];
      return { midi: pitch, duration: 1 };
    }

    return { midi: singlePitch, duration: 1 };
  });
}

/**
 * Generate 20-40 Euclidean rhythm patterns with progressive density arc,
 * pentatonic pitches, and interlocking complementary pairs.
 */
export function generateEuclideanPatterns(): Pattern[] {
  const targetCount = Math.floor(Math.random() * 21) + 20; // 20-40
  const patterns: Pattern[] = [];
  let id = 1;

  for (let i = 0; i < targetCount; i++) {
    const progress = targetCount > 1 ? i / (targetCount - 1) : 0;
    const isEndgame = i >= targetCount - 5;

    // Step count: 4-16
    const steps = Math.floor(Math.random() * 13) + 4;

    // Progressive density: 20% to 70%, endgame caps at 30%
    let baseDensity = 0.2 + progress * 0.5;
    if (isEndgame) {
      baseDensity = Math.min(baseDensity, 0.3);
    }
    const pulses = Math.max(1, Math.round(steps * baseDensity));

    // Apply random rotation for phase relationships
    const rotation = Math.floor(Math.random() * steps);
    const rhythm = rotatePattern(bjorklund(pulses, steps), rotation);

    // Decide: ~40% single-pitch rhythmic, ~60% melodic
    const melodic = Math.random() < 0.6;
    const notes = rhythmToNotes(rhythm, melodic, progress);

    patterns.push({ id, notes });
    id++;

    // Interlocking pairs: ~30% chance, skip if we'd exceed target or in endgame
    if (
      !isEndgame &&
      i < targetCount - 1 &&
      Math.random() < 0.3 &&
      patterns.length < 40
    ) {
      const complement = rhythm.map((v) => 1 - v);
      const partnerNotes = rhythmToNotes(complement, melodic, progress);
      patterns.push({ id, notes: partnerNotes });
      id++;
      i++; // Skip next iteration since we created a pair
    }

    // Safety: don't exceed 40 patterns
    if (patterns.length >= 40) break;
  }

  // Ensure minimum 20 patterns by generating extras if needed
  while (patterns.length < 20) {
    const progress = 0.5; // Mid-range density for fill patterns
    const steps = Math.floor(Math.random() * 13) + 4;
    const pulses = Math.max(1, Math.round(steps * 0.35));
    const rotation = Math.floor(Math.random() * steps);
    const rhythm = rotatePattern(bjorklund(pulses, steps), rotation);
    const melodic = Math.random() < 0.6;
    const notes = rhythmToNotes(rhythm, melodic, progress);
    patterns.push({ id, notes });
    id++;
  }

  return patterns;
}
