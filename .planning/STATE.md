# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Ensemble behavior must feel alive -- performers making believable musical decisions over a precisely timed audio engine, so each performance is unique and compelling.
**Current focus:** Phase 3 in progress -- Visualization, Instruments, Polish

## Current Position

Phase: 3 of 4 (Visualization, Instruments, Polish)
Plan: 2 of 3 in current phase -- COMPLETE
Status: Executing
Last activity: 2026-02-15 -- Completed 03-02-PLAN.md

Progress: [#################-] 92%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 4min
- Total execution time: 0.45 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-audio-engine-score-foundation | 3/3 | 16min | 5min |
| 02-ensemble-ai | 2/2 | 5min | 2.5min |
| 03-visualization-instruments-polish | 2/3 | 5min | 2.5min |

**Recent Trend:**
- Last 5 plans: 01-03 (10min), 02-01 (3min), 02-02 (2min), 03-01 (2min), 03-02 (3min)
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
- [03-01]: Canvas rAF loop reads from ref (not React state) to avoid render-loop coupling
- [03-01]: STATE_COLORS separated from base PALETTE for clean renderer code
- [03-01]: ScoreModeSelector uses native select element with disabled options for simplicity
- [03-02]: Deterministic instrument assignment via performerId % 3 for stable, varied timbres
- [03-02]: SamplePlayer routes through shared GainNode at 0.6 to balance with synth voices
- [03-02]: Pulse uses fresh OscillatorNode per beat with auto-disconnect for zero memory growth

### Pending Todos

None yet.

### Blockers/Concerns

- GT Canon font files need to be provided by user before Phase 3 visual identity work
- ~~Sampled instrument audio files~~ RESOLVED: smplr loads piano/marimba from CDN at runtime

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed 03-02-PLAN.md (Sampled instruments via smplr, pulse generator, instrument routing in scheduler)
Resume file: None

**Phase 3 in progress** - Canvas visualization, visual identity, and sampled instruments complete. Next: 03-03 (final polish).
