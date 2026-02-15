/**
 * Score mode resolver - factory function that returns patterns for each mode.
 */

import type { Pattern } from '../audio/types.ts';
import type { ScoreMode } from '../audio/types.ts';
import { PATTERNS } from './patterns.ts';
import { generateGenerativePatterns } from './generative.ts';
import { generateEuclideanPatterns } from './euclidean.ts';

export function getPatternsForMode(mode: ScoreMode): Pattern[] {
  switch (mode) {
    case 'riley':
      return PATTERNS;
    case 'generative':
      return generateGenerativePatterns();
    case 'euclidean':
      return generateEuclideanPatterns();
  }
}
