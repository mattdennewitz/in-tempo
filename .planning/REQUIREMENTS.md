# Requirements: InTempo

**Defined:** 2026-02-15
**Core Value:** Ensemble behavior must feel alive -- performers making believable musical decisions over a precisely timed audio engine, so each performance is unique and compelling.

## v1.2 Requirements

Requirements for stereo spread, shareable seeded performances, pattern visualization, and microtiming humanization. Each maps to roadmap phases.

### Stereo Spread

- [ ] **STE-01**: Each performer's audio output is panned to a distinct stereo position
- [ ] **STE-02**: Pan positions are deterministic (same performer ID = same position across resets)
- [ ] **STE-03**: Performers are evenly distributed across the stereo field

### Seeded Replay

- [ ] **SEED-01**: Starting a performance with the same seed, mode, BPM, and performer count produces the exact same note-by-note sequence
- [ ] **SEED-02**: Current seed is displayed in the UI during/after performance
- [ ] **SEED-03**: User can copy seed to clipboard with one click
- [ ] **SEED-04**: User can paste/enter a seed to replay a specific performance
- [ ] **SEED-05**: Performance configuration (seed + mode + BPM + count) is encoded in a shareable URL
- [ ] **SEED-06**: Opening a shared URL auto-configures and starts the same performance

### Pattern Visualization

- [ ] **VIZ-01**: Performer cards show visual feedback when a note is played (pulse/flash)
- [ ] **VIZ-02**: Performer cards show progress within current pattern repetition
- [ ] **VIZ-03**: A score overview visualization shows all performers' positions across the pattern sequence, revealing canonic phasing

### Microtiming

- [ ] **TIME-01**: Global swing parameter shifts alternate eighth notes forward (50% straight to ~67% triplet)
- [ ] **TIME-02**: Each performer has a timing personality (rush/drag bias) creating natural temporal spread
- [ ] **TIME-03**: Rubato gently modulates the effective tempo creating ensemble breathing
- [ ] **TIME-04**: Higher performer density produces slightly looser timing
- [ ] **TIME-05**: Microtiming shares the existing humanization toggle and intensity control

## Future Requirements

### Audio Polish

- **AUD-P01**: Dynamic pan on dropout/rejoin (spatial sense of performers entering/leaving)
- **AUD-P02**: Instrument-based spatial depth (piano wider, marimba centered, synth narrow)
- **AUD-P03**: Recording/export to audio file (WAV/MP3)

### Visual Identity

- **VIZ-P01**: GT Canon font throughout the UI
- **VIZ-P02**: Semafor/FT color palette (warm salmon, cream, dark navy)
- **VIZ-P03**: Note event particles/ripples on the canvas
- **VIZ-P04**: Instrument-based color coding for performer cards
- **VIZ-P05**: Phase relationship spread indicator

### Sharing

- **SHARE-P01**: Human-readable performance names ("Coral Meadow #7392")

## Out of Scope

| Feature | Reason |
|---------|--------|
| 3D spatial audio (PannerNode/HRTF) | Overkill for stereo; most users on laptop speakers |
| Per-performer pan sliders | Breaks spectator-only design philosophy |
| Backend/database for seed storage | URL params achieve shareability without server |
| QR code sharing | Copy-link already solves this |
| Real-time waveform/spectrum viz | Doesn't communicate ensemble structure |
| Per-performer swing amounts | Too many degrees of freedom; shared groove + personality offsets |
| Complex tempo curves/automation | Requires timeline editor; breaks spectator UX |
| Beat-synced strobe/flash effects | Accessibility concern (photosensitive seizures) |
| MIDI-synchronized video export | Enormous scope; users can screen-record |
| Real-time multiplayer | Too complex, not core to generative performance value |
| Mobile-optimized layout | Desktop-first |
| User conducting/intervention | Spectator only by design |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STE-01 | Phase 9 | Pending |
| STE-02 | Phase 9 | Pending |
| STE-03 | Phase 9 | Pending |
| SEED-01 | Phase 7 | Pending |
| SEED-02 | Phase 7 | Pending |
| SEED-03 | Phase 7 | Pending |
| SEED-04 | Phase 7 | Pending |
| SEED-05 | Phase 7 | Pending |
| SEED-06 | Phase 7 | Pending |
| VIZ-01 | Phase 10 | Pending |
| VIZ-02 | Phase 10 | Pending |
| VIZ-03 | Phase 10 | Pending |
| TIME-01 | Phase 8 | Pending |
| TIME-02 | Phase 8 | Pending |
| TIME-03 | Phase 8 | Pending |
| TIME-04 | Phase 8 | Pending |
| TIME-05 | Phase 8 | Pending |

**Coverage:**
- v1.2 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-15 after roadmap creation*
