---
phase: 08-microtiming
plan: 01
subsystem: score
tags: [timing, swing, jitter, rubato, humanization, prng]

# Dependency graph
requires:
  - phase: 07-seeded-prng
    provides: "SeededRng for deterministic timing jitter"
  - phase: 04-velocity
    provides: "intensityScale and VelocityConfig reused for timing layers"
provides:
  - "computeTimingOffset: layered timing offset (swing + personality + jitter + density)"
  - "computeSwingOffset: offbeat shift computation"
  - "computeRubatoMultiplier / advanceRubato: tempo oscillation (wired in Plan 02)"
  - "generateTimingPersonality: deterministic rush/drag bias and jitter"
  - "AgentNoteEvent.timingOffset populated on every note event"
  - "Ensemble.tick(bpm) accepts BPM for tempo-aware timing"
affects: [08-02-integration, scheduler, audio-playback]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Layered timing offset mirroring velocity.ts architecture", "Per-agent tickCount for beat tracking"]

key-files:
  created:
    - src/score/timing.ts
    - src/score/timing.test.ts
  modified:
    - src/score/ensemble.ts
    - src/audio/scheduler.ts

key-decisions:
  - "Per-agent tickCount for beat index (option b) instead of passing through tick() signature"
  - "Ensemble.tick(bpm) optional parameter with default 120 for backward compatibility"
  - "Timing personality generated alongside velocity personality in generatePersonality()"

patterns-established:
  - "Timing offset layers: swing + personality + jitter + density, clamped to +/-50ms"
  - "Rubato as separate state machine (phase + period), not coupled to timing offset"

# Metrics
duration: 4min
completed: 2026-02-15
---

# Phase 8 Plan 01: Timing Offset Computation Summary

**Pure timing offset module with swing, personality bias, jitter, and density layers -- clamped to +/-50ms -- plus rubato types for Plan 02**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T23:42:37Z
- **Completed:** 2026-02-15T23:46:05Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created timing.ts with 5 pure functions and 3 interfaces mirroring velocity.ts architecture
- 18 unit tests covering all timing computation functions including clamping bounds
- Extended AgentNoteEvent with timingOffset and AgentPersonality with timing fields
- Scheduler passes BPM to ensemble for tempo-aware swing calculation

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD timing.ts -- pure timing offset computation** - `7653a30` (feat)
2. **Task 2: Extend ensemble types and compute timing offset per note** - `461e56a` (feat)

## Files Created/Modified
- `src/score/timing.ts` - Pure timing offset computation (swing, personality, jitter, density, rubato)
- `src/score/timing.test.ts` - 18 unit tests for all timing functions
- `src/score/ensemble.ts` - Extended AgentPersonality, AgentNoteEvent, generatePersonality, tick() with BPM
- `src/audio/scheduler.ts` - Passes BPM to ensemble.tick()

## Decisions Made
- Used per-agent tickCount (option b) instead of passing beat index through tick() -- simpler interface, each agent gets consistent beat counter
- Ensemble.tick() accepts optional BPM parameter (default 120) -- backward compatible with all existing callers
- Timing personality traits generated in same generatePersonality() call as velocity traits -- single RNG stream maintained

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- timing.ts ready for Plan 02 rubato integration
- All note events carry timingOffset -- Plan 02 wires this into scheduler note scheduling
- Rubato types defined and tested, ready to be connected to ensemble tick loop

---
*Phase: 08-microtiming*
*Completed: 2026-02-15*
