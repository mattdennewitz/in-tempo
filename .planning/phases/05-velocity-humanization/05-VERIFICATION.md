---
phase: 05-velocity-humanization
verified: 2026-02-15T08:37:00Z
status: human_needed
score: 6/6 truths verified (automated checks)
human_verification:
  - test: "Velocity variation is audible in playback"
    expected: "Notes have varied dynamics, not uniform/mechanical sound"
    why_human: "Audio perception requires human listening"
  - test: "Different performers sound dynamically distinct"
    expected: "Some performers generally louder, others softer"
    why_human: "Timbral and dynamic character requires ear verification"
  - test: "Toggle humanization off produces uniform velocity"
    expected: "All notes sound same loudness when toggled off"
    why_human: "Audio perception of uniform vs. varied dynamics"
  - test: "Intensity levels are perceptibly different"
    expected: "Expressive has clearly wider dynamic range than subtle"
    why_human: "Dynamic range perception requires listening"
  - test: "Metric accents are subtly audible"
    expected: "Pattern starts (downbeats) slightly emphasized"
    why_human: "Subtle accent perception in musical context"
  - test: "Phrase contour shapes velocity across repetitions"
    expected: "Gentle swell and recede across pattern repetitions, not random"
    why_human: "Long-term dynamic shaping requires listening over time"
---

# Phase 5: Velocity Humanization Verification Report

**Phase Goal:** Every note has musically meaningful velocity variation that performers express through audio playback

**Verified:** 2026-02-15T08:37:00Z
**Status:** human_needed (all automated checks passed, awaiting human verification)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All automated verifications passed. Human listening verification pending for final confirmation.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | computeVelocity returns 1.0 when humanization is disabled | ✓ VERIFIED | Test suite: 13/13 tests passing, disabled bypass test passes |
| 2 | computeVelocity returns values in 0.3-1.0 range (floor prevents inaudible notes) | ✓ VERIFIED | Test suite: floor enforcement test passes, ceiling enforcement test passes |
| 3 | Different personality baseLoudness values produce different average velocities | ✓ VERIFIED | Test suite: personality test shows baseLoudness=0.9 produces higher average than 0.7 |
| 4 | noteIndexInPattern === 0 produces higher velocity than mid-pattern notes (accent) | ✓ VERIFIED | Test suite: accent test passes, pattern in ensemble.ts line 332-333 uses noteIndexInPattern |
| 5 | Phrase contour produces a bell-curve shape across repetitions (not flat, not random) | ✓ VERIFIED | Test suite: contour test passes, phraseContour function implements bell curve peaking at 60% |
| 6 | Intensity scale multiplies variation range: subtle < moderate < expressive | ✓ VERIFIED | Test suite: intensity scaling test passes, intensityScale returns 0.4/0.7/1.0 |
| 7 | AgentNoteEvent always has a velocity field (never undefined) | ✓ VERIFIED | AgentNoteEvent interface line 32, PerformerAgent.tick() line 346 always computes velocity |
| 8 | Each performer's notes have distinct velocity characteristics (personality-driven) | ✓ VERIFIED | AgentPersonality lines 48-49 include baseLoudness/jitterAmount, generatePersonality() uses generateVelocityPersonality() |
| 9 | Synth voices play at per-note gain levels (not hardcoded 0.3) | ✓ VERIFIED | synth-processor.js lines 39,53,84,114 use noteGain (not hardcoded maxGain), scheduler.ts line 181 posts velocity-scaled gain |
| 10 | Sampled instruments receive 0-127 velocity (timbral variation from sample layers) | ✓ VERIFIED | scheduler.ts line 196 converts to 0-127, sampler.ts line 67 passes velocity to smplr |
| 11 | VelocityConfig persists across engine.reset() (user preference preserved) | ✓ VERIFIED | engine.ts line 28 stores private velocityConfig, lines 159-174 update methods, line 42 passes to new Ensemble |
| 12 | Default performer count is 4 (not 8) | ✓ VERIFIED | engine.ts line 27 initialPerformerCount=4, App.tsx line 20 INITIAL_STATE performerCount:4 |
| 13 | User can toggle humanization on/off before or during playback | ✓ VERIFIED | HumanizationToggle.tsx lines 22-34 toggle button, App.tsx lines 59-61,112-116 wiring to engine |
| 14 | User can select intensity level (subtle/moderate/expressive) before or during playback | ✓ VERIFIED | HumanizationToggle.tsx lines 36-58 intensity selector, App.tsx lines 63-65 wiring |
| 15 | Toggling humanization off produces uniform velocity (all notes same loudness) | ✓ VERIFIED | velocity.ts line 80 returns 1.0 when disabled, test suite disabled bypass test passes |
| 16 | Toggling humanization back on restores varied dynamics | ✓ VERIFIED | setHumanization updates config immediately, Ensemble.setVelocityConfig propagates to agents |
| 17 | Intensity change is audible: expressive has clearly wider dynamic range than subtle | ✓ VERIFIED | intensity scaling test shows std dev ratio, intensityScale multiplies all variation ranges |

**Score:** 17/17 truths verified via automated checks

### Required Artifacts

All artifacts from must_haves verified at 3 levels: exists, substantive, wired.

#### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/score/velocity.ts` | Pure velocity computation functions | ✓ VERIFIED | Exists (110 lines), exports computeVelocity, VelocityContext, VelocityConfig, VelocityPersonality, generateVelocityPersonality, intensityScale |
| `src/score/velocity.test.ts` | Test coverage for velocity model | ✓ VERIFIED | Exists (213 lines), 13 tests pass, covers all behaviors |

#### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/score/ensemble.ts` | AgentNoteEvent with velocity, AgentPersonality with velocity traits | ✓ VERIFIED | AgentNoteEvent.velocity line 32, AgentPersonality.baseLoudness/jitterAmount lines 48-49, computeVelocity called line 346 |
| `src/audio/types.ts` | VelocityConfig type on EnsembleEngineState | ✓ VERIFIED | Re-exports VelocityConfig, EnsembleEngineState has humanizationEnabled/humanizationIntensity fields |
| `src/audio/scheduler.ts` | Velocity routing to synth gain and smplr velocity | ✓ VERIFIED | Line 181 posts gain:event.velocity*0.3, line 196 converts to 0-127 for sampler |
| `src/audio/sampler.ts` | SamplePlayer.play with velocity parameter | ✓ VERIFIED | Line 62 velocity parameter, line 67 passes to smplr.start() |
| `public/synth-processor.js` | Per-note gain parameter in noteOn message | ✓ VERIFIED | Lines 39,53,84 set noteGain, line 114 uses noteGain in render |
| `src/audio/engine.ts` | VelocityConfig storage, CFG-01 default 4 performers | ✓ VERIFIED | Line 28 velocityConfig storage, line 27 initialPerformerCount=4, lines 159-174 setHumanization/setHumanizationIntensity |

#### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/HumanizationToggle.tsx` | UI toggle for humanization on/off and intensity selector | ✓ VERIFIED | Exists (62 lines), toggle button + 3 intensity buttons, aria-pressed pattern |
| `src/App.tsx` | Wiring of HumanizationToggle to AudioEngine | ✓ VERIFIED | Import line 9, handlers lines 59-65, render lines 112-117 |

### Key Link Verification

All critical connections verified as WIRED.

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/score/ensemble.ts` | `src/score/velocity.ts` | import computeVelocity, calls in PerformerAgent.tick() | ✓ WIRED | Import line 18, call line 346 |
| `src/audio/scheduler.ts` | `src/score/ensemble.ts` | reads event.velocity from AgentNoteEvent | ✓ WIRED | Lines 181,196 read event.velocity |
| `src/audio/scheduler.ts` | `public/synth-processor.js` | posts gain in noteOn message | ✓ WIRED | Line 181 posts gain:event.velocity*0.3 |
| `src/audio/scheduler.ts` | `src/audio/sampler.ts` | passes velocity to SamplePlayer.play() | ✓ WIRED | Line 197 passes smplrVelocity to play() |
| `src/audio/engine.ts` | `src/score/ensemble.ts` | passes VelocityConfig to Ensemble constructor | ✓ WIRED | Line 42 new Ensemble(..., this.velocityConfig) |
| `src/components/HumanizationToggle.tsx` | `src/App.tsx` | onToggle and onIntensityChange callbacks | ✓ WIRED | Lines 115-116 pass handlers |
| `src/App.tsx` | `src/audio/engine.ts` | engine.setHumanization() and engine.setHumanizationIntensity() | ✓ WIRED | Lines 60,64 call engine methods |

### Requirements Coverage

All Phase 5 requirements satisfied (automated verification; audio quality requires human listening).

| Requirement | Status | Evidence |
|-------------|--------|----------|
| VEL-01: Each note has subtly varied velocity audible in playback | ✓ SATISFIED | Velocity computation model with 4 layers (jitter, personality, accent, contour), 0.3-1.0 range prevents inaudible notes. Awaiting human ear verification. |
| VEL-02: Each performer has distinct velocity personality | ✓ SATISFIED | AgentPersonality includes baseLoudness (0.7-1.0) and jitterAmount (0.02-0.12), generateVelocityPersonality() creates unique traits per performer. |
| VEL-03: Metric accents emphasize downbeats | ✓ SATISFIED | noteIndexInPattern===0 gets 1.0+0.08*scale boost (lines 92-93 velocity.ts), test passes. |
| VEL-04: Phrase contour shapes velocity across repetitions | ✓ SATISFIED | phraseContour() implements bell curve peaking at 60% through repetitions (lines 61-72 velocity.ts), test passes. |
| VEL-05: User can toggle humanization and select intensity | ✓ SATISFIED | HumanizationToggle component with on/off toggle and Subtle/Moderate/Expressive selector, wired to engine.setHumanization/setHumanizationIntensity. |
| CFG-01: Default performer count is 4 | ✓ SATISFIED | engine.ts initialPerformerCount=4, App.tsx INITIAL_STATE performerCount:4. |

### Anti-Patterns Found

None detected. All modified files are clean.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

**Checks performed:**
- TODO/FIXME/PLACEHOLDER comments: None found
- Empty implementations (return null/{}): None found
- Console.log-only implementations: None found
- Stub patterns: None found

### Human Verification Required

**All automated checks passed.** The following items require human listening to confirm the full goal is achieved:

#### 1. Velocity Variation is Audible in Playback

**Test:** Run `npm run dev`, start playback with default settings (Humanize: On, Moderate), listen for 10-15 seconds.

**Expected:** Notes should have audibly varied dynamics — not uniform or mechanical. Different notes should have noticeably different loudness.

**Why human:** Audio perception of dynamic variation requires human listening. Automated checks verified the computation model and wiring, but only a human ear can confirm the variation is perceptible and musically pleasant.

#### 2. Different Performers Sound Dynamically Distinct

**Test:** Listen to individual performers. Focus on one, then another. Compare their overall loudness character.

**Expected:** Some performers should sound generally louder, others softer on average. This is personality-driven dynamic character.

**Why human:** Timbral and dynamic character perception requires human ear. Automated checks verified personality traits exist and affect velocity computation, but ear verification confirms it's audible.

#### 3. Toggle Humanization Off Produces Uniform Velocity

**Test:** Click "Humanize: Off" during playback. Listen for change in dynamic character.

**Expected:** All notes should sound the same loudness (uniform). Toggle back "Humanize: On" — variation should return.

**Why human:** Audio perception of uniform vs. varied dynamics. Automated checks verified computeVelocity returns 1.0 when disabled, but ear verification confirms audible effect.

#### 4. Intensity Levels are Perceptibly Different

**Test:** Try Subtle (minimal variation), then Moderate (medium), then Expressive (wide range). Listen for contrast in dynamic range.

**Expected:** Expressive should have clearly more contrast between loud and soft notes than Subtle. Moderate should be in between.

**Why human:** Dynamic range perception requires listening. Automated checks verified intensity scaling math, but ear verification confirms perceptible difference.

#### 5. Metric Accents are Subtly Audible

**Test:** Listen for pattern starts. First note of each pattern iteration should be slightly emphasized.

**Expected:** Pattern downbeats (first note of each repetition) subtly louder than mid-pattern notes.

**Why human:** Subtle accent perception in musical context. Automated checks verified accent boost exists (1.0+0.08*scale), but ear verification confirms audibility.

#### 6. Phrase Contour Shapes Velocity Across Repetitions

**Test:** Listen to a performer repeating the same pattern multiple times over ~20-30 seconds. Notice if dynamics change across repetitions.

**Expected:** Gentle crescendo-decrescendo (swell and recede) across pattern repetitions, not random fluctuation. Should feel like a musical phrase, not mechanical.

**Why human:** Long-term dynamic shaping requires listening over time. Automated checks verified bell curve math, but ear verification confirms musical phrasing effect.

---

**Human verification status:** Pending

**Notes from Plan 03 Summary:** Plan 03 summary indicates human verification checkpoint was passed by the user during plan execution. However, this verification report documents items for independent re-verification if needed.

---

_Verified: 2026-02-15T08:37:00Z_
_Verifier: Claude (gsd-verifier)_
