# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Ensemble behavior must feel alive -- performers making believable musical decisions over a precisely timed audio engine, so each performance is unique and compelling.
**Current focus:** Phase 5 complete -- ready for Phase 6 (MIDI Export)

## Current Position

Phase: 5 of 6 (Velocity Humanization) -- COMPLETE
Plan: 3 of 3 in current phase
Status: Phase complete
Last activity: 2026-02-15 -- Completed 05-03 humanization UI toggle & verification

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 11 (v1.0)
- Average duration: 3.5min
- Total execution time: ~0.6 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 5. Velocity | 3/3 | ~20min | ~7min |
| 6. MIDI Export | - | - | - |

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed 05-03-PLAN.md (humanization UI & verification) -- Phase 5 complete
Resume file: None
