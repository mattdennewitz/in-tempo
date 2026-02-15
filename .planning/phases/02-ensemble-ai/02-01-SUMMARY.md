---
phase: 02-ensemble-ai
plan: 01
subsystem: ai
tags: [ensemble, weighted-decisions, agent-ai, in-c, performer-simulation]

# Dependency graph
requires:
  - phase: 01-audio-engine-score-foundation
    provides: "Pattern/ScoreNote types, PATTERNS array (53 patterns), Performer class"
provides:
  - "Ensemble coordinator with immutable snapshot evaluation"
  - "PerformerAgent with weighted decision-making at pattern boundaries"
  - "Band enforcement (BAND_WIDTH=3), dropout/rejoin cycles, unison seeking"
  - "Endgame logic for staggered completion at pattern 53"
  - "AgentPersonality for per-agent behavioral variation"
  - "PerformerState and EnsembleEngineState types"
affects: [02-02, 03-visuals, 04-composition-modes]

# Tech tracking
tech-stack:
  added: []
  patterns: [immutable-snapshot-evaluation, weighted-random-choice, agent-personality-system]

key-files:
  created:
    - src/score/ensemble.ts
    - src/score/ensemble.test.ts
  modified:
    - src/audio/types.ts

key-decisions:
  - "Immutable frozen snapshots per tick prevent order-of-evaluation bugs"
  - "Band enforcement is a hard override after weighted choice (not a weight modifier)"
  - "Minimum active floor of 2 playing performers prevents dropout cascades"
  - "Endgame dropout is permanent (status='complete', no rejoin) vs normal dropout (status='silent')"
  - "_mutableState accessor exposed for testing direct state manipulation"

patterns-established:
  - "Snapshot pattern: all agents evaluate against same frozen state per tick"
  - "Personality system: random 0.8-1.2 bias multipliers for behavioral variation"
  - "Decision pipeline: computeWeights -> weightedChoice -> enforceBand (hard override)"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 2 Plan 1: Ensemble AI Core Summary

**Ensemble AI with weighted PerformerAgent decisions, immutable snapshot evaluation, band enforcement (BAND_WIDTH=3), dropout/rejoin cycles, unison seeking, and endgame logic for 53-pattern In C score**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T23:58:08Z
- **Completed:** 2026-02-15T00:00:46Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- PerformerAgent with tick-based decision logic: advance/repeat/dropout at pattern boundaries with personality-weighted probabilities
- Ensemble coordinator creates frozen snapshots each tick so all agents evaluate against identical state
- Band enforcement prevents any performer from being more than 3 patterns ahead of lowest active performer
- Dropout/rejoin cycles with configurable silent durations, density-aware rejoin probability, and minimum active floor
- Endgame logic: scaled dropout chance when >60% of performers reach pattern 53, permanent completion (no rejoin)
- Full test suite with 13 tests covering all behaviors including integration tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types and build Ensemble AI with PerformerAgent** - `8f3fe36` (feat)

## Files Created/Modified
- `src/audio/types.ts` - Added PerformerState and EnsembleEngineState interfaces
- `src/score/ensemble.ts` - Full ensemble AI: PerformerAgent, Ensemble, weightedChoice, computeWeights, enforceBand, generatePersonality
- `src/score/ensemble.test.ts` - 13 Vitest tests covering weighted choice, band enforcement, dropout/rejoin, endgame, snapshot immutability, staggered entry, minimum active floor

## Decisions Made
- Immutable frozen snapshots per tick prevent order-of-evaluation bugs across agents
- Band enforcement is a hard override after weighted choice rather than a weight modifier -- ensures absolute constraint
- Minimum active floor of 2 playing performers prevents dropout cascades that could leave the ensemble silent
- Endgame dropout sets status='complete' (permanent, no rejoin) vs normal dropout status='silent'
- Exposed `_mutableState` accessor on PerformerAgent for direct state manipulation in tests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ensemble AI is pure logic with no audio dependency, ready for integration with audio engine in plan 02
- PerformerState type available for UI consumption
- All exports documented in plan frontmatter for downstream plans

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 02-ensemble-ai*
*Completed: 2026-02-14*
