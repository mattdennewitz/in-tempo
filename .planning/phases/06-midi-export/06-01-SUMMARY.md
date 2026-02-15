---
phase: 06-midi-export
plan: 01
subsystem: audio
tags: [midi, midi-writer-js, recording, export]

# Dependency graph
requires:
  - phase: 05-velocity
    provides: "Velocity values on AgentNoteEvent for MIDI velocity mapping"
provides:
  - "MidiRecorder: passive event recorder with integer beat counter"
  - "MidiExporter: multi-track MIDI file generation via midi-writer-js"
  - "Engine.exportMidi() and hasRecording for UI consumption"
affects: [06-02-PLAN]

# Tech tracking
tech-stack:
  added: [midi-writer-js v3.1.1]
  patterns: [passive-recorder-pattern, midiRecorder-ref-on-scheduler]

key-files:
  created:
    - src/audio/midi-recorder.ts
    - src/audio/midi-exporter.ts
  modified:
    - src/audio/scheduler.ts
    - src/audio/engine.ts
    - src/audio/types.ts

key-decisions:
  - "startTick for absolute tick positioning in midi-writer-js NoteEvent"
  - "midiRecorder ref pattern on Scheduler (same as velocityConfigRef)"
  - "Ghost note trimming via beatIndex < stopBeat filter"

patterns-established:
  - "midiRecorder ref on Scheduler: Engine owns recorder, passes to Scheduler via public field"
  - "Beat counter increment after event loop: ensures all events in a beat share same beatIndex"

# Metrics
duration: 7min
completed: 2026-02-15
---

# Phase 6 Plan 1: MIDI Recording & Export Pipeline Summary

**Passive MIDI recorder with integer beat counter and multi-track MIDI export via midi-writer-js with GM programs, tempo, and 1-100 velocity scaling**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-15T13:31:53Z
- **Completed:** 2026-02-15T13:39:26Z
- **Tasks:** 2
- **Files modified:** 5 (+ package.json/lock)

## Accomplishments
- MidiRecorder passively captures note events with integer eighth-note beat indices, trims ghost notes on stop
- MidiExporter converts recorded events to multi-track MIDI files with GM program changes (piano=0, marimba=12, synth=88), tempo meta-event, velocity mapped to 1-100 scale
- Scheduler increments beatCounter per eighth note, records every note event during playback
- Engine manages MidiRecorder lifecycle across scheduler rebuilds, exposes exportMidi() and hasRecording

## Task Commits

Each task was committed atomically:

1. **Task 1: Install midi-writer-js and create MidiRecorder + MidiExporter** - `7f89dc8` (feat)
2. **Task 2: Wire MidiRecorder into Scheduler and expose on Engine** - `39ffd21` (feat)

## Files Created/Modified
- `src/audio/midi-recorder.ts` - RecordedEvent interface and MidiRecorder class with start/record/stop/clear lifecycle
- `src/audio/midi-exporter.ts` - exportToMidi() for MIDI generation and downloadMidi() for browser download
- `src/audio/scheduler.ts` - beatCounter, midiRecorder ref, record calls in scheduleBeat, lifecycle hooks
- `src/audio/engine.ts` - MidiRecorder ownership, exportMidi(), hasRecording getter, wiring across rebuilds
- `src/audio/types.ts` - hasRecording field on EnsembleEngineState

## Decisions Made
- Used `startTick` (not `tick`) for absolute tick positioning in midi-writer-js NoteEvent constructor -- verified in source code
- Followed `velocityConfigRef` pattern for midiRecorder on Scheduler (public field set by Engine) to avoid constructor changes
- Ghost note trimming: filter events where beatIndex < stopBeat, since lookahead may schedule notes beyond actual stop point
- Beat counter increments after the event loop so all notes in one eighth-note slot share the same beatIndex

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MIDI recording and export pipeline complete
- Engine.exportMidi() and Engine.hasRecording ready for UI consumption in Plan 02
- EnsembleEngineState.hasRecording available for conditional button rendering

## Self-Check: PASSED

- All 5 key files exist on disk
- Commits 7f89dc8 and 39ffd21 verified in git log
- TypeScript compiles with zero errors

---
*Phase: 06-midi-export*
*Completed: 2026-02-15*
