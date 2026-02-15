---
phase: 03-visualization-instruments-polish
plan: 02
subsystem: audio
tags: [smplr, sampled-instruments, piano, marimba, pulse, oscillator, web-audio]

# Dependency graph
requires:
  - phase: 02-ensemble-ai
    provides: "Ensemble tick loop, performer agents, beat clock scheduler"
  - phase: 01-audio-engine-score-foundation
    provides: "AudioEngine facade, VoicePool, AudioWorklet synth voices"
provides:
  - "SamplePlayer wrapping smplr for piano and marimba playback"
  - "PulseGenerator for toggleable eighth-note high C reference tone"
  - "Deterministic instrument assignment (synth/piano/marimba by performer ID)"
  - "Scheduler instrument routing (synth via VoicePool, sampled via SamplePlayer)"
affects: [03-visualization-instruments-polish, ui-controls]

# Tech tracking
tech-stack:
  added: [smplr]
  patterns: [instrument-routing, deterministic-assignment, oscillator-per-pulse]

key-files:
  created:
    - src/audio/sampler.ts
    - src/audio/pulse.ts
  modified:
    - src/audio/types.ts
    - src/audio/scheduler.ts
    - src/audio/engine.ts
    - src/score/ensemble.ts
    - package.json

key-decisions:
  - "Deterministic instrument assignment via performerId % 3 for stable, varied timbres"
  - "SamplePlayer uses smplr destination option to route through shared GainNode (0.6 level)"
  - "Pulse uses fresh OscillatorNode per beat with auto-disconnect for zero memory growth"

patterns-established:
  - "Instrument routing: scheduler checks assignInstrument() to route notes to VoicePool or SamplePlayer"
  - "Sampled instruments loaded during engine init (not lazily) to avoid first-note latency"

# Metrics
duration: 3min
completed: 2026-02-15
---

# Phase 3 Plan 2: Sampled Instruments and Pulse Summary

**Piano and marimba via smplr library with deterministic performer assignment and toggleable high-C eighth-note pulse generator**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-15T04:15:38Z
- **Completed:** 2026-02-15T04:18:56Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- SamplePlayer wrapping smplr loads piano (SplendidGrandPiano) and marimba (Soundfont) during engine initialization
- PulseGenerator creates staccato sine-wave pulses at C7 (MIDI 96, 2093 Hz) each beat when enabled
- Scheduler routes ~33% of performers each to synth, piano, and marimba based on deterministic ID-based assignment
- Engine exposes togglePulse() for UI control; state includes pulseEnabled and per-performer instrument type

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SamplePlayer with smplr and PulseGenerator** - `20bde94` (feat)
2. **Task 2: Wire SamplePlayer and PulseGenerator into Scheduler and Engine** - `ea71c2a` (feat)

## Files Created/Modified
- `src/audio/sampler.ts` - SamplePlayer class wrapping smplr, assignInstrument() utility
- `src/audio/pulse.ts` - PulseGenerator class with toggleable high-C sine pulses
- `src/audio/types.ts` - Added InstrumentType, instrument on PerformerState, pulseEnabled on EnsembleEngineState
- `src/audio/scheduler.ts` - Instrument routing in scheduleBeat, pulse scheduling, togglePulse()
- `src/audio/engine.ts` - SamplePlayer and PulseGenerator lifecycle management
- `src/score/ensemble.ts` - Added instrument to performerStates getter
- `package.json` - Added smplr dependency

## Decisions Made
- Deterministic instrument assignment via `performerId % 3` ensures stable, reproducible timbral variety across resets
- SamplePlayer routes through a GainNode at 0.6 to balance volume with synth voices
- Pulse uses a fresh OscillatorNode per beat (auto-disposed via onended) rather than a persistent oscillator, preventing memory growth
- Removed unused `ScoreNote` import from ensemble.ts (was pre-existing dead import)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused ScoreNote import from ensemble.ts**
- **Found during:** Task 2
- **Issue:** `ScoreNote` was imported but unused in ensemble.ts (pre-existing), TypeScript strict mode flagged it
- **Fix:** Removed the unused import
- **Files modified:** src/score/ensemble.ts
- **Committed in:** ea71c2a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial cleanup of pre-existing unused import. No scope creep.

## Issues Encountered
None

## User Setup Required
None - smplr loads samples from CDN at runtime, no local asset configuration needed.

## Next Phase Readiness
- Sampled instruments and pulse ready for audible testing
- UI needs togglePulse button (not in this plan's scope)
- Pre-existing TypeScript errors remain in PatternDisplay.tsx (unused var) and ensemble.test.ts (vitest not installed) -- unrelated to this plan

## Self-Check: PASSED

- All 6 source files verified present
- Both task commits verified (20bde94, ea71c2a)
- Production build succeeds

---
*Phase: 03-visualization-instruments-polish*
*Completed: 2026-02-15*
