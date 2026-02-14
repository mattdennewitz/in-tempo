# Requirements: InTempo

**Defined:** 2026-02-14
**Core Value:** The ensemble behavior must feel alive — performers making believable musical decisions over a precisely timed audio engine, so each performance is unique and compelling to watch and listen to.

## v1 Requirements

### Audio Engine

- [ ] **AUD-01**: Audio scheduling uses Web Audio API lookahead pattern (AudioContext.currentTime + lookahead window), never setTimeout/setInterval for musical timing
- [ ] **AUD-02**: User can start a performance with a single click (handles autoplay policy with user gesture)
- [ ] **AUD-03**: User can stop a running performance
- [ ] **AUD-04**: User can reset a stopped performance to initial state
- [ ] **AUD-05**: User can set global BPM before or during performance
- [ ] **AUD-06**: Voice pool manages audio node lifecycle — nodes are disconnected and released after use to prevent memory leaks over 45-90 minute performances
- [ ] **AUD-07**: Synthesis runs in an AudioWorklet on the audio thread, decoupled from main-thread rendering

### Score & Composition

- [ ] **SCR-01**: Riley's 53 original melodic patterns are encoded as score data (pitch sequences with rhythm)
- [ ] **SCR-02**: Score is precalculated before performance begins
- [ ] **SCR-03**: Generative mode produces algorithmically created patterns in the style of In C (short melodic cells in C, varying rhythm and contour)
- [ ] **SCR-04**: Euclidean mode replaces all patterns with randomly generated euclidean rhythms (Bjorklund's algorithm) sized to performance parameters
- [ ] **SCR-05**: User can select score mode (Riley / Generative / Euclidean) before starting performance

### Ensemble & Performer AI

- [ ] **ENS-01**: Multiple simulated performers navigate the shared score simultaneously
- [ ] **ENS-02**: Each performer traverses patterns sequentially (1→53) and cannot skip backward
- [ ] **ENS-03**: Each performer independently decides how many times to repeat a pattern before advancing
- [ ] **ENS-04**: Performers stay within a 2-3 pattern band of the ensemble — performers too far ahead wait, too far behind jump forward
- [ ] **ENS-05**: Performers make density-aware decisions — adjust repetition and advancement based on how many others are on nearby patterns
- [ ] **ENS-06**: Performers periodically seek unison — aligning on the same pattern as others before spreading out
- [ ] **ENS-07**: Performers drop out (go silent) to listen, then rejoin where it helps the texture
- [ ] **ENS-08**: User can add performers during a running performance
- [ ] **ENS-09**: User can remove performers during a running performance
- [ ] **ENS-10**: Performance ends with natural fade — performers reaching pattern 53 drop out one by one until silence

### Instruments & Mixing

- [ ] **INS-01**: Synth voices are available as performer instruments (Web Audio oscillator-based)
- [ ] **INS-02**: Sampled instrument voices are available (real instrument recordings — piano, marimba, etc.)
- [ ] **INS-03**: Each performer is assigned an instrument (synth or sampled)
- [ ] **INS-04**: Steady eighth-note pulse on high C is available and toggleable by the user

### Visualization & UI

- [ ] **VIZ-01**: Each performer is represented by a visual box/card showing current state (playing or silent)
- [ ] **VIZ-02**: Each performer's box shows which pattern number they are currently on
- [ ] **VIZ-03**: Visualization renders on Canvas 2D, decoupled from React's render cycle
- [ ] **VIZ-04**: UI uses GT Canon font throughout
- [ ] **VIZ-05**: Color palette follows Semafor / Financial Times aesthetic (warm salmon, cream, dark navy, muted tones)
- [ ] **VIZ-06**: Transport controls (start/stop/reset) are clearly accessible
- [ ] **VIZ-07**: Score mode selector is available before performance start
- [ ] **VIZ-08**: BPM control is accessible and adjustable
- [ ] **VIZ-09**: Performer count is adjustable (add/remove controls)

## v2 Requirements

### Visualization

- **VIZ-V2-01**: Abstract geometry animation per performer visualizing their active pattern's shape/rhythm
- **VIZ-V2-02**: Stereo spread — performers panned across the stereo field

### Export

- **EXP-01**: Record and export performance as audio file
- **EXP-02**: Shareable URL encoding performance configuration

### Interaction

- **INT-01**: Keyboard shortcuts for transport controls

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time multiplayer (human performers over network) | Too complex for v1, fundamentally different architecture |
| MIDI output | Browser audio only; adds hardware dependency |
| Mobile-optimized layout | Desktop-first; touch interaction model differs significantly |
| User conducting/intervention during performance | Spectator-only by design — preserves emergent self-organization |
| Backend/server | Fully client-side application |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated during roadmap creation) | | |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 0
- Unmapped: 28 ⚠️

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*
