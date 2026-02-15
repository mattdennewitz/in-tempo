---
phase: 04-composition-modes
plan: 01
subsystem: score
tags: [generative, ensemble, c-major, pattern-factory, score-modes]

requires:
  - phase: 02-ensemble-ai
    provides: Ensemble class, PerformerAgent, band enforcement, endgame logic
provides:
  - Dynamic ensemble accepting any-length Pattern[] (no hardcoded 52)
  - ScoreMode type ('riley' | 'generative' | 'euclidean')
  - generateGenerativePatterns() producing 30-80 fresh C-major patterns
  - getPatternsForMode() factory function
  - PerformerState currentRep/totalReps for UI consumption
affects: [04-02, 04-03, ui-composition-selector]

tech-stack:
  added: []
  patterns: [dynamic-derived-fields, motif-bank-reuse, progressive-arc-generation]

key-files:
  created:
    - src/score/generative.ts
    - src/score/score-modes.ts
  modified:
    - src/audio/types.ts
    - src/score/ensemble.ts
    - src/score/ensemble.test.ts
    - src/audio/engine.ts
    - src/audio/scheduler.ts

key-decisions:
  - "bandWidth formula: Math.max(2, Math.min(5, Math.round(patterns.length * 0.06))) -- 2-5 range proportional to pattern count"
  - "enforceBand accepts bandWidth as parameter with default=3 for backward compat"
  - "Ensemble.scoreMode getter returns 'riley' for now -- mode switching deferred to Plan 03"
  - "Generative patterns use motif bank with transpose/invert/retrograde transforms for cohesion"

patterns-established:
  - "setNewReps() dual-set pattern: always set totalRepetitions alongside repetitionsRemaining"
  - "Dynamic ensemble fields: finalPatternIndex and bandWidth derived from patterns.length in constructor"

duration: 4min
completed: 2026-02-15
---

# Phase 4 Plan 1: Dynamic Ensemble + Generative Factory Summary

**Dynamic ensemble handling any-length Pattern[] with proportional band width, plus generative pattern factory producing 30-80 fresh C-major patterns with progressive arc**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T06:00:51Z
- **Completed:** 2026-02-15T06:05:06Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Ensemble now derives finalPatternIndex and bandWidth from patterns.length -- no hardcoded 52 or 3
- PerformerState exposes currentRep/totalReps (1-based) for UI repetition display
- Generative factory produces musically structured patterns: progressive arc, motif reuse, tonal center drift, pulse patterns, C-major constraint
- Score mode resolver dispatches riley/generative/euclidean via single factory function

## Task Commits

Each task was committed atomically:

1. **Task 1: Dynamic Ensemble + Type Extensions** - `06f929c` (feat)
2. **Task 2: Generative Pattern Factory + Score Mode Resolver** - `77f5af6` (feat)

## Files Created/Modified
- `src/audio/types.ts` - Added ScoreMode type, currentRep/totalReps to PerformerState, totalPatterns/scoreMode to EnsembleEngineState
- `src/score/ensemble.ts` - Removed BAND_WIDTH/FINAL_PATTERN_INDEX constants, dynamic derivation, totalRepetitions tracking, enforceBand bandWidth param
- `src/score/ensemble.test.ts` - Updated AgentState fixtures with totalRepetitions field
- `src/audio/engine.ts` - Updated getState fallback with totalPatterns/scoreMode defaults
- `src/audio/scheduler.ts` - Updated getState to include totalPatterns/scoreMode from ensemble
- `src/score/generative.ts` - New: generative pattern factory with progressive arc, motif bank, C-major constraint
- `src/score/score-modes.ts` - New: getPatternsForMode() factory dispatching by ScoreMode

## Decisions Made
- Band width formula `Math.max(2, Math.min(5, Math.round(patterns.length * 0.06)))` gives 3 for 53 patterns (Riley), 2-5 for generative range
- enforceBand gets bandWidth as optional parameter with default=3 so existing tests pass without change
- Ensemble.scoreMode returns 'riley' as hardcoded default; actual mode tracking deferred to Plan 03 (mode switching UI)
- Generative motif bank stores 2-4 note fragments from ~30% of patterns, reuses via transpose/invert/retrograde at ~20% probability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated EnsembleEngineState consumers**
- **Found during:** Task 1 (Dynamic Ensemble + Type Extensions)
- **Issue:** Adding totalPatterns/scoreMode to EnsembleEngineState made engine.ts and scheduler.ts type-incomplete
- **Fix:** Updated Scheduler.getState() and AudioEngine.getState() fallback to include new fields
- **Files modified:** src/audio/engine.ts, src/audio/scheduler.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 06f929c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for type correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dynamic ensemble ready for euclidean patterns (Plan 02)
- getPatternsForMode() ready to dispatch euclidean mode once generator is built
- currentRep/totalReps ready for UI consumption in Plan 03

---
*Phase: 04-composition-modes*
*Completed: 2026-02-15*
