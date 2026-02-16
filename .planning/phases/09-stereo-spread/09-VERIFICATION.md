---
phase: 09-stereo-spread
verified: 2026-02-16T01:16:25Z
status: human_needed
score: 8/8
human_verification:
  - test: "Headphone stereo positioning test"
    expected: "Each performer audibly positioned at different stereo location"
    why_human: "Requires listening with headphones to verify spatial positioning"
  - test: "Deterministic pan position test"
    expected: "Same seed produces same pan positions across multiple starts"
    why_human: "Requires human to compare stereo positions across resets"
  - test: "Even distribution test"
    expected: "Performers evenly distributed across stereo field (no clustering)"
    why_human: "Requires human judgment to assess spatial distribution quality"
  - test: "Dynamic add/remove test"
    expected: "Adding performer fills largest gap, removing maintains others"
    why_human: "Requires listening to verify new performers fill gaps correctly"
---

# Phase 9: Stereo Spread Verification Report

**Phase Goal:** Each performer occupies a distinct position in the stereo field, giving spatial clarity to the ensemble

**Verified:** 2026-02-16T01:16:25Z

**Status:** human_needed

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | computePanPositions returns evenly-distributed values from -1 to +1 | ✓ VERIFIED | Unit tests pass: 1 performer (0), 2 performers (-1, +1), 4 performers (-1, -0.3333, 0.3333, 1) |
| 2 | Single performer returns center (0) | ✓ VERIFIED | Unit test `returns [0] for a single performer (center)` passes |
| 3 | Same seed produces identical pan position assignments | ✓ VERIFIED | Unit test `produces deterministic output for the same seed` passes |
| 4 | All positions are unique (no two performers share a pan value) | ✓ VERIFIED | Unit test `returns all unique values (no duplicates)` passes |
| 5 | Each performer's audio output is panned to a distinct stereo position | ✓ VERIFIED | Scheduler routes synth voices through performerPanNodes (lines 195-198), sampled instruments through playPanned (line 226) |
| 6 | Pan positions are stable across resets and replays | ✓ VERIFIED | reset() does NOT dispose pan nodes (engine.ts:181-185), only rebuild paths (setScoreMode, setPerformerCount) recreate them |
| 7 | Performers are evenly distributed across the stereo field | ✓ VERIFIED | computePanPositions uses formula `-1 + (2 * i) / (count - 1)` for even spacing |
| 8 | Synth voices route through the correct performer's pan node on every note | ✓ VERIFIED | Scheduler disconnects/reconnects voice.node to performerPanNodes in scheduleBeat() |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/audio/panner.ts` | Pan position computation with seeded shuffle | ✓ VERIFIED | Exports computePanPositions and createPerformerPanNode, imports SeededRng, 59 lines |
| `src/audio/panner.test.ts` | Unit tests for pan position computation | ✓ VERIFIED | 8 tests covering edge cases, determinism, uniqueness, 77 lines |
| `src/audio/sampler.ts` | Per-group sampled instrument instances (3 per type) | ✓ VERIFIED | PanGroups interface, playPanned() method, CacheStorage import, 229 lines |
| `src/audio/scheduler.ts` | Per-note pan routing for synth voices and sampled instruments | ✓ VERIFIED | performerPanNodes and performerPanValues fields, routing in scheduleBeat() |
| `src/audio/engine.ts` | Pan node creation during initialize() using computePanPositions | ✓ VERIFIED | setupPanNodes() method, called after Ensemble constructor in all paths |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/audio/panner.ts` | `src/score/rng.ts` | SeededRng for deterministic shuffle | ✓ WIRED | Import on line 10: `import type { SeededRng } from '../score/rng'` |
| `src/audio/engine.ts` | `src/audio/panner.ts` | computePanPositions called during initialize() | ✓ WIRED | Import on line 20, called in setupPanNodes() line 122 |
| `src/audio/scheduler.ts` | `src/audio/panner.ts` | performerPanNodes map used in scheduleBeat() | ✓ WIRED | Field declared line 44, used lines 195-198 for synth routing |
| `src/audio/sampler.ts` | StereoPannerNode | Per-group instances route through pan nodes | ✓ WIRED | PanGroups interface lines 18-20, instances created with destination: panGroups.left/center/right |
| `src/audio/engine.ts` | `src/audio/scheduler.ts` | Pan maps passed to scheduler | ✓ WIRED | Lines 96, 207, 267, 321, 442 assign performerPanNodes and performerPanValues |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| STE-01: Each performer's audio output is panned to a distinct stereo position | ✓ SATISFIED | Synth voices route through performerPanNodes (scheduler.ts:195-198), sampled instruments use playPanned() (scheduler.ts:226) |
| STE-02: Pan positions are deterministic (same performer ID = same position across resets) | ✓ SATISFIED | computePanPositions uses seeded shuffle, reset() preserves pan nodes, unit test verifies determinism |
| STE-03: Performers are evenly distributed across the stereo field | ✓ SATISFIED | Even spacing formula verified by unit tests, spans -1 to +1 |

### Anti-Patterns Found

None detected. All files contain substantive implementations with no TODO/FIXME/placeholder comments, no empty returns, no console.log-only implementations.

### Human Verification Required

#### 1. Headphone Stereo Positioning Test

**Test:** Start a performance with 4+ performers while wearing headphones. Listen for distinct stereo positions.

**Expected:** Each performer should be audibly positioned at a different point in the stereo field (some left, some center, some right). The spatial separation should make it easier to follow individual performers.

**Why human:** Requires listening with headphones to verify that the StereoPannerNode routing produces the expected spatial positioning. Automated tests can verify the code structure but cannot verify the auditory experience.

#### 2. Deterministic Pan Position Test

**Test:** Start a performance with a specific seed and 4 performers. Note which performer is on the left. Stop and restart with the same seed. Verify the same performer is on the left.

**Expected:** Same seed + same performer count = same pan positions. The leftmost performer should be the same, the rightmost performer should be the same, etc.

**Why human:** While unit tests verify computePanPositions is deterministic, this test verifies the end-to-end integration including Ensemble RNG sequencing, pan node creation, and scheduler routing.

#### 3. Even Distribution Test

**Test:** Start performances with 2, 3, 4, 6, and 8 performers. Listen for even spacing.

**Expected:** 
- 2 performers: one hard left, one hard right
- 3 performers: left, center, right
- 4 performers: evenly spaced across field
- 6+ performers: no clustering on one side

**Why human:** Requires human judgment to assess whether the spatial distribution "feels" even. While the formula guarantees mathematical evenness, the perceptual quality needs human verification.

#### 4. Dynamic Add/Remove Performer Test

**Test:** Start with 3 performers. Add a performer. Note where the new performer appears in the stereo field (should fill a gap). Remove the new performer. Verify existing performers haven't shifted.

**Expected:** 
- Adding a performer: new performer fills the largest gap in the stereo field (not clustered with existing)
- Removing a performer: existing performers maintain their positions (no shifts)

**Why human:** Requires listening to verify the findLargestGapMidpoint() algorithm produces perceptually correct results and that pan positions remain stable during dynamic changes.

### Implementation Quality

**Code Structure:**
- Clean separation: panner.ts (pure computation), engine.ts (lifecycle), scheduler.ts (routing), sampler.ts (per-group instances)
- Well-documented: All functions have JSDoc comments explaining purpose and parameters
- Type-safe: All exports properly typed, no `any` types used

**Test Coverage:**
- 8 unit tests covering edge cases (1, 2, 3, 4, 8, 16 performers)
- Determinism verified (same seed = same output)
- Uniqueness verified (no duplicate pan values)
- Full range verified (spans -1 to +1)

**Wiring Quality:**
- All imports verified present
- All key links traced through grep
- No orphaned artifacts (all created files are used)
- No stub implementations detected

**RNG Sequencing:**
- Pan positions computed AFTER Ensemble constructor in all code paths (initialize, setScoreMode, setPerformerCount) per plan requirement
- Preserves deterministic personality/timing sequence

**Dynamic Behavior:**
- addPerformer() fills largest gap using findLargestGapMidpoint()
- removePerformer() cleans up pan node without shifting others
- Scheduler references updated on add/remove

### Commits Verified

All commits from SUMMARY.md exist in git history:

1. `ae8d3aa` - test(09-01): add failing tests for computePanPositions
2. `5f1b470` - feat(09-01): implement computePanPositions with seeded shuffle  
3. `0079bd1` - feat(09-02): create per-performer pan nodes and per-group sampled instrument routing
4. `13ea84c` - feat(09-02): route synth voices and sampled notes through per-performer pan nodes

---

## Conclusion

**All automated checks passed.** The stereo spread feature is fully implemented with:

- Deterministic pan position computation (verified by unit tests)
- Per-performer StereoPannerNode routing for synth voices
- Per-group sampled instrument instances (3 per type) for stereo spread
- Dynamic add/remove performer support with gap-filling
- Stable pan positions across resets (STE-02)
- No regressions (tsc --noEmit passes, existing tests pass)

**Human verification required** to confirm the auditory experience matches the implementation: spatial positioning, determinism, even distribution, and dynamic behavior.

All must_haves verified. Phase goal automated verification complete. Awaiting human UAT for final sign-off.

---
_Verified: 2026-02-16T01:16:25Z_
_Verifier: Claude (gsd-verifier)_
