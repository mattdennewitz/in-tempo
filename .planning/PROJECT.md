# InTempo

## What This Is

A browser-based generative performance engine inspired by Terry Riley's "In C." Simulated performers independently navigate a shared score of short melodic patterns, following Riley's coordination rules — stay within a few patterns of each other, repeat freely, drop out and rejoin — producing an emergent, shifting tapestry of sound. Built with the Web Audio API for rock-solid timing, React + shadcn + Vite for the interface.

## Core Value

The ensemble behavior must feel alive — performers making believable musical decisions (repetition, dropouts, unison-seeking, density-awareness) over a precisely timed audio engine, so each performance is unique and compelling to watch and listen to.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Precalculated score from Riley's 53 patterns as default mode
- [ ] Algorithmically generated score mode (patterns in the style of In C)
- [ ] Euclidean mode: all patterns replaced with randomly generated euclidean rhythms sized to performance parameters
- [ ] Dynamic performer count — add/remove players before or during performance
- [ ] Emergent performer AI: weighted decisions based on ensemble density, pattern-band proximity, drop-out/rejoin behavior, unison-seeking
- [ ] Riley's rules enforced: sequential pattern traversal, 2-3 pattern band, no skipping backward
- [ ] Toggleable steady eighth-note pulse (high C)
- [ ] User-configurable global BPM
- [ ] Start, stop, and reset performance controls
- [ ] User is a spectator — no interaction with individual performers during performance
- [ ] Mix of synth and sampled instrument voices, randomly assigned or per-player
- [ ] Stereo spread — performers panned across the stereo field
- [ ] Per-performer status box: playing/silent, current pattern number
- [ ] Abstract geometry visualization of each performer's active pattern
- [ ] Natural fade ending: performers reach pattern 53 and drop out one by one
- [ ] Rock-solid Web Audio API timing (AudioContext scheduling, not setTimeout)
- [ ] GT Canon font throughout the UI
- [ ] Color palette inspired by Semafor / Financial Times (warm salmon, cream, dark navy, muted tones)

### Out of Scope

- Real-time multiplayer (human performers over network) — too complex for v1
- MIDI output — browser audio only for now
- Mobile-optimized layout — desktop-first
- Recording/export to audio file — defer to v2
- User conducting/intervention during performance — spectator only by design

## Context

Terry Riley's "In C" (1964) is a seminal minimalist composition. 53 short melodic modules are played in sequence by any number of performers. The magic is in the simple rules: go in order, repeat freely, stay close to each other, listen and adjust. This produces emergent phasing, canonic textures, and dynamic waves without a conductor.

The Web Audio API's AudioContext provides sample-accurate scheduling via `currentTime`, making it ideal for the tight timing this piece demands. The AudioWorklet API enables custom synthesis on a dedicated audio thread.

Euclidean rhythms (Bjorklund's algorithm) distribute k onsets across n steps as evenly as possible, producing rhythms found across world music traditions — a natural fit for generating pattern variations.

## Constraints

- **Tech stack**: React + shadcn/ui + Vite for UI; Web Audio API for all audio
- **Font**: GT Canon (user will provide the font files)
- **Timing**: All note scheduling must use AudioContext.currentTime lookahead, never setTimeout/setInterval for musical timing
- **Browser**: Modern Chromium-based browsers as primary target (best Web Audio support)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Spectator-only interaction | Preserves the emergent, self-organizing nature of the piece — user sets parameters then watches/listens | — Pending |
| Emergent AI over simple random | Rule-based random wouldn't capture the listening/responding behavior that makes In C performances compelling | — Pending |
| Precalculate score | Avoids runtime computation during performance; enables visualization ahead of playback | — Pending |
| Stereo spread over spatial audio | Simpler to implement, works on all systems, still gives spatial separation | — Pending |
| Abstract geometry visualization | Matches the aesthetic of the piece — process-driven, non-literal, visually engaging | — Pending |

---
*Last updated: 2026-02-14 after initialization*
