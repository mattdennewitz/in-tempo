import { describe, it, expect } from 'vitest';
import { SeededRng } from './rng.ts';

describe('SeededRng', () => {
  it('same seed produces identical sequence of 1000 random() calls', () => {
    const rng1 = new SeededRng(42);
    const rng2 = new SeededRng(42);

    const seq1: number[] = [];
    const seq2: number[] = [];
    for (let i = 0; i < 1000; i++) {
      seq1.push(rng1.random());
      seq2.push(rng2.random());
    }

    expect(seq1).toEqual(seq2);
  });

  it('different seeds produce different sequences', () => {
    const rng1 = new SeededRng(42);
    const rng2 = new SeededRng(99);

    const seq1: number[] = [];
    const seq2: number[] = [];
    for (let i = 0; i < 100; i++) {
      seq1.push(rng1.random());
      seq2.push(rng2.random());
    }

    // Sequences should differ (extremely unlikely to match by chance)
    expect(seq1).not.toEqual(seq2);
  });

  it('int() returns values in [min, max] inclusive', () => {
    const rng = new SeededRng(123);
    const values = new Set<number>();

    for (let i = 0; i < 1000; i++) {
      const v = rng.int(0, 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
      values.add(v);
    }

    // With 1000 calls over range [0,10], we should hit all 11 values
    expect(values.size).toBe(11);
  });

  it('pick() returns elements from the provided array', () => {
    const rng = new SeededRng(456);
    const arr = ['a', 'b', 'c', 'd'];
    const picked = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const v = rng.pick(arr);
      expect(arr).toContain(v);
      picked.add(v);
    }

    // Should pick all elements with 100 tries over 4 options
    expect(picked.size).toBe(4);
  });

  it('weighted() with weights [0, 0, 1] always picks the third option', () => {
    const rng = new SeededRng(789);
    const options = ['a', 'b', 'c'];
    const weights = [0, 0, 1];

    for (let i = 0; i < 100; i++) {
      expect(rng.weighted(options, weights)).toBe('c');
    }
  });

  it('seed zero does not produce a degenerate zero sequence', () => {
    const rng = new SeededRng(0);
    const values: number[] = [];

    for (let i = 0; i < 100; i++) {
      values.push(rng.random());
    }

    // All values should be in [0, 1)
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }

    // Should not be all zeros or all the same value
    const unique = new Set(values);
    expect(unique.size).toBeGreaterThan(50);
  });
});
