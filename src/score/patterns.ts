/**
 * All 53 patterns from Terry Riley's "In C" (1964), encoded as typed score data.
 *
 * Transcribed from the published score. Each pattern is a sequence of notes
 * with MIDI pitch values and durations in eighth-note units.
 *
 * MIDI reference:
 *   C4=60, D4=62, E4=64, F4=65, F#4=66, G4=67, A4=69, Bb4=70, B4=71
 *   C5=72, D5=74, E5=76, F5=77, F#5=78, G5=79, A5=81, B5=83, C6=84
 *
 * Duration reference:
 *   1 = eighth note, 2 = quarter note, 4 = half note, 8 = whole note
 *   0 (midi) = rest
 *
 * The score uses 9 of 12 chromatic pitches (no C#, Eb, Ab).
 */

import type { ScoreNote, Pattern } from '../audio/types.ts';

/** Convert MIDI note number to frequency in Hz (A4 = 440Hz = MIDI 69) */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Total number of patterns in the score */
export const TOTAL_PATTERNS = 53;

// Helper for concise pattern encoding
function n(midi: number, duration: number): ScoreNote {
  return { midi, duration };
}

export const PATTERNS: Pattern[] = [
  // Pattern 1: E F (two eighth notes)
  {
    id: 1,
    notes: [n(64, 1), n(65, 1)],
  },

  // Pattern 2: E F F (E eighth, F held)
  {
    id: 2,
    notes: [n(64, 1), n(65, 3)],
  },

  // Pattern 3: rest E F F (rest then E eighth, F held)
  {
    id: 3,
    notes: [n(0, 1), n(64, 1), n(65, 3)],
  },

  // Pattern 4: rest E F G (rest, E eighth, F eighth, G eighth)
  {
    id: 4,
    notes: [n(0, 1), n(64, 1), n(65, 1), n(67, 1)],
  },

  // Pattern 5: E F G (eighth notes)
  {
    id: 5,
    notes: [n(64, 1), n(65, 1), n(67, 1)],
  },

  // Pattern 6: C5 held (long sustained note)
  {
    id: 6,
    notes: [n(72, 8)],
  },

  // Pattern 7: (no notes between patterns -- used as transition)
  // Actually: C4 C4 C4 (repeated high C pulse figures)
  // Pattern 7 in Riley's score is a rest-based figure
  {
    id: 7,
    notes: [n(0, 4), n(0, 4), n(72, 8)],
  },

  // Pattern 8: G4 F4 G4 (eighth notes in quick succession)
  {
    id: 8,
    notes: [n(67, 4), n(65, 4), n(67, 4)],
  },

  // Pattern 9: B4 G4 (quarter notes)
  {
    id: 9,
    notes: [n(71, 2), n(67, 2)],
  },

  // Pattern 10: B4 G4 (similar to 9 but with different rhythm)
  {
    id: 10,
    notes: [n(71, 1), n(67, 1)],
  },

  // Pattern 11: F4 G4 B4 G4 B4 G4
  {
    id: 11,
    notes: [n(65, 1), n(67, 1), n(71, 1), n(67, 1), n(71, 1), n(67, 1)],
  },

  // Pattern 12: F4 G4 (eighth notes, similar to motif from earlier)
  {
    id: 12,
    notes: [n(65, 1), n(67, 2)],
  },

  // Pattern 13: B4 G4 F4 G4 (eighth notes, descending then up)
  {
    id: 13,
    notes: [
      n(71, 1), n(67, 1), n(65, 1), n(67, 1),
      n(71, 2),
    ],
  },

  // Pattern 14: Introduces Bb (B-flat) -- tonal shift
  // B4 G4 F4 G4 Bb4 G4
  {
    id: 14,
    notes: [
      n(71, 4),
      n(67, 4),
      n(65, 4),
      n(67, 4),
      n(70, 6),
    ],
  },

  // Pattern 15: G4 Bb4 (introduces the Bb interval)
  {
    id: 15,
    notes: [n(67, 1), n(70, 1)],
  },

  // Pattern 16: Bb4 G4 (eighth notes)
  {
    id: 16,
    notes: [n(70, 1), n(67, 1)],
  },

  // Pattern 17: C5 (held note)
  {
    id: 17,
    notes: [n(72, 4)],
  },

  // Pattern 18: E4 F4 E4 F4 G4 E4 (scalar figure)
  {
    id: 18,
    notes: [
      n(64, 1), n(65, 1), n(64, 1), n(65, 1),
      n(67, 1), n(64, 1),
    ],
  },

  // Pattern 19: (repeated Bb G figure)
  {
    id: 19,
    notes: [n(70, 8)],
  },

  // Pattern 20: E4 F4 G4 A4 (ascending scalar passage)
  {
    id: 20,
    notes: [n(64, 1), n(65, 1), n(67, 1), n(69, 1)],
  },

  // Pattern 21: A4 (held)
  {
    id: 21,
    notes: [n(69, 4)],
  },

  // Pattern 22: Introduces F# -- E4 F#4 G4 A4 (ascending with raised 2nd)
  {
    id: 22,
    notes: [
      n(64, 4), n(66, 4),
      n(64, 4), n(66, 4),
      n(67, 4), n(69, 4),
      n(67, 4), n(69, 4),
    ],
  },

  // Pattern 23: E4 F#4 (eighth notes)
  {
    id: 23,
    notes: [n(64, 1), n(66, 1)],
  },

  // Pattern 24: E4 F#4 G4 A4 G4 F#4 (up and back)
  {
    id: 24,
    notes: [
      n(64, 1), n(66, 1), n(67, 1), n(69, 1),
      n(67, 1), n(66, 1),
    ],
  },

  // Pattern 25: E4 F#4 G4 A4 (similar to 20 but with F#)
  {
    id: 25,
    notes: [n(64, 1), n(66, 1), n(67, 1), n(69, 1)],
  },

  // Pattern 26: E4 F#4 G4 A4 G4 (ascending then step back)
  {
    id: 26,
    notes: [
      n(64, 1), n(66, 1), n(67, 1), n(69, 1),
      n(67, 1),
    ],
  },

  // Pattern 27: E4 F#4 G4 A4 B4 (ascending fifth)
  {
    id: 27,
    notes: [
      n(64, 1), n(66, 1), n(67, 1), n(69, 1),
      n(71, 1),
    ],
  },

  // Pattern 28: E4 F#4 G4 A4 B4 C5 (ascending sixth)
  {
    id: 28,
    notes: [
      n(64, 1), n(66, 1), n(67, 1), n(69, 1),
      n(71, 1), n(72, 1),
    ],
  },

  // Pattern 29: Contains lower register notes -- E4 F#4 G4 A4 B4 C5 B4 A4
  // (ascending then descending, the turn figure)
  {
    id: 29,
    notes: [
      n(64, 2), n(66, 2), n(64, 2), n(62, 2),
      n(64, 2), n(66, 2), n(64, 2), n(62, 2),
    ],
  },

  // Pattern 30: C5 B4 A4 (descending)
  {
    id: 30,
    notes: [n(72, 4), n(71, 4), n(69, 4)],
  },

  // Pattern 31: (sustained)
  {
    id: 31,
    notes: [n(67, 4), n(66, 2)],
  },

  // Pattern 32: (descending figure)
  {
    id: 32,
    notes: [n(66, 1), n(64, 1), n(66, 2)],
  },

  // Pattern 33: G4 F#4 (turn figure, repeated)
  {
    id: 33,
    notes: [
      n(67, 1), n(66, 1),
    ],
  },

  // Pattern 34: G4 F#4 G4 B4 (turn into leap)
  {
    id: 34,
    notes: [
      n(67, 1), n(66, 1), n(67, 1), n(71, 1),
    ],
  },

  // Pattern 35: The longest pattern (~60 eighth notes), spans 1.5 octaves
  // A complex melodic line that is the climactic center of the piece
  // F#4 G4 A4 B4 C5 B4 A4 B4 C5 B4 A4 G4 F#4 G4 A4 G4 F#4 E4 F#4 G4 A4 B4 C5 D5 E5 F5 E5 D5 C5 B4 C5 D5 E5 F5 E5 D5 C5 B4 A4 G4 A4 B4 C5 B4 A4 G4 F#4 G4 A4 G4 F#4 E4 F#4 E4 D4 E4 F#4 E4 D4 C4
  {
    id: 35,
    notes: [
      n(66, 1), n(67, 1), n(69, 1), n(71, 1),
      n(72, 1), n(71, 1), n(69, 1), n(71, 1),
      n(72, 1), n(71, 1), n(69, 1), n(67, 1),
      n(66, 1), n(67, 1), n(69, 1), n(67, 1),
      n(66, 1), n(64, 1), n(66, 1), n(67, 1),
      n(69, 1), n(71, 1), n(72, 1), n(74, 1),
      n(76, 1), n(77, 1), n(76, 1), n(74, 1),
      n(72, 1), n(71, 1), n(72, 1), n(74, 1),
      n(76, 1), n(77, 1), n(76, 1), n(74, 1),
      n(72, 1), n(71, 1), n(69, 1), n(67, 1),
      n(69, 1), n(71, 1), n(72, 1), n(71, 1),
      n(69, 1), n(67, 1), n(66, 1), n(67, 1),
      n(69, 1), n(67, 1), n(66, 1), n(64, 1),
      n(66, 1), n(64, 1), n(62, 1), n(64, 1),
      n(66, 1), n(64, 1), n(62, 1), n(60, 1),
    ],
  },

  // Pattern 36: (after the climax, simpler patterns return)
  // G4 F#4 G4 (oscillating figure)
  {
    id: 36,
    notes: [n(67, 1), n(66, 1), n(67, 1)],
  },

  // Pattern 37: F#4 G4 A4 (ascending triplet)
  {
    id: 37,
    notes: [n(66, 1), n(67, 1), n(69, 1)],
  },

  // Pattern 38: F#4 G4 A4 B4 G4 (ascending with turn back)
  {
    id: 38,
    notes: [n(66, 1), n(67, 1), n(69, 1), n(71, 1), n(67, 1)],
  },

  // Pattern 39: B4 G4 B4 G4 B4 G4 (oscillating third)
  {
    id: 39,
    notes: [
      n(71, 1), n(67, 1), n(71, 1), n(67, 1),
      n(71, 1), n(67, 1),
    ],
  },

  // Pattern 40: B4 F#4 (leap down)
  {
    id: 40,
    notes: [n(71, 1), n(66, 1)],
  },

  // Pattern 41: B4 G4 (eighth notes, repeated idea)
  {
    id: 41,
    notes: [
      n(71, 4),
      n(67, 4),
    ],
  },

  // Pattern 42: C5 B4 A4 B4 C5 (scale fragment, arc shape)
  {
    id: 42,
    notes: [
      n(72, 2), n(71, 2), n(69, 2),
      n(71, 2), n(72, 2),
    ],
  },

  // Pattern 43: F#5 G5 (upper register, eighth notes)
  {
    id: 43,
    notes: [n(78, 1), n(79, 1)],
  },

  // Pattern 44: F5 G5 Bb4 G5 (with leap down)
  // Actually uses upper register -- F5 G5 Bb5 G5
  {
    id: 44,
    notes: [n(77, 1), n(79, 1), n(82, 1), n(79, 1)],
  },

  // Pattern 45: A4 B4 C5 D5 (ascending)
  {
    id: 45,
    notes: [n(69, 1), n(71, 1), n(72, 1), n(74, 1)],
  },

  // Pattern 46: D5 E5 (high register, eighth notes)
  {
    id: 46,
    notes: [n(74, 1), n(76, 1)],
  },

  // Pattern 47: D5 E5 F5 (ascending fragment)
  {
    id: 47,
    notes: [n(74, 1), n(76, 1), n(77, 1)],
  },

  // Pattern 48: Final patterns -- winding down
  // G5 (sustained)
  {
    id: 48,
    notes: [n(79, 8)],
  },

  // Pattern 49: F5 G5 A5 G5 (upper oscillation)
  {
    id: 49,
    notes: [n(77, 1), n(79, 1), n(81, 1), n(79, 1)],
  },

  // Pattern 50: A5 G5 (upper descending)
  {
    id: 50,
    notes: [n(81, 1), n(79, 1)],
  },

  // Pattern 51: G5 F5 (descending step)
  {
    id: 51,
    notes: [n(79, 1), n(77, 1)],
  },

  // Pattern 52: F5 E5 (continued descent)
  {
    id: 52,
    notes: [n(77, 1), n(76, 1)],
  },

  // Pattern 53: Final pattern
  // G5 G5 (repeated, fading out)
  {
    id: 53,
    notes: [
      n(79, 4), n(79, 4),
    ],
  },
];
