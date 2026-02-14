# Phase 1: Audio Engine + Score Foundation - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

A single performer plays through Riley's 53 In C patterns with precise timing via a basic synth voice. User controls playback with Start/Stop/Reset and adjusts BPM. This phase delivers the audio engine and transport — ensemble behavior (Phase 2), visuals (Phase 3), and alternative scores (Phase 4) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Transport & tempo behavior
- **Stop:** Let the currently playing note finish ringing out, then silence
- **Reset:** Stop playback and move performer back to pattern 1 (user must click Start again)
- **BPM change:** Takes effect on the next note (no smooth ramping)
- **BPM range:** 100-180 BPM (tight range honoring In C's intended tempo)

### Performance flow
- **Pattern advancement:** Random number of repetitions per pattern (e.g. 2-8), then advance to the next
- **Rests:** Occasional brief silences between some patterns for breathing room
- **End behavior:** Auto-stop when pattern 53 is complete — audio stops, transport resets to stopped state
- **Pattern display:** Show current pattern number only (e.g. "Pattern 17 of 53") — no progress bar

### Minimal UI layout
- **Level of polish:** Simple but presentable — clean layout with basic styling, not the final design but not ugly
- **Framework:** React + TypeScript with Vite
- **Transport controls:** Start / Stop / Reset in a centered horizontal row, BPM slider below
- **BPM control:** Horizontal slider with current value displayed, range 100-180
- **Page chrome:** No header/title — just transport controls and pattern info, centered on page
- **Theme:** Light background (Phase 3 will apply the final salmon/cream/navy palette)

### Claude's Discretion
- Synth voice character and timbre (warm, bright, etc.)
- Whether to add a subtle visual beat indicator while playing (low-effort only)
- Exact spacing, typography, and button styling
- Loading and error states
- Exact repetition range per pattern (within the "random 2-8" spirit)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-audio-engine-score-foundation*
*Context gathered: 2026-02-14*
