# Project Research Summary

**Project:** InTempo — MIDI Export & Velocity Humanization Milestone
**Domain:** Browser-based generative music performance engine (Web Audio API)
**Researched:** 2026-02-15
**Confidence:** MEDIUM-HIGH

## Executive Summary

This research covers adding MIDI file export and velocity humanization to InTempo's existing generative performance engine. The core finding is that **velocity is a cross-cutting concern** requiring simultaneous changes across five architectural layers (Ensemble AI → Scheduler → AudioWorklet synth → smplr sampler → MIDI recorder). Partial implementation will create inconsistency between what users hear and what they export, making coordinated implementation essential.

The recommended approach uses **midi-writer-js** (v3.1.1) for MIDI file generation paired with an in-house velocity humanization algorithm that layers personality-driven dynamics, metric accents, phrase contours, and micro-variations. The MIDI recorder should tap the Scheduler's event stream using a parallel integer tick counter to avoid floating-point time drift. With 4 default performers (down from 8), voice stealing becomes more common, making it critical that MIDI recording tracks event durations from the Ensemble, not from audio voice pool callbacks.

The biggest risk is **time conversion drift** (Pitfall 1): the Scheduler tracks time as floating-point `AudioContext.currentTime` while MIDI uses integer ticks. Over a 45-minute performance, cumulative rounding errors will shift notes off-grid in the exported file. This is prevented by maintaining a parallel integer tick counter from the start. The second major risk is the **midi-writer-js velocity scale mismatch** (Pitfall 3): the library uses 1-100 instead of MIDI's standard 0-127, requiring explicit conversion to preserve dynamic range.

## Key Findings

### Recommended Stack

**Single new dependency:** midi-writer-js v3.1.1 for MIDI file generation. This library was chosen over @tonejs/midi (bidirectional read/write when we only need write), jsmidgen (unmaintained since 2018), and JZZ.js (massive overkill for file generation). midi-writer-js speaks in musical durations natively (`'8'` for eighth note) which maps directly to InTempo's eighth-note beat clock, requires no Node.js polyfills, and is ~15KB.

**Core technologies:**
- **midi-writer-js v3.1.1**: Generate Standard MIDI File (.mid) — purpose-built for writing, clean Track/NoteEvent API, zero dependencies
- **In-house velocity algorithm**: Humanization with personality + metric accent + phrase contour — 30-50 lines of TypeScript, more appropriate than ML-based solutions for minimalist generative music
- **Existing smplr library**: Already supports velocity 0-127 natively via `start({ velocity })` — no changes needed, just pass the parameter

**Critical API detail:** midi-writer-js velocity range is 1-100 (not 0-127). Must map: `Math.round(velocity * 100 / 127)` before passing to NoteEvent.

### Expected Features

**Must have (table stakes):**
- Download as .mid file (Standard MIDI Format 1, multi-track)
- One track per performer with correct tempo metadata
- Velocity values on every note (1-127 MIDI range)
- Track names identifying performers (e.g., "Performer 1 (Piano)")
- Instrument program changes (General MIDI mapping)
- Export available after stopping (buffer persists until reset)
- Default 4 performers (trivial change from current 8)

**Should have (differentiators):**
- Per-note velocity humanization with Gaussian-like distribution
- Performer personality affects velocity curve (some naturally louder/softer)
- Contextual velocity dynamics (pattern accents, density-responsive, re-entry energy)
- Export during playback (snapshot mid-performance)
- Descriptive filename (`intempo-riley-120bpm-4perf-2026-02-15.mid`)

**Defer (anti-features for this milestone):**
- Real-time MIDI output to hardware (Web MIDI API inconsistent, different feature)
- MIDI import/load (contradicts generative premise)
- WAV/MP3 audio export (MediaRecorder quality issues, much harder than MIDI)
- Configurable humanization amount (bake in good defaults first)
- MIDI CC data (sustain, mod wheel) — note on/off only

### Architecture Approach

The architecture centers on three new components integrated into the existing scheduler-based event flow. **VelocityHumanizer** generates per-note velocity at the Ensemble/Agent level using personality profiles. **MidiRecorder** passively observes the Scheduler's event stream (observer/tap pattern) without affecting audio timing. **MidiExporter** converts the accumulated recording buffer to Standard MIDI File format via midi-writer-js on export.

**Major components:**
1. **VelocityHumanizer** (`src/audio/velocity.ts`) — Computes velocity from personality profile + beat position + ensemble density + entry fade-in; called by PerformerAgent during tick()
2. **MidiRecorder** (`src/audio/midi-recorder.ts`) — Accumulates timestamped events with parallel integer tick counter; fed by Scheduler.scheduleBeat(), read by MidiExporter
3. **MidiExporter** (`src/audio/midi-exporter.ts`) — Groups events by performer into multi-track MIDI file; handles tempo meta-events, track naming, instrument program changes, browser download

**Key integration points:**
- Extend `AgentNoteEvent` with `velocity: number` field (single source of truth)
- Flow velocity through five layers simultaneously: Ensemble → Scheduler → AudioWorklet (maxGain scaling) → SamplePlayer (smplr velocity) → MidiRecorder
- Record in Scheduler.scheduleBeat() where all data converges (events, timing, BPM, instrument assignment)
- Use integer tick counter parallel to AudioContext.currentTime to prevent drift

**Critical architectural decision:** Velocity originates at Ensemble/Agent level (musical decision tied to personality), not Scheduler level (audio-routing decision). This ensures both audio playback and MIDI export use the same velocity values.

### Critical Pitfalls

1. **AudioContext Time to MIDI Tick Conversion Drift** — Floating-point `currentTime` accumulates rounding errors over long performances; converted to integer MIDI ticks, this creates audible timing drift. **Prevention:** Maintain parallel integer tick counter (PPQ=480) incremented by fixed amounts, never derive MIDI ticks from AudioContext seconds.

2. **Velocity Has No Path Through Architecture** — Current `AgentNoteEvent` lacks velocity field; synth maxGain is hardcoded; SamplePlayer doesn't pass velocity to smplr. Partial implementation creates mismatch between audio and MIDI. **Prevention:** Add velocity to AgentNoteEvent and flow through all five layers (Ensemble, Scheduler, synth worklet, sampler, MIDI recorder) simultaneously in one milestone.

3. **midi-writer-js Velocity Scale Mismatch** — Library uses 1-100 range, not MIDI standard 0-127. Passing raw MIDI velocity compresses dynamics into top 20% of range. **Prevention:** Map velocity before passing: `Math.round((velocity / 127) * 100)`. Test with known velocity values and verify via hex editor.

4. **Recording Notes Never Heard (Lookahead Ghost Notes)** — Scheduler pre-schedules notes 100ms ahead; on stop, already-scheduled notes play but may/may not be in MIDI file depending on timing. **Prevention:** Record at scheduling time with session ID; on stop, record exact AudioContext time and trim notes scheduled after stop time.

5. **Voice Stealing Creates Overlapping MIDI Notes** — VoicePool steals oldest voice when all busy; stolen note's duration in MIDI will be wrong if recorder couples to voice pool callbacks instead of event durations. **Prevention:** Record durations from Ensemble event.duration field (authoritative), not from audio voice pool state.

## Implications for Roadmap

Based on research, suggested phase structure follows dependency chain:

### Phase 1: Velocity Humanization Foundation
**Rationale:** Velocity must exist before MIDI recording can capture it. Zero external dependencies, additive changes to existing types. Implements the VelocityProfile/computeVelocity algorithm and adds velocity field to AgentNoteEvent.
**Delivers:** Per-note velocity values with musical humanization (personality + metric accent + phrase contour + jitter)
**Addresses:** Must-have velocity on every note; differentiator of personality-driven dynamics
**Avoids:** Pitfall 2 (no velocity path) by implementing across all five layers simultaneously
**Research needed:** None — standard pattern, in-house algorithm

### Phase 2: Velocity Audio Integration
**Rationale:** Depends on Phase 1 (velocity values exist). Makes velocity audible for testing/validation before MIDI export. Required changes isolated to audio layer.
**Delivers:** Velocity affects audio playback (synth maxGain scaling, smplr velocity parameter)
**Uses:** Existing smplr velocity support (0-127 native), modified synth-processor.js
**Implements:** Audio propagation through Scheduler → AudioWorklet/SamplePlayer
**Avoids:** Pitfall 7 (synth processor clicks) via separate velocityGain field with ramped transitions; Pitfall 12 (gain staging breaks) via master gain re-tuning
**Research needed:** None — modifications to existing components

### Phase 3: MIDI Recording Infrastructure
**Rationale:** Depends on Phase 1 (velocity in events). Independent of Phase 2 (recording doesn't need audio to work). Must implement parallel tick counter from the start to avoid Pitfall 1.
**Delivers:** Passive event recording with integer tick timeline, session management (start/stop/reset)
**Addresses:** Must-have MIDI export foundation
**Implements:** MidiRecorder class, Scheduler integration hook
**Avoids:** Pitfall 1 (time drift) via parallel integer tick counter at PPQ=480; Pitfall 4 (ghost notes) via stop-time trimming; Pitfall 5 (voice stealing durations) by recording from event stream not audio callbacks
**Research needed:** None — observer pattern, well-understood approach

### Phase 4: MIDI File Export
**Rationale:** Depends on Phase 3 (recorded events exist). This is the user-facing output. Requires midi-writer-js integration and careful handling of velocity scale mismatch.
**Delivers:** Multi-track MIDI file download with tempo metadata, track names, instrument mapping
**Uses:** midi-writer-js v3.1.1, descriptive filename generation
**Addresses:** Must-have .mid file download, track-per-performer, tempo/instrument metadata
**Avoids:** Pitfall 3 (velocity scale) via explicit 0-127 to 1-100 mapping; Pitfall 8 (no tempo event) via setTempo at tick 0; Pitfall 9 (channel 10 drums) by mapping performers to tracks not channels
**Research needed:** None — library integration with known API quirks

### Phase 5: Default 4 Performers
**Rationale:** Trivially independent, can run parallel with any phase. One-line change in AudioEngine.initialPerformerCount with verification.
**Delivers:** Better default listener experience (less chaotic, more intelligible)
**Addresses:** Milestone requirement for default 4 performers
**Avoids:** No pitfalls — simple configuration change
**Research needed:** None

### Phase Ordering Rationale

- **Velocity before MIDI recording** because the recorder needs velocity values to exist in AgentNoteEvent
- **Audio integration before MIDI export** so velocity can be validated audibly before committing to file format
- **MIDI infrastructure before export** because exporter reads from recorder's accumulated buffer
- **All five velocity layers simultaneously** to prevent audio/MIDI mismatch (Pitfall 2)
- **Integer tick counter from day one** because retrofitting time conversion is architecturally disruptive (Pitfall 1)

Dependencies form a clear chain: Phase 1 → Phase 2 (uses velocity), Phase 1 → Phase 3 (records velocity) → Phase 4 (exports recording). Phase 5 is independent.

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Velocity Foundation):** In-house algorithm, extends existing personality system following established patterns
- **Phase 2 (Audio Integration):** Modifications to existing components (scheduler, sampler, synth-processor) with clear integration points
- **Phase 3 (Recording):** Observer pattern, well-documented approach for event capture
- **Phase 4 (Export):** Library integration with verified API (midi-writer-js), known quirks documented in PITFALLS.md
- **Phase 5 (Default 4):** Configuration change

**No phases need deeper research** — all patterns are well-understood, library API is verified, integration points are clear from codebase analysis.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | midi-writer-js API verified via npm + GitHub, smplr velocity support confirmed from type definitions, existing codebase analyzed directly |
| Features | MEDIUM-HIGH | MidiWriterJS capabilities verified, velocity humanization patterns well-documented in production music literature, table stakes identified from DAW import expectations |
| Architecture | HIGH | All integration points identified via direct codebase analysis (scheduler.ts, ensemble.ts, voice-pool.ts, sampler.ts, synth-processor.js), clear component boundaries |
| Pitfalls | MEDIUM-HIGH | Time drift and velocity scale mismatch verified from library docs + MIDI spec, voice stealing behavior confirmed from voice-pool.ts source, lookahead timing analyzed from scheduler |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **midi-writer-js velocity scale (1-100 vs 0-127):** Research confirms the mismatch. Mitigation is clear (explicit mapping function) but should be validated with hex editor inspection of first exported MIDI file to verify correct velocity bytes.

- **Synth processor velocity clicks:** Pitfall 7 describes the risk but exact implementation depends on synth-processor.js envelope behavior during voice stealing. May require iteration during Phase 2 to tune the velocityGain ramp timing.

- **Optimal PPQ value:** Research suggests 480 (industry standard) but InTempo's eighth-note resolution could work with lower values (e.g., 240). Should be decided during Phase 3 based on whether triplet or dotted note patterns emerge from generative scores.

- **Gaussian random implementation:** Box-Muller transform suggested but simpler approximation (sum of 3-5 uniform randoms) may be sufficient for audible humanization. Can be validated with A/B testing during Phase 1.

## Sources

### Primary (HIGH confidence)
- InTempo codebase analysis: `scheduler.ts`, `voice-pool.ts`, `engine.ts`, `ensemble.ts`, `sampler.ts`, `synth-processor.js`, `src/audio/types.ts` — direct code reading of integration points, current event flow, existing personality system
- smplr type definitions at `node_modules/smplr/dist/index.d.ts` — verified `SampleStart` accepts `velocity?: number` (0-127 range)
- [MidiWriterJS GitHub](https://github.com/grimmdude/MidiWriterJS) — API documentation, NoteEvent velocity 1-100 range, Writer.buildFile() returns Uint8Array, TypeScript source
- [MidiWriterJS npm](https://www.npmjs.com/package/midi-writer-js) — v3.1.1 latest, weekly downloads ~1.5K, actively maintained

### Secondary (MEDIUM confidence)
- [Standard MIDI File Format spec](https://midimusic.github.io/tech/midispec.html) — Format 1 structure, tempo meta-events, velocity 0-127 range, PPQ timing
- [Production Music Live - Humanize Your Tracks](https://www.productionmusiclive.com/blogs/news/6-ways-to-humanize-your-tracks) — Velocity randomization at 10-20% range for subtle humanization
- [Music Sequencing - Humanize MIDI](https://www.musicsequencing.com/article/humanize-midi/) — Layered humanization approaches (metric accent + phrase shape + jitter)
- [Ableton - Understanding MIDI Files](https://help.ableton.com/hc/en-us/articles/209068169-Understanding-MIDI-files) — Track naming expectations, Format 1 for DAW import
- [MDN AudioWorklet documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet) — postMessage for parameter passing to worklet
- [@tonejs/midi GitHub](https://github.com/Tonejs/Midi) — Evaluated and rejected (bidirectional read/write, time-based API not musical duration)

### Tertiary (LOW confidence)
- [MIDI timing/PPQN reference](http://midi.teragonaudio.com/tech/midifile/ppqn.htm) — Integer tick rounding issues in long performances (described theoretically, not empirically tested)
- [Best Practices for Sharing MIDI Files Between DAWs](https://www.macprovideo.com/article/fl-studio/best-practices-for-sharing-midi-files-between-daws) — File naming conventions, instrument mapping for compatibility

---
*Research completed: 2026-02-15*
*Ready for roadmap: yes*
