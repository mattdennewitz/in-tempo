# Requirements: InTempo

**Defined:** 2026-02-15
**Core Value:** Ensemble behavior must feel alive -- performers making believable musical decisions over a precisely timed audio engine, so each performance is unique and compelling.

## v1.1 Requirements

Requirements for MIDI export, velocity humanization, and configuration. Each maps to roadmap phases.

### MIDI Export

- [ ] **MIDI-01**: User can download a .mid file of the current performance at any point (during or after playback)
- [ ] **MIDI-02**: MIDI file contains one track per performer with correct note pitches and durations
- [ ] **MIDI-03**: MIDI file includes tempo metadata matching the performance BPM
- [ ] **MIDI-04**: Each MIDI track has an instrument program change matching the performer's assigned instrument (synth/piano/marimba)
- [ ] **MIDI-05**: Per-note velocity values in MIDI file reflect the humanized velocities from playback

### Velocity

- [ ] **VEL-01**: Each note played has a subtly varied velocity (not uniform) audible in both synth and sampled instrument playback
- [ ] **VEL-02**: Each performer has a distinct velocity personality (some louder, some softer on average)
- [ ] **VEL-03**: Metric accents emphasize downbeats with slightly higher velocity
- [ ] **VEL-04**: Phrase contour shapes velocity across pattern repetitions (not just random per-note)
- [ ] **VEL-05**: User can toggle humanization on/off and select intensity level (subtle, moderate, expressive) before or during playback

### Configuration

- [ ] **CFG-01**: Default performer count is 4 (down from 8)

## Future Requirements

### Audio Polish

- **AUD-P01**: Stereo spread -- performers panned across the stereo field
- **AUD-P02**: Recording/export to audio file (WAV/MP3)

### Visual Identity

- **VIZ-P01**: GT Canon font throughout the UI
- **VIZ-P02**: Semafor/FT color palette (warm salmon, cream, dark navy)
- **VIZ-P03**: Abstract geometry visualization of each performer's active pattern

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time multiplayer | Too complex, not core to generative performance value |
| Mobile-optimized layout | Desktop-first |
| User conducting/intervention | Spectator only by design |
| Pulse track in MIDI export | Pulse is a playback aid, not a musical voice |
| MIDI input (live play) | Out of scope -- this is a generative/spectator tool |
| BPM change events in MIDI | Adds complexity; constant BPM per performance is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VEL-01 | Phase 5 | Pending |
| VEL-02 | Phase 5 | Pending |
| VEL-03 | Phase 5 | Pending |
| VEL-04 | Phase 5 | Pending |
| VEL-05 | Phase 5 | Pending |
| CFG-01 | Phase 5 | Pending |
| MIDI-01 | Phase 6 | Pending |
| MIDI-02 | Phase 6 | Pending |
| MIDI-03 | Phase 6 | Pending |
| MIDI-04 | Phase 6 | Pending |
| MIDI-05 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-15 after roadmap creation*
