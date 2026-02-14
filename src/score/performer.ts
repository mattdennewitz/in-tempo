/**
 * Performer - Navigates through the score patterns for a single performer.
 *
 * Manages pattern advancement with random repetitions (2-8) and occasional
 * rest beats between patterns (~30% chance). Returns null when all 53
 * patterns have been exhausted (performance complete).
 */
import type { ScoreNote, Pattern } from '../audio/types.ts';
import { PATTERNS } from './patterns.ts';

export class Performer {
  private patterns: Pattern[];
  private currentPatternIndex: number = 0;
  private currentNoteIndex: number = 0;
  private repetitionsRemaining: number;
  private shouldRest: boolean = false;

  constructor(patterns: Pattern[] = PATTERNS) {
    this.patterns = patterns;
    this.repetitionsRemaining = this.randomRepetitions();
  }

  /** Returns a random repetition count between 2 and 8 (inclusive, uniform). */
  private randomRepetitions(): number {
    return Math.floor(Math.random() * 7) + 2;
  }

  /**
   * Returns the next note to play, or null if the performance is complete.
   *
   * Handles pattern iteration, repetition counting, pattern advancement,
   * and optional rest beats between patterns.
   */
  nextNote(): ScoreNote | null {
    // Performance complete
    if (this.currentPatternIndex >= this.patterns.length) {
      return null;
    }

    // Insert a rest beat between patterns if flagged
    if (this.shouldRest) {
      this.shouldRest = false;
      return { midi: 0, duration: 1 };
    }

    const pattern = this.patterns[this.currentPatternIndex];
    const note = pattern.notes[this.currentNoteIndex];

    this.currentNoteIndex++;

    // End of pattern iteration
    if (this.currentNoteIndex >= pattern.notes.length) {
      this.currentNoteIndex = 0;
      this.repetitionsRemaining--;

      // Repetitions exhausted: advance to next pattern
      if (this.repetitionsRemaining <= 0) {
        this.currentPatternIndex++;
        this.repetitionsRemaining = this.randomRepetitions();

        // ~30% chance of a rest beat between patterns
        if (this.currentPatternIndex < this.patterns.length && Math.random() < 0.3) {
          this.shouldRest = true;
        }
      }
    }

    return note;
  }

  /** Returns 1-based pattern number (1-53), clamped to 53 if complete. */
  get currentPattern(): number {
    return Math.min(this.currentPatternIndex + 1, this.patterns.length);
  }

  /** True when all patterns have been exhausted. */
  get isComplete(): boolean {
    return this.currentPatternIndex >= this.patterns.length;
  }

  /** Reset to pattern 1, note 0, with a fresh repetition count. */
  reset(): void {
    this.currentPatternIndex = 0;
    this.currentNoteIndex = 0;
    this.repetitionsRemaining = this.randomRepetitions();
    this.shouldRest = false;
  }
}
