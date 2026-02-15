# Milestones

## v1.0 MVP (Shipped: 2026-02-15)

**Phases completed:** 4 phases, 11 plans, 0 tasks

**Key accomplishments:**
- Rock-solid Web Audio engine with AudioWorklet, lookahead scheduler, and voice pool
- Ensemble AI with weighted decisions, band enforcement, dropout/rejoin, and natural endgame
- Canvas-based performer visualization with dynamic add/remove during playback
- Sampled instruments (piano, marimba) mixed with synth voices for timbral variety
- Three composition modes: Riley's 53 patterns, generative melodic cells, Euclidean rhythms
- Score mode selector dropdown with performer cards and mode badge

---


## v1.1 MIDI (Shipped: 2026-02-15)

**Phases completed:** 2 phases (5-6), 5 plans
**Git range:** `c8d74ed` → `a5b35a0` (18 commits)
**Files:** 34 changed, 3,448 lines added

**Key accomplishments:**
- Four-layer velocity model (jitter, personality, metric accent, phrase contour) making each performer dynamically distinct
- Velocity piped through full audio chain — ensemble, scheduler, synth, and sampler all honor per-note velocity
- Humanization UI toggle with subtle/moderate/expressive intensity presets
- Passive MIDI recorder with integer beat counter capturing events during playback
- Multi-track MIDI export with per-performer tracks, GM instruments, tempo, and humanized velocities
- Default 4 performers for cleaner listening experience

---

