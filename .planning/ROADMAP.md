# Roadmap: InTempo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-15)
- 🚧 **v1.1 MIDI** — Phases 5-6 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-4) — SHIPPED 2026-02-15</summary>

- [x] Phase 1: Audio Engine + Score Foundation (3/3 plans) — completed 2026-02-14
- [x] Phase 2: Ensemble AI (2/2 plans) — completed 2026-02-15
- [x] Phase 3: Visualization + Instruments + Polish (3/3 plans) — completed 2026-02-15
- [x] Phase 4: Composition Modes (3/3 plans) — completed 2026-02-15

</details>

### v1.1 MIDI (In Progress)

**Milestone Goal:** Add velocity humanization to make performances feel more alive in audio and MIDI, then export performances as downloadable multi-track MIDI files. Default to 4 performers for a cleaner listening experience.

- [x] **Phase 5: Velocity Humanization** — Per-note velocity variation with personality, metric accents, and phrase contour audible in playback — completed 2026-02-15
- [ ] **Phase 6: MIDI Export** — Record and export performances as downloadable multi-track .mid files

## Phase Details

### Phase 5: Velocity Humanization
**Goal**: Every note has musically meaningful velocity variation that performers express through audio playback
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: VEL-01, VEL-02, VEL-03, VEL-04, VEL-05, CFG-01
**Success Criteria** (what must be TRUE):
  1. Individual notes within a single performer's pattern repetition have audibly varied velocities (not uniform)
  2. Two different performers playing the same pattern sound dynamically distinct (one naturally louder/softer than the other)
  3. Downbeats are subtly accented compared to offbeats within a pattern
  4. A performer repeating the same pattern multiple times shapes velocity across repetitions (crescendo/decrescendo contour, not random)
  5. User can toggle humanization on/off and select intensity (subtle/moderate/expressive) before or during playback
  6. A new performance starts with 4 performers by default (not 8)
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — Velocity computation model (TDD: pure functions for jitter, personality, accent, contour)
- [x] 05-02-PLAN.md — Wire velocity through audio pipeline (ensemble, scheduler, synth, sampler) + CFG-01
- [x] 05-03-PLAN.md — Humanization UI toggle + end-to-end listening verification

### Phase 6: MIDI Export
**Goal**: Users can download a multi-track MIDI file that faithfully captures the performance they heard
**Depends on**: Phase 5 (velocity values exist in AgentNoteEvent for recording)
**Requirements**: MIDI-01, MIDI-02, MIDI-03, MIDI-04, MIDI-05
**Success Criteria** (what must be TRUE):
  1. User can click a download button and receive a .mid file of the current performance (during or after playback)
  2. Opening the .mid file in a DAW shows one track per performer with correct note pitches and durations
  3. The MIDI file plays back at the same BPM as the original performance
  4. Each track in the DAW shows the correct instrument assignment (piano, marimba, or synth equivalent)
  5. Note velocities in the MIDI file match the humanized velocities heard during playback (not uniform)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Audio Engine + Score Foundation | v1.0 | 3/3 | Complete | 2026-02-14 |
| 2. Ensemble AI | v1.0 | 2/2 | Complete | 2026-02-15 |
| 3. Visualization + Instruments + Polish | v1.0 | 3/3 | Complete | 2026-02-15 |
| 4. Composition Modes | v1.0 | 3/3 | Complete | 2026-02-15 |
| 5. Velocity Humanization | v1.1 | 3/3 | Complete | 2026-02-15 |
| 6. MIDI Export | v1.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-15*
*Last updated: 2026-02-15*
*Phase 5 completed: 2026-02-15*
