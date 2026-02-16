---
phase: 09-stereo-spread
plan: 02
subsystem: audio
tags: [stereo, panning, web-audio, StereoPannerNode, smplr]

# Dependency graph
requires:
  - phase: 09-01
    provides: computePanPositions() for deterministic stereo distribution
  - phase: 07-seeded-prng
    provides: SeededRng class for deterministic pan position shuffle
provides:
  - Per-performer StereoPannerNode routing for synth voices
  - Per-group sampled instrument instances (3 per type) for stereo spread
  - Dynamic pan assignment for add/remove performer
affects: []

# Tech tracking
tech-stack:
  added: [smplr CacheStorage]
  patterns: [per-performer-pan-routing, per-group-sampled-instruments, largest-gap-fill]

key-files:
  created: []
  modified:
    - src/audio/panner.ts
    - src/audio/sampler.ts
    - src/audio/engine.ts
    - src/audio/scheduler.ts

key-decisions:
  - "Per-group (3 instances per instrument type) instead of per-performer smplr instances to limit memory"
  - "Pan positions computed AFTER Ensemble constructor to preserve existing RNG sequence"
  - "New performers fill largest gap in stereo field rather than recomputing all positions"
  - "Synth voices dynamically disconnect/reconnect to pan nodes on each claim (shared pool)"

patterns-established:
  - "setupPanNodes() called AFTER new Ensemble() in all code paths (initialize, setScoreMode, setPerformerCount)"
  - "findLargestGapMidpoint() for dynamic performer pan assignment during playback"
  - "Scheduler receives pan maps via public fields (same pattern as velocityConfigRef)"

# Metrics
duration: 3min
completed: 2026-02-15
---

# Phase 9 Plan 2: Audio Graph Wiring Summary

**StereoPannerNode routing for synth voices and per-group sampled instrument instances with CacheStorage shared downloads**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T01:09:51Z
- **Completed:** 2026-02-16T01:13:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Per-performer StereoPannerNodes created in Engine and passed to Scheduler for synth voice routing
- SamplePlayer refactored with 3 instances per instrument type (left/center/right) using CacheStorage
- Dynamic pan assignment (addPerformer fills largest gap, removePerformer cleans up)
- Pan infrastructure wired into all rebuild paths (initialize, setScoreMode, setPerformerCount)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create per-performer pan nodes and refactor SamplePlayer** - `0079bd1` (feat)
2. **Task 2: Route synth voices and sampled notes through pan nodes** - `13ea84c` (feat)

## Files Created/Modified
- `src/audio/panner.ts` - Added createPerformerPanNode() helper for StereoPannerNode creation
- `src/audio/sampler.ts` - Refactored for per-group stereo instances with PanGroups interface and playPanned() method
- `src/audio/engine.ts` - Pan node lifecycle (setupPanNodes, disposePanNodes, findLargestGapMidpoint), wired into all init/rebuild paths
- `src/audio/scheduler.ts` - Added performerPanNodes/performerPanValues fields, voice routing through pan nodes in scheduleBeat()

## Decisions Made
- Used per-group (3 instances per instrument type) rather than per-performer smplr instances to limit memory usage
- Pan positions computed AFTER Ensemble constructor RNG calls to preserve deterministic personality/timing sequence
- New performers during playback fill the largest gap in the stereo field (maintains even distribution)
- Synth voices disconnect from masterGain and reconnect to per-performer pan nodes on each claim -- voice stealing handles routing correctly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Stereo spread feature complete -- each performer panned to a distinct position
- Phase 9 (final feature phase) complete
- Ready for Phase 10 (if applicable)

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 09-stereo-spread*
*Completed: 2026-02-15*
