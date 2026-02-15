---
phase: 03-visualization-instruments-polish
plan: 03
subsystem: audio
tags: [dynamic-ensemble, voice-pool-resize, performer-management, react]

# Dependency graph
requires:
  - phase: 02-ensemble-ai
    provides: "Ensemble class with PerformerAgent tick loop and snapshot system"
  - phase: 03-visualization-instruments-polish
    plan: 01
    provides: "Canvas visualization, PALETTE theme"
  - phase: 03-visualization-instruments-polish
    plan: 02
    provides: "SamplePlayer, PulseGenerator, instrument assignment"
provides:
  - "Ensemble.addAgent()/removeAgent() with safe mutation queueing"
  - "VoicePool.resize() for dynamic pool growth"
  - "AudioEngine.addPerformer()/removePerformer() public API"
  - "PerformerControls UI component with +/- buttons (min 2, max 16)"
affects: [04-alternate-composition-modes]

# Tech tracking
tech-stack:
  added: []
  patterns: [mutation-queueing, monotonic-ids, dynamic-pool-resize]

key-files:
  created:
    - src/components/PerformerControls.tsx
  modified:
    - src/score/ensemble.ts
    - src/audio/voice-pool.ts
    - src/audio/engine.ts
    - src/audio/scheduler.ts
    - src/audio/types.ts
    - src/App.tsx
    - src/App.css

key-decisions:
  - "Pending removals processed at start of tick() before snapshot creation -- zero mid-iteration mutation risk"
  - "VoicePool only grows, never shrinks -- excess voices stay available to avoid audio glitches"
  - "New performers start at ensemble minimum pattern index for musical blending"
  - "Scheduler.fireStateChange() made public so Engine can trigger UI updates after add/remove"

patterns-established:
  - "Mutation queueing: pendingRemovals set processed between ticks, not during iteration"
  - "Monotonic ID generation: nextId field increments, IDs never reused across add/remove cycles"

# Metrics
duration: 5min
completed: 2026-02-15
---

# Phase 03 Plan 03: Dynamic Performer Management Summary

**Real-time add/remove performers during playback with mutation-safe queueing, dynamic VoicePool resize, and +/- UI controls**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-15T04:22:20Z
- **Completed:** 2026-02-15T04:27:37Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Ensemble supports dynamic addAgent()/removeAgent() with monotonically increasing IDs and safe mutation queueing via pendingRemovals set
- VoicePool.resize() grows the pool by creating new AudioWorkletNodes on demand, adjusting master gain for new voice count
- AudioEngine exposes addPerformer()/removePerformer() public API that coordinates Ensemble and VoicePool
- PerformerControls component with +/- buttons, performer count display, min 2 / max 16 bounds enforcement

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dynamic agent management to Ensemble and VoicePool resize** - `0409c3d` (feat)
2. **Task 2: Wire dynamic management through Engine to UI** - `08e2dea` (feat)

## Files Created/Modified
- `src/score/ensemble.ts` - Added nextId, pendingRemovals, addAgent(), removeAgent(), agentCount getter; updated tick() and reset()
- `src/audio/voice-pool.ts` - Added audioContext private field, resize() method for dynamic pool growth
- `src/audio/engine.ts` - Added addPerformer(), removePerformer(), performerCount getter; renamed field to initialPerformerCount
- `src/audio/scheduler.ts` - Made fireStateChange() public; added performerCount to getState()
- `src/audio/types.ts` - Added performerCount to EnsembleEngineState interface
- `src/components/PerformerControls.tsx` - New component with +/- buttons, min/max enforcement, palette-matching styles
- `src/App.tsx` - Imported PerformerControls, added add/remove callbacks, wired into controls-row
- `src/App.css` - Added performer-controls, performer-btn, performer-count styles

## Decisions Made
- Pending removals are processed at the start of tick() before creating the snapshot, ensuring zero mid-iteration array mutation risk
- VoicePool only grows (never shrinks) -- excess voices remain available to avoid audio glitches during removal
- New performers start at the ensemble's current minimum pattern index so they blend into the musical context
- Scheduler.fireStateChange() made public so Engine can trigger UI updates after dynamic add/remove operations
- Renamed private field `performerCount` to `initialPerformerCount` to avoid conflict with public getter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate identifier: performerCount field vs getter**
- **Found during:** Task 2
- **Issue:** Engine had a private `performerCount = 8` field that conflicted with the new public `get performerCount()` getter
- **Fix:** Renamed private field to `initialPerformerCount`
- **Files modified:** src/audio/engine.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 08e2dea (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial naming conflict resolution. No scope change.

## Issues Encountered
- Pre-existing `tsc -b` build errors in PatternDisplay.tsx and ensemble.test.ts (unused vars, missing vitest) -- these exist before and after this plan's changes. Vite build succeeds. This plan introduces zero new errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dynamic performer management complete -- ensemble size no longer fixed at 8
- Canvas visualization automatically reflects performer count changes (reads from state)
- Phase 3 complete -- all 3 plans executed. Ready for Phase 4 (alternate composition modes)

## Self-Check: PASSED

- [x] src/score/ensemble.ts exists (addAgent, removeAgent, agentCount, pendingRemovals)
- [x] src/audio/voice-pool.ts exists (resize method, audioContext field)
- [x] src/audio/engine.ts exists (addPerformer, removePerformer, performerCount)
- [x] src/audio/scheduler.ts exists (fireStateChange public, performerCount in state)
- [x] src/audio/types.ts exists (performerCount in EnsembleEngineState)
- [x] src/components/PerformerControls.tsx exists (new file)
- [x] src/App.tsx exists (PerformerControls wired in)
- [x] src/App.css exists (performer-controls styles)
- [x] Commit 0409c3d (Task 1) found
- [x] Commit 08e2dea (Task 2) found

---
*Phase: 03-visualization-instruments-polish*
*Completed: 2026-02-15*
