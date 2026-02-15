# Roadmap: InTempo

## Overview

InTempo delivers a browser-based generative performance engine in four phases: first a rock-solid audio foundation with Riley's score and basic synthesis, then the ensemble AI that makes performers feel alive, then the visual identity and instrument variety that makes it compelling to watch, and finally alternative composition modes that extend replayability. Each phase delivers a coherent, verifiable capability that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Audio Engine + Score Foundation** - Precisely timed audio scheduler, Riley's 53 patterns, basic synth, transport controls
- [x] **Phase 2: Ensemble AI** - Multiple performers with believable musical behavior navigating the shared score
- [x] **Phase 3: Visualization + Instruments + Polish** - Canvas performer display, sampled instruments, visual identity, dynamic performer management
- [x] **Phase 4: Composition Modes** - Generative and Euclidean alternative score modes

## Phase Details

### Phase 1: Audio Engine + Score Foundation
**Goal**: A single performer can play through Riley's score with precise timing, controlled by the user via transport and BPM controls
**Depends on**: Nothing (first phase)
**Requirements**: AUD-01, AUD-02, AUD-03, AUD-04, AUD-05, AUD-06, AUD-07, SCR-01, SCR-02, INS-01, VIZ-06, VIZ-08
**Success Criteria** (what must be TRUE):
  1. User clicks Start and hears notes playing with rock-solid timing (no drift, no stuttering) via synth voice
  2. User can Stop, then Reset the performance back to the beginning
  3. User can change BPM and hear the tempo shift immediately (or on next note)
  4. A 10-minute test run shows no audio glitches and no memory growth in DevTools (voice pool working)
  5. Riley's 53 patterns play back as recognizable melodic content (not random noise)
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md -- Project scaffold, AudioWorklet processor, and 53 Riley patterns as score data
- [ ] 01-02-PLAN.md -- Voice pool, lookahead scheduler, AudioEngine facade, and performer logic
- [ ] 01-03-PLAN.md -- React UI (transport, BPM slider, pattern display) wired to audio engine

### Phase 2: Ensemble AI
**Goal**: Multiple simulated performers independently navigate the shared score with emergent, believable musical behavior
**Depends on**: Phase 1
**Requirements**: ENS-01, ENS-02, ENS-03, ENS-04, ENS-05, ENS-06, ENS-07, ENS-10
**Success Criteria** (what must be TRUE):
  1. User starts a performance and hears multiple distinct voices playing different patterns simultaneously
  2. Performers visibly stay within a 2-3 pattern band of each other -- none races ahead or falls far behind
  3. Performers periodically align on the same pattern (unison moments) then spread apart again
  4. Performers go silent for stretches then rejoin, creating natural breathing in the texture
  5. When the last pattern is reached, performers drop out one by one until silence -- the performance ends itself
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md -- Ensemble AI core: PerformerAgent, weighted decisions, band enforcement, dropout/rejoin, unison seeking, endgame (TDD)
- [ ] 02-02-PLAN.md -- Scheduler beat clock refactor, voice pool scaling, AudioEngine ensemble management, multi-performer UI

### Phase 3: Visualization + Instruments + Polish
**Goal**: Each performer is visually represented on a styled canvas, instruments include sampled sounds, and the user can dynamically manage the ensemble
**Depends on**: Phase 2
**Requirements**: VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05, VIZ-07, VIZ-09, INS-02, INS-03, INS-04, ENS-08, ENS-09
**Success Criteria** (what must be TRUE):
  1. Each performer appears as a distinct visual element on a Canvas showing their current pattern number and playing/silent state
  2. The UI uses GT Canon font and the warm salmon / cream / dark navy color palette throughout
  3. User can add and remove performers during a running performance and hear/see the change immediately
  4. Some performers play sampled instrument sounds (piano, marimba) while others play synth -- the mix is audibly varied
  5. A steady eighth-note pulse on high C is toggleable by the user
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md -- Canvas performer visualization, visual identity (GT Canon font, salmon/cream/navy palette), score mode selector
- [ ] 03-02-PLAN.md -- Sampled instruments (piano, marimba via smplr), toggleable eighth-note pulse on high C
- [ ] 03-03-PLAN.md -- Dynamic performer management (add/remove during playback), VoicePool resize, ensemble mutation queueing

### Phase 4: Composition Modes
**Goal**: Users can choose between Riley's original score, algorithmically generated patterns, or Euclidean rhythm patterns before starting a performance
**Depends on**: Phase 1 (score system), Phase 2 (ensemble plays it)
**Requirements**: SCR-03, SCR-04, SCR-05
**Success Criteria** (what must be TRUE):
  1. User selects "Generative" mode before starting and hears new melodic patterns that feel stylistically consistent with In C (short cells in C, varied rhythm and contour)
  2. User selects "Euclidean" mode before starting and hears rhythmically distinct patterns generated by Bjorklund's algorithm
  3. Score mode selector is visible and functional before performance start, with Riley as the default
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md -- Dynamic ensemble (variable pattern count, proportional band width, rep tracking), generative pattern factory, ScoreMode type
- [ ] 04-02-PLAN.md -- Bjorklund algorithm, Euclidean pattern factory, AudioEngine mode switching
- [ ] 04-03-PLAN.md -- ScoreModeSelector UI component, enhanced performer cards with rep/total, mode badge, App wiring

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audio Engine + Score Foundation | 3/3 | Complete | 2026-02-14 |
| 2. Ensemble AI | 2/2 | Complete | 2026-02-15 |
| 3. Visualization + Instruments + Polish | 3/3 | Complete | 2026-02-15 |
| 4. Composition Modes | 3/3 | Complete | 2026-02-15 |
