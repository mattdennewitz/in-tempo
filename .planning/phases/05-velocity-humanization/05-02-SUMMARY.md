---
phase: 05-velocity-humanization
plan: 02
subsystem: audio
tags: [velocity, humanization, audio-pipeline, synth, sampler, integration]

requires:
  - phase: 05-01
    provides: computeVelocity, VelocityConfig, VelocityPersonality, generateVelocityPersonality
provides:
  - AgentNoteEvent with velocity field on every note
  - Per-note gain in synth voices (not hardcoded 0.3)
  - 0-127 velocity to sampled instruments for timbral variation
  - VelocityConfig persisted on AudioEngine, survives reset/setScoreMode
  - setHumanization() and setHumanizationIntensity() API on AudioEngine
  - Default 4 performers (CFG-01)
affects: [05-03 (UI toggle for humanization), 06-midi-export (velocity in MIDI events)]

tech-stack:
  added: []
  patterns: [velocity-routing-pipeline, per-note-gain-worklet, config-persistence-across-reset]

key-files:
  created: []
  modified:
    - src/score/ensemble.ts
    - src/audio/types.ts
    - src/audio/scheduler.ts
    - src/audio/sampler.ts
    - src/audio/engine.ts
    - public/synth-processor.js
    - src/App.tsx

key-decisions:
  - "Velocity scales maxGain (0.3) multiplicatively rather than replacing it -- preserves headroom"
  - "velocityConfigRef pattern on Scheduler avoids adding constructor parameter to existing API"
  - "Default 4 performers (CFG-01) applied in engine.ts and App.tsx INITIAL_STATE"

patterns-established:
  - "Velocity pipeline: Ensemble computes -> Scheduler routes -> Synth/Sampler applies"
  - "Config persistence: AudioEngine owns VelocityConfig, passes to new Ensemble instances on reset/mode-change"

duration: 4min
completed: 2026-02-15
---

# Phase 5 Plan 2: Velocity Pipeline Integration Summary

**Velocity routed through full audio pipeline: ensemble computes per-note velocity, synth uses per-note gain, sampler receives 0-127 velocity, default 4 performers**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T08:11:41Z
- **Completed:** 2026-02-15T08:15:21Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Every AgentNoteEvent now carries a velocity field computed from four-layer humanization model
- Synth voices use per-note gain scaled by velocity instead of hardcoded maxGain
- Sampled instruments (piano/marimba) receive 0-127 velocity for timbral variation via sample layers
- Default performer count changed from 8 to 4 (CFG-01)
- VelocityConfig persists across engine.reset() and setScoreMode()

## Task Commits

Each task was committed atomically:

1. **Task 1: Add velocity to AgentNoteEvent and wire through Ensemble** - `08f4d26` (feat)
2. **Task 2: Route velocity through Scheduler, SamplePlayer, and synth processor** - `13ece1d` (feat)

## Files Created/Modified
- `src/score/ensemble.ts` - AgentNoteEvent + velocity field, AgentPersonality + velocity traits, Ensemble accepts VelocityConfig
- `src/audio/types.ts` - Re-exports VelocityConfig, EnsembleEngineState + humanization fields
- `src/audio/scheduler.ts` - Routes velocity as gain to synth, 0-127 to sampler, reports humanization state
- `src/audio/sampler.ts` - SamplePlayer.play() accepts optional velocity parameter (0-127)
- `public/synth-processor.js` - Per-note noteGain replaces hardcoded maxGain in render loop
- `src/audio/engine.ts` - Owns VelocityConfig, 4 default performers, setHumanization/setHumanizationIntensity API
- `src/App.tsx` - INITIAL_STATE updated to 4 performers with humanization defaults

## Decisions Made
- Velocity scales maxGain (0.3) multiplicatively rather than replacing it -- preserves per-voice headroom while allowing dynamic variation
- Used velocityConfigRef pattern on Scheduler to expose config without changing constructor signature
- Applied CFG-01 (default 4 performers) in both engine.ts and App.tsx INITIAL_STATE for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Velocity flows end-to-end: every note has humanized dynamics
- setHumanization() and setHumanizationIntensity() ready for UI toggle (Plan 03)
- humanizationEnabled and humanizationIntensity in EnsembleEngineState for React binding

## Self-Check: PASSED

- [x] All 7 modified files exist
- [x] Commit 08f4d26 (Task 1) exists
- [x] Commit 13ece1d (Task 2) exists
- [x] AgentNoteEvent has velocity field
- [x] synth-processor uses noteGain (not hardcoded maxGain)
- [x] scheduler routes event.velocity to synth and sampler
- [x] sampler accepts velocity parameter
- [x] initialPerformerCount = 4
- [x] All 26 tests passing (13 velocity + 13 ensemble)

---
*Phase: 05-velocity-humanization*
*Completed: 2026-02-15*
