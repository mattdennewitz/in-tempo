---
phase: 08-microtiming
verified: 2026-02-15T23:55:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 08: Microtiming Verification Report

**Phase Goal:** Performances feel rhythmically organic with swing, rubato, and per-performer timing variation
**Verified:** 2026-02-15T23:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | computeTimingOffset returns 0 when humanization disabled | ✓ VERIFIED | Test timing.test.ts:45-48, implementation timing.ts:65 |
| 2 | Swing shifts only odd beats forward, even unchanged | ✓ VERIFIED | Tests timing.test.ts:14-31, implementation timing.ts:53-54 |
| 3 | Rush/drag personality creates consistent directional offset | ✓ VERIFIED | Tests timing.test.ts:51-67, implementation timing.ts:73 |
| 4 | Random jitter produces different offsets per note within bounds | ✓ VERIFIED | Tests timing.test.ts:69-80, implementation timing.ts:76-77 |
| 5 | Density looseness adds spread proportional to density | ✓ VERIFIED | Implementation timing.ts:80 |
| 6 | Total offset clamped to [-50ms, +50ms] regardless of stacking | ✓ VERIFIED | Tests timing.test.ts:82-112, implementation timing.ts:84 |
| 7 | AgentNoteEvent includes timingOffset field on every note | ✓ VERIFIED | ensemble.ts:44, 387 |
| 8 | AgentPersonality includes rushDragBias and timingJitter | ✓ VERIFIED | ensemble.ts:69-70, 232-233 |
| 9 | Swing shifts alternate eighth notes forward audibly | ✓ VERIFIED | Wired: scheduler.ts:177-180 applies offset |
| 10 | Each performer has audible timing personality spread | ✓ VERIFIED | Personality generated (ensemble.ts:232-233), computed (ensemble.ts:374-375), applied (scheduler.ts:177-180) |
| 11 | Rubato breathes effective tempo non-mechanically | ✓ VERIFIED | Rubato state (ensemble.ts:581), multiplier computed (ensemble.ts:636-640), applied (scheduler.ts:242-243) |
| 12 | Microtiming controlled by humanization toggle/intensity | ✓ VERIFIED | timing.ts:65 checks config.enabled, :67 uses intensityScale |
| 13 | Timing offsets never cause dropped notes or past-scheduling | ✓ VERIFIED | scheduler.ts:177-180 Math.max(currentTime, time + offset) |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/score/timing.ts` | Pure timing offset computation (swing, personality, jitter, density, rubato) | ✓ VERIFIED | 121 lines, exports all 5 functions + 3 interfaces, no stubs |
| `src/score/timing.test.ts` | Unit tests for all timing functions | ✓ VERIFIED | 189 lines, 18 tests passing, covers all edge cases |
| `src/score/ensemble.ts` | Extended AgentPersonality, AgentNoteEvent, RubatoState ownership | ✓ VERIFIED | Modified, timing fields added, rubato state owned and exposed |
| `src/audio/scheduler.ts` | Applies timingOffset when scheduling, rubato in advanceTime | ✓ VERIFIED | offsetTime computed line 177-180, rubato applied line 242-243 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| timing.ts | velocity.ts | imports intensityScale, VelocityConfig | ✓ WIRED | timing.ts:18,22-23 imports, :67 uses intensityScale |
| ensemble.ts | timing.ts | imports computeTimingOffset, generateTimingPersonality | ✓ WIRED | ensemble.ts:27-32 imports, :387 calls computeTimingOffset |
| scheduler.ts | ensemble.ts | reads timingOffset from AgentNoteEvent, rubatoMultiplier getter | ✓ WIRED | scheduler.ts:179 event.timingOffset, :242 ensemble.rubatoMultiplier |
| ensemble.ts | timing.ts | imports computeRubatoMultiplier, advanceRubato | ✓ WIRED | ensemble.ts:28-29 imports, :636 computes, :640 advances |

### Requirements Coverage

No requirements explicitly mapped to Phase 08 in REQUIREMENTS.md.

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER/console.log-only implementations found in modified files.

### Human Verification Required

The following aspects require manual testing as they involve audible perception:

#### 1. Swing Groove Feel

**Test:** Start a performance with humanization enabled at "expressive" intensity. Listen to the rhythmic feel.
**Expected:** Alternate eighth notes (offbeats) should feel pushed forward, creating a swing groove. The feel should be subtle but noticeable, making the rhythm less mechanical.
**Why human:** Groove perception is subjective and requires musical hearing.

#### 2. Per-Performer Timing Spread

**Test:** With multiple performers active (4-6 agents), listen for timing differences between voices.
**Expected:** Each performer should have a consistent rush or drag tendency. Some voices slightly ahead, some behind, creating a natural ensemble spread. Not random chaos, but consistent personalities.
**Why human:** Temporal spread perception requires tracking multiple voices simultaneously.

#### 3. Rubato Breathing

**Test:** Listen for gentle tempo fluctuations over 16-32 beat periods.
**Expected:** The tempo should subtly speed up and slow down in a wave pattern, making the performance feel more organic and less like a metronome. Should be barely noticeable, not jarring.
**Why human:** Subtle tempo modulation detection requires extended listening and feel.

#### 4. Humanization Toggle Control

**Test:** Toggle humanization off during playback.
**Expected:** Timing should become perfectly grid-locked (no swing, no personality spread, no rubato). Then toggle back on and verify timing variety returns.
**Why human:** A/B comparison requires real-time listening.

#### 5. Intensity Scaling

**Test:** Try different humanization intensity levels (subtle, moderate, expressive).
**Expected:** Higher intensity should produce more pronounced swing, wider personality spread, and stronger rubato. Subtle should be barely noticeable.
**Why human:** Relative intensity perception requires subjective judgment.

#### 6. Determinism Check

**Test:** Start two performances with the same seed and same humanization settings.
**Expected:** Timing offsets should be identical across both performances (same swing patterns, same personality behaviors, same rubato breathing).
**Why human:** Requires comparing two full performances for perceptual equivalence.

### Overall Assessment

Phase 08 successfully achieves its goal. All computational foundations are in place:

- **Swing** shifts odd beats forward proportionally to intensity (15% of eighth note at expressive, ~37.5ms at 120 BPM)
- **Personality** gives each performer a consistent rush/drag bias (-30ms to +30ms at expressive)
- **Jitter** adds per-note random variation scaled by personality
- **Density** adds looseness when many performers are active
- **Rubato** modulates tempo by ±3% over 16-32 beat periods
- **Clamping** ensures no offset exceeds ±50ms (half the lookahead window)
- **Integration** applies all offsets in the scheduler while preserving MIDI quantization

The implementation is:
- **Pure functional** (timing.ts mirrors velocity.ts architecture)
- **Deterministic** (seeded PRNG ensures reproducibility)
- **Tested** (18 unit tests covering all edge cases)
- **Wired** (ensemble computes, scheduler applies)
- **Controlled** (single humanization toggle, no new UI needed)

Human verification is needed to confirm the audible quality and musical feel, but all programmatic checks pass.

---

_Verified: 2026-02-15T23:55:00Z_
_Verifier: Claude (gsd-verifier)_
