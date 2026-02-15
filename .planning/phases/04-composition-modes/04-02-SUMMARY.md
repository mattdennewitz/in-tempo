---
phase: 04-composition-modes
plan: 02
subsystem: score
tags: [euclidean, bjorklund, pentatonic, mode-switching, audio-engine]

requires:
  - phase: 04-composition-modes
    provides: Dynamic ensemble, ScoreMode type, getPatternsForMode factory, generative patterns
provides:
  - Bjorklund's algorithm (bjorklund + rotatePattern utilities)
  - Euclidean pattern factory generating 20-40 pentatonic rhythm patterns
  - AudioEngine.setScoreMode() for runtime mode switching
  - All three score modes fully wired and producing valid Pattern[]
affects: [04-03, ui-composition-selector]

tech-stack:
  added: []
  patterns: [bjorklund-euclidean-rhythm, complementary-interlocking-pairs, callback-preservation-across-rebuild]

key-files:
  created:
    - src/score/bjorklund.ts
    - src/score/euclidean.ts
  modified:
    - src/score/score-modes.ts
    - src/audio/engine.ts

key-decisions:
  - "C-major pentatonic (C D E G A) for Euclidean mode -- distinguishes from generative's full diatonic palette"
  - "setScoreMode() preserves onStateChange callback across scheduler rebuild"
  - "No auto-restart after mode switch -- user must explicitly click Start"
  - "Interlocking pairs created by inverting binary rhythm (complement) at ~30% probability"

patterns-established:
  - "Callback preservation: store callback before teardown, reattach after rebuild"
  - "Pattern factory contract: each mode returns fresh Pattern[] with sequential IDs"

duration: 2min
completed: 2026-02-15
---

# Phase 4 Plan 2: Euclidean Patterns + Engine Mode Switching Summary

**Bjorklund-based Euclidean rhythm generator with C-major pentatonic pitches and AudioEngine mode switching API for all three score modes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T06:07:03Z
- **Completed:** 2026-02-15T06:09:11Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Bjorklund's algorithm correctly distributes k pulses across n steps with rotation support
- Euclidean factory generates 20-40 patterns with progressive density arc, pentatonic pitches, and interlocking complementary pairs
- AudioEngine.setScoreMode() stops playback, generates new patterns, rebuilds Ensemble/Scheduler, fires state change
- All three score modes (riley, generative, euclidean) fully wired and producing valid Pattern[] arrays

## Task Commits

Each task was committed atomically:

1. **Task 1: Bjorklund Algorithm + Euclidean Pattern Factory** - `ae6be1a` (feat)
2. **Task 2: AudioEngine Mode Switching + Score Modes Wiring** - `547ee92` (feat)

## Files Created/Modified
- `src/score/bjorklund.ts` - New: bjorklund(k, n) algorithm and rotatePattern utility
- `src/score/euclidean.ts` - New: generateEuclideanPatterns() with progressive arc, pentatonic pitches, interlocking pairs
- `src/score/score-modes.ts` - Wired euclidean case to generateEuclideanPatterns (replaced placeholder)
- `src/audio/engine.ts` - Added setScoreMode(), scoreMode getter, patternCount getter, currentMode/currentPatterns fields

## Decisions Made
- C-major pentatonic scale (C D E G A, MIDI degrees 0/2/4/7/9) for Euclidean mode per RESEARCH.md recommendation -- warmer consonance, clearly distinct from generative's full diatonic
- setScoreMode() preserves the onStateChange callback by reading it from the old scheduler before teardown and reattaching to the new one
- No auto-restart after mode switch per CONTEXT.md spec -- user must click Start
- Interlocking complementary pairs created by inverting the binary Euclidean rhythm at ~30% probability, keeping total within 20-40 range

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three score modes generate valid Pattern[] and are wired through AudioEngine
- Mode switching API ready for UI consumption in Plan 03
- scoreMode and patternCount exposed on engine state for display

---
*Phase: 04-composition-modes*
*Completed: 2026-02-15*
