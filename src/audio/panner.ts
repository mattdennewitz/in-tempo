/**
 * Pan position computation for stereo spread.
 *
 * Assigns each performer an evenly-distributed position in the stereo field
 * from -1 (hard left) to +1 (hard right). Slot assignment is shuffled using
 * a seeded PRNG so performer 0 isn't always hard-left -- the same seed
 * always produces the same pan layout.
 */

import type { SeededRng } from '../score/rng';

/**
 * Compute pan positions for `count` performers, evenly distributed from -1 to +1.
 *
 * - 1 performer: center (0)
 * - 2 performers: hard left (-1) and hard right (+1), shuffled
 * - N performers: evenly-spaced slots from -1 to +1, Fisher-Yates shuffled
 *
 * @param count Number of performers (>= 1)
 * @param rng   Seeded PRNG for deterministic shuffle
 * @returns Array of pan values, one per performer index
 */
export function computePanPositions(count: number, rng: SeededRng): number[] {
  if (count === 1) return [0];

  // Generate evenly-spaced slots from -1 to +1, rounded to 4 decimal places
  const slots: number[] = [];
  for (let i = 0; i < count; i++) {
    slots.push(parseFloat((-1 + (2 * i) / (count - 1)).toFixed(4)));
  }

  // Fisher-Yates shuffle with seeded RNG for deterministic assignment
  for (let i = slots.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  return slots;
}

/**
 * Create a StereoPannerNode for a performer at a specific pan position.
 *
 * @param audioContext - The AudioContext to create the node in
 * @param panValue - Pan position from -1 (left) to +1 (right)
 * @param destination - The AudioNode to connect the panner output to
 * @returns A StereoPannerNode connected to the destination
 */
export function createPerformerPanNode(
  audioContext: AudioContext,
  panValue: number,
  destination: AudioNode,
): StereoPannerNode {
  const panner = audioContext.createStereoPanner();
  panner.pan.value = panValue;
  panner.connect(destination);
  return panner;
}
