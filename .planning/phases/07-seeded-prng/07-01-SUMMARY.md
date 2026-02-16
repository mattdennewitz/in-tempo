---
phase: 07-seeded-prng
plan: 01
subsystem: score
tags: [prng, mulberry32, determinism, seeded-rng]

# Dependency graph
requires: []
provides:
  - "SeededRng class with Mulberry32 PRNG (src/score/rng.ts)"
  - "All 32 Math.random() call sites replaced with SeededRng in src/score/"
  - "Optional rng parameter on all generator and ensemble APIs"
affects: [07-02, 08-microtiming, engine, url-sharing]

# Tech tracking
tech-stack:
  added: [mulberry32-prng]
  patterns: [constructor-injection-rng, module-level-rng-for-generators, optional-rng-with-date-fallback]

key-files:
  created:
    - src/score/rng.ts
    - src/score/rng.test.ts
  modified:
    - src/score/ensemble.ts
    - src/score/generative.ts
    - src/score/euclidean.ts
    - src/score/velocity.ts
    - src/score/performer.ts
    - src/score/score-modes.ts
    - src/score/ensemble.test.ts
    - src/score/velocity.test.ts

key-decisions:
  - "Single PRNG stream shared across all agents (not per-agent streams)"
  - "Module-level _rng pattern for generative.ts/euclidean.ts (avoids threading rng through every helper)"
  - "All RNG params optional with Date.now() fallback so existing call sites don't break"

patterns-established:
  - "Constructor injection: Ensemble/PerformerAgent accept optional rng, store as private field"
  - "Module-level RNG: generators set _rng at entry, helpers use it implicitly"
  - "Determinism invariant: agents tick in array order, PRNG call sequence is deterministic"

# Metrics
duration: 5min
completed: 2026-02-15
---

# Phase 7 Plan 1: Seeded PRNG Summary

**Mulberry32 SeededRng class with random/int/pick/weighted methods, all 32 Math.random() sites replaced across 6 score files**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-15T20:07:45Z
- **Completed:** 2026-02-15T20:12:58Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- SeededRng class with Mulberry32 algorithm and 4 convenience methods (random, int, pick, weighted)
- All 32 Math.random() call sites across 6 files replaced with SeededRng methods
- Zero Math.random() calls remain in src/score/ production code
- 6 new determinism/distribution tests, all 32 total tests passing
- All parameters optional with Date.now() fallback -- zero breaking changes to existing call sites

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SeededRng class with Mulberry32 and determinism tests** - `6462b49` (feat)
2. **Task 2: Replace all Math.random() in score files with SeededRng** - `78482b3` (feat)

## Files Created/Modified
- `src/score/rng.ts` - SeededRng class with Mulberry32 PRNG
- `src/score/rng.test.ts` - 6 determinism and distribution tests
- `src/score/ensemble.ts` - RNG in Ensemble/PerformerAgent constructors, weightedChoice, personality generation
- `src/score/generative.ts` - Module-level RNG, all helpers converted
- `src/score/euclidean.ts` - Module-level RNG, all helpers converted
- `src/score/velocity.ts` - Optional RNG param on computeVelocity and generateVelocityPersonality
- `src/score/performer.ts` - Optional RNG param on Performer constructor
- `src/score/score-modes.ts` - Optional RNG forwarded to generators
- `src/score/ensemble.test.ts` - Fixed weightedChoice test to use shared RNG
- `src/score/velocity.test.ts` - Fixed intensity spread test to use shared RNG

## Decisions Made
- Single PRNG stream shared across all agents (tick order is deterministic via array iteration)
- Module-level `_rng` pattern for generative.ts/euclidean.ts to avoid threading rng through every inner helper
- All RNG parameters optional with `Date.now() & 0xFFFFFFFF` fallback for backward compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed existing tests broken by RNG change**
- **Found during:** Task 2 (Math.random replacement)
- **Issue:** Tests calling weightedChoice() and computeVelocity() in loops without RNG got identical values each call (same Date.now() seed)
- **Fix:** Passed shared SeededRng instance to test loops in ensemble.test.ts and velocity.test.ts
- **Files modified:** src/score/ensemble.test.ts, src/score/velocity.test.ts
- **Verification:** All 32 tests pass
- **Committed in:** 78482b3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for test correctness after API change. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All score files use SeededRng via optional parameters
- Plan 02 can wire the RNG through the engine: create seed in AudioEngine, pass to getPatternsForMode() and Ensemble constructor
- URL hash encoding/decoding and SeedDisplay component ready to build

---
*Phase: 07-seeded-prng*
*Completed: 2026-02-15*
