# Roadmap: InTempo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-15)
- ✅ **v1.1 MIDI** — Phases 5-6 (shipped 2026-02-15)
- 🚧 **v1.2 Polish** — Phases 7-10 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-4) — SHIPPED 2026-02-15</summary>

- [x] Phase 1: Audio Engine + Score Foundation (3/3 plans) — completed 2026-02-14
- [x] Phase 2: Ensemble AI (2/2 plans) — completed 2026-02-15
- [x] Phase 3: Visualization + Instruments + Polish (3/3 plans) — completed 2026-02-15
- [x] Phase 4: Composition Modes (3/3 plans) — completed 2026-02-15

</details>

<details>
<summary>v1.1 MIDI (Phases 5-6) — SHIPPED 2026-02-15</summary>

- [x] Phase 5: Velocity Humanization (3/3 plans) — completed 2026-02-15
- [x] Phase 6: MIDI Export (2/2 plans) — completed 2026-02-15

</details>

### 🚧 v1.2 Polish (In Progress)

**Milestone Goal:** Elevate the listening and sharing experience with stereo spread, pattern visualization, shareable seeded performances, and microtiming humanization.

- [x] **Phase 7: Seeded PRNG** — Deterministic performances reproducible via shared URL — completed 2026-02-15
- [x] **Phase 8: Microtiming** — Swing, rubato, and per-performer timing personality — completed 2026-02-15
- [ ] **Phase 9: Stereo Spread** — Performers panned across the stereo field
- [ ] **Phase 10: Pattern Visualization** — Score overview and per-performer visual feedback

## Phase Details

### Phase 7: Seeded PRNG
**Goal**: Users can share a URL that reproduces an identical performance note-for-note
**Depends on**: Phase 6 (v1.1 complete)
**Requirements**: SEED-01, SEED-02, SEED-03, SEED-04, SEED-05, SEED-06
**Success Criteria** (what must be TRUE):
  1. Starting a performance with the same seed, mode, BPM, and performer count produces the exact same note sequence every time
  2. The current seed is visible in the UI and can be copied to clipboard with one click
  3. User can enter a seed manually to replay a specific performance
  4. Pasting a shared URL into a browser auto-configures mode, BPM, performer count, and seed, then starts the same performance
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — SeededRng class (Mulberry32) + replace all 32 Math.random() call sites
- [x] 07-02-PLAN.md — Wire RNG through AudioEngine, seed UI, URL hash sharing
- [x] 07-03-PLAN.md — Fix seed display: Engine intercepts onStateChange to overlay seed

### Phase 8: Microtiming
**Goal**: Performances feel rhythmically organic with swing, rubato, and per-performer timing variation
**Depends on**: Phase 7 (seeded PRNG required for deterministic timing jitter)
**Requirements**: TIME-01, TIME-02, TIME-03, TIME-04, TIME-05
**Success Criteria** (what must be TRUE):
  1. Enabling swing shifts alternate eighth notes forward, audibly changing the groove feel
  2. Each performer has a subtle but audible timing personality (some rush, some drag) creating ensemble spread
  3. Rubato gently breathes the effective tempo so the ensemble feels less mechanical
  4. Microtiming is controlled through the existing humanization toggle and intensity levels
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md — TDD timing.ts: pure timing offset computation (swing, personality, jitter, density) + extend ensemble types
- [x] 08-02-PLAN.md — Wire rubato into Ensemble, apply timing offsets in Scheduler

### Phase 9: Stereo Spread
**Goal**: Each performer occupies a distinct position in the stereo field, giving spatial clarity to the ensemble
**Depends on**: Phase 7 (deterministic pan assignment uses seeded performer IDs)
**Requirements**: STE-01, STE-02, STE-03
**Success Criteria** (what must be TRUE):
  1. Listening on headphones, each performer is audibly positioned at a different point in the stereo field
  2. Pan positions are stable across resets and replays (same performer ID = same position)
  3. Performers are evenly distributed across the stereo field (no clustering on one side)
**Plans**: 2 plans

Plans:
- [ ] 09-01-PLAN.md — TDD pan position computation (evenly-distributed, seeded shuffle)
- [ ] 09-02-PLAN.md — Wire StereoPannerNodes into audio graph (synth + sampled routing)

### Phase 10: Pattern Visualization
**Goal**: Users can see ensemble structure and activity through visual feedback on performer cards and a score overview
**Depends on**: Phase 7 (seeded replay means visualization is reproducible)
**Requirements**: VIZ-01, VIZ-02, VIZ-03
**Success Criteria** (what must be TRUE):
  1. Performer cards flash or pulse visibly when a note is played
  2. Performer cards show progress within the current pattern repetition
  3. A score overview visualization shows all performers' positions across the full pattern sequence, revealing canonic phasing and convergence
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

## Progress

**Execution Order:** 7 → 8 → 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Audio Engine + Score Foundation | v1.0 | 3/3 | Complete | 2026-02-14 |
| 2. Ensemble AI | v1.0 | 2/2 | Complete | 2026-02-15 |
| 3. Visualization + Instruments + Polish | v1.0 | 3/3 | Complete | 2026-02-15 |
| 4. Composition Modes | v1.0 | 3/3 | Complete | 2026-02-15 |
| 5. Velocity Humanization | v1.1 | 3/3 | Complete | 2026-02-15 |
| 6. MIDI Export | v1.1 | 2/2 | Complete | 2026-02-15 |
| 7. Seeded PRNG | v1.2 | 3/3 | Complete | 2026-02-15 |
| 8. Microtiming | v1.2 | 2/2 | Complete | 2026-02-15 |
| 9. Stereo Spread | v1.2 | 0/TBD | Not started | - |
| 10. Pattern Visualization | v1.2 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-15*
*v1.0 MVP shipped: 2026-02-15*
*v1.1 MIDI shipped: 2026-02-15*
*v1.2 Polish started: 2026-02-15*
