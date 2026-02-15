# Technology Stack: MIDI Export & Velocity Humanization

**Project:** InTempo -- Browser-Based Generative Performance Engine
**Researched:** 2026-02-15
**Scope:** New capabilities only -- MIDI file export, velocity humanization, default 4 performers

## Existing Stack (validated, not re-researched)

React 19 + Vite 7 + TypeScript 5.9 + Tailwind CSS v4 + shadcn/ui, Web Audio API with AudioWorklet, smplr ^0.16.4 for sampled instruments (SplendidGrandPiano + Soundfont marimba), lookahead scheduler with eighth-note beat clock, VoicePool with voice stealing, Ensemble AI with PerformerAgent weighted decisions.

---

## New Dependencies

### MIDI File Generation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| midi-writer-js | ^3.1.1 | Generate Standard MIDI File (.mid) for export | Purpose-built for MIDI file *writing* (not parsing). Clean API: Track, NoteEvent with velocity/pitch/duration, Writer outputs Uint8Array. Zero dependencies. TypeScript source (compiled from TS). Browser-native, no Node.js polyfills needed. | HIGH |

#### Why midi-writer-js over alternatives

**@tonejs/midi (rejected):** Bidirectional read/write library. InTempo only needs write. @tonejs/midi depends on `midi-file` internally, adding unnecessary parsing code. Its API is time-based (seconds) rather than musical (beats/ticks), requiring manual tempo-to-time conversion. midi-writer-js speaks in musical durations natively (`'8'` for eighth note, `'4'` for quarter) which maps directly to InTempo's eighth-note beat clock.

**jsmidgen (rejected):** Unmaintained (last commit 2018). No TypeScript types. String-based output requires conversion.

**JZZ.js (rejected):** Full MIDI stack (hardware I/O, Web MIDI API, real-time). Massive overkill for file generation. ~100KB+ bundle.

**Raw MIDI binary (rejected):** SMF is a well-specified binary format but writing it manually means reimplementing chunk headers, variable-length quantities, running status, and track termination. midi-writer-js is ~15KB and handles all of this correctly. Not worth hand-rolling.

#### midi-writer-js API mapping to InTempo

```typescript
import MidiWriter from 'midi-writer-js';

// One Track per performer (maps to PerformerAgent)
const track = new MidiWriter.Track();
track.setTempo(120); // from scheduler._bpm

// NoteEvent maps directly from AgentNoteEvent
new MidiWriter.NoteEvent({
  pitch: 60,           // from event.midi (MIDI note number)
  duration: 'd8',      // 'd8' = dotted eighth, '8' = eighth note
  velocity: 80,        // from humanized velocity (1-100 range)
  channel: 1,          // performer channel assignment
});

// Export: Writer accepts array of tracks (multi-track Type 1 MIDI)
const writer = new MidiWriter.Writer([track1, track2, track3, track4]);
const blob = new Blob([writer.buildFile()], { type: 'audio/midi' });
```

**Key detail:** midi-writer-js velocity range is 1-100 (not 0-127). The library internally scales to MIDI's 0-127 range. This is a design choice, not a bug. Map InTempo's 0-127 velocity to 1-100 via `Math.round(velocity * 100 / 127)`.

### No Other New Dependencies Required

Velocity humanization and the default-4-performers change require zero new libraries. Both are algorithmic changes to existing code.

---

## Integration Points with Existing Code

### 1. Velocity: AgentNoteEvent needs a `velocity` field

**Current state:** `AgentNoteEvent` has `{ performerId, midi, duration }`. No velocity.

**Change:** Add `velocity: number` (0-127, MIDI standard) to `AgentNoteEvent` in `src/audio/types.ts`.

**Upstream (Ensemble/PerformerAgent):** The `PerformerAgent.tick()` method returns `AgentNoteEvent`. Velocity must be computed here, per-performer, using the humanization algorithm. Each performer's `AgentPersonality` should gain a `velocityBias` and `velocityVariance` to create per-performer dynamic character.

**Downstream consumers that must handle velocity:**

| Consumer | File | Current | Change Needed |
|----------|------|---------|---------------|
| Scheduler (synth path) | `src/audio/scheduler.ts` | Posts `{ type: 'noteOn', frequency, time }` to AudioWorkletNode | Add `velocity` to the message: `{ type: 'noteOn', frequency, time, velocity }` |
| SynthProcessor | `public/synth-processor.js` | `this.maxGain = 0.3` fixed | Scale `maxGain` by velocity: `this.noteGain = (velocity / 127) * 0.3` |
| Scheduler (sampler path) | `src/audio/scheduler.ts` | Calls `samplePlayer.play(instrument, midi, time, duration)` | Add velocity parameter |
| SamplePlayer | `src/audio/sampler.ts` | `target.start({ note: midi, time, duration })` | Add velocity: `target.start({ note: midi, time, duration, velocity })` -- smplr already supports velocity 0-127 natively |
| MIDI Recorder (new) | New file | N/A | Records AgentNoteEvents with velocity for export |

### 2. MIDI Export: Event Recording Architecture

**Where to tap:** The Scheduler's `scheduleBeat()` method is the single point where all performer note events flow. This is where a MIDI recorder should observe events.

**Pattern:** Observer/tap on `scheduleBeat()`. The recorder accumulates events with timestamps relative to performance start. On export, it converts to midi-writer-js Track/NoteEvent objects.

```
Ensemble.tick() -> AgentNoteEvent[] -> Scheduler.scheduleBeat()
                                         |
                                         +-> Audio playback (existing)
                                         +-> MidiRecorder.record() (new)
```

**Timestamp strategy:** Record `beatIndex` (integer eighth-note count from performance start), not `AudioContext.currentTime`. Beat-based timestamps convert cleanly to MIDI ticks. Time-based timestamps require reverse-engineering BPM, which breaks if BPM changes during performance.

### 3. Default 4 Performers

**Current:** `AudioEngine.initialPerformerCount = 8`

**Change:** Set to `4`. One-line change in `src/audio/engine.ts`. VoicePool size follows (`performerCount * 2`), so 8 voices instead of 16. This is a tuning change, not an architectural one.

---

## Velocity Humanization Algorithm (No Library Needed)

Build this in-house. It is 30-50 lines of TypeScript, not a library problem.

### Approach: Layered velocity with per-performer personality

```typescript
function computeVelocity(
  baseVelocity: number,     // 80 (mf) default
  beatPosition: number,     // 0-based eighth note within pattern
  patternLength: number,    // total eighth notes in pattern
  personality: AgentPersonality,
): number {
  // Layer 1: Metric accent (downbeats louder)
  const metricAccent = beatPosition % 4 === 0 ? 12
                     : beatPosition % 2 === 0 ? 6
                     : 0;

  // Layer 2: Per-performer bias (some play louder/softer)
  const personalBias = (personality.velocityBias - 1.0) * 20; // +/- 4

  // Layer 3: Random jitter (humanization)
  const jitter = (Math.random() - 0.5) * personality.velocityVariance * 2;

  // Layer 4: Phrase shaping (slight crescendo/decrescendo across pattern)
  const phrasePosition = beatPosition / Math.max(1, patternLength - 1);
  const phraseShape = Math.sin(phrasePosition * Math.PI) * 8; // arc shape

  return Math.max(30, Math.min(127,
    Math.round(baseVelocity + metricAccent + personalBias + jitter + phraseShape)
  ));
}
```

### Personality Extensions

Add to `AgentPersonality` in `src/score/ensemble.ts`:

```typescript
velocityBias: number;     // 0.8-1.2 (some performers naturally louder/softer)
velocityVariance: number; // 5-20 (amount of random jitter in velocity)
```

Generate in `generatePersonality()`:

```typescript
velocityBias: randomInRange(0.8, 1.2),
velocityVariance: randomInRange(5, 20),
```

---

## What NOT to Add

| Temptation | Why Avoid |
|------------|-----------|
| Tone.js for MIDI | Already rejected in Phase 1. MIDI export is file generation, not audio. |
| @tonejs/midi | Bidirectional when we only write. midi-writer-js is leaner and speaks musical durations. |
| Web MIDI API | For hardware MIDI I/O (controllers, synths). InTempo exports files, not real-time MIDI streams. |
| ML-based humanization (midihum) | Python-only, 400 features, trained on piano competition data. Extreme overkill for a generative art piece. Simple layered velocity is musically appropriate for In C's minimalist aesthetic. |
| file-saver.js | `URL.createObjectURL()` + `<a download>` is 5 lines. No library needed for browser file download. |
| Zustand | Already not in the project (state flows via AudioEngine callbacks). Do not add for MIDI recording state -- keep it in the engine layer. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| MIDI generation | midi-writer-js | @tonejs/midi | Write-only need; midi-writer-js has musical duration API matching InTempo's beat model |
| MIDI generation | midi-writer-js | Raw binary | SMF format is well-specified but fiddly (VLQ encoding, chunk headers). 15KB lib saves debugging time. |
| MIDI generation | midi-writer-js | jsmidgen | Unmaintained since 2018, no TypeScript |
| Humanization | Custom algorithm | midihum ML | Python-only, extreme overkill for minimalist generative music |
| Humanization | Custom algorithm | Random velocity only | Sounds mechanical. Metric accents + phrase shaping + personality make it musical. |
| File download | Native Blob + URL API | file-saver.js | 5 lines of native code, no dependency warranted |

---

## Installation

```bash
# Single new dependency
npm install midi-writer-js

# That's it. Everything else is algorithmic changes to existing code.
```

---

## Sources

- [MidiWriterJS GitHub](https://github.com/grimmdude/MidiWriterJS) -- API documentation, NoteEvent options (velocity 1-100), Writer.buildFile() -> Uint8Array
- [MidiWriterJS npm](https://www.npmjs.com/package/midi-writer-js) -- v3.1.1 latest, weekly downloads ~1.5K
- [@tonejs/midi GitHub](https://github.com/Tonejs/Midi) -- Evaluated and rejected; bidirectional read/write, time-based API
- [smplr GitHub](https://github.com/danigb/smplr) -- Confirmed velocity support in start() method, 0-127 range
- Existing codebase analysis: `src/audio/scheduler.ts`, `src/audio/voice-pool.ts`, `src/audio/engine.ts`, `src/score/ensemble.ts`, `public/synth-processor.js`
- MIDI specification -- Standard velocity range 0-127, SMF Type 1 for multi-track
