---
phase: 05-velocity-humanization
plan: 03
subsystem: ui
tags: [velocity, humanization, ui, toggle, controls, react]

requires:
  - phase: 05-02
    provides: setHumanization, setHumanizationIntensity on AudioEngine, engineState with humanization fields
provides:
  - HumanizationToggle UI component with on/off toggle and intensity selector
  - Full velocity humanization pipeline verified end-to-end by ear
  - Performer count bugfix (setPerformerCount rebuilds ensemble when stopped)
affects: [06-midi-export]

tech-stack:
  added: []
  patterns:
    - "Toggle+selector component pattern matching existing Transport/BpmSlider conventions"

key-files:
  created:
    - src/components/HumanizationToggle.tsx
  modified:
    - src/App.tsx
    - src/audio/engine.ts
    - src/App.css

key-decisions:
  - "HumanizationToggle uses aria-pressed pattern consistent with ScoreModeSelector"
  - "Performer count change rebuilds ensemble/scheduler when stopped (not just before first init)"

patterns-established:
  - "Toggle+intensity selector: reusable pattern for on/off with multi-level controls"

duration: ~15min (across checkpoint)
completed: 2026-02-15
---

# Phase 5 Plan 3: Humanization UI Toggle & End-to-End Verification Summary

**HumanizationToggle component with on/off and intensity selector, verified audible velocity variation end-to-end**

## Performance

- **Duration:** ~15 min (spanning human verification checkpoint)
- **Started:** 2026-02-15
- **Completed:** 2026-02-15
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- HumanizationToggle component renders with on/off toggle and Subtle/Moderate/Expressive intensity buttons
- Full velocity humanization pipeline verified by ear -- audible dynamics, toggle works, intensity levels perceptibly different
- Fixed performer count bug: setPerformerCount now rebuilds ensemble when called while stopped after initialization

## Task Commits

Each task was committed atomically:

1. **Task 1: Create HumanizationToggle component and wire into App** - `25aa626` (feat)
2. **Task 2: Verify velocity humanization end-to-end** - human-verify checkpoint (approved, no code commit)

**Bugfix during verification:** `96d9dc5` (fix) - performer count rebuild when stopped

## Files Created/Modified
- `src/components/HumanizationToggle.tsx` - Toggle on/off and intensity selector component
- `src/App.tsx` - Wiring of HumanizationToggle with engine callbacks
- `src/audio/engine.ts` - setPerformerCount bugfix: rebuild ensemble/scheduler when stopped
- `src/App.css` - Mode badge margin fix

## Decisions Made
- HumanizationToggle follows existing aria-pressed pattern from ScoreModeSelector for active state styling
- setPerformerCount changed from no-op-after-init to rebuilding ensemble when stopped, enabling performer count changes between plays

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Performer count change had no effect after first playback**
- **Found during:** Task 2 (human verification)
- **Issue:** setPerformerCount was a no-op after initialization, so changing performer count in UI after first play had no effect
- **Fix:** Rebuilt ensemble/scheduler/voicePool when setPerformerCount called while stopped and initialized
- **Files modified:** src/audio/engine.ts
- **Verification:** User confirmed performer count changes take effect after stop
- **Committed in:** 96d9dc5

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential bugfix for correct performer count behavior. No scope creep.

## Issues Encountered
- Docker restart was needed during verification (unrelated environment issue, not a code problem)
- "In C" style repetition behavior (performers repeat patterns before advancing) confirmed as correct/expected

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Velocity humanization complete: computation model, pipeline integration, UI controls, all verified
- Phase 05 fully complete -- ready for Phase 06 (MIDI Export)
- AgentNoteEvent now carries velocity values needed by MIDI recorder

## Self-Check: PASSED

- FOUND: src/components/HumanizationToggle.tsx
- FOUND: .planning/phases/05-velocity-humanization/05-03-SUMMARY.md
- FOUND: commit 25aa626 (Task 1)
- FOUND: commit 96d9dc5 (bugfix)

---
*Phase: 05-velocity-humanization*
*Completed: 2026-02-15*
