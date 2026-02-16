---
phase: 08-microtiming
plan: 02
subsystem: audio
tags: [timing, rubato, scheduler, microtiming, humanization]

# Dependency graph
requires:
  - phase: 08-01
    provides: "computeTimingOffset, computeRubatoMultiplier, advanceRubato, RubatoState"
  - phase: 07-seeded-prng
    provides: "SeededRng for deterministic timing offsets"
provides:
  - "Audible microtiming: per-note timing offsets applied in Scheduler"
  - "Rubato tempo modulation via Ensemble.rubatoMultiplier in advanceTime()"
  - "Complete humanization pipeline: velocity + timing controlled by single toggle"
affects: [audio-playback, performance-feel]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Rubato state machine owned by Ensemble, read by Scheduler", "offsetTime clamped to currentTime for safety"]

key-files:
  created: []
  modified:
    - src/score/ensemble.ts
    - src/audio/scheduler.ts

key-decisions:
  - "Rubato getter (Option A) instead of tick() return type change -- simpler integration"
  - "Rubato period preserved across reset (personality of the performance)"

patterns-established:
  - "Ensemble owns tempo-modulation state; Scheduler reads via getter after tick()"
  - "offsetTime = max(currentTime, time + timingOffset) prevents past-scheduling"

# Metrics
duration: 2min
completed: 2026-02-15
---

# Phase 8 Plan 02: Scheduler Integration Summary

**Per-note timing offsets and rubato tempo modulation wired into audio scheduler -- swing, personality spread, and breathing feel all audible and controlled by humanization toggle**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T23:48:16Z
- **Completed:** 2026-02-15T23:49:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Ensemble owns RubatoState, computes multiplier per tick, exposes getter for Scheduler
- Scheduler applies event.timingOffset to all note scheduling (synth + sampled instruments)
- Rubato modulates advanceTime() grid spacing without changing displayed BPM
- MIDI recording preserved at quantized beat positions (unaffected by timing offsets)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add rubato to Ensemble and expose tempo multiplier** - `737a488` (feat)
2. **Task 2: Apply timing offsets and rubato in Scheduler** - `1e8eb32` (feat)

## Files Created/Modified
- `src/score/ensemble.ts` - Added RubatoState ownership, rubatoMultiplier getter, rubato reset
- `src/audio/scheduler.ts` - Applied offsetTime to note scheduling, rubato to advanceTime()

## Decisions Made
- Used getter approach (Option A) for rubatoMultiplier -- no tick() return type change needed, Scheduler reads after tick() completes
- Rubato period preserved across Ensemble.reset() -- it's a personality trait of the performance, only phase resets to 0

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete microtiming pipeline operational: velocity + timing humanization via single toggle
- Phase 8 fully complete -- ready for Phase 9 (per-note destination routing)
- All 50 tests passing, no type errors

---
*Phase: 08-microtiming*
*Completed: 2026-02-15*
