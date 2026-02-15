# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Ensemble behavior must feel alive -- performers making believable musical decisions over a precisely timed audio engine, so each performance is unique and compelling.
**Current focus:** Phase 2 - Ensemble AI

## Current Position

Phase: 2 of 4 (Ensemble AI)
Plan: 1 of 2 in current phase
Status: In Progress
Last activity: 2026-02-14 -- Completed 02-01-PLAN.md

Progress: [############------] 67%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 5min
- Total execution time: 0.32 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-audio-engine-score-foundation | 3/3 | 16min | 5min |
| 02-ensemble-ai | 1/2 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: 01-01 (4min), 01-02 (2min), 01-03 (10min), 02-01 (3min)
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

### Pending Todos

None yet.

### Blockers/Concerns

- GT Canon font files need to be provided by user before Phase 3 visual identity work
- Sampled instrument audio files (piano, marimba) need to be sourced before Phase 3 instrument work

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 02-01-PLAN.md (Ensemble AI core: PerformerAgent with weighted decisions, band enforcement, dropout/rejoin, endgame logic)
Resume file: None

**Phase 2 In Progress** - Plan 02-01 complete, ready for 02-02 (Ensemble-Audio integration)
