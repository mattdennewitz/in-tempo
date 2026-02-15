# Phase 6: MIDI Export - Research

**Researched:** 2026-02-15
**Domain:** MIDI file generation and browser download from in-memory performance data
**Confidence:** HIGH

## Summary

Phase 6 converts the real-time performance event stream into a downloadable Standard MIDI File (.mid). The core challenge is architectural: tapping into the existing `Ensemble.tick() -> AgentNoteEvent[]` pipeline to record events with beat-accurate timing, then converting those events to multi-track MIDI format using `midi-writer-js`. Phase 5 already completed the velocity pipeline -- `AgentNoteEvent` now carries a `velocity: number` field (range 0.3-1.0) -- so Phase 6 does not need to modify the velocity system, only consume it.

The critical design decisions are: (1) use an integer beat counter for MIDI timing instead of deriving ticks from `AudioContext.currentTime` floats, (2) record from the ensemble event stream (not the audio output), (3) map instrument types to General MIDI program numbers by instrument group (not by performer ID), and (4) correctly scale velocity from InTempo's 0.3-1.0 range to midi-writer-js's 1-100 range.

**Primary recommendation:** Create a `MidiRecorder` class that passively observes `scheduleBeat()` events using an integer beat counter, and a `MidiExporter` module that converts recorded events to a multi-track MIDI file on demand. The recorder starts automatically with playback and accumulates events until export or reset.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| midi-writer-js | ^3.1.1 | Generate Standard MIDI File (.mid) from note events | Purpose-built for MIDI writing. Clean API: Track, NoteEvent, ProgramChangeEvent, Writer. Zero dependencies. TypeScript source. Browser-native. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | Browser file download | Native `Blob` + `URL.createObjectURL` + `<a download>` is 5 lines. No library needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| midi-writer-js | @tonejs/midi | Bidirectional read/write when we only need write. Time-based API requires manual tempo conversion. |
| midi-writer-js | Raw SMF binary | SMF format is fiddly (VLQ encoding, chunk headers). 15KB lib handles it correctly. |
| midi-writer-js | jsmidgen | Uses raw 0-127 velocity (avoids scale mapping), but unmaintained since 2018, no TypeScript types. |

**Installation:**
```bash
npm install midi-writer-js
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  audio/
    midi-recorder.ts     # NEW: Accumulates timestamped events during playback
    midi-exporter.ts     # NEW: Converts recorded events to MIDI file via midi-writer-js
    scheduler.ts         # MODIFY: Add recording calls in scheduleBeat()
    engine.ts            # MODIFY: Own MidiRecorder, expose exportMidi()
  components/
    ExportButton.tsx     # NEW: Download button UI
```

### Pattern 1: Passive Event Recording (Observer Pattern)
**What:** MidiRecorder sits as a passive observer in the scheduler's `scheduleBeat()` method. It records note events without affecting audio timing.
**When to use:** Whenever you need to capture a stream of events without modifying the producer.
**Example:**
```typescript
// In Scheduler.scheduleBeat(), after routing events to audio:
for (const event of events) {
  if (event.midi === 0) continue;
  // Existing audio routing...

  // NEW: Record for MIDI export
  if (this.midiRecorder?.isRecording) {
    this.midiRecorder.record(
      this.beatCounter,  // integer eighth-note count
      event.performerId,
      event.midi,
      event.duration,    // in eighth notes
      event.velocity,    // 0.3-1.0
    );
  }
}
this.beatCounter++;  // integer, never drifts
```

### Pattern 2: Beat-Based Timing (Integer Tick Counter)
**What:** Maintain a parallel integer beat counter that increments by exactly 1 per eighth note. Use this as the authoritative timeline for MIDI export. Never derive MIDI ticks from `AudioContext.currentTime`.
**When to use:** Any time you need to convert real-time audio events to discrete MIDI ticks.
**Why critical:** `AudioContext.currentTime` is floating-point. At 137 BPM, one eighth = 0.2189781... seconds. Cumulative float rounding across a 45-minute performance creates audible timing drift in the exported MIDI file.
**Example:**
```typescript
// In MidiRecorder:
interface RecordedEvent {
  beatIndex: number;    // integer eighth-note count from start
  performerId: number;
  midi: number;
  duration: number;     // in eighth notes (integer)
  velocity: number;     // 0.3-1.0
}

// In MidiExporter, convert beat index to MIDI ticks:
// midi-writer-js PPQ = 128 ticks per quarter note
// 1 eighth note = 64 ticks (PPQ / 2)
const TICKS_PER_EIGHTH = 64;
const startTick = event.beatIndex * TICKS_PER_EIGHTH;
const durationTicks = event.duration * TICKS_PER_EIGHTH;
```

### Pattern 3: Export-Time Conversion (Not Incremental Building)
**What:** Store simple timestamped events during recording. Convert to MIDI file format only when the user clicks "Download."
**When to use:** Always. Never build MIDI file structures (tracks, delta times) incrementally during recording.
**Why:** MIDI file format uses delta times (time since previous event). Inserting or removing events during recording would corrupt the structure. Absolute-time events are simpler to store, filter, and convert.

### Anti-Patterns to Avoid
- **Recording from audio output:** Record from `Ensemble.tick()` events, not from VoicePool or SamplePlayer. The audio path has voice stealing, release timers, and other artifacts that don't belong in MIDI.
- **Using AudioContext time for MIDI ticks:** Float-to-int conversion accumulates drift. Use integer beat counter.
- **Assigning MIDI channels by performer ID:** Exceeds 16 channels with many performers, and hits channel 10 (drums). Use instrument-type grouping instead.
- **Building MIDI file incrementally:** Delta times require knowing previous events. Convert on export, not during recording.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMF binary format | Custom binary writer with VLQ encoding, chunk headers, track termination | midi-writer-js `Writer.buildFile()` | SMF is well-specified but fiddly. Library handles all binary details. |
| Browser file download | Complex download manager | `Blob` + `URL.createObjectURL` + `<a download>` | 5 lines of native browser API. |
| Velocity scaling to MIDI | Guessing at conversion | Explicit `Math.round(velocity * 100)` then clamp to 1-100 | midi-writer-js uses 1-100, not 0-127. Must map explicitly. |

**Key insight:** The hard part of MIDI export is not the file format (midi-writer-js handles that). The hard part is the recording architecture: correct timing, correct velocity mapping, correct instrument assignment, and clean handling of start/stop/reset lifecycle.

## Common Pitfalls

### Pitfall 1: Float-to-Tick Timing Drift
**What goes wrong:** Deriving MIDI ticks from `AudioContext.currentTime` floats accumulates rounding errors over long performances. Notes drift off the grid.
**Why it happens:** `nextNoteTime += 60 / (bpm * 2)` at non-power-of-2 BPMs produces irrational floats.
**How to avoid:** Parallel integer beat counter. Increment by 1 per eighth note. Convert to MIDI ticks via `beatIndex * 64` (since PPQ=128, eighth = PPQ/2 = 64 ticks).
**Warning signs:** MIDI file sounds fine for 30 seconds but notes are visibly off-grid when zoomed in a DAW piano roll after 5+ minutes.

### Pitfall 2: midi-writer-js Velocity Scale (1-100, NOT 0-127)
**What goes wrong:** Passing raw MIDI 0-127 velocity values to `NoteEvent({ velocity })` silently compresses dynamics. A velocity of 100 (moderately loud in 0-127) becomes maximum (100/100) in midi-writer-js.
**Why it happens:** Non-standard API design choice by the library. Not prominently documented.
**How to avoid:** InTempo velocity is 0.3-1.0. Convert: `Math.max(1, Math.round(velocity * 100))`. This maps the full InTempo range to midi-writer-js's 1-100 range directly.
**Warning signs:** MIDI file "plays" but all notes sound similarly loud. Dynamics are compressed into top 20% of range.

### Pitfall 3: Ghost Notes on Stop
**What goes wrong:** The scheduler's lookahead window (100ms) may have already scheduled notes that haven't played when the user hits stop. These appear in the MIDI file as notes that were never heard.
**Why it happens:** The scheduler queues notes ahead of `AudioContext.currentTime`. Stop clears the timer but already-scheduled audio events still play. The MIDI recorder may have already recorded these.
**How to avoid:** On stop, record the beat counter value. When exporting, trim events whose `beatIndex` exceeds the stop beat.
**Warning signs:** MIDI file has 1-3 extra notes at the end compared to what was heard.

### Pitfall 4: Missing Tempo Meta-Event
**What goes wrong:** MIDI file has no Set Tempo event, so DAWs default to 120 BPM. If InTempo ran at 140 BPM, everything plays back too slowly.
**Why it happens:** midi-writer-js does not auto-insert tempo. Must call `track.setTempo(bpm)` explicitly.
**How to avoid:** Always set tempo on the first track at tick 0. Test with a BPM other than 120 (120 is the default and masks this bug).
**Warning signs:** MIDI plays at wrong speed. Bug is invisible if you only test at 120 BPM.

### Pitfall 5: Pulse Generator Notes in MIDI
**What goes wrong:** The pulse generator (high C7, MIDI 96, every eighth note) bleeds into the MIDI file if the recorder captures all audio events.
**Why it happens:** Pulse is scheduled in `scheduleBeat()` alongside ensemble events.
**How to avoid:** Only record events from `ensemble.tick()`. The pulse is scheduled separately (after the event loop), so it is naturally excluded if the recorder only observes the ensemble event array.

### Pitfall 6: Channel 10 Drums Conflict
**What goes wrong:** If performers map to MIDI channels by ID, performer 9 (0-indexed) hits channel 10, which is drums in General MIDI.
**Why it happens:** MIDI channel 10 is reserved for percussion.
**How to avoid:** Map by instrument type, not performer ID. Use channel 1 for synth, channel 2 for piano, channel 3 for marimba. All performers of the same instrument share a channel but each gets their own MIDI track.

## Code Examples

Verified patterns from official sources and codebase analysis:

### MidiRecorder Class
```typescript
// src/audio/midi-recorder.ts
export interface RecordedEvent {
  beatIndex: number;      // integer eighth-note count from performance start
  performerId: number;
  midi: number;           // MIDI note number
  duration: number;       // in eighth notes (integer)
  velocity: number;       // 0.3-1.0 (InTempo range)
}

export class MidiRecorder {
  private events: RecordedEvent[] = [];
  private _isRecording = false;
  private _stopBeat: number | null = null;

  start(): void {
    this.events = [];
    this._isRecording = true;
    this._stopBeat = null;
  }

  record(beatIndex: number, performerId: number, midi: number,
         duration: number, velocity: number): void {
    if (!this._isRecording) return;
    this.events.push({ beatIndex, performerId, midi, duration, velocity });
  }

  stop(currentBeat: number): RecordedEvent[] {
    this._isRecording = false;
    this._stopBeat = currentBeat;
    // Trim events beyond stop point
    return this.events.filter(e => e.beatIndex < currentBeat);
  }

  clear(): void {
    this.events = [];
    this._isRecording = false;
    this._stopBeat = null;
  }

  get isRecording(): boolean { return this._isRecording; }
  get eventCount(): number { return this.events.length; }
}
```

### MidiExporter (midi-writer-js Integration)
```typescript
// src/audio/midi-exporter.ts
// Source: https://github.com/grimmdude/MidiWriterJS (v3.1.1)
import MidiWriter from 'midi-writer-js';
import type { RecordedEvent } from './midi-recorder.ts';
import type { InstrumentType } from './types.ts';
import { assignInstrument } from './sampler.ts';

// midi-writer-js PPQ = 128 ticks per quarter note
// 1 eighth note = 64 ticks
const TICKS_PER_EIGHTH = 64;

// General MIDI program numbers (1-indexed in GM spec, 0-indexed in MIDI bytes)
// midi-writer-js ProgramChangeEvent uses 0-indexed values
const GM_PROGRAMS: Record<InstrumentType, number> = {
  piano: 0,     // Acoustic Grand Piano (GM #1)
  marimba: 12,  // Marimba (GM #13)
  synth: 88,    // Pad 1 (New Age) (GM #89) -- warm pad for sustained synth tones
};

export function exportToMidi(events: RecordedEvent[], bpm: number): Uint8Array {
  // Group events by performerId
  const byPerformer = new Map<number, RecordedEvent[]>();
  for (const evt of events) {
    const list = byPerformer.get(evt.performerId) ?? [];
    list.push(evt);
    byPerformer.set(evt.performerId, list);
  }

  const tracks: MidiWriter.Track[] = [];

  for (const [performerId, performerEvents] of byPerformer) {
    const track = new MidiWriter.Track();
    const instrument = assignInstrument(performerId);

    // Set tempo on first track only (MIDI convention)
    if (tracks.length === 0) {
      track.setTempo(bpm);
    }

    // Track name and instrument
    track.addTrackName(`Performer ${performerId + 1} (${instrument})`);
    track.addEvent(new MidiWriter.ProgramChangeEvent({
      instrument: GM_PROGRAMS[instrument],
    }));

    // Sort events by beat index
    performerEvents.sort((a, b) => a.beatIndex - b.beatIndex);

    // Convert events to NoteEvents with absolute tick positions
    for (const evt of performerEvents) {
      const startTick = evt.beatIndex * TICKS_PER_EIGHTH;
      const durationTicks = evt.duration * TICKS_PER_EIGHTH;

      // Velocity: InTempo 0.3-1.0 -> midi-writer-js 1-100
      const mwjVelocity = Math.max(1, Math.round(evt.velocity * 100));

      track.addEvent(new MidiWriter.NoteEvent({
        pitch: evt.midi,
        duration: `T${durationTicks}`,
        velocity: mwjVelocity,
        tick: startTick,
      }));
    }

    tracks.push(track);
  }

  const writer = new MidiWriter.Writer(tracks);
  return writer.buildFile();
}

export function downloadMidi(data: Uint8Array, filename: string): void {
  const blob = new Blob([data], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### Scheduler Integration (Beat Counter)
```typescript
// In Scheduler class, add:
private beatCounter: number = 0;
private midiRecorder: MidiRecorder | null = null;

// In scheduleBeat(), after existing event loop:
for (const event of events) {
  if (event.midi === 0) continue;
  // ... existing audio routing ...

  // Record for MIDI export
  if (this.midiRecorder?.isRecording) {
    this.midiRecorder.record(
      this.beatCounter,
      event.performerId,
      event.midi,
      event.duration,
      event.velocity,
    );
  }
}
this.beatCounter++;

// In start():
this.beatCounter = 0;

// In stop():
// Pass current beat to recorder for trimming
```

### Browser Download Pattern
```typescript
// Source: MDN Web API (Blob, URL.createObjectURL)
function downloadMidi(data: Uint8Array, filename: string): void {
  const blob = new Blob([data], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

## Key Technical Details

### midi-writer-js Internals (Verified from Source)
| Property | Value | Source |
|----------|-------|--------|
| PPQ (ticks per quarter) | 128 | `constants.ts`: `HEADER_CHUNK_DIVISION: [0x00, 0x80]` |
| Velocity range | 1-100 (NOT 0-127) | README + NoteEvent source |
| Default velocity | 50 | NoteEvent defaults |
| Duration `Tn` format | Direct tick count (e.g., `T64` = 64 ticks = 1 eighth) | `utils.ts`: strings starting with 't' parse as direct ticks |
| `tick` parameter | Absolute tick position for note start | NoteEvent source |
| `buildFile()` return | `Uint8Array` | Writer source |
| Multi-track | Pass array of Track objects to Writer | Writer source |
| Format | MIDI Type 1 (multi-track) when multiple tracks | `HEADER_CHUNK_FORMAT1` |

### Velocity Mapping Chain
```
computeVelocity() -> [0.3, 1.0]  (InTempo internal, clamped)
    |
    v
AgentNoteEvent.velocity -> [0.3, 1.0]
    |
    +---> Scheduler synth path: event.velocity * 0.3 (gain scaling)
    +---> Scheduler sampler path: Math.round(event.velocity * 127) (smplr 0-127)
    +---> MidiExporter: Math.max(1, Math.round(event.velocity * 100)) (midi-writer-js 1-100)
```

### General MIDI Program Numbers for InTempo Instruments
| InTempo Instrument | GM Program (1-indexed) | GM Program (0-indexed, for MIDI bytes) | GM Name |
|-------------------|----------------------|---------------------------------------|---------|
| piano | 1 | 0 | Acoustic Grand Piano |
| marimba | 13 | 12 | Marimba |
| synth | 89 | 88 | Pad 1 (New Age) |

Note: `assignInstrument(performerId)` uses `performerId % 3` to cycle through `['synth', 'piano', 'marimba']`. The instrument assignment is deterministic and stable across reset.

### Instrument-to-Channel Mapping (Avoid Channel 10)
| Instrument | MIDI Channel (1-indexed) | Rationale |
|------------|-------------------------|-----------|
| synth | 1 | Default channel |
| piano | 2 | Separate from synth |
| marimba | 3 | Separate from others |

Multiple performers sharing an instrument share the channel but get separate MIDI tracks.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Record AudioContext timestamps, convert to ticks | Integer beat counter, convert directly | Best practice | Eliminates timing drift |
| One channel per performer | One channel per instrument type | Best practice | Avoids channel 10 drums, stays under 16 channels |
| Build MIDI incrementally | Store events, convert on export | Best practice | Simpler, no corruption risk |

## Open Questions

1. **BPM changes during performance**
   - What we know: `setBpm()` can change BPM mid-performance (clamped 100-180). MIDI needs tempo meta-events at the tick where BPM changed.
   - What's unclear: Does the current UI allow BPM changes during playback? The slider exists but it's unclear if it's enabled during playback.
   - Recommendation: For v1, record BPM at performance start only. If BPM changes mid-performance, note that this is a known limitation. The beat counter approach still works (beats are correct, only tempo interpretation changes). Add BPM change recording as a follow-up.

2. **Export during playback vs. after stop**
   - What we know: MIDI-01 requires "at any point (during or after playback)." Exporting during playback means the file captures everything up to the export moment.
   - Recommendation: Allow export at any time. During playback, export a snapshot of events recorded so far (copy the array, don't stop recording). After stop, export all events up to the stop beat.

3. **Filename convention**
   - Recommendation: `intempo-{mode}-{bpm}bpm-{timestamp}.mid` (e.g., `intempo-riley-120bpm-20260215-143022.mid`)

## Sources

### Primary (HIGH confidence)
- [midi-writer-js GitHub](https://github.com/grimmdude/MidiWriterJS) - API docs, NoteEvent velocity (1-100), PPQ (128), Tn duration format, ProgramChangeEvent
- [midi-writer-js constants.ts source](https://raw.githubusercontent.com/grimmdude/MidiWriterJS/master/src/constants.ts) - Verified PPQ=128, version 3.1.1
- [midi-writer-js utils.ts source](https://raw.githubusercontent.com/grimmdude/MidiWriterJS/master/src/utils.ts) - Verified Tn duration parsing
- [midi-writer-js writer.ts source](https://raw.githubusercontent.com/grimmdude/MidiWriterJS/master/src/writer.ts) - Verified buildFile() returns Uint8Array, multi-track support
- [midi-writer-js program-change-event.ts source](https://raw.githubusercontent.com/grimmdude/MidiWriterJS/master/src/midi-events/program-change-event.ts) - Verified instrument parameter handling
- Existing codebase: `src/score/ensemble.ts` (AgentNoteEvent with velocity), `src/audio/scheduler.ts` (scheduleBeat flow), `src/audio/sampler.ts` (assignInstrument), `src/audio/engine.ts` (facade API)
- [General MIDI Instrument List](https://soundprogramming.net/file-formats/general-midi-instrument-list/) - Program numbers for piano (1), marimba (13), synth pads (89+)

### Secondary (MEDIUM confidence)
- Prior project research: `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md` - Comprehensive MIDI export analysis from project inception
- [MDN Blob API](https://developer.mozilla.org/en-US/docs/Web/API/Blob) - Browser download pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - midi-writer-js v3.1.1 verified from source, API confirmed
- Architecture: HIGH - Prior project research + current codebase analysis. Velocity pipeline already complete from Phase 5.
- Pitfalls: HIGH - Comprehensive pitfall analysis from prior research, verified against current codebase state

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable domain, midi-writer-js unlikely to change)
