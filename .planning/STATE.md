# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Ensemble behavior must feel alive -- performers making believable musical decisions over a precisely timed audio engine, so each performance is unique and compelling.
**Current focus:** Phase 7 complete -- Seeded PRNG (deterministic performances via shared URL, seed display bug fixed)

## Current Position

Phase: 7 of 10 (Seeded PRNG) -- COMPLETE
Plan: 3 of 3 in current phase (done)
Status: Phase complete
Last activity: 2026-02-15 -- Completed 07-03 (Seed display bug fix via callback wrapping)

Progress: [███████████████░░░░░] 75% (16/16 v1.0+v1.1 plans complete, 3/3 phase 7)

## Performance Metrics

**Velocity:**
- Total plans completed: 19 (v1.0: 11, v1.1: 5, v1.2: 3)
- Average duration: --
- Total execution time: --

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1-4 (v1.0) | 11 | -- | -- |
| 5-6 (v1.1) | 5 | -- | -- |
| 7 (v1.2) | 3 | 10min | 3min |

**Recent Trend:**
- Last 5 plans: --
- Trend: --

*Updated after each plan completion*

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

Recent decisions affecting current work:
- v1.2: Seeded PRNG before microtiming (foundation for deterministic timing jitter)
- v1.2: Mulberry32 hand-rolled PRNG, no npm dependency (15 lines, period 4B)
- 07-01: Single PRNG stream shared across all agents (not per-agent streams)
- 07-01: Module-level _rng pattern for generators, constructor injection for Ensemble
- 07-01: All RNG params optional with Date.now() fallback (zero breaking changes)
- 07-02: Engine owns the seed and overlays it on scheduler state (single source of truth)
- 07-02: URL hash uses URLSearchParams for encoding seed+mode+bpm+count
- 07-02: Hash cleared on reset, updated on start (not during playback changes)
- 07-03: Callback wrapping pattern -- Engine wraps onStateChange at all scheduler assignment sites to overlay seed
- 07-03: pendingOnStateChange is canonical raw callback; scheduler gets wrapped version to avoid double-nesting

### Pending Todos

None.

### Blockers/Concerns

- Phase 8: Microtiming offsets must stay within 100ms lookahead window (clamp required)
- Phase 9: smplr per-note destination routing needs runtime verification

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed 07-03-PLAN.md (Seed display bug fix via callback wrapping)
Resume file: None
