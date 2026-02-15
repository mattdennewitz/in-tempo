# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Ensemble behavior must feel alive -- performers making believable musical decisions over a precisely timed audio engine, so each performance is unique and compelling.
**Current focus:** Phase 7 — Seeded PRNG (deterministic performances via shared URL)

## Current Position

Phase: 7 of 10 (Seeded PRNG)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-15 — Completed 07-01 (SeededRng + Math.random replacement)

Progress: [██████████████░░░░░░] 70% (16/16 v1.0+v1.1 plans complete, 1/2 phase 7)

## Performance Metrics

**Velocity:**
- Total plans completed: 16 (v1.0: 11, v1.1: 5)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1-4 (v1.0) | 11 | — | — |
| 5-6 (v1.1) | 5 | — | — |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

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

### Pending Todos

None.

### Blockers/Concerns

- Phase 7: 30+ Math.random() call sites must ALL be replaced for determinism (silent failure if any missed)
- Phase 8: Microtiming offsets must stay within 100ms lookahead window (clamp required)
- Phase 9: smplr per-note destination routing needs runtime verification

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed 07-01-PLAN.md (SeededRng class + all 32 Math.random replacements)
Resume file: None
