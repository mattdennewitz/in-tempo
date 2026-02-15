# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Ensemble behavior must feel alive -- performers making believable musical decisions over a precisely timed audio engine, so each performance is unique and compelling.
**Current focus:** Phase 6 complete -- MIDI recording and export feature delivered

## Current Position

Phase: 6 of 6 (MIDI Export)
Plan: 2 of 2 in current phase
Status: Phase 6 complete
Last activity: 2026-02-15 -- Completed 06-02 MIDI export UI integration

Progress: [████████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 13 (v1.0 complete)
- Average duration: 3.7min
- Total execution time: ~0.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 5. Velocity | 3/3 | ~20min | ~7min |
| 6. MIDI Export | 2/2 | ~15min | ~7.5min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Velocity before MIDI -- recorder needs velocity values in AgentNoteEvent
- [Roadmap]: CFG-01 (default 4 performers) bundled with velocity phase since both affect default experience
- [Research]: midi-writer-js v3.1.1 for MIDI generation (velocity scale 1-100, not 0-127)
- [Research]: Parallel integer tick counter (PPQ=480) to prevent time drift in MIDI recording
- [05-01]: Velocity floor at 0.3 to prevent inaudible notes from multiplicative stacking
- [05-01]: Pattern-relative accent (noteIndexInPattern===0) rather than global beat counter
- [05-02]: Velocity scales maxGain multiplicatively (preserves headroom)
- [05-02]: velocityConfigRef pattern on Scheduler avoids constructor change
- [05-02]: CFG-01 applied: default 4 performers in engine.ts and App.tsx
- [05-03]: HumanizationToggle uses aria-pressed pattern consistent with ScoreModeSelector
- [05-03]: setPerformerCount rebuilt to rebuild ensemble when stopped (not just before first init)
- [06-01]: startTick for absolute tick positioning in midi-writer-js NoteEvent
- [06-01]: midiRecorder ref pattern on Scheduler (same as velocityConfigRef)
- [06-01]: Ghost note trimming via beatIndex < stopBeat filter
- [06-02]: ExportButton styled consistently with Transport using shadcn Button variant
- [06-02]: Export enabled based on engineState.hasRecording (reactive to recording state)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed 06-02-PLAN.md (MIDI export UI integration) -- Phase 6 complete, v1.0 delivered
Resume file: None
