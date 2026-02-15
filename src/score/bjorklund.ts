/**
 * Bjorklund's algorithm: distribute k pulses as evenly as possible across n steps.
 * Based on Toussaint (2005) "The Euclidean Algorithm Generates Traditional Musical Rhythms".
 *
 * Returns a binary array of length n where 1 = pulse and 0 = rest.
 */

export function bjorklund(k: number, n: number): number[] {
  if (k >= n) return Array(n).fill(1);
  if (k === 0) return Array(n).fill(0);

  let level = 0;
  const counts: number[] = [];
  const remainders: number[] = [];

  // Compute remainders (like Euclidean GCD)
  let divisor = n - k;
  remainders.push(k);

  while (remainders[remainders.length - 1] > 1) {
    counts.push(Math.floor(divisor / remainders[remainders.length - 1]));
    const newRemainder = divisor % remainders[remainders.length - 1];
    divisor = remainders[remainders.length - 1];
    remainders.push(newRemainder);
    level++;
    if (newRemainder <= 1) break;
  }
  counts.push(divisor);

  // Build pattern via the Bjorklund construction
  function build(lev: number): number[] {
    if (lev === -1) return [0];
    if (lev === -2) return [1];

    const result: number[] = [];
    for (let i = 0; i < counts[lev]; i++) {
      result.push(...build(lev - 1));
    }
    if (remainders[lev] > 0) {
      result.push(...build(lev - 2));
    }
    return result;
  }

  return build(level);
}

/**
 * Rotate a pattern by offset positions (circular shift).
 * E.g., rotatePattern([1,0,1,0,0], 2) => [1,0,0,1,0]
 */
export function rotatePattern(pattern: number[], offset: number): number[] {
  const len = pattern.length;
  if (len === 0) return [];
  const normalized = ((offset % len) + len) % len;
  return [...pattern.slice(normalized), ...pattern.slice(0, normalized)];
}
