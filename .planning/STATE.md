# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Ensemble behavior must feel alive -- performers making believable musical decisions over a precisely timed audio engine, so each performance is unique and compelling.
**Current focus:** Phase 2 Complete -- Ready for Phase 3

## Current Position

Phase: 2 of 4 (Ensemble AI) -- COMPLETE
Plan: 2 of 2 in current phase -- COMPLETE
Status: Phase Complete
Last activity: 2026-02-15 -- Completed 02-02-PLAN.md

Progress: [################--] 83%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 4min
- Total execution time: 0.37 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-audio-engine-score-foundation | 3/3 | 16min | 5min |
| 02-ensemble-ai | 2/2 | 5min | 2.5min |

**Recent Trend:**
- Last 5 plans: 01-01 (4min), 01-02 (2min), 01-03 (10min), 02-01 (3min), 02-02 (2min)
- Trend: Fast

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 4-phase structure derived from requirements -- audio foundation first, then ensemble AI, then visuals/instruments, then alt composition modes
- [Research]: Lookahead scheduler (Chris Wilson "Two Clocks" pattern) must be correct from Phase 1; audio-visual sync bridge should be designed into scheduler even though visuals come in Phase 3
- [01-01]: AudioWorklet processor as plain JS in public/ dir for Vite compatibility
- [01-01]: Dual detuned sine oscillators (~3 cents) for warm synth voice character
- [01-01]: Score encoded as MIDI note numbers + eighth-note duration units
- [01-02]: Voice stealing reclaims oldest claimed voice when pool exhausted (no null returns)
- [01-02]: Scheduler fires onStateChange after every note for responsive UI updates
- [01-02]: AudioEngine lazy initialization -- AudioContext created on first start() only
- [01-03]: AudioEngine stored in useRef for framework-agnostic persistence across renders
- [01-03]: Pattern display shows contextual states (Ready/Pattern N/Performance Complete)
- [01-03]: 5ms exponential attack ramp eliminates click artifacts at note onset
- [02-01]: Immutable frozen snapshots per tick prevent order-of-evaluation bugs across agents
- [02-01]: Band enforcement is hard override after weighted choice (not weight modifier)
- [02-01]: Minimum active floor of 2 playing performers prevents dropout cascades
- [02-01]: Endgame dropout is permanent (status='complete') vs normal dropout (status='silent')
- [02-01]: _mutableState accessor on PerformerAgent for direct test state manipulation
- [02-02]: Scheduler advances exactly one eighth note per tick (fixed beat clock) rather than variable note durations
- [02-02]: Voice pool sized at 2x performer count (16 voices for 8 performers) for headroom
- [02-02]: Global voice claim/release handles multi-performer contention naturally via voice stealing
- [02-02]: Performer grid uses CSS opacity transitions for playing/silent/complete states

### Pending Todos

None yet.

### Blockers/Concerns

- GT Canon font files need to be provided by user before Phase 3 visual identity work
- Sampled instrument audio files (piano, marimba) need to be sourced before Phase 3 instrument work

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed 02-02-PLAN.md (Ensemble-Audio integration: beat clock scheduler, 16-voice pool, per-performer UI grid)
Resume file: None

**Phase 2 COMPLETE** - Full multi-performer In C performance with ensemble AI driving all musical decisions. Ready for Phase 3.
