# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Ensemble behavior must feel alive -- performers making believable musical decisions over a precisely timed audio engine, so each performance is unique and compelling.
**Current focus:** Phase 9 complete -- Stereo spread fully wired into audio graph

## Current Position

Phase: 9 of 10 (Stereo Spread)
Plan: 2 of 2 in current phase (09-02 complete)
Status: Phase 9 complete
Last activity: 2026-02-15 -- Completed 09-02 (Audio graph wiring for stereo spread)

Progress: [██████████████████████] 95% (20/20 plans complete through 09-02)

## Performance Metrics

**Velocity:**
- Total plans completed: 22 (v1.0: 11, v1.1: 5, v1.2: 6)
- Average duration: --
- Total execution time: --

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1-4 (v1.0) | 11 | -- | -- |
| 5-6 (v1.1) | 5 | -- | -- |
| 7 (v1.2) | 3 | 10min | 3min |
| 8 (v1.2) | 2 | 6min | 3min |
| 9 (v1.2) | 2 | 4min | 2min |

**Recent Trend:**
- Last 5 plans: --
- Trend: --

*Updated after each plan completion*

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

Recent decisions affecting current work:
- 09-02: Per-group (3 per instrument type) sampled instances instead of per-performer (memory optimization)
- 09-02: Pan positions computed AFTER Ensemble constructor to preserve RNG sequence
- 09-02: New performers fill largest gap in stereo field (not recompute all positions)
- 09-02: Synth voices dynamically disconnect/reconnect to pan nodes on each claim
- 09-01: Round pan positions to 4 decimal places (toFixed(4)) to avoid floating-point noise
- 09-01: Shuffle slots directly rather than indices (simpler, same result)
- 08-02: Rubato getter (Option A) instead of tick() return type change
- 08-02: Rubato period preserved across reset (personality of the performance)
- 08-01: Per-agent tickCount for beat index (not passed through tick() signature)
- 08-01: Ensemble.tick(bpm) optional parameter with default 120 (backward compatible)
- 08-01: Timing personality generated alongside velocity personality in generatePersonality()
- v1.2: Seeded PRNG before microtiming (foundation for deterministic timing jitter)
- v1.2: Mulberry32 hand-rolled PRNG, no npm dependency (15 lines, period 4B)
- 07-01: Single PRNG stream shared across all agents (not per-agent streams)
- 07-01: Module-level _rng pattern for generators, constructor injection for Ensemble
- 07-01: All RNG params optional with Date.now() fallback (zero breaking changes)
- 07-02: Engine owns the seed and overlays it on scheduler state (single source of truth)
- 07-03: Callback wrapping pattern -- Engine wraps onStateChange at all scheduler assignment sites to overlay seed

### Pending Todos

None.

### Blockers/Concerns

- Phase 8: Microtiming offsets clamped to +/-50ms (implemented in 08-01)
- Phase 9: smplr per-note destination routing needs runtime verification (addressed via per-group instances)

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed 09-02-PLAN.md (Audio graph wiring for stereo spread)
Resume file: None
