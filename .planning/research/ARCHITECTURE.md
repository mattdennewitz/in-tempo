# Architecture Patterns

**Domain:** Browser-based generative music performance engine
**Researched:** 2026-02-14
**Confidence:** MEDIUM (based on training data; WebSearch/WebFetch unavailable for verification)

## Recommended Architecture

Three-layer separation: **Score/Data**, **Engine/Simulation**, **Audio/Rendering**, with React UI as a thin presentation layer that observes engine state. The critical boundary is between the main thread (UI + simulation) and the audio thread (Web Audio API scheduling).

```
+------------------------------------------------------------------+
|  React UI Layer (presentation only)                              |
|  - PerformanceControls (start/stop/reset/BPM)                   |
|  - PerformerGrid (status boxes, geometry viz)                    |
|  - ScoreConfig (mode selector, performer count)                  |
+------------------------------------------------------------------+
        |  reads via subscription (React state/store)
        v
+------------------------------------------------------------------+
|  Engine Layer (main thread)                                      |
|  +------------------+  +---------------------+                   |
|  | ScoreManager     |  | PerformanceEngine   |                   |
|  | - pattern data   |  | - transport state   |                   |
|  | - score modes    |  | - tick loop         |                   |
|  | - Euclidean gen  |  | - performer updates |                   |
|  +------------------+  +---------------------+                   |
|          |                       |                                |
|          v                       v                                |
|  +----------------------------------------------------+         |
|  | PerformerAgent[] (one per simulated performer)      |         |
|  | - current pattern index                             |         |
|  | - repetition count / decision state                 |         |
|  | - AI behavior weights (density, proximity, etc.)    |         |
|  | - playing/silent status                             |         |
|  +----------------------------------------------------+         |
+------------------------------------------------------------------+
        |  schedules notes via Web Audio API
        v
+------------------------------------------------------------------+
|  Audio Layer                                                     |
|  +---------------------+  +---------------------------+         |
|  | AudioScheduler      |  | VoiceManager              |         |
|  | - lookahead loop    |  | - synth voice pool        |         |
|  | - scheduleAheadTime |  | - sample voice pool       |         |
|  | - note queue        |  | - voice assignment        |         |
|  +---------------------+  +---------------------------+         |
|          |                           |                           |
|          v                           v                           |
|  +----------------------------------------------------+         |
|  | AudioContext                                        |         |
|  | - GainNode per performer (volume + panning)         |         |
|  | - StereoPannerNode per performer                    |         |
|  | - OscillatorNode / AudioBufferSourceNode per note   |         |
|  | - Master GainNode -> destination                    |         |
|  +----------------------------------------------------+         |
+------------------------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Thread |
|-----------|---------------|-------------------|--------|
| **ScoreManager** | Holds pattern data for all score modes. Generates Euclidean/algorithmic scores on demand. Pure data, no timing. | PerformerAgent (reads patterns), ScoreConfig UI (mode selection) | Main |
| **PerformanceEngine** | Transport control (play/pause/stop/reset). Runs the lookahead tick loop via `setInterval`. Advances simulation time. Orchestrates performer decisions each tick. | PerformerAgent[] (triggers decisions), AudioScheduler (sends note events), UI (exposes state) | Main |
| **PerformerAgent** | Single performer's AI brain. Decides: advance to next pattern? repeat? drop out? rejoin? Holds all per-performer state. Pure logic, no audio. | ScoreManager (reads current pattern), PerformanceEngine (receives tick), EnsembleState (reads peer positions) | Main |
| **EnsembleState** | Shared read-only snapshot of all performers' positions/statuses. Performers read this to make density-aware, proximity-aware decisions. Updated by PerformanceEngine each tick. | PerformerAgent[] (reads), PerformanceEngine (writes) | Main |
| **AudioScheduler** | The Chris Wilson lookahead scheduler. Runs a `setInterval` (~25ms) that looks ahead (~100ms) and schedules any notes that fall in that window using `AudioContext.currentTime`. Converts note events into Web Audio API calls. | PerformanceEngine (receives note events), VoiceManager (requests voices), AudioContext (schedules) | Main (scheduling), Audio (playback) |
| **VoiceManager** | Manages instrument assignment and voice creation. Each performer gets assigned a voice type (synth or sampled instrument) at performance start. Creates appropriate AudioNodes per note. | AudioScheduler (creates nodes on demand), AudioContext (node creation) | Main |
| **StereoMixer** | Per-performer signal chain: source -> gain -> panner -> master. Manages the static routing graph. Panning positions calculated from performer index/count. | VoiceManager (output routing), AudioContext (node graph) | Main (setup), Audio (processing) |
| **React UI** | Presentation only. Subscribes to engine state, renders performer boxes, controls, visualizations. Never touches audio directly. | PerformanceEngine (reads state), ScoreManager (config), user input (dispatches commands) | Main |

### Data Flow

**Setup flow (before performance starts):**
```
User selects score mode -> ScoreManager generates/loads patterns
User sets BPM -> PerformanceEngine stores tempo
User sets performer count -> PerformanceEngine creates PerformerAgent[]
User clicks Start -> PerformanceEngine.start()
```

**Performance flow (each tick cycle):**
```
1. setInterval fires (~25ms)
2. PerformanceEngine updates EnsembleState snapshot
3. For each PerformerAgent:
   a. Agent reads EnsembleState (peer positions, density)
   b. Agent makes decision (advance/repeat/dropout/rejoin)
   c. If playing: Agent reads current pattern from ScoreManager
   d. Agent emits note events for notes in the lookahead window
4. AudioScheduler receives note events
5. AudioScheduler calls VoiceManager to create source nodes
6. Source nodes scheduled at exact AudioContext.currentTime offsets
7. PerformanceEngine publishes state update for UI
8. React re-renders affected performer boxes
```

**Note scheduling detail (the critical timing path):**
```
                    now              lookahead boundary
                     |                    |
  AudioContext time: |====scheduling======|
                     |  window (~100ms)   |

  setInterval fires every ~25ms
  Each fire: schedule any unscheduled notes between now and (now + scheduleAheadTime)
  Notes get exact .start(time) calls -> sample-accurate playback
```

**State update flow (Engine -> UI):**
```
PerformanceEngine holds observable state:
  - performers[]: { id, patternIndex, status, repetitionCount, voiceType }
  - transport: { isPlaying, currentBeat, elapsedTime }
  - isFinished: boolean

React subscribes via:
  Option A: Zustand store (recommended - lightweight, no boilerplate)
  Option B: useSyncExternalStore hook (built-in, zero deps)

UI reads state, never writes to engine internals.
User commands flow through: UI -> dispatch action -> PerformanceEngine method call
```

## Patterns to Follow

### Pattern 1: Lookahead Scheduler (Chris Wilson pattern)

**What:** Decouple musical timing from JavaScript's unreliable `setInterval` by using it only as a wake-up call, then scheduling notes precisely using `AudioContext.currentTime`.

**When:** Always. This is the only correct way to do musical timing in the browser.

**Why:** `setInterval` jitter is 5-25ms (catastrophic for music). `AudioContext.currentTime` is sample-accurate. The lookahead pattern bridges the two: imprecise JS timer wakes up the scheduler, which precisely places notes using the audio clock.

**Example:**
```typescript
class AudioScheduler {
  private audioContext: AudioContext;
  private scheduleAheadTime = 0.1;  // seconds to look ahead
  private timerInterval = 25;        // ms between setInterval fires
  private timerId: number | null = null;
  private nextNoteTime = 0;

  start() {
    this.nextNoteTime = this.audioContext.currentTime;
    this.timerId = window.setInterval(() => this.tick(), this.timerInterval);
  }

  private tick() {
    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      // Get notes at this time from performers
      const notes = this.getNotes(this.nextNoteTime);
      for (const note of notes) {
        this.scheduleNote(note, this.nextNoteTime);
      }
      this.advanceTime();
    }
  }

  private scheduleNote(note: NoteEvent, time: number) {
    const source = this.voiceManager.createSource(note);
    source.start(time);
    source.stop(time + note.duration);
  }
}
```

**Confidence:** HIGH - This is the well-established pattern from Chris Wilson's "A Tale of Two Clocks" (2013), referenced in MDN docs, and the standard approach in Tone.js and every serious Web Audio project.

### Pattern 2: Performer as Pure State Machine

**What:** Each PerformerAgent is a pure function of (own state + ensemble snapshot) -> (new state + note events). No side effects, no audio references.

**When:** Modeling performer AI decisions.

**Why:** Testability. You can unit test every performer behavior without an AudioContext. Reproducibility: given the same random seed and ensemble state, you get the same decisions.

**Example:**
```typescript
interface PerformerState {
  id: number;
  patternIndex: number;
  repetitionCount: number;
  status: 'playing' | 'silent';
  silentBeats: number;
  decisionWeights: DecisionWeights;
}

interface EnsembleSnapshot {
  performers: ReadonlyArray<{ patternIndex: number; status: string }>;
  averagePatternIndex: number;
  density: number;  // fraction of performers currently playing
  tick: number;
}

interface TickResult {
  newState: PerformerState;
  noteEvents: NoteEvent[];  // notes to schedule this tick
}

function performerTick(
  state: PerformerState,
  ensemble: EnsembleSnapshot,
  patterns: Pattern[],
  rng: () => number  // seeded random for reproducibility
): TickResult {
  // Decision logic here - pure function
}
```

**Confidence:** HIGH - Standard game-AI / simulation pattern. Clean separation of logic from rendering.

### Pattern 3: Immutable Ensemble Snapshot

**What:** Each tick, the engine creates a frozen snapshot of all performer positions. Performers read this snapshot, never each other's mutable state.

**When:** Every tick when performers need to make ensemble-aware decisions.

**Why:** Prevents order-of-evaluation bugs. If performer 1 advances and performer 2 reads performer 1's new position in the same tick, you get inconsistent behavior depending on iteration order. Snapshot ensures all performers see the same world state.

**Example:**
```typescript
// In PerformanceEngine.tick():
const snapshot: EnsembleSnapshot = Object.freeze({
  performers: this.performers.map(p => ({
    patternIndex: p.state.patternIndex,
    status: p.state.status,
  })),
  averagePatternIndex: this.calcAverageIndex(),
  density: this.calcDensity(),
  tick: this.currentTick,
});

// All performers evaluate against the SAME snapshot
const results = this.performers.map(p => p.tick(snapshot));

// Apply all state changes AFTER all decisions
results.forEach((result, i) => {
  this.performers[i].applyState(result.newState);
});
```

**Confidence:** HIGH - Standard simulation pattern (equivalent to double-buffering in game engines).

### Pattern 4: Score as Static Data

**What:** Score patterns are pre-computed data structures. No generation during performance.

**When:** Before performance starts, during mode selection / configuration.

**Why:** Zero runtime cost during performance. Score data is read-only during playback. Different score modes (Riley, generated, Euclidean) produce the same data structure, so the engine doesn't care about the source.

**Example:**
```typescript
interface Note {
  pitch: number;       // MIDI note number
  duration: number;    // in beats
  offset: number;      // beat offset within pattern
}

interface Pattern {
  id: number;
  notes: Note[];
  lengthInBeats: number;
}

interface Score {
  patterns: Pattern[];
  mode: 'riley' | 'generated' | 'euclidean';
}

// All three modes produce Score - engine is mode-agnostic
const rileyScore = loadRileyPatterns();        // static data
const generatedScore = generatePatterns(seed); // algorithmic
const euclideanScore = generateEuclidean(params); // Bjorklund
```

**Confidence:** HIGH - Obvious separation of concerns.

### Pattern 5: Audio Graph Setup Once, Trigger Per Note

**What:** Build the per-performer signal chain (gain + panner) once at performance start. Per-note, only create ephemeral source nodes that connect to the pre-built chain.

**When:** Setting up audio routing.

**Why:** Creating and connecting AudioNodes is cheap but not free. The static routing (gain, pan, master bus) should be built once. Only the source nodes (OscillatorNode or AudioBufferSourceNode) are created and destroyed per note.

**Example:**
```typescript
// Setup once per performer:
const performerGain = audioContext.createGain();
const performerPan = audioContext.createStereoPanner();
performerPan.pan.value = panPosition(performerIndex, totalPerformers);
performerGain.connect(performerPan);
performerPan.connect(masterGain);

// Per note (ephemeral):
const osc = audioContext.createOscillator();
osc.frequency.value = midiToFreq(note.pitch);
osc.connect(performerGain);
osc.start(scheduledTime);
osc.stop(scheduledTime + note.duration);
// osc is automatically garbage collected after stop
```

**Confidence:** HIGH - Standard Web Audio API practice.

## Anti-Patterns to Avoid

### Anti-Pattern 1: setTimeout for Musical Timing

**What:** Using `setTimeout` or `setInterval` directly to trigger note playback.

**Why bad:** JavaScript timers have 5-25ms jitter, worse under load. 25ms at 120 BPM is an entire 16th note. The result is audibly sloppy timing -- completely unacceptable for a rhythmic performance piece.

**Instead:** Use the lookahead scheduler (Pattern 1). JS timers only wake up the scheduler; actual note timing uses `AudioContext.currentTime` which is sample-accurate.

### Anti-Pattern 2: Performer AI in the Audio Thread

**What:** Running decision logic in an AudioWorklet or trying to do performer AI in the audio callback.

**Why bad:** AudioWorklet runs on a separate thread with extreme real-time constraints. Complex decision logic risks audio glitches. Also, AudioWorklet cannot easily access the ensemble state needed for AI decisions.

**Instead:** All AI runs on the main thread. The audio thread only receives pre-scheduled note events. The lookahead window (100ms) provides ample time for the main thread to compute decisions.

### Anti-Pattern 3: React State as Source of Truth for Engine

**What:** Storing performer positions, transport state, or note queues in React state (useState, Redux, etc.) and having the engine read from React.

**Why bad:** React state updates are async and batched. The engine needs immediate, synchronous access to state. Mixing React's render cycle with audio scheduling creates timing issues and unnecessary re-renders.

**Instead:** Engine owns its own state (plain TypeScript objects). React subscribes to a derived/projected view of that state. Data flows one way: Engine -> UI state -> React render.

### Anti-Pattern 4: One Giant "tick" That Does Everything

**What:** A single function that evaluates AI, schedules audio, updates UI state, and manages transport.

**Why bad:** Impossible to test, impossible to profile, impossible to optimize. When timing issues arise, you can't isolate the cause.

**Instead:** Separate concerns: `PerformanceEngine.tick()` orchestrates, but delegates to `PerformerAgent.tick()` for AI, `AudioScheduler.scheduleNote()` for audio, and a state publication mechanism for UI.

### Anti-Pattern 5: Creating AudioContext on Page Load

**What:** Instantiating `new AudioContext()` before user interaction.

**Why bad:** Browsers require a user gesture to start an AudioContext (autoplay policy). Creating it early means it starts in `suspended` state and you need to `.resume()` on user click anyway. Creates confusing state management.

**Instead:** Create AudioContext in response to the first user interaction (e.g., clicking "Start Performance"). Single, clean initialization path.

## Scalability Considerations

| Concern | 5 performers | 20 performers | 50 performers |
|---------|-------------|---------------|---------------|
| Note scheduling | Trivial. ~5 notes per tick. | Fine. ~20 notes per tick. | Monitor. ~50 notes per tick. Batch scheduling calls. |
| AudioNode count | ~10 active source nodes | ~40 active source nodes | ~100 active source nodes. May need voice limiting (oldest-note stealing). |
| AI computation | Negligible | Negligible | Measure. 50 agents x ensemble snapshot reads. Should still be <1ms per tick. |
| UI re-renders | No concern | Use React.memo on performer boxes | Virtualize if needed, but 50 boxes should be fine with memo |
| Stereo panning | Clear separation | Gets crowded but still meaningful | Diminishing returns. Consider spatial grouping. |

For InTempo's use case (likely 5-20 performers), scalability is not a primary concern. The architecture handles 50+ without fundamental changes.

## Suggested Build Order

The dependency graph dictates a clear build sequence:

```
Phase 1: Foundation
  Score data model (Pattern, Note, Score types)
  ScoreManager with Riley's 53 patterns (static data)
  --> No dependencies. Pure data. Testable immediately.

Phase 2: Audio Backbone
  AudioContext creation + resume on user gesture
  AudioScheduler (lookahead pattern)
  VoiceManager (basic synth voice only)
  StereoMixer (per-performer gain + pan chain)
  --> Depends on: Score data model (for Note type)
  --> Can play hardcoded notes to verify timing

Phase 3: Performer AI
  PerformerAgent state machine
  EnsembleSnapshot mechanism
  Decision logic (advance, repeat, dropout, rejoin, unison-seek)
  PerformanceEngine orchestrator (tick loop, transport)
  --> Depends on: Score data model
  --> Testable with mocked audio (just verify note events)

Phase 4: Integration
  Wire PerformanceEngine -> AudioScheduler
  Wire PerformerAgent decisions -> note events -> scheduled audio
  --> Depends on: Phase 2 + Phase 3
  --> First audible performance

Phase 5: React UI
  Transport controls (start/stop/reset/BPM)
  Performer status grid
  Score mode selector
  State subscription (engine -> UI)
  --> Depends on: Phase 3 (engine state shape)
  --> Can develop in parallel with Phase 2 using mock state

Phase 6: Polish
  Sampled voices (load audio buffers)
  Abstract geometry visualization
  Additional score modes (generated, Euclidean)
  Steady pulse toggle
  Styling (GT Canon font, color palette)
  --> Depends on: Phase 4 (working engine)
```

**Key insight:** The Score data model and PerformerAgent AI can be built and thoroughly tested before any audio code exists. The AudioScheduler can be built and tested with hardcoded notes before the AI exists. These two streams converge at integration.

## Sources

- Chris Wilson, "A Tale of Two Clocks" - the canonical Web Audio scheduling reference (training data, HIGH confidence - this is the universally cited pattern)
- MDN Web Audio API documentation - AudioContext, OscillatorNode, AudioBufferSourceNode, StereoPannerNode, GainNode (training data, HIGH confidence - stable APIs)
- MDN Autoplay policy documentation - user gesture requirement for AudioContext (training data, HIGH confidence - well-established browser policy)
- General game engine architecture patterns for simulation ticks, snapshot-based evaluation (training data, HIGH confidence - established CS patterns)

**Note:** WebSearch and WebFetch were unavailable during this research session. All findings are based on training data. The Web Audio API scheduling pattern and React architecture patterns are well-established and unlikely to have changed, but specific API details (e.g., new AudioWorklet capabilities) should be verified against current MDN docs during implementation.
