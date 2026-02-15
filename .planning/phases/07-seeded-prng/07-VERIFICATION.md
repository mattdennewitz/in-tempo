---
phase: 07-seeded-prng
verified: 2026-02-15T20:21:30Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 7: Seeded PRNG Verification Report

**Phase Goal:** Users can share a URL that reproduces an identical performance note-for-note
**Verified:** 2026-02-15T20:21:30Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                | Status     | Evidence                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| 1   | AudioEngine creates a SeededRng from the seed and passes it to Ensemble and getPatternsForMode                      | ✓ VERIFIED | Lines 61-64, 167-169, 260-272 in engine.ts — RNG created and passed in correct order                    |
| 2   | Same seed + mode + BPM + count produces identical note sequence on every run                                        | ✓ VERIFIED | Deterministic RNG stream through getPatternsForMode → Ensemble. All 32 tests pass                       |
| 3   | Current seed is visible in the UI during and after performance                                                      | ✓ VERIFIED | SeedDisplay.tsx lines 49-54 — renders seed when > 0, shows "random" when 0                              |
| 4   | User can copy seed to clipboard with one click                                                                      | ✓ VERIFIED | SeedDisplay.tsx lines 19-23 — Copy button calls navigator.clipboard.writeText with seed                 |
| 5   | User can type a seed to replay a specific performance                                                               | ✓ VERIFIED | SeedDisplay.tsx lines 32-38, 81-96 — numeric input with handleSubmit calling onSeedChange               |
| 6   | URL hash fragment encodes seed + mode + BPM + count                                                                 | ✓ VERIFIED | App.tsx lines 80-87 — URLSearchParams encoding all 4 parameters after start                             |
| 7   | Opening a URL with hash fragment auto-configures mode, BPM, count, seed and shows Play button                       | ✓ VERIFIED | App.tsx lines 29-43, 54-68 — parsePerformanceHash on mount, engine configured, user clicks Start        |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                       | Expected                                       | Status     | Details                                                                                          |
| ------------------------------ | ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `src/components/SeedDisplay.tsx` | Seed display, copy, and input UI component     | ✓ VERIFIED | 99 lines, exports SeedDisplay, implements copy/share/input with clipboard API and feedback      |
| `src/audio/engine.ts`            | Seed-aware engine with RNG creation/injection  | ✓ VERIFIED | Lines 35-45, 58-64, 163-169, 256-272 — currentSeed field, setSeed, seed getter, RNG lifecycle   |
| `src/audio/types.ts`             | Updated EnsembleEngineState with seed field    | ✓ VERIFIED | Line 47 — `seed: number` added to EnsembleEngineState interface                                 |

### Key Link Verification

| From                  | To                            | Via                                                                              | Status     | Details                                                                                                |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| src/audio/engine.ts   | src/score/rng.ts              | Creates SeededRng instance, passes to Ensemble and getPatternsForMode            | ✓ WIRED    | Lines 19, 61-64 — import + 3 creation sites (initialize, setPerformerCount, setScoreMode)             |
| src/App.tsx           | src/components/SeedDisplay.tsx| Renders SeedDisplay with seed state and handlers                                 | ✓ WIRED    | Lines 11, 164-168 — import + render with seed, playing, onSeedChange props                            |
| src/App.tsx           | window.location.hash          | Parses URL hash on mount, updates hash on performance start                      | ✓ WIRED    | Lines 29-68 (parse on mount), 80-87 (update on start), 97 (clear on reset) — full lifecycle           |

### Requirements Coverage

| Requirement | Status       | Blocking Issue |
| ----------- | ------------ | -------------- |
| SEED-01     | ✓ SATISFIED  | Deterministic RNG stream verified through code inspection and test suite (32/32 tests pass)          |
| SEED-02     | ✓ SATISFIED  | SeedDisplay.tsx shows seed during/after performance (line 50-54)                                     |
| SEED-03     | ✓ SATISFIED  | Copy button with navigator.clipboard.writeText (line 21)                                             |
| SEED-04     | ✓ SATISFIED  | Manual seed input with onSeedChange handler (lines 32-96)                                            |
| SEED-05     | ✓ SATISFIED  | URL hash encoding with URLSearchParams (App.tsx lines 80-87)                                         |
| SEED-06     | ✓ SATISFIED  | parsePerformanceHash on mount auto-configures all parameters (App.tsx lines 54-68)                   |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| None | -    | -       | -        | -      |

**Notes:**
- No TODOs, FIXMEs, or placeholder comments found
- No empty implementations or console.log debugging
- The only "placeholder" string is in SeedDisplay.tsx line 87, which is a legitimate input placeholder attribute
- TypeScript compiles cleanly with no errors
- All 32 tests pass (6 rng.test.ts + 13 velocity.test.ts + 13 ensemble.test.ts)

### Critical Implementation Details Verified

**RNG Ordering (CRITICAL per PLAN):**
✓ All three creation sites (initialize, setPerformerCount, setScoreMode) follow correct order:
  1. Create RNG from seed
  2. Call getPatternsForMode(mode, rng) — consumes RNG calls for pattern generation
  3. Pass SAME RNG instance to Ensemble constructor — continues from where pattern generation left off
  4. This ensures single deterministic PRNG stream end-to-end

**Seed Lifecycle:**
✓ Seed = 0 → auto-generate from Date.now() on next start
✓ Seed > 0 → use explicit seed for deterministic replay
✓ Reset → clears seed to 0, clears URL hash
✓ Engine owns seed, overlays it on scheduler state (single source of truth)

**URL Hash Sharing:**
✓ Hash cleared on reset (line 97)
✓ Hash updated only on start, not during config changes (avoids hash churn)
✓ URLSearchParams ensures clean encoding
✓ parsePerformanceHash validates all 4 parameters before applying

**Commits Verified:**
✓ Task 1: 00c1620 — Wire SeededRng through AudioEngine (5 files modified)
✓ Task 2: 69558ff — Add SeedDisplay component and URL hash sharing (2 files created/modified)
✓ Both commits exist in git history with proper co-authorship

### Human Verification Required

None. All success criteria are verifiable through code inspection and automated tests.

**Rationale:**
- Deterministic performance: verified by RNG threading and test suite
- UI rendering: SeedDisplay component is substantive with full implementation
- Clipboard operations: standard browser API with proper error handling
- URL parsing/encoding: URLSearchParams is a standard API
- Manual seed entry: standard input with validation

All automated checks passed. No human verification needed.

---

## Verification Summary

**All must-haves verified.** Phase 7 goal achieved.

The seeded PRNG pipeline is complete:
1. ✓ Seed generation/storage in AudioEngine
2. ✓ SeededRng creation and consistent threading through score layer
3. ✓ Critical ordering enforced (getPatternsForMode BEFORE Ensemble)
4. ✓ Seed display with copy/share/input UI
5. ✓ URL hash encoding/decoding for shareable performances
6. ✓ Full lifecycle: parse on mount, update on start, clear on reset

All 6 SEED requirements (SEED-01 through SEED-06) from v1.2 roadmap are satisfied.

Phase 8 (microtiming) can build on this foundation — timing jitter will share the same SeededRng stream.

---

_Verified: 2026-02-15T20:21:30Z_
_Verifier: Claude (gsd-verifier)_
