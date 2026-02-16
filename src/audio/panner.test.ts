import { describe, it, expect } from 'vitest';
import { computePanPositions } from './panner';
import { SeededRng } from '../score/rng';

describe('computePanPositions', () => {
  it('returns [0] for a single performer (center)', () => {
    const rng = new SeededRng(42);
    expect(computePanPositions(1, rng)).toEqual([0]);
  });

  it('returns values containing -1 and +1 for 2 performers', () => {
    const rng = new SeededRng(42);
    const positions = computePanPositions(2, rng);
    expect(positions).toHaveLength(2);
    expect(positions).toContain(-1);
    expect(positions).toContain(1);
  });

  it('returns 4 unique evenly spaced values for 4 performers', () => {
    const rng = new SeededRng(42);
    const positions = computePanPositions(4, rng);
    expect(positions).toHaveLength(4);

    // Should contain the evenly-spaced slots (in any order due to shuffle)
    const sorted = [...positions].sort((a, b) => a - b);
    expect(sorted).toEqual([-1, -0.3333, 0.3333, 1]);

    // All unique
    const unique = new Set(positions);
    expect(unique.size).toBe(4);
  });

  it('produces deterministic output for the same seed', () => {
    const rng1 = new SeededRng(123);
    const rng2 = new SeededRng(123);
    const pos1 = computePanPositions(6, rng1);
    const pos2 = computePanPositions(6, rng2);
    expect(pos1).toEqual(pos2);
  });

  it('produces different shuffle order for different seeds', () => {
    const rng1 = new SeededRng(111);
    const rng2 = new SeededRng(999);
    const pos1 = computePanPositions(8, rng1);
    const pos2 = computePanPositions(8, rng2);

    // Same values when sorted, but different order
    const sorted1 = [...pos1].sort((a, b) => a - b);
    const sorted2 = [...pos2].sort((a, b) => a - b);
    expect(sorted1).toEqual(sorted2);

    // At least one position should differ in order
    const orderDiffers = pos1.some((v, i) => v !== pos2[i]);
    expect(orderDiffers).toBe(true);
  });

  it('returns all unique values (no duplicates)', () => {
    const rng = new SeededRng(42);
    const positions = computePanPositions(16, rng);
    const unique = new Set(positions);
    expect(unique.size).toBe(16);
  });

  it('spans from -1 to +1 (full stereo field)', () => {
    const rng = new SeededRng(42);
    const positions = computePanPositions(8, rng);
    expect(Math.min(...positions)).toBe(-1);
    expect(Math.max(...positions)).toBe(1);
  });

  it('handles edge case of 3 performers: -1, 0, 1', () => {
    const rng = new SeededRng(42);
    const positions = computePanPositions(3, rng);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(sorted).toEqual([-1, 0, 1]);
  });
});
