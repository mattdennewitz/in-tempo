/**
 * Seeded PRNG using Mulberry32 algorithm.
 *
 * Drop-in replacement for Math.random() that produces deterministic sequences
 * from a given seed. Used throughout src/score/ to enable reproducible
 * performances from shared URLs.
 *
 * Algorithm: Mulberry32 (Tommy Ettinger) -- period 2^32, passes gjrand testing.
 * Source: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    // Ensure non-zero initial state (seed 0 would produce degenerate sequence)
    this.state = (seed | 0) || 1;
  }

  /** Returns float in [0, 1) -- drop-in replacement for Math.random() */
  random(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** Pick random element from array */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }

  /**
   * Weighted random selection.
   * Semantics match the existing weightedChoice/weightedPick pattern:
   * cumulative weights, fall through to last option on floating-point edge case.
   */
  weighted<T>(options: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.random() * total;
    for (let i = 0; i < options.length; i++) {
      r -= weights[i];
      if (r <= 0) return options[i];
    }
    return options[options.length - 1];
  }
}
