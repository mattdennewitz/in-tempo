# Feature Landscape

**Domain:** MIDI export and velocity humanization for browser-based generative performance engine
**Researched:** 2026-02-15
**Scope:** New milestone features only (MIDI file export, velocity humanization, default 4 performers)
**Confidence:** MEDIUM-HIGH (MidiWriterJS API verified via web search and npm; velocity humanization patterns well-documented in production music literature; existing codebase reviewed)

## Context: What Already Exists

The following are already built and should NOT be re-implemented:

- Three composition modes (riley, generative, euclidean) with score generation
- Ensemble AI with weighted decisions, band enforcement, dropout/rejoin
- Canvas visualization with per-performer geometry
- Sampled instruments (piano, marimba) + synth via AudioWorklet
- Dynamic performer add/remove during playback
- Transport controls (start/stop/reset), BPM slider, pulse toggle
- Score mode selector UI

The scheduler already produces `AgentNoteEvent` objects with `performerId`, `midi`, and `duration` on every tick. This is the hook point for both MIDI recording and velocity humanization.

## Table Stakes

Features users expect when a generative music app offers MIDI export. Missing these and the feature feels half-baked.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Download as .mid file** | The fundamental promise. Users click export, get a standard MIDI file that opens in any DAW. | Medium | MidiWriterJS library, event recording buffer |
| **One track per performer** | DAW users expect to see separate tracks they can edit independently. Format 0 (single track) is useless for multi-performer output. | Low | MIDI Format 1 support in MidiWriterJS (built-in) |
| **Correct tempo in MIDI metadata** | If the BPM in the MIDI file doesn't match what was playing, every note lands wrong when imported into a DAW. | Low | Read BPM from engine state, set on MIDI tempo track |
| **Velocity values on every note** | MIDI without velocity is flat and lifeless. Every note needs a velocity value (1-127). This is where humanization lives. | Low | Velocity data must exist in the event pipeline |
| **Track names identifying performers** | "Track 1, Track 2" is acceptable but "Performer 1 (Piano)", "Performer 2 (Synth)" is expected. DAW users orient by track names. | Low | Track name meta-event in MidiWriterJS |
| **Instrument program changes** | MIDI files should specify General MIDI program numbers so DAWs auto-assign roughly correct sounds (piano, marimba, synth pad). | Low | Program change events at track start |
| **Export available after stopping** | Users who stop a performance should be able to export what was recorded up to that point. Not just on completion. | Low | Buffer persists across stop, cleared on reset |
| **Default 4 performers** | The milestone specifies this. 4 is a better default than 8 for first-time listeners -- less chaotic, more intelligible, still demonstrates ensemble behavior. | Low | Change `initialPerformerCount` from 8 to 4 in `AudioEngine` |

## Differentiators

Features that elevate InTempo's MIDI export beyond "dump notes to file."

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **Per-note velocity humanization** | Subtle velocity variation (+-10-15% around a base) makes every performance sound alive rather than mechanical. Applied to BOTH audio playback and MIDI output simultaneously. This is the feature that makes exported MIDI actually usable in a DAW without manual humanization. | Medium | Gaussian-like random distribution, per-performer personality bias, integration into scheduler |
| **Performer personality affects velocity curve** | Each performer already has an `AgentPersonality` with biases. Extending this to velocity means some performers naturally play louder/softer, creating timbral depth. Performer 1 might hover around velocity 85, Performer 3 around 100. | Low | Extend `AgentPersonality` with `velocityCenter` and `velocitySpread` |
| **Contextual velocity dynamics** | Notes at pattern beginnings slightly louder (accent), repeated patterns gradually softer (fatigue/relaxation), rejoin after silence slightly louder (re-entry energy). Mimics how real musicians play In C. | Medium | Pattern position awareness in velocity calculation |
| **Export during playback** | Most apps require stopping first. Letting users export a snapshot mid-performance ("I like what's happening right now") captures the generative magic at its peak. | Low | Clone the recording buffer without stopping |
| **Descriptive filename** | Auto-generated filename like `intempo-riley-120bpm-4perf-2026-02-15.mid` tells users what's inside without opening it. Better than "download.mid". | Low | String template from engine state |
| **Density-responsive velocity** | When ensemble density is high (many performers playing), individual velocities drop slightly. When sparse, they rise. Mimics acoustic reality where musicians play softer in a crowd. | Low | Read density from ensemble snapshot during velocity calculation |

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-time MIDI output to hardware** | Web MIDI API support is inconsistent (no Firefox/Safari). Adds device enumeration, latency management, error handling for disconnects. Completely different feature from file export. | File export only. Real-time MIDI out is a separate future milestone if ever. |
| **MIDI import / load** | InTempo generates its own scores. Importing external MIDI contradicts the generative premise and requires a parser, note-to-pattern mapping, and UI for file selection. | Not applicable to this product's design. |
| **Per-track velocity/volume sliders in UI** | Turns the spectator experience into a mixing console. Breaks the "aquarium" design philosophy. | Velocity humanization is automatic and personality-driven. No user knobs. |
| **WAV/MP3 audio export** | MediaRecorder API quality is inconsistent. OfflineAudioContext rendering requires rewiring the entire audio graph. Much harder than MIDI export for marginal additional value. | MIDI export only. Users render audio in their DAW from the MIDI file. |
| **Configurable humanization amount** | Exposing "humanization intensity" as a slider adds UI complexity for a parameter most users won't understand. The default should just sound good. | Bake in sensible defaults. Possibly expose as an advanced/hidden option later. |
| **MIDI CC data (sustain pedal, mod wheel, etc.)** | Adds complexity for minimal value. InTempo's performers don't model continuous controllers. The note data is what matters. | Note on/off with velocity only. Clean, simple MIDI that's easy to edit in a DAW. |
| **Multiple export formats (MusicXML, ABC notation)** | Scope creep. MIDI is the universal interchange format for this use case. | MIDI only. |
| **Undo/redo for recording** | There's nothing to undo. The recording is a passive capture of what happened. | Export what was recorded. Reset clears the buffer. |

## Feature Dependencies

```
Existing Scheduler tick loop (produces AgentNoteEvent[])
  |
  +-> Velocity Humanization Layer (NEW)
  |     |
  |     +-> Per-performer velocity personality (extends AgentPersonality)
  |     +-> Contextual dynamics (pattern position, density)
  |     +-> Gaussian-like random spread (utility function)
  |     |
  |     +-> Applied to audio playback (pass velocity to SamplePlayer/VoicePool)
  |     +-> Applied to MIDI recording buffer (store velocity with each event)
  |
  +-> MIDI Recording Buffer (NEW)
  |     |
  |     +-> Captures: performerId, midi, duration, velocity, tick timestamp
  |     +-> Persists across stop (cleared on reset)
  |     +-> Cloneable for mid-playback export
  |
  +-> MIDI Export Service (NEW)
        |
        +-> MidiWriterJS (npm dependency)
        +-> Buffer -> multi-track MIDI file conversion
        +-> Track naming (performer ID + instrument)
        +-> Tempo meta-event from engine BPM
        +-> Program change events (GM instrument mapping)
        +-> Blob -> download trigger (anchor click pattern)
        +-> Filename generation from engine state

Default performer count change: AudioEngine.initialPerformerCount = 4
  (independent of above, no dependencies)
```

## Velocity Humanization Design

### Base Algorithm

Each note's velocity should be computed as:

```
baseVelocity = performerVelocityCenter  (e.g., 75-100, per personality)
spread = performerVelocitySpread         (e.g., 8-15, per personality)
contextModifier = f(patternPosition, density, reentryState)
rawVelocity = baseVelocity + gaussianRandom() * spread + contextModifier
finalVelocity = clamp(rawVelocity, 30, 120)
```

### Recommended Ranges (from production music research)

| Parameter | Range | Rationale |
|-----------|-------|-----------|
| Base velocity center | 75-100 | Leaves headroom above and below. 127 max is too hot; below 60 is inaudible on many patches. |
| Velocity spread (std dev) | 8-15 | 10-15% variation is the industry standard for subtle humanization. Too much sounds drunk; too little sounds robotic. |
| Pattern-start accent | +5 to +10 | Mimics natural downbeat emphasis. |
| Density reduction | -5 to -15 at high density | Real musicians play softer when many are playing. |
| Re-entry boost | +8 to +12 | Musicians re-entering after silence play with energy. |

### Gaussian-Like Random Without External Dependencies

Use Box-Muller transform (two uniform randoms -> one normal random). No library needed:

```typescript
function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
```

This returns values with mean 0, std dev 1. Multiply by spread and add to center.

## MIDI Export Design

### File Structure (Format 1)

- **Track 0:** Tempo track (tempo meta-event, time signature 4/4)
- **Tracks 1-N:** One per performer, each containing:
  - Track name meta-event: "Performer {id} ({instrument})"
  - Program change: GM instrument number (0=Piano, 12=Marimba, 89=Warm Pad for synth)
  - Note on/off events with velocity and correct timing

### Timing Conversion

The scheduler runs in eighth notes. MIDI uses ticks (default 128 ticks per quarter note in MidiWriterJS). Conversion:

```
1 eighth note = 0.5 quarter notes = 64 ticks (at 128 TPQ)
```

Each event in the recording buffer needs a tick timestamp relative to performance start.

### Browser Download Pattern

Standard approach for browser file downloads without a server:

```typescript
const blob = new Blob([midiBytes], { type: 'audio/midi' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
```

MidiWriterJS provides `writer.buildFile()` which returns a `Uint8Array`, or `writer.dataUri()` for a data URI. The Blob approach is cleaner for named downloads.

### Filename Convention

Format: `intempo-{mode}-{bpm}bpm-{performerCount}perf-{YYYY-MM-DD}.mid`

Example: `intempo-riley-120bpm-4perf-2026-02-15.mid`

Uses hyphens (not spaces or underscores) for maximum cross-platform compatibility. Project name first for easy identification when sorting.

## Recording Buffer Design

The buffer sits between the scheduler and the export service. It passively records every note event during playback.

| Field | Type | Source |
|-------|------|--------|
| `performerId` | number | `AgentNoteEvent.performerId` |
| `midi` | number | `AgentNoteEvent.midi` |
| `duration` | number | `AgentNoteEvent.duration` (in eighth notes) |
| `velocity` | number | Computed by humanization layer |
| `tick` | number | Scheduler beat counter (eighth notes from start) |

Buffer lifecycle:
- **Start:** Begin recording (tick counter resets to 0)
- **Stop:** Pause recording, buffer preserved
- **Resume:** Continue recording from current tick
- **Reset:** Clear buffer entirely
- **Export:** Clone buffer, convert to MIDI, trigger download

## MVP Recommendation

Build in this order due to dependencies:

1. **Default 4 performers** -- Trivial constant change, ship immediately
2. **Velocity humanization layer** -- Must exist before MIDI recording so recorded events include velocity
   - Gaussian random utility
   - Extend AgentPersonality with velocity fields
   - Velocity computation function (personality + context)
   - Wire into scheduler (pass velocity to SamplePlayer.play and VoicePool noteOn)
3. **MIDI recording buffer** -- Passive event capture with velocity
   - Buffer data structure
   - Integration into scheduler tick
   - Lifecycle management (start/stop/reset/clone)
4. **MIDI export service** -- Buffer to file conversion
   - MidiWriterJS integration
   - Multi-track generation with metadata
   - Browser download trigger
5. **Export UI** -- Button in transport controls
   - Export button (enabled when buffer has events)
   - Filename generation
   - Mid-playback export support

**Defer:**
- Audio export (WAV/MP3): Different technology entirely, not needed for this milestone
- Real-time MIDI output: Inconsistent browser support, separate concern
- Humanization intensity control: Bake in good defaults first

## Complexity Budget

| Feature | Estimated Effort | Risk Level | Notes |
|---------|-----------------|------------|-------|
| Default 4 performers | Trivial | None | Single constant change |
| Velocity humanization | Medium | Low | Algorithm is straightforward; tuning "feel" takes iteration |
| Recording buffer | Low | Low | Simple array append on each tick |
| MIDI export (MidiWriterJS) | Medium | Low | Library is mature; mapping InTempo events to MIDI events is mechanical |
| Export UI button | Low | None | Single button in existing transport bar |
| Velocity integration into audio | Medium | Medium | SamplePlayer already accepts velocity implicitly via smplr; VoicePool synth needs gain scaling from velocity |

## Sources

- [MidiWriterJS GitHub](https://github.com/grimmdude/MidiWriterJS) -- JavaScript MIDI file generation library, v3.1.1, supports multi-track Format 1, per-note velocity, TypeScript (MEDIUM confidence -- API details from web search, not Context7 verified)
- [MidiWriterJS npm](https://www.npmjs.com/package/midi-writer-js) -- ~1,500 weekly downloads, actively maintained (MEDIUM confidence)
- [Standard MIDI File Format spec](https://midimusic.github.io/tech/midispec.html) -- Format 1 structure, tempo track conventions, meta-events (HIGH confidence -- official spec)
- [Production Music Live - 6 Ways to Humanize Your Tracks](https://www.productionmusiclive.com/blogs/news/6-ways-to-humanize-your-tracks) -- Velocity randomization at 10-20% range (MEDIUM confidence)
- [Music Sequencing - Humanize MIDI](https://www.musicsequencing.com/article/humanize-midi/) -- Humanization approaches and velocity range recommendations (MEDIUM confidence)
- [Ableton - Understanding MIDI Files](https://help.ableton.com/hc/en-us/articles/209068169-Understanding-MIDI-files) -- Track naming and Format 1 expectations for DAW import (HIGH confidence -- official docs)
- [Best Practices for Sharing MIDI Files Between DAWs](https://www.macprovideo.com/article/fl-studio/best-practices-for-sharing-midi-files-between-daws) -- File naming, instrument mapping, compatibility (MEDIUM confidence)
- InTempo codebase review: `src/audio/scheduler.ts`, `src/score/ensemble.ts`, `src/audio/engine.ts`, `src/audio/types.ts` (HIGH confidence -- direct code reading)
