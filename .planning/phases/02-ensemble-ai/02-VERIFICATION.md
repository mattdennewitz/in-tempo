---
phase: 02-ensemble-ai
verified: 2026-02-15T00:07:33Z
status: human_needed
score: 5/5
re_verification: false
human_verification:
  - test: "Multi-voice playback verification"
    expected: "Multiple distinct voices playing different patterns simultaneously"
    why_human: "Audible playback requires human listening"
  - test: "Performer band cohesion"
    expected: "No performer more than 2-3 patterns ahead/behind others"
    why_human: "Real-time pattern position tracking requires observation during playback"
  - test: "Dropout/rejoin behavior"
    expected: "Performers go silent for stretches then rejoin, visible in UI"
    why_human: "Temporal behavior requires observation over time"
  - test: "Natural performance ending"
    expected: "Performers drop out one by one at pattern 53 until silence"
    why_human: "Endgame behavior requires playing to completion"
  - test: "Per-performer UI status"
    expected: "8 performers visible with pattern numbers updating independently, opacity changes for silent/complete states"
    why_human: "Visual UI behavior requires human observation"
---

# Phase 2: Ensemble AI Verification Report

**Phase Goal:** Multiple simulated performers independently navigate the shared score with emergent, believable musical behavior

**Verified:** 2026-02-15T00:07:33Z

**Status:** human_needed (all automated checks passed)

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User starts a performance and hears multiple distinct voices playing different patterns simultaneously | ✓ VERIFIED | Scheduler polls Ensemble.tick() which returns AgentNoteEvent[] from all performers. Each event scheduled via VoicePool with midiToFrequency(). VoicePool sized at 16 voices (8 performers * 2). |
| 2 | Performers visibly stay within a 2-3 pattern band of each other | ✓ VERIFIED | Band enforcement in ensemble.ts (BAND_WIDTH=3): enforceBand() forces repeat if agent is ≥3 ahead, forces jump if ≥3 behind. Weight computation penalizes advance when near top of band. |
| 3 | Performers go silent for stretches then rejoin, creating natural breathing | ✓ VERIFIED | PerformerAgent.decisionLogic() includes 'dropout' decision with weighted choice. rejoinLogic() handles rejoin probability based on silence duration and density. Status tracked in AgentState ('playing', 'silent', 'complete'). |
| 4 | Performance ends with performers dropping out one by one until silence | ✓ VERIFIED | PerformerAgent.handleEndgame() triggers when patternIndex >= FINAL_PATTERN_INDEX (52). Scaled dropout chance increases as fractionAtEnd > 0.6. Scheduler stops when ensemble.isComplete (all agents complete). |
| 5 | UI shows per-performer status (pattern number and playing/silent state) | ✓ VERIFIED | PatternDisplay receives performers[] array, renders grid with performer-status cards. CSS classes performer-status--playing/silent/complete control opacity (1.0/0.4/0.2). App.tsx wires engine.onStateChange to state.performers. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/audio/scheduler.ts | Beat-clock scheduler polling Ensemble per eighth-note tick | ✓ VERIFIED | 167 lines. Fixed eighth-note tick loop (advanceTime advances by secondsPerEighth). Calls ensemble.tick() each beat, schedules returned events via voicePool. Returns EnsembleEngineState with performers[] and ensembleComplete. |
| src/audio/voice-pool.ts | Scaled voice pool supporting N performers | ✓ VERIFIED | 85 lines. Constructor takes size parameter. Engine creates with performerCount*2 (16 voices). Added size getter. Voice stealing handles contention. |
| src/audio/engine.ts | AudioEngine managing Ensemble lifecycle and exposing EnsembleEngineState | ✓ VERIFIED | 113 lines. Creates Ensemble(performerCount=8, PATTERNS), VoicePool(16), Scheduler(context, pool, ensemble). getState() returns EnsembleEngineState. dispose() cleans up ensemble. |
| src/App.tsx | React app wired to ensemble state | ✓ VERIFIED | 70 lines. useState for performers[], ensembleComplete. engine.onStateChange reads state.performers and state.ensembleComplete. Passes to PatternDisplay. |
| src/components/PatternDisplay.tsx | Per-performer pattern display | ✓ VERIFIED | 42 lines. Maps performers[] to performer-status cards. Displays performer ID (P{id+1}), pattern number or status ('Done', '...'). Handles ensembleComplete and empty states. |

**All artifacts verified:** Level 1 (exists), Level 2 (substantive), Level 3 (wired).

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| src/audio/scheduler.ts | src/score/ensemble.ts | imports Ensemble, calls tick() per beat | ✓ WIRED | Line 15: `import type { Ensemble }`, Line 116: `this.ensemble.tick()`, Lines 86-87: reads performerStates and isComplete |
| src/audio/engine.ts | src/audio/scheduler.ts | creates Scheduler with Ensemble | ✓ WIRED | Line 36: `new Scheduler(this.audioContext, this.voicePool, this.ensemble)` |
| src/audio/engine.ts | src/score/ensemble.ts | creates Ensemble, reads performerStates | ✓ WIRED | Line 34: `new Ensemble(this.performerCount, PATTERNS)`, getState() delegates to scheduler which reads ensemble.performerStates |
| src/App.tsx | src/audio/engine.ts | reads EnsembleEngineState for UI rendering | ✓ WIRED | Line 20: `engine.onStateChange = (state) => {...}`, Lines 21-24: reads state.playing, state.performers, state.ensembleComplete, state.bpm and updates React state |

**All key links verified:** All imports present, all method calls active, all data flows connected.

### Requirements Coverage

No phase-specific requirements documented in REQUIREMENTS.md for Phase 2.

### Anti-Patterns Found

None. All files have:
- No TODO/FIXME/PLACEHOLDER comments
- No empty return statements (return null/{}/ [])
- No console.log-only implementations
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)
- All commit hashes from SUMMARY verified (b13ce04, db2bf6f)

### Human Verification Required

All automated checks passed. The following items require human verification because they involve audible playback, real-time visual behavior, and temporal dynamics:

#### 1. Multi-voice playback verification

**Test:** Start a performance and listen for multiple distinct voices

**Expected:** Multiple melodic lines playing simultaneously, each following different patterns at different rates

**Why human:** Requires listening to audible playback. Automated checks verified the wiring (Ensemble.tick() returns multiple events, Scheduler schedules all events via VoicePool), but can't verify actual sound output.

#### 2. Performer band cohesion

**Test:** Start a performance and observe the pattern numbers in the performer grid

**Expected:** All performers stay within 2-3 pattern numbers of each other. No performer races far ahead or lags far behind.

**Why human:** Requires real-time observation during playback. Automated checks verified the band enforcement logic (BAND_WIDTH=3, enforceBand() forces repeat/jump), but can't verify emergent behavior over time.

#### 3. Dropout/rejoin breathing behavior

**Test:** Watch the performer grid during a performance

**Expected:** Performers periodically show '...' (silent state) with reduced opacity (0.4), then return to playing state. Texture density varies naturally.

**Why human:** Requires temporal observation. Automated checks verified the dropout/rejoin logic (decisionLogic includes 'dropout' weight, rejoinLogic handles probability), but can't verify the visual feel of breathing texture.

#### 4. Natural performance ending

**Test:** Let a performance run to completion (may take several minutes at 120 BPM)

**Expected:** As performers reach pattern 53, they drop out one by one. Eventually all show 'Done' with opacity 0.2, and playback stops.

**Why human:** Requires observing endgame behavior over time. Automated checks verified the endgame logic (handleEndgame with scaled dropout, ensemble.isComplete triggers stop), but can't verify the staggered dropout feel.

#### 5. Per-performer UI status accuracy

**Test:** Watch the performer grid while playing

**Expected:** 8 performers visible (P1-P8), pattern numbers update independently, opacity transitions smoothly for playing (1.0) / silent (0.4) / complete (0.2) states

**Why human:** Requires visual observation of UI. Automated checks verified the rendering logic (PatternDisplay maps performers[], CSS classes control opacity), but can't verify the actual visual appearance.

---

## Verification Summary

**All automated checks passed.** The codebase fully implements the must-haves:

- **Scheduler** is a fixed eighth-note beat clock polling Ensemble.tick() each beat
- **VoicePool** scales to 16 voices (2 per performer) with voice stealing
- **AudioEngine** creates 8-performer Ensemble and manages lifecycle
- **Ensemble AI** implements band enforcement (BAND_WIDTH=3), dropout/rejoin, endgame staggered dropouts
- **UI** displays per-performer status grid with pattern numbers and playing/silent/complete states
- **Wiring** is complete: Scheduler → Ensemble → AudioEngine → React state → PatternDisplay

**Human verification required** for audible playback quality, real-time visual behavior, and temporal dynamics (band cohesion, dropout/rejoin breathing, endgame dropouts).

---

_Verified: 2026-02-15T00:07:33Z_
_Verifier: Claude (gsd-verifier)_
