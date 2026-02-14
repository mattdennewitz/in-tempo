# Phase 1: Audio Engine + Score Foundation - Research

**Researched:** 2026-02-14
**Domain:** Web Audio API scheduling, synthesis, React/TypeScript/Vite
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Transport & tempo behavior
- **Stop:** Let the currently playing note finish ringing out, then silence
- **Reset:** Stop playback and move performer back to pattern 1 (user must click Start again)
- **BPM change:** Takes effect on the next note (no smooth ramping)
- **BPM range:** 100-180 BPM (tight range honoring In C's intended tempo)

#### Performance flow
- **Pattern advancement:** Random number of repetitions per pattern (e.g. 2-8), then advance to the next
- **Rests:** Occasional brief silences between some patterns for breathing room
- **End behavior:** Auto-stop when pattern 53 is complete -- audio stops, transport resets to stopped state
- **Pattern display:** Show current pattern number only (e.g. "Pattern 17 of 53") -- no progress bar

#### Minimal UI layout
- **Level of polish:** Simple but presentable -- clean layout with basic styling, not the final design but not ugly
- **Framework:** React + TypeScript with Vite
- **Transport controls:** Start / Stop / Reset in a centered horizontal row, BPM slider below
- **BPM control:** Horizontal slider with current value displayed, range 100-180
- **Page chrome:** No header/title -- just transport controls and pattern info, centered on page
- **Theme:** Light background (Phase 3 will apply the final salmon/cream/navy palette)

### Claude's Discretion
- Synth voice character and timbre (warm, bright, etc.)
- Whether to add a subtle visual beat indicator while playing (low-effort only)
- Exact spacing, typography, and button styling
- Loading and error states
- Exact repetition range per pattern (within the "random 2-8" spirit)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Summary

This phase builds the audio engine for a single-performer playback of Terry Riley's "In C" -- 53 short melodic patterns played sequentially with random repetitions, controlled by Start/Stop/Reset transport and BPM slider. The core technical challenge is rock-solid audio timing using the Web Audio API's lookahead scheduling pattern (Chris Wilson's "Two Clocks" approach), combined with an AudioWorklet-based synthesizer to keep synthesis fully off the main thread.

The stack is straightforward: React 19 + TypeScript + Vite for the UI shell, with the audio engine as a standalone TypeScript module that communicates with React via a thin API. The score data (all 53 patterns encoded as pitch/duration arrays) is a static data file hand-transcribed from Riley's published score. The key architectural decision is clean separation between the scheduling layer (main thread, setTimeout-based lookahead), the synthesis layer (AudioWorklet on audio thread), and the React UI layer.

**Primary recommendation:** Build a lookahead scheduler that sends note events to an AudioWorklet-based synth processor via MessagePort, with the React UI as a thin control surface. Keep audio engine completely framework-agnostic.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2 | UI framework | Locked decision from CONTEXT.md |
| TypeScript | ^5.7 | Type safety | Locked decision (React + TypeScript) |
| Vite | ^7.3 | Build tool + dev server | Locked decision (Vite), latest stable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | -- | -- | No additional libraries needed for Phase 1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw Web Audio API | Tone.js | Tone.js provides scheduling + synths out of the box, but adds ~150KB, its Transport uses a different scheduling model than required, and AUD-07 requires AudioWorklet synthesis which Tone.js does not use for its built-in synths. Raw Web Audio gives full control over the AudioWorklet requirement. |
| Hand-coded AudioWorklet | Pre-built synth library | The synthesis needs are simple (single oscillator + envelope), so a custom AudioWorklet is small and avoids dependency overhead. |

**Installation:**
```bash
npm create vite@latest intempo -- --template react-ts
cd intempo
npm install
```

No additional audio dependencies needed -- Web Audio API is a browser built-in.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── audio/
│   ├── engine.ts           # AudioEngine class (context, worklet loading, scheduling)
│   ├── scheduler.ts        # Lookahead scheduler (Two Clocks pattern)
│   ├── worklet/
│   │   └── synth-processor.ts  # AudioWorkletProcessor (runs on audio thread)
│   └── types.ts            # Shared audio types (NoteEvent, SchedulerState, etc.)
├── score/
│   ├── patterns.ts         # All 53 In C patterns as typed data
│   └── performer.ts        # Single performer logic (pattern advancement, repetitions)
├── components/
│   ├── Transport.tsx        # Start/Stop/Reset buttons
│   ├── BpmSlider.tsx        # BPM control slider
│   └── PatternDisplay.tsx   # "Pattern N of 53" display
├── App.tsx                  # Main layout, wires audio engine to UI
└── main.tsx                 # Vite entry point
```

### Pattern 1: Lookahead Scheduler (Chris Wilson "Two Clocks")

**What:** A setTimeout loop on the main thread checks `AudioContext.currentTime` and schedules upcoming notes within a lookahead window. The audio events themselves execute with sample-accurate timing on the audio thread.

**When to use:** Always, for any musically-timed Web Audio application. This is the canonical pattern.

**Key parameters:**
- `scheduleAheadTime`: 100ms (how far ahead to schedule)
- `timerInterval`: 25ms (how often the setTimeout fires)
- The overlap (100ms window, 25ms interval) ensures notes are always scheduled even if the main thread hiccups

**Example:**
```typescript
// Source: https://web.dev/articles/audio-scheduling
class Scheduler {
  private audioContext: AudioContext;
  private nextNoteTime: number = 0;
  private scheduleAheadTime: number = 0.1; // seconds
  private timerInterval: number = 25; // milliseconds
  private timerId: number | null = null;

  start() {
    this.nextNoteTime = this.audioContext.currentTime;
    this.tick();
  }

  private tick = () => {
    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.nextNoteTime);
      this.advanceNote();
    }
    this.timerId = window.setTimeout(this.tick, this.timerInterval);
  };

  private advanceNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    // Duration depends on the current note in the current pattern
    this.nextNoteTime += this.currentNoteDuration * secondsPerBeat;
  }
}
```

### Pattern 2: AudioWorklet Synth Processor

**What:** An AudioWorkletProcessor running on the audio thread generates sound samples. The main thread sends note-on/note-off messages via MessagePort. The processor maintains its own oscillator state and ADSR envelope.

**When to use:** Required by AUD-07. Keeps synthesis completely off the main thread, preventing UI jank from affecting audio and vice versa.

**Example:**
```typescript
// synth-processor.ts -- runs in AudioWorklet scope
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet

class SynthProcessor extends AudioWorkletProcessor {
  private phase: number = 0;
  private frequency: number = 0;
  private envelope: number = 0;
  private playing: boolean = false;

  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 20, maxValue: 4186 },
      { name: 'gain', defaultValue: 0.3, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'noteOn') {
        this.frequency = e.data.frequency;
        this.playing = true;
        this.envelope = 1.0;
      } else if (e.data.type === 'noteOff') {
        this.playing = false;
      }
    };
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>) {
    const output = outputs[0][0]; // mono
    const gain = parameters.gain.length === 1 ? parameters.gain[0] : 0.3;

    for (let i = 0; i < output.length; i++) {
      if (this.envelope > 0.001) {
        // Simple sine oscillator
        output[i] = Math.sin(this.phase * 2 * Math.PI) * this.envelope * gain;
        this.phase += this.frequency / sampleRate;
        if (this.phase > 1) this.phase -= 1;

        // Simple decay envelope
        if (!this.playing) {
          this.envelope *= 0.9995; // ~200ms decay at 44.1kHz
        }
      } else {
        output[i] = 0;
        this.envelope = 0;
      }
    }
    return true; // Keep processor alive
  }
}

registerProcessor('synth-processor', SynthProcessor);
```

### Pattern 3: Voice Pool for Memory Safety

**What:** Instead of creating/destroying AudioWorkletNode instances per note, maintain a fixed pool of voice processors. The scheduler claims voices from the pool and releases them after the note's envelope completes.

**When to use:** Required by AUD-06. For a single performer playing monophonic patterns, a pool of 2-4 voices suffices (to handle note overlap during decay).

**Implementation approach:**
```typescript
class VoicePool {
  private voices: AudioWorkletNode[];
  private available: Set<number>;

  constructor(audioContext: AudioContext, size: number = 4) {
    this.voices = [];
    this.available = new Set();
    for (let i = 0; i < size; i++) {
      const node = new AudioWorkletNode(audioContext, 'synth-processor');
      node.connect(audioContext.destination);
      this.voices.push(node);
      this.available.add(i);
    }
  }

  claim(): { node: AudioWorkletNode; index: number } | null {
    const index = this.available.values().next().value;
    if (index === undefined) return null; // All voices busy
    this.available.delete(index);
    return { node: this.voices[index], index };
  }

  release(index: number) {
    this.available.add(index);
  }
}
```

### Pattern 4: Score Data Encoding

**What:** Riley's 53 patterns encoded as TypeScript arrays of note events. Each note has a pitch (MIDI number or note name) and duration (in eighth-note units, since the score is written in eighth notes).

**Encoding approach:**
```typescript
// Each note: [midiNote, durationInEighths] where 0 = rest
// C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71
// C5 = 72, etc.

interface ScoreNote {
  midi: number;    // MIDI note number (0 for rest)
  duration: number; // in eighth notes
}

interface Pattern {
  id: number;       // 1-53
  notes: ScoreNote[];
}

// Example: Pattern 1 is just the notes E and F (eighth notes)
// Pattern 1: [E4, F4] repeated
const PATTERNS: Pattern[] = [
  { id: 1, notes: [{ midi: 64, duration: 1 }, { midi: 65, duration: 1 }] },
  // ... all 53 patterns
];
```

**Score facts (from published score analysis):**
- 53 patterns total, fitting on a single page
- Uses 9 of 12 chromatic pitches (omits C#, Eb, Ab)
- Total written duration: 521 eighth notes
- Shortest pattern: 1 eighth note
- Longest pattern (#35): 60 pulses (eighth notes), spans 1.5 octaves
- Constant "pulse" on high C (C5 or C6) runs throughout -- but this is performed by a dedicated pulse player, not the pattern performer. For Phase 1 (single performer), the pulse is NOT played.
- Patterns must be transcribed by hand from the published score (available on IMSLP under Creative Commons)

### Pattern 5: AudioEngine Facade

**What:** A single class that owns the AudioContext, loads the worklet, creates the voice pool, and exposes a clean API for React.

```typescript
class AudioEngine {
  private audioContext: AudioContext | null = null;
  private scheduler: Scheduler | null = null;
  private voicePool: VoicePool | null = null;

  async initialize(): Promise<void> {
    this.audioContext = new AudioContext();
    await this.audioContext.audioWorklet.addModule('/worklet/synth-processor.js');
    this.voicePool = new VoicePool(this.audioContext, 4);
    this.scheduler = new Scheduler(this.audioContext, this.voicePool);
  }

  async start(): Promise<void> {
    if (!this.audioContext) await this.initialize();
    if (this.audioContext!.state === 'suspended') {
      await this.audioContext!.resume();
    }
    this.scheduler!.start();
  }

  stop(): void {
    this.scheduler?.stop(); // Let current note ring out
  }

  reset(): void {
    this.scheduler?.reset(); // Stop + return to pattern 1
  }

  setBpm(bpm: number): void {
    this.scheduler?.setBpm(bpm); // Takes effect on next note
  }

  getState(): { playing: boolean; currentPattern: number; bpm: number } {
    return this.scheduler?.getState() ?? { playing: false, currentPattern: 1, bpm: 120 };
  }
}
```

### Anti-Patterns to Avoid
- **setTimeout for musical timing:** Never use setTimeout/setInterval to trigger individual notes. Use it ONLY for the lookahead scheduling loop where AudioContext.currentTime is the actual clock.
- **Creating AudioContext without user gesture:** Will be suspended. Always create or resume within a click handler.
- **Creating/destroying nodes per note:** Creates GC pressure. Use a fixed voice pool instead.
- **Putting score logic in React components:** Keep all audio/timing logic in the audio engine module. React is just a control surface.
- **Using ScriptProcessorNode:** Deprecated since 2014. Use AudioWorklet.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio timing | Custom clock/interval system | Lookahead scheduler with AudioContext.currentTime | Main-thread timers drift; AudioContext clock is hardware-backed |
| MIDI-to-frequency | Manual frequency math | Standard formula: `440 * 2^((midi-69)/12)` | Well-known formula, but use a helper function to avoid repeated calculation errors |
| ADSR envelope | Complex envelope generator | Simple attack/decay in the AudioWorkletProcessor | For Phase 1 single voice, a simple onset + decay is sufficient. Full ADSR can be added in Phase 2 if needed for ensemble variety |
| Audio autoplay handling | Custom detection logic | Check `audioContext.state === 'suspended'` then `resume()` on user gesture | Standard browser API, no library needed |

**Key insight:** The Web Audio API provides everything needed for this phase. No audio libraries are necessary. The complexity is in the scheduling pattern (well-documented) and AudioWorklet setup (well-documented), not in finding the right library.

## Common Pitfalls

### Pitfall 1: AudioWorklet Module Loading Path
**What goes wrong:** The AudioWorklet processor file must be loadable as a separate JS module via URL. Vite's build pipeline may not handle this correctly out of the box.
**Why it happens:** `audioContext.audioWorklet.addModule()` takes a URL string, not an import. Vite bundles everything by default.
**How to avoid:** Place the worklet processor file in `public/` so it's served as-is, OR use Vite's `?url` or `?worker` import suffix to get a URL to the built file. The simplest approach: put `synth-processor.js` in `public/` during development, then configure Vite to handle it for production builds.
**Warning signs:** "Failed to load module script" errors in console; `addModule()` promise rejection.

### Pitfall 2: Forgetting to Resume AudioContext
**What goes wrong:** Audio context stays suspended, no sound plays, no error thrown.
**Why it happens:** Browser autoplay policy. Context created outside user gesture starts suspended.
**How to avoid:** Always check `audioContext.state` and call `resume()` inside the Start button click handler. The AudioEngine.start() method must handle this.
**Warning signs:** Console warning "AudioContext was prevented from starting automatically."

### Pitfall 3: Lookahead Window Too Small
**What goes wrong:** Notes are scheduled late, causing audible gaps or timing jitter.
**Why it happens:** scheduleAheadTime too small (e.g., 25ms) means a single main-thread stall causes missed scheduling windows.
**How to avoid:** Use 100ms scheduleAheadTime with 25ms timer interval. This gives 4 chances to schedule each note.
**Warning signs:** Uneven timing, notes arriving late during page reflow or GC pauses.

### Pitfall 4: Lookahead Window Too Large
**What goes wrong:** BPM changes or stop commands feel laggy because notes are already scheduled 500ms+ ahead.
**Why it happens:** Overly conservative scheduleAheadTime.
**How to avoid:** 100ms is the sweet spot. User's locked decision says BPM changes take effect "on next note" which naturally fits the lookahead model.
**Warning signs:** Noticeable delay between clicking Stop and audio stopping.

### Pitfall 5: Voice Pool Exhaustion
**What goes wrong:** New notes fail to play because all voices are still in decay phase.
**Why it happens:** Pool too small, or decay time too long relative to note rate.
**How to avoid:** For single performer, 4 voices is generous. Track voice state (idle/attack/sustain/release) and steal the oldest releasing voice if pool is exhausted.
**Warning signs:** Dropped notes, especially at fast tempos.

### Pitfall 6: Memory Growth Over Long Performances
**What goes wrong:** Memory slowly grows over a 45+ minute performance until browser tab crashes.
**Why it happens:** Creating new AudioNodes without disconnecting old ones, or accumulating event data.
**How to avoid:** Fixed voice pool (no node creation/destruction during playback). No unbounded arrays of past events. Disconnect and null out nodes only on explicit reset.
**Warning signs:** DevTools Memory tab shows steady upward trend. Check with a 10-minute test run (success criterion #4).

### Pitfall 7: Worklet Message Timing
**What goes wrong:** Notes sent via MessagePort to AudioWorklet arrive late, causing timing issues.
**Why it happens:** MessagePort is asynchronous; messages are not delivered with sample accuracy.
**How to avoid:** For Phase 1, send note events slightly ahead of time (the lookahead scheduler already does this). The worklet processor should start playing the note immediately upon receiving the message. For more precision, schedule via AudioParam automation (setValueAtTime) rather than MessagePort messages. A hybrid approach: use MessagePort for note-on triggers but AudioParam for timing-critical frequency changes.
**Warning signs:** Notes consistently late by 3-10ms; subtle "flamming" effect.

### Pitfall 8: Vite + TypeScript for AudioWorklet Files
**What goes wrong:** TypeScript worklet files don't compile correctly or lack proper type definitions.
**Why it happens:** AudioWorklet processor files run in a separate global scope (AudioWorkletGlobalScope) with different APIs than window/worker scope. TypeScript doesn't have built-in types for this.
**How to avoid:** Write the worklet processor as plain JavaScript (`.js`) in `public/`, or add a custom `.d.ts` file for `AudioWorkletGlobalScope` types (`registerProcessor`, `sampleRate`, `currentTime`, `currentFrame`). Keep the worklet file simple -- it should only contain the processor class.
**Warning signs:** TypeScript errors about missing `registerProcessor`, `sampleRate` globals.

## Code Examples

### Loading AudioWorklet and Creating Voices
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet
async function initAudio(): Promise<{
  context: AudioContext;
  voices: AudioWorkletNode[];
}> {
  const context = new AudioContext();

  // Load worklet module -- file must be accessible via URL
  await context.audioWorklet.addModule('/synth-processor.js');

  // Create voice pool
  const voices: AudioWorkletNode[] = [];
  for (let i = 0; i < 4; i++) {
    const node = new AudioWorkletNode(context, 'synth-processor');
    node.connect(context.destination);
    voices.push(node);
  }

  return { context, voices };
}
```

### Sending Note Events to Worklet
```typescript
function playNote(voice: AudioWorkletNode, midiNote: number) {
  const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
  voice.port.postMessage({ type: 'noteOn', frequency });
}

function stopNote(voice: AudioWorkletNode) {
  voice.port.postMessage({ type: 'noteOff' });
}
```

### MIDI Note to Frequency Conversion
```typescript
// Standard MIDI tuning: A4 = 440Hz = MIDI 69
function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Common notes in In C:
// C4=60 (261.63Hz), D4=62 (293.66Hz), E4=64 (329.63Hz)
// F4=65 (349.23Hz), G4=67 (392.00Hz), A4=69 (440Hz)
// B4=71 (493.88Hz), C5=72 (523.25Hz), F#4=66 (369.99Hz)
```

### Autoplay Policy Handling
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
async function handleStart(audioContext: AudioContext) {
  // This MUST be called from a user gesture (click handler)
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  // Now safe to start scheduling
}
```

### Performer Pattern Advancement Logic
```typescript
class Performer {
  private currentPatternIndex: number = 0;
  private currentNoteIndex: number = 0;
  private repetitionsRemaining: number = 0;
  private patterns: Pattern[];

  constructor(patterns: Pattern[]) {
    this.patterns = patterns;
    this.repetitionsRemaining = this.randomRepetitions();
  }

  private randomRepetitions(): number {
    return Math.floor(Math.random() * 7) + 2; // 2-8 repetitions
  }

  nextNote(): ScoreNote | null {
    if (this.currentPatternIndex >= this.patterns.length) {
      return null; // Performance complete
    }

    const pattern = this.patterns[this.currentPatternIndex];
    const note = pattern.notes[this.currentNoteIndex];

    this.currentNoteIndex++;
    if (this.currentNoteIndex >= pattern.notes.length) {
      // End of pattern iteration
      this.currentNoteIndex = 0;
      this.repetitionsRemaining--;

      if (this.repetitionsRemaining <= 0) {
        // Advance to next pattern
        this.currentPatternIndex++;
        this.repetitionsRemaining = this.randomRepetitions();
        // Optionally insert a rest between patterns
      }
    }

    return note;
  }

  get currentPattern(): number {
    return Math.min(this.currentPatternIndex + 1, 53);
  }

  get isComplete(): boolean {
    return this.currentPatternIndex >= this.patterns.length;
  }

  reset(): void {
    this.currentPatternIndex = 0;
    this.currentNoteIndex = 0;
    this.repetitionsRemaining = this.randomRepetitions();
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ScriptProcessorNode for custom audio | AudioWorklet | Deprecated 2014, AudioWorklet stable ~2018 | Must use AudioWorklet for any custom audio processing |
| setTimeout for note timing | Lookahead scheduler (Two Clocks) | Always best practice since ~2013 | Precise timing even under main-thread load |
| createScriptProcessor polyfill | Native AudioWorklet | All modern browsers now support | No polyfill needed for AudioWorklet in 2026 |
| Tone.js for everything | Raw Web Audio for focused projects | Ongoing | Tone.js still excellent for complex DAW-like apps, but overkill for focused single-synth projects |

**Deprecated/outdated:**
- **ScriptProcessorNode:** Replaced by AudioWorklet. Do not use.
- **webkitAudioContext:** All browsers use standard `AudioContext` now.
- **noteOn/noteOff methods:** Ancient API, replaced by `start()`/`stop()` on source nodes.

## Discretion Recommendations

### Synth Voice Character
**Recommendation:** Warm, slightly detuned sine-based tone. Use a sine wave as the base with a touch of a second slightly-detuned sine (2-3 cents sharp) for warmth. Add a simple low-pass filter to round off any harmonics. This gives a clean, pleasant tone appropriate for Riley's meditative patterns without being harsh.

### Beat Indicator
**Recommendation:** Skip for Phase 1. A pulsing opacity on the pattern display text (e.g., slight brightness on each beat) is trivial to add later but adds scope now. The audio itself provides rhythm feedback.

### Repetition Range
**Recommendation:** 2-8 repetitions per pattern, uniformly distributed. This gives an average performance of ~5 repetitions per pattern x 53 patterns = ~265 pattern plays. At moderate tempo with average pattern length, this yields roughly 10-15 minutes -- a reasonable single-performer duration.

### Loading and Error States
**Recommendation:** Show a simple centered "Initializing audio..." message while the AudioWorklet loads (typically < 100ms). If AudioContext creation fails, show "Audio not supported in this browser." Keep it minimal -- a conditional render in App.tsx, not a full loading screen.

## Open Questions

1. **Score transcription accuracy**
   - What we know: The score is published and available (IMSLP, various editions). It uses standard treble clef notation with 9 chromatic pitches.
   - What's unclear: Exact encoding of all 53 patterns requires careful hand-transcription from the score. Some patterns have ties, accidentals (F# appears later), and articulation nuances.
   - Recommendation: Transcribe from the published score PDF. Cross-reference with the Wellesley CS203 assignment's subset encoding and existing GitHub implementations for validation. Flag pattern #35 (longest, most complex) for extra verification.

2. **AudioWorklet vs. Scheduled Native OscillatorNode**
   - What we know: AUD-07 says "Synthesis runs in an AudioWorklet on the audio thread." Native OscillatorNodes also run on the audio thread and can be precisely scheduled with `start(time)` and `stop(time)`.
   - What's unclear: Whether the intent of AUD-07 is specifically AudioWorklet, or more broadly "audio processing must not block main thread." Using native OscillatorNode + GainNode for envelope would also satisfy the spirit of the requirement and be simpler.
   - Recommendation: Implement with AudioWorklet as specified. It provides a cleaner architecture for Phase 2 (ensemble with many voices) and Phase 3 (custom timbres). The upfront complexity is manageable and pays off.

3. **Worklet file serving in Vite**
   - What we know: AudioWorklet modules must be loaded via URL. Vite's module bundling may interfere.
   - What's unclear: Best practice for Vite 7 specifically (plugin landscape may have changed).
   - Recommendation: Start with the file in `public/` directory (simplest, always works). If a cleaner build integration is needed, investigate `vite-plugin-audioworklet` or inline module approach later.

## Sources

### Primary (HIGH confidence)
- [Chris Wilson "A Tale of Two Clocks"](https://web.dev/articles/audio-scheduling) - Lookahead scheduling pattern, code examples, timing parameters
- [MDN: Using AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet) - AudioWorkletProcessor creation, registration, parameter descriptors, communication
- [MDN: Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) - Autoplay policy handling, AudioContext state management
- [Chrome AudioWorklet Design Patterns](https://developer.chrome.com/blog/audio-worklet-design-pattern) - SharedArrayBuffer, ring buffers, main-to-audio thread communication

### Secondary (MEDIUM confidence)
- [Paul Adenot: Web Audio API Performance Notes](https://padenot.github.io/web-audio-perf/) - Memory management, GC concerns in audio thread
- [Teropa: Terry Riley's In C](https://teropa.info/blog/2017/01/23/terry-rileys-in-c.html) - Score structure, performance rules, pattern descriptions
- [Wellesley CS203 In C Assignment](http://cs.wellesley.edu/~cs203/assignments/inC/) - Score encoding approach (scale degrees + durations)
- [Tone.js GitHub](https://github.com/Tonejs/Tone.js) - Evaluated and rejected for this use case (v14.7.39, July 2025)

### Tertiary (LOW confidence)
- [cprimozic: AudioWorklet Performance Pitfall](https://cprimozic.net/blog/webaudio-audioworklet-optimization/) - Optimization tips (single source, needs validation)
- Vite 7.3 worklet handling - Based on Vite release page; specific AudioWorklet plugin support unverified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - React 19 + Vite 7 + TypeScript are well-documented, locked decisions
- Architecture: HIGH - Lookahead scheduler is the established pattern (unchanged since 2013, still canonical). AudioWorklet is the current standard for custom audio processing.
- Pitfalls: HIGH - Well-documented failure modes from multiple authoritative sources
- Score data: MEDIUM - Structure is well-understood but actual transcription of all 53 patterns requires manual work from published score

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable domain, Web Audio API is mature and rarely changes)
