# Architecture Patterns: MIDI Export & Velocity Humanization

**Domain:** Integration of MIDI recording/export and velocity humanization into existing generative performance engine
**Researched:** 2026-02-15
**Confidence:** HIGH (based on direct codebase analysis + verified library APIs)

## Existing Architecture Summary

```
AudioEngine (facade)
  |-- AudioContext
  |-- Ensemble (score/ensemble.ts)
  |   |-- PerformerAgent[] (weighted decision logic)
  |   `-- tick() -> AgentNoteEvent[] { performerId, midi, duration }
  |-- Scheduler (audio/scheduler.ts)
  |   |-- lookahead tick loop (25ms timer, 100ms window)
  |   |-- scheduleBeat() polls Ensemble, routes to VoicePool or SamplePlayer
  |   `-- advanceTime() increments by one eighth note
  |-- VoicePool (audio/voice-pool.ts)
  |   |-- AudioWorkletNode[] (synth-processor.js)
  |   `-- claim/release with voice stealing
  |-- SamplePlayer (audio/sampler.ts)
  |   |-- SplendidGrandPiano (smplr)
  |   `-- Soundfont marimba (smplr)
  `-- PulseGenerator (audio/pulse.ts)
```

**Key data flow today:** Scheduler.scheduleBeat() calls ensemble.tick() which returns AgentNoteEvent[]. Each event has `{ performerId, midi, duration }`. The scheduler routes events to either VoicePool (synth) or SamplePlayer (piano/marimba) based on `assignInstrument(performerId)`. Neither event type currently carries velocity.

## Recommended Architecture for New Features

### Component Boundaries

| Component | Status | Responsibility | Communicates With |
|-----------|--------|---------------|-------------------|
| `VelocityHumanizer` | **NEW** `src/audio/velocity.ts` | Generate per-note velocity values with musical humanization curves | Called by Scheduler during scheduleBeat |
| `MidiRecorder` | **NEW** `src/audio/midi-recorder.ts` | Accumulate timestamped MIDI events during performance | Fed by Scheduler, read by MidiExporter |
| `MidiExporter` | **NEW** `src/audio/midi-exporter.ts` | Convert recorded events to Standard MIDI File via midi-writer-js | Reads from MidiRecorder, triggered by AudioEngine |
| `AgentNoteEvent` | **MODIFY** `src/score/ensemble.ts` | Add `velocity` field to event interface | Produced by Ensemble, consumed by Scheduler |
| `Scheduler` | **MODIFY** `src/audio/scheduler.ts` | Apply velocity to audio routing, feed events to MidiRecorder | Reads velocity from events, writes to MidiRecorder |
| `SamplePlayer` | **MODIFY** `src/audio/sampler.ts` | Accept and pass velocity to smplr `.start()` | Receives velocity from Scheduler |
| `synth-processor.js` | **MODIFY** `public/synth-processor.js` | Accept velocity in noteOn message, scale maxGain | Receives velocity via port.postMessage |
| `AudioEngine` | **MODIFY** `src/audio/engine.ts` | Expose recording controls and export trigger | Owns MidiRecorder, delegates to MidiExporter |

### Architecture Diagram

```
                  Ensemble.tick()
                       |
                       v
              AgentNoteEvent[] (now includes velocity)
                       |
            +----------+----------+
            |                     |
            v                     v
    VelocityHumanizer      MidiRecorder.record()
    (enrich velocity)       (accumulate events)
            |                     |
            v                     |
    Scheduler.scheduleBeat()      |
     |          |                 |
     v          v                 v
  VoicePool  SamplePlayer   MidiExporter.export()
  (velocity   (velocity      (on stop/export)
   in noteOn)  in .start())
```

## Integration Point 1: Velocity Humanization

### Where Velocity Originates

**Decision: Velocity is generated at the Ensemble/Agent level, not the Scheduler level.**

Rationale: Velocity is a musical decision, not an audio-routing decision. Each PerformerAgent already has a `personality` with biases. Velocity should follow the same pattern -- each agent generates its own velocity influenced by its personality and the current musical context.

### VelocityHumanizer Design

```typescript
// src/audio/velocity.ts

/** Velocity value 1-127 (MIDI standard) */
export type Velocity = number;

export interface VelocityProfile {
  baseVelocity: number;      // 60-100, center point for this performer
  variance: number;           // 5-20, random spread around base
  accentStrength: number;     // 0.1-0.3, how much louder accented beats are
  fadeInBeats: number;        // 4-16, gradual entry (start soft, ramp up)
}

export function generateVelocityProfile(): VelocityProfile {
  return {
    baseVelocity: 70 + Math.floor(Math.random() * 30),  // 70-100
    variance: 5 + Math.floor(Math.random() * 15),         // 5-20
    accentStrength: 0.1 + Math.random() * 0.2,            // 0.1-0.3
    fadeInBeats: 4 + Math.floor(Math.random() * 12),       // 4-16
  };
}

/**
 * Compute velocity for a single note event.
 *
 * Factors:
 * 1. Base velocity from performer profile
 * 2. Gaussian-ish random variance (humanization)
 * 3. Metric accent: downbeats (beat 0, 4) get boosted
 * 4. Fade-in on entry/rejoin
 * 5. Density scaling: quieter when ensemble is dense
 */
export function computeVelocity(
  profile: VelocityProfile,
  beatIndex: number,
  beatsSinceEntry: number,
  ensembleDensity: number,
): Velocity {
  // 1. Base
  let vel = profile.baseVelocity;

  // 2. Humanization variance (approximated normal distribution via sum of 3 randoms)
  const noise = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2;
  vel += noise * profile.variance;

  // 3. Metric accent (every 4th eighth note = quarter note downbeat)
  if (beatIndex % 4 === 0) {
    vel += vel * profile.accentStrength;
  }
  // Stronger accent on beat 0 of bar (every 8th eighth note)
  if (beatIndex % 8 === 0) {
    vel += vel * profile.accentStrength * 0.5;
  }

  // 4. Fade-in after entry/rejoin
  if (beatsSinceEntry < profile.fadeInBeats) {
    const fadeRatio = beatsSinceEntry / profile.fadeInBeats;
    vel *= 0.4 + 0.6 * fadeRatio; // start at 40%, ramp to 100%
  }

  // 5. Density scaling: softer when crowded
  if (ensembleDensity > 0.7) {
    vel *= 1.0 - (ensembleDensity - 0.7) * 0.5; // up to 15% reduction at full density
  }

  return Math.max(1, Math.min(127, Math.round(vel)));
}
```

### Integration with AgentNoteEvent

**MODIFY** `AgentNoteEvent` in `src/score/ensemble.ts`:

```typescript
export interface AgentNoteEvent {
  performerId: number;
  midi: number;
  duration: number;
  velocity: number;  // NEW: 1-127 MIDI velocity
}
```

**MODIFY** `PerformerAgent.tick()` to compute and include velocity:

The agent already tracks `beatsSinceLastDropout` which can approximate "beats since entry." The `VelocityProfile` should be added alongside `AgentPersonality` -- generated once at agent creation, stored on agent state.

### Velocity Propagation Through Audio

**VoicePool path (synth):**

Currently in `scheduler.ts` line 177:
```typescript
voice.node.port.postMessage({ type: 'noteOn', frequency, time });
```

Change to:
```typescript
voice.node.port.postMessage({ type: 'noteOn', frequency, time, velocity: event.velocity });
```

In `synth-processor.js`, the `maxGain` field (currently hardcoded 0.3) becomes dynamic:
```javascript
// In noteOn handler:
this.maxGain = 0.3 * (data.velocity / 100); // scale 0.3 by normalized velocity
```

**SamplePlayer path (piano/marimba):**

Currently in `sampler.ts` line 67:
```typescript
target.start({ note: midi, time, duration });
```

The smplr `SampleStart` type already accepts `velocity?: number` (0-127 range, verified from smplr type definitions). Change to:
```typescript
target.start({ note: midi, time, duration, velocity });
```

**This is the lowest-friction integration point in the entire system.** The smplr library natively supports velocity and will adjust both volume and timbre (piano samples have velocity layers). The synth processor needs a small modification but the change is isolated.

**PulseGenerator:** No velocity change needed. The pulse is a fixed reference signal.

## Integration Point 2: MIDI Event Recording

### Where Recording Should Happen

**Decision: Record in Scheduler.scheduleBeat(), NOT at the Engine level or Ensemble level.**

Rationale:
- **Not Ensemble level:** Ensemble produces abstract note events without timing information. It does not know about AudioContext time or BPM.
- **Not Engine level:** Engine is a facade with no visibility into individual beat scheduling.
- **Scheduler level:** This is where we have (a) the note events from Ensemble, (b) the precise AudioContext timestamp, (c) the current BPM, and (d) velocity. This is the single point where all MIDI-relevant data converges.

### MidiRecorder Design

```typescript
// src/audio/midi-recorder.ts

export interface RecordedMidiEvent {
  /** Absolute time in seconds from performance start */
  time: number;
  /** MIDI note number */
  midi: number;
  /** Duration in seconds */
  durationSeconds: number;
  /** MIDI velocity 1-127 */
  velocity: number;
  /** Performer ID (maps to MIDI track) */
  performerId: number;
  /** Instrument type for track metadata */
  instrument: InstrumentType;
}

export class MidiRecorder {
  private events: RecordedMidiEvent[] = [];
  private startTime: number = 0;
  private _recording: boolean = false;

  /** Begin recording. Call with AudioContext.currentTime at performance start. */
  start(audioContextTime: number): void {
    this.events = [];
    this.startTime = audioContextTime;
    this._recording = true;
  }

  /** Record a single note event. */
  record(
    time: number,
    midi: number,
    durationSeconds: number,
    velocity: number,
    performerId: number,
    instrument: InstrumentType,
  ): void {
    if (!this._recording) return;
    this.events.push({
      time: time - this.startTime,  // normalize to 0-based
      midi,
      durationSeconds,
      velocity,
      performerId,
      instrument,
    });
  }

  /** Stop recording and return accumulated events. */
  stop(): RecordedMidiEvent[] {
    this._recording = false;
    return [...this.events];
  }

  /** Clear all recorded events. */
  clear(): void {
    this.events = [];
    this._recording = false;
  }

  get isRecording(): boolean {
    return this._recording;
  }

  get eventCount(): number {
    return this.events.length;
  }
}
```

### Recording Hook in Scheduler

In `Scheduler.scheduleBeat()`, after the existing event routing loop, add recording:

```typescript
// Inside the for (const event of events) loop, after routing to voice/sample:
if (this.midiRecorder?.isRecording) {
  const instrument = assignInstrument(event.performerId);
  this.midiRecorder.record(
    time,
    event.midi,
    noteDurationSeconds,
    event.velocity,
    event.performerId,
    instrument,
  );
}
```

The Scheduler constructor gains a `midiRecorder` parameter (optional, injected by AudioEngine).

### MidiExporter Design

```typescript
// src/audio/midi-exporter.ts
import MidiWriter from 'midi-writer-js';

export function exportToMidi(
  events: RecordedMidiEvent[],
  bpm: number,
  scoreMode: ScoreMode,
): Uint8Array {
  // Group events by performerId -> one MIDI track per performer
  const byPerformer = new Map<number, RecordedMidiEvent[]>();
  for (const evt of events) {
    const list = byPerformer.get(evt.performerId) ?? [];
    list.push(evt);
    byPerformer.set(evt.performerId, list);
  }

  const tracks: MidiWriter.Track[] = [];

  for (const [performerId, performerEvents] of byPerformer) {
    const track = new MidiWriter.Track();
    track.setTempo(bpm);
    track.addTrackName(`Performer ${performerId + 1} (${performerEvents[0]?.instrument ?? 'synth'})`);

    // Sort by time
    performerEvents.sort((a, b) => a.time - b.time);

    // Convert seconds to ticks (midi-writer-js uses 'T' prefix for tick values)
    // PPQ is 128 by default in midi-writer-js
    const PPQ = 128;
    const ticksPerSecond = (bpm / 60) * PPQ;

    let lastTick = 0;
    for (const evt of performerEvents) {
      const startTick = Math.round(evt.time * ticksPerSecond);
      const durationTicks = Math.max(1, Math.round(evt.durationSeconds * ticksPerSecond));
      const waitTicks = startTick - lastTick;

      track.addEvent(new MidiWriter.NoteEvent({
        pitch: evt.midi,
        duration: `T${durationTicks}`,
        velocity: Math.round(evt.velocity * (100 / 127)), // midi-writer-js uses 1-100 scale
        wait: `T${Math.max(0, waitTicks)}`,
      }));

      lastTick = startTick + durationTicks;
    }

    tracks.push(track);
  }

  const writer = new MidiWriter.Writer(tracks);
  return writer.buildFile();
}

/** Trigger browser download of MIDI file. */
export function downloadMidi(data: Uint8Array, filename: string): void {
  const blob = new Blob([data], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

## Integration Point 3: AudioEngine Facade Changes

```typescript
// Additions to AudioEngine class

private midiRecorder: MidiRecorder | null = null;

// In initialize():
this.midiRecorder = new MidiRecorder();
// Pass to Scheduler constructor (add parameter)

// In start():
this.midiRecorder?.start(this.audioContext!.currentTime);

// In stop():
// Recording continues until explicit export or reset

// In reset():
this.midiRecorder?.clear();

// NEW public methods:
exportMidi(): void {
  const events = this.midiRecorder?.stop() ?? [];
  if (events.length === 0) return;
  const data = exportToMidi(events, this._bpm, this.currentMode);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  downloadMidi(data, `intempo-${this.currentMode}-${timestamp}.mid`);
}

get hasRecordedEvents(): boolean {
  return (this.midiRecorder?.eventCount ?? 0) > 0;
}
```

## Data Flow Summary

### Velocity Flow (per note)

```
PerformerAgent.tick()
  -> computeVelocity(profile, beatIndex, beatsSinceEntry, density)
  -> AgentNoteEvent { midi, duration, velocity }
  -> Scheduler.scheduleBeat()
     |
     +-- synth path: voice.node.port.postMessage({ ..., velocity })
     |     -> synth-processor.js: maxGain = 0.3 * (velocity / 100)
     |
     +-- sample path: samplePlayer.play(instrument, midi, time, duration, velocity)
           -> smplr .start({ note, time, duration, velocity })
```

### MIDI Recording Flow

```
Performance Start
  -> AudioEngine.start()
     -> MidiRecorder.start(audioContext.currentTime)

Each Beat
  -> Scheduler.scheduleBeat()
     -> Ensemble.tick() -> events[]
     -> for each event: route to audio AND record
        -> MidiRecorder.record(time, midi, duration, velocity, performerId, instrument)

Export Trigger (button click)
  -> AudioEngine.exportMidi()
     -> MidiRecorder.stop() -> RecordedMidiEvent[]
     -> exportToMidi(events, bpm, mode) -> Uint8Array
     -> downloadMidi(data, filename) -> browser download
```

## Patterns to Follow

### Pattern 1: Observer/Tap Pattern for Recording

**What:** MidiRecorder is a passive observer that taps into the existing event stream without modifying it. The scheduler's primary job (audio scheduling) is unaffected by whether recording is active.

**When:** Any time you need to capture data from a hot path without affecting its behavior.

**Why:** Recording must never interfere with audio timing. A single `if (recording)` guard plus an array push is negligible overhead.

### Pattern 2: Personality-Driven Parameters

**What:** Velocity profiles are generated alongside agent personalities at creation time, following the exact same pattern as `AgentPersonality`.

**When:** Adding any new per-performer musical parameter.

**Why:** The existing personality system works well. Velocity is another dimension of musical personality. Keep it consistent.

### Pattern 3: Normalized Velocity Convention

**What:** Use MIDI standard 1-127 internally everywhere. Convert to library-specific ranges only at output boundaries (midi-writer-js uses 1-100, synth-processor uses 0-1 gain scaling).

**When:** Any velocity value crosses a component boundary.

**Why:** Single internal convention prevents confusion. Conversion happens exactly once at each output point.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Recording at the Wrong Level

**What:** Recording MIDI events in the Ensemble or inside PerformerAgent.

**Why bad:** Ensemble has no concept of real time (only beat indices). Agent events lack timing, BPM context, and instrument assignment. You would need to reconstruct timing later, which is error-prone and duplicates logic already in Scheduler.

**Instead:** Record in Scheduler.scheduleBeat() where all data converges.

### Anti-Pattern 2: Velocity as Post-Processing

**What:** Generating flat velocity in agents and applying humanization as a transform in the Scheduler or audio layer.

**Why bad:** Velocity is a musical decision tied to performer personality. Separating it from the agent makes it harder to have personality-driven dynamics. It also means the recorded MIDI would have flat velocity unless you add a separate humanization pass.

**Instead:** Generate velocity at the agent level so it flows naturally through both audio and recording paths.

### Anti-Pattern 3: Global Velocity Scaling via Master Gain

**What:** Implementing velocity by adjusting VoicePool's masterGain or SamplePlayer's masterGain.

**Why bad:** Master gain affects ALL voices simultaneously. Velocity must be per-note. The VoicePool masterGain exists for anti-clipping normalization, not dynamics.

**Instead:** Per-voice gain scaling (synth-processor maxGain) and per-note smplr velocity parameter.

### Anti-Pattern 4: Storing MIDI Events as MIDI File Format During Recording

**What:** Building MIDI file structures (tracks, delta times) incrementally during recording.

**Why bad:** MIDI file format uses delta times that require knowing the previous event. Insertions/removals during recording would corrupt the structure. Much simpler to store absolute-time events and convert to MIDI format on export.

**Instead:** Record simple timestamped events. Convert to MIDI file format only at export time.

## Suggested Build Order

Build order is dictated by the dependency chain:

### Step 1: Velocity Humanization (no external dependencies)

1. Create `VelocityProfile` type and `generateVelocityProfile()` in `src/audio/velocity.ts`
2. Create `computeVelocity()` function
3. Add `velocity` field to `AgentNoteEvent` interface
4. Add `VelocityProfile` to agent state, generate in constructor
5. Call `computeVelocity()` in `PerformerAgent.tick()`, include in returned event
6. Write unit tests for velocity computation

**Why first:** Zero external dependencies. Changes are additive to existing types. The velocity field on `AgentNoteEvent` is needed by both audio propagation and MIDI recording.

### Step 2: Velocity Propagation Through Audio

1. Modify `synth-processor.js` to accept velocity in noteOn message, scale gain
2. Modify `Scheduler.scheduleBeat()` to pass `event.velocity` to voice.node.port.postMessage
3. Modify `SamplePlayer.play()` to accept and forward velocity parameter
4. Update Scheduler's sample path to pass velocity

**Why second:** Depends on Step 1 (velocity values exist). Makes velocity audible immediately for testing/validation.

### Step 3: MIDI Recording Infrastructure

1. Create `MidiRecorder` class in `src/audio/midi-recorder.ts`
2. Inject MidiRecorder into Scheduler (add constructor parameter)
3. Add recording calls in `Scheduler.scheduleBeat()`
4. Wire up in AudioEngine: create recorder, start on play, clear on reset

**Why third:** Depends on Step 1 (velocity in events). Independent of Step 2 (recording does not need audio to work).

### Step 4: MIDI Export

1. Install `midi-writer-js` dependency
2. Create `MidiExporter` in `src/audio/midi-exporter.ts`
3. Add `exportMidi()` method to AudioEngine
4. Add export button to UI

**Why last:** Depends on Step 3 (recorded events exist). This is the user-facing output.

### Step 5 (parallel with 4): Default 4 Performers

1. Change `initialPerformerCount` from 8 to 4 in AudioEngine
2. Verify VoicePool sizing, UI layout adjustments

**Why:** Trivially independent. One-line change plus verification.

## Files Modified vs Created

| File | Action | Changes |
|------|--------|---------|
| `src/audio/velocity.ts` | CREATE | VelocityProfile, generateVelocityProfile, computeVelocity |
| `src/audio/midi-recorder.ts` | CREATE | MidiRecorder class |
| `src/audio/midi-exporter.ts` | CREATE | exportToMidi, downloadMidi functions |
| `src/score/ensemble.ts` | MODIFY | Add velocity to AgentNoteEvent, VelocityProfile to agent state |
| `src/audio/scheduler.ts` | MODIFY | Pass velocity to audio, feed MidiRecorder |
| `src/audio/sampler.ts` | MODIFY | Accept velocity param in play(), forward to smplr |
| `src/audio/engine.ts` | MODIFY | Own MidiRecorder, expose exportMidi(), change default count |
| `src/audio/types.ts` | MODIFY | Add velocity to relevant interfaces if needed |
| `public/synth-processor.js` | MODIFY | Accept velocity in noteOn, scale maxGain |
| `package.json` | MODIFY | Add midi-writer-js dependency |

## Scalability Considerations

| Concern | Current (8 performers, ~5 min) | 16 performers, 20 min | Notes |
|---------|-------------------------------|----------------------|-------|
| MidiRecorder memory | ~2K events, ~100KB | ~16K events, ~800KB | Array of plain objects. No concern. |
| MIDI export time | <50ms | <200ms | midi-writer-js builds in memory. Negligible. |
| Velocity computation | 8 calls per beat | 16 calls per beat | Pure math, no allocations. Negligible. |
| MIDI file size | ~20KB | ~150KB | Standard MIDI files are tiny. |

## Sources

- [MidiWriterJS GitHub](https://github.com/grimmdude/MidiWriterJS) - v3.1.1, TypeScript support, NoteEvent velocity 1-100, Writer.buildFile() returns Uint8Array (HIGH confidence)
- smplr type definitions at `node_modules/smplr/dist/index.d.ts` - SampleStart accepts `velocity?: number` (0-127 range) (HIGH confidence, verified from actual types)
- synth-processor.js at `public/synth-processor.js` - maxGain hardcoded 0.3, noteOn accepts frequency+time (HIGH confidence, verified from source)
- Existing architecture verified from direct codebase analysis of engine.ts, scheduler.ts, ensemble.ts, voice-pool.ts, sampler.ts (HIGH confidence)
