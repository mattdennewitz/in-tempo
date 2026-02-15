/**
 * Generative pattern factory for algorithmic composition mode.
 *
 * Produces 30-80 fresh C-major patterns each call with a progressive arc:
 * intro (simple/short) -> development (growing) -> climax (complex/dense) ->
 * winddown (simplifying, returning to C).
 *
 * Characteristics that distinguish from Riley's In C:
 * - Wider pitch range (3 octaves C3-C6 vs Riley's ~2)
 * - Angular melodic leaps alongside steps
 * - Variable note durations within cells
 * - Motif bank for compositional cohesion
 * - Each call produces entirely new material
 */

import type { ScoreNote, Pattern } from '../audio/types.ts';

// ---------------------------------------------------------------------------
// C-major pitch utilities
// ---------------------------------------------------------------------------

/** C major scale degrees as semitone offsets from C */
const C_MAJOR_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);

/** All valid C-major MIDI notes in range C3 (48) to C6 (84) */
const C_MAJOR_NOTES: number[] = [];
for (let midi = 48; midi <= 84; midi++) {
  if (C_MAJOR_CLASSES.has(midi % 12)) {
    C_MAJOR_NOTES.push(midi);
  }
}

/** Get the index of the nearest C-major note to a target MIDI value */
function nearestCMajorIndex(target: number): number {
  let best = 0;
  let bestDist = Math.abs(C_MAJOR_NOTES[0] - target);
  for (let i = 1; i < C_MAJOR_NOTES.length; i++) {
    const dist = Math.abs(C_MAJOR_NOTES[i] - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Random utilities
// ---------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(options: number[], weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}

// ---------------------------------------------------------------------------
// Phase determination
// ---------------------------------------------------------------------------

type Phase = 'intro' | 'development' | 'climax' | 'winddown';

function getPhase(progress: number): Phase {
  if (progress < 0.2) return 'intro';
  if (progress < 0.6) return 'development';
  if (progress < 0.85) return 'climax';
  return 'winddown';
}

// ---------------------------------------------------------------------------
// Pitch selection with tonal center bias
// ---------------------------------------------------------------------------

/** Get a pitch from C-major with optional center bias */
function selectPitch(
  phase: Phase,
  progress: number,
  prevPitch: number | null,
  allowLeaps: boolean
): number {
  // Determine center bias
  let centerMidi = 60; // C4 default
  if (phase === 'development' && progress >= 0.3 && progress < 0.5) {
    centerMidi = 67; // G bias
  } else if (phase === 'development' && progress >= 0.5) {
    centerMidi = 65; // F bias
  } else if (phase === 'climax' && progress < 0.7) {
    centerMidi = 67; // G bias
  } else if (phase === 'climax' && progress >= 0.7) {
    centerMidi = 65; // F bias
  } else if (phase === 'winddown') {
    centerMidi = 60; // Return to C
  }

  // Determine pitch range per phase
  let lowMidi: number, highMidi: number;
  switch (phase) {
    case 'intro':
      lowMidi = 55; highMidi = 72; // G3 to C5 (narrower)
      break;
    case 'development':
      lowMidi = 50; highMidi = 79; // D3 to G5
      break;
    case 'climax':
      lowMidi = 48; highMidi = 84; // Full range C3 to C6
      break;
    case 'winddown':
      lowMidi = 55; highMidi = 72; // G3 to C5 (narrower)
      break;
  }

  // Filter valid notes to range
  const candidates = C_MAJOR_NOTES.filter(n => n >= lowMidi && n <= highMidi);

  // If we have a previous pitch and want stepwise motion
  if (prevPitch !== null && !allowLeaps) {
    const prevIdx = nearestCMajorIndex(prevPitch);
    const step = pick([-2, -1, 1, 2]);
    const newIdx = Math.max(0, Math.min(C_MAJOR_NOTES.length - 1, prevIdx + step));
    const note = C_MAJOR_NOTES[newIdx];
    if (note >= lowMidi && note <= highMidi) return note;
  }

  // Weighted selection biased toward center
  const centerIdx = nearestCMajorIndex(centerMidi);
  const weights = candidates.map(n => {
    const idx = nearestCMajorIndex(n);
    const dist = Math.abs(idx - centerIdx);
    return 1 / (1 + dist * 0.3); // Soft bias toward center
  });

  return weightedPick(candidates, weights);
}

// ---------------------------------------------------------------------------
// Duration selection
// ---------------------------------------------------------------------------

/** Select a note duration based on phase */
function selectDuration(phase: Phase): number {
  // Options: 1 (eighth), 2 (quarter), 4 (half)
  switch (phase) {
    case 'intro':
      return weightedPick([1, 2, 4], [2, 4, 3]); // Favor longer
    case 'development':
      return weightedPick([1, 2, 4], [3, 4, 2]); // Balanced
    case 'climax':
      return weightedPick([1, 2, 4], [5, 3, 1]); // Favor shorter
    case 'winddown':
      return weightedPick([1, 2, 4], [2, 4, 3]); // Favor longer again
  }
}

// ---------------------------------------------------------------------------
// Motif bank
// ---------------------------------------------------------------------------

interface Motif {
  notes: ScoreNote[];
}

function transposeMotif(motif: Motif, semitones: number): ScoreNote[] {
  return motif.notes.map(n => {
    if (n.midi === 0) return { ...n };
    let target = n.midi + semitones;
    // Snap to nearest C-major note in range
    target = Math.max(48, Math.min(84, target));
    const idx = nearestCMajorIndex(target);
    return { midi: C_MAJOR_NOTES[idx], duration: n.duration };
  });
}

function invertMotif(motif: Motif): ScoreNote[] {
  if (motif.notes.length === 0) return [];
  const firstPitch = motif.notes[0].midi;
  return motif.notes.map(n => {
    if (n.midi === 0) return { ...n };
    const interval = n.midi - firstPitch;
    let target = firstPitch - interval;
    target = Math.max(48, Math.min(84, target));
    const idx = nearestCMajorIndex(target);
    return { midi: C_MAJOR_NOTES[idx], duration: n.duration };
  });
}

function retrogradeMotif(motif: Motif): ScoreNote[] {
  return [...motif.notes].reverse().map(n => ({ ...n }));
}

// ---------------------------------------------------------------------------
// Pattern generation
// ---------------------------------------------------------------------------

function generateMelodicPattern(
  phase: Phase,
  progress: number,
  motifBank: Motif[]
): ScoreNote[] {
  // Determine note count based on phase
  let minNotes: number, maxNotes: number;
  switch (phase) {
    case 'intro':
      minNotes = 1; maxNotes = 8;
      break;
    case 'development':
      minNotes = 4; maxNotes = 16;
      break;
    case 'climax':
      minNotes = 8; maxNotes = 32;
      break;
    case 'winddown':
      minNotes = 2; maxNotes = 8;
      break;
  }
  const noteCount = randInt(minNotes, maxNotes);

  // Rest probability per phase
  const restProb = phase === 'intro' || phase === 'winddown' ? 0.25 : 0.15;

  // Leap probability per phase
  const leapProb = phase === 'climax' ? 0.5 : phase === 'development' ? 0.3 : 0.15;

  // Maybe reuse a motif (~20% chance if bank has entries)
  if (motifBank.length > 0 && Math.random() < 0.2) {
    const motif = pick(motifBank);
    const transform = Math.random();
    let notes: ScoreNote[];
    if (transform < 0.4) {
      // Transpose by random interval
      const semitones = pick([-7, -5, -3, -2, 2, 3, 5, 7]);
      notes = transposeMotif(motif, semitones);
    } else if (transform < 0.7) {
      notes = invertMotif(motif);
    } else {
      notes = retrogradeMotif(motif);
    }
    return notes;
  }

  const notes: ScoreNote[] = [];
  let prevPitch: number | null = null;

  for (let i = 0; i < noteCount; i++) {
    // Rest
    if (Math.random() < restProb) {
      const dur = selectDuration(phase);
      notes.push({ midi: 0, duration: dur });
      continue;
    }

    const allowLeap = Math.random() < leapProb;
    const midi = selectPitch(phase, progress, prevPitch, allowLeap);
    const duration = selectDuration(phase);
    notes.push({ midi, duration });
    prevPitch = midi;
  }

  // Ensure at least one note (not all rests)
  if (notes.every(n => n.midi === 0)) {
    const midi = selectPitch(phase, progress, null, false);
    notes[0] = { midi, duration: selectDuration(phase) };
  }

  return notes;
}

function generatePulsePattern(phase: Phase, progress: number): ScoreNote[] {
  // Single-pitch repeated note pattern
  const pitch = selectPitch(phase, progress, null, false);
  const repeatCount = randInt(2, 6);
  const notes: ScoreNote[] = [];
  for (let i = 0; i < repeatCount; i++) {
    notes.push({ midi: pitch, duration: selectDuration(phase) });
  }
  return notes;
}

function generateEndgamePattern(): ScoreNote[] {
  // Short, C-centric, simple steps
  const noteCount = randInt(2, 4);
  const cNotes = C_MAJOR_NOTES.filter(
    n => n === 60 || n === 72 || n === 62 || n === 64 || n === 67
  ); // C4, C5, D4, E4, G4
  const notes: ScoreNote[] = [];
  for (let i = 0; i < noteCount; i++) {
    notes.push({ midi: pick(cNotes), duration: weightedPick([1, 2, 4], [2, 3, 2]) });
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a fresh set of patterns for generative composition mode.
 * Returns 30-80 patterns with progressive arc (intro -> development ->
 * climax -> winddown) using only C-major pitches in the C3-C6 range.
 */
export function generateGenerativePatterns(): Pattern[] {
  const totalPatterns = randInt(30, 80);
  const patterns: Pattern[] = [];
  const motifBank: Motif[] = [];

  for (let i = 0; i < totalPatterns; i++) {
    const progress = i / (totalPatterns - 1);
    const phase = getPhase(progress);

    let notes: ScoreNote[];

    // Last 5 patterns: endgame
    if (i >= totalPatterns - 5) {
      notes = generateEndgamePattern();
    }
    // ~15% pulse patterns
    else if (Math.random() < 0.15) {
      notes = generatePulsePattern(phase, progress);
    }
    // Normal melodic pattern
    else {
      notes = generateMelodicPattern(phase, progress, motifBank);
    }

    const pattern: Pattern = {
      id: i + 1,
      notes,
    };
    patterns.push(pattern);

    // Store ~30% of patterns as motifs (2-4 note fragments)
    if (Math.random() < 0.3 && notes.length >= 2) {
      const start = randInt(0, Math.max(0, notes.length - 3));
      const len = Math.min(randInt(2, 4), notes.length - start);
      motifBank.push({ notes: notes.slice(start, start + len) });
    }
  }

  return patterns;
}
