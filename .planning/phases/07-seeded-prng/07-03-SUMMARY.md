---
phase: 07-seeded-prng
plan: 03
subsystem: audio
tags: [seed, prng, state-management, callback-wrapping]

# Dependency graph
requires:
  - phase: 07-seeded-prng/02
    provides: "Engine.getState() seed overlay and SeedDisplay component"
provides:
  - "Seed overlay on every Scheduler.fireStateChange() via callback wrapping"
  - "SeedDisplay shows actual numeric seed during performance (not 'Random')"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["callback wrapping pattern for Engine-owned state overlay"]

key-files:
  created: []
  modified:
    - src/audio/engine.ts

key-decisions:
  - "Use pendingOnStateChange as canonical raw callback, avoid double-wrapping"
  - "All 4 scheduler.onStateChange assignment sites wrapped consistently"

patterns-established:
  - "Callback wrapping: Engine always wraps onStateChange before assigning to Scheduler, ensuring Engine-owned fields are overlaid"

# Metrics
duration: 2min
completed: 2026-02-15
---

# Phase 7 Plan 3: Seed Display Bug Fix Summary

**Engine wraps onStateChange callback at all 4 assignment sites to overlay currentSeed, fixing SeedDisplay showing "Random" during performance**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T21:50:56Z
- **Completed:** 2026-02-15T21:52:18Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed seed display showing "Random" instead of actual seed value during performance
- Wrapped onStateChange callback at all 4 Scheduler assignment sites in Engine (setter, initialize, setPerformerCount, setScoreMode)
- Used pendingOnStateChange as canonical raw callback to prevent double-wrapping when scheduler is rebuilt

## Task Commits

Each task was committed atomically:

1. **Task 1: Engine intercepts onStateChange to overlay seed on every state update** - `a983b38` (fix)

## Files Created/Modified
- `src/audio/engine.ts` - Wrapped onStateChange callback at all 4 scheduler assignment sites to overlay Engine-owned currentSeed before state reaches React

## Decisions Made
- Used pendingOnStateChange as the canonical raw callback source instead of reading from scheduler.onStateChange (which would be the already-wrapped version, causing double-wrapping)
- Scheduler.ts left unchanged -- the seed: 0 placeholder in getState() is fine since Engine intercepts all state changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented double-wrapping in setPerformerCount and setScoreMode**
- **Found during:** Task 1 (callback wrapping)
- **Issue:** Plan said to preserve `this.scheduler?.onStateChange` as callback in setPerformerCount/setScoreMode, but after wrapping the setter, scheduler.onStateChange is already the wrapped version. Re-wrapping would nest closures infinitely.
- **Fix:** Changed both methods to read from `this.pendingOnStateChange` (raw callback) instead of `this.scheduler?.onStateChange`
- **Files modified:** src/audio/engine.ts
- **Verification:** TypeScript compiles, all 32 tests pass
- **Committed in:** a983b38 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential correctness fix -- without it, callbacks would nest on each mode/count change.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 7 gap closure complete -- all UAT tests should now pass
- Seed is correctly displayed in UI during performance
- Ready for Phase 8 (Microtiming)

---
*Phase: 07-seeded-prng*
*Completed: 2026-02-15*
