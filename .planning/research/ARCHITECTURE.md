# Architecture Patterns: v1.2 Polish Features

**Domain:** Stereo spread, seeded PRNG (shareable performances), pattern visualization, microtiming -- integrated into existing AudioWorklet/scheduler/ensemble/voice-pool architecture
**Researched:** 2026-02-15
**Confidence:** HIGH (direct codebase analysis + verified Web Audio API capabilities)

## Existing Architecture Recap

```
AudioEngine (facade)
  |-- AudioContext
  |-- Ensemble (score/ensemble.ts)
  |   |-- PerformerAgent[] (weighted decision logic, personality-driven)
  |   |-- Math.random() calls in: weightedChoice, generatePersonality,
  |   |   randomReps, handleEndgame, rejoinLogic, computeVelocity
  |   `-- tick() -> AgentNoteEvent[] { performerId, midi, duration, velocity }
  |-- Scheduler (audio/scheduler.ts)
  |   |-- setTimeout tick loop (25ms timer, 100ms lookahead window)
  |   |-- scheduleBeat() polls Ensemble, routes to VoicePool or SamplePlayer
  |   `-- beatCounter tracks eighth-note index
  |-- VoicePool (audio/voice-pool.ts)
  |   |-- AudioWorkletNode[] -> masterGain -> audioContext.destination
  |   `-- claim/release with voice stealing
  |-- SamplePlayer (audio/sampler.ts)
  |   |-- SplendidGrandPiano(ctx, { destination: masterGain })
  |   |-- Soundfont marimba(ctx, { destination: masterGain })
  |   `-- masterGain -> audioContext.destination
  `-- PulseGenerator (audio/pulse.ts)
      `-- per-pulse OscillatorNode -> gainNode -> audioContext.destination
```

**Critical observation:** All three audio paths (VoicePool, SamplePlayer, PulseGenerator) connect directly to `audioContext.destination` through their own master gain nodes. There is no shared output bus. This matters for stereo spread.

**Critical observation:** All randomness uses bare `Math.random()`. There are approximately 15+ call sites across ensemble.ts, velocity.ts, and performer.ts. This matters for seeded PRNG.

## Feature 1: Stereo Spread

### Problem

All performers currently output to center (mono). With 4-16 performers playing simultaneously, the stereo image is flat. Real ensembles have spatial distribution.

### Architecture Decision: Per-Performer StereoPannerNode

**Approach:** Insert a `StereoPannerNode` per performer between the audio source and the master gain. Each performer gets a deterministic pan position based on their ID, spread evenly across the stereo field.

**Why StereoPannerNode over PannerNode:** StereoPannerNode uses a simple equal-power panning algorithm with a single `pan` parameter (-1 to +1). PannerNode is 3D spatialization -- overkill for stereo spread. StereoPannerNode is cheaper computationally and simpler to manage.

### Integration Points

**Challenge:** The three audio paths have different routing architectures:

1. **VoicePool (synth):** AudioWorkletNodes connect to a shared `masterGain`. There is no per-performer routing -- any voice can play any performer's note (voice stealing means voice 0 might play performer 3's note one beat, performer 1's note the next).

2. **SamplePlayer (piano/marimba):** smplr instruments are initialized with a single `destination` GainNode. The `.start()` call does not accept a pan or destination override per note.

3. **PulseGenerator:** Fixed center pan is correct (reference signal should not be spatialized).

### Recommended Design: Per-Performer Pan Nodes in Scheduler

```
Per performer (created at Ensemble construction):
  panNode[performerId] = new StereoPannerNode(ctx, { pan: computePan(id, count) })
  panNode[performerId] -> audioContext.destination

Synth path: voice.node needs to be reconnected per-note:
  voice.node.disconnect()
  voice.node -> panNode[event.performerId]
  (on release: voice.node.disconnect() -> reconnect to center or leave disconnected)

Sample path: per-performer SamplePlayer instances OR per-note routing
```

**Problem with voice reconnection:** Disconnecting and reconnecting AudioWorkletNodes on every note is expensive and may cause clicks. Better approach:

### Revised Design: Per-Performer Gain+Pan Chains

```typescript
// src/audio/stereo-field.ts (NEW)

interface PerformerChannel {
  gain: GainNode;
  panner: StereoPannerNode;
}

export class StereoField {
  private channels: Map<number, PerformerChannel> = new Map();
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /** Get or create a per-performer audio channel with panning. */
  getChannel(performerId: number, totalPerformers: number): PerformerChannel {
    let ch = this.channels.get(performerId);
    if (!ch) {
      const gain = this.audioContext.createGain();
      gain.gain.value = 1.0;
      const panner = new StereoPannerNode(this.audioContext, {
        pan: this.computePan(performerId, totalPerformers),
      });
      gain.connect(panner).connect(this.audioContext.destination);
      ch = { gain, panner };
      this.channels.set(performerId, ch);
    }
    return ch;
  }

  /** Spread performers evenly: center-weighted with edges at +-0.7 */
  private computePan(id: number, total: number): number {
    if (total <= 1) return 0;
    const maxSpread = 0.7; // don't hard-pan to +-1.0 (too extreme)
    // Spread evenly from -maxSpread to +maxSpread
    return -maxSpread + (2 * maxSpread * id) / (total - 1);
  }

  /** Update pan positions when performer count changes. */
  updateSpread(performerIds: number[]): void {
    const total = performerIds.length;
    for (const id of performerIds) {
      const ch = this.channels.get(id);
      if (ch) {
        ch.panner.pan.value = this.computePan(id, total);
      }
    }
  }

  dispose(): void {
    for (const ch of this.channels.values()) {
      ch.gain.disconnect();
      ch.panner.disconnect();
    }
    this.channels.clear();
  }
}
```

### VoicePool Integration (Synth Path)

The current VoicePool connects all voices to a single `masterGain`. To add per-performer panning:

**Option A (recommended): Route per-note through StereoField**

Instead of `voice.node.connect(masterGain)` at pool creation, keep voices unconnected (or connected to a silent default). On each `claim()`, the Scheduler connects the voice to the appropriate performer's channel:

```typescript
// In Scheduler.scheduleBeat():
const voice = this.voicePool.claim();
const channel = this.stereoField.getChannel(event.performerId, performerCount);

// Reconnect voice to this performer's pan chain
voice.node.disconnect();
voice.node.connect(channel.gain);

// On release (via existing setTimeout):
voice.node.disconnect();
// Voice returns to pool disconnected -- will be reconnected on next claim
```

**Cost:** One `disconnect()` + `connect()` per note-on and per note-off. AudioWorkletNode connections are lightweight (just graph edges, no buffer copies). This is the same pattern used by commercial Web Audio engines.

**Why not per-performer voice pools:** Would multiply voice count by performer count (4 performers x 8 voices = 32 AudioWorkletNodes). Wasteful and defeats voice stealing.

### SamplePlayer Integration (Piano/Marimba Path)

smplr instruments accept a `destination` AudioNode at construction time. Two options:

**Option A (simple, recommended): Create per-performer instrument instances**

```typescript
// Instead of one global piano + marimba:
// Create piano/marimba per performer, each routed through its StereoField channel
for (const id of performerIds) {
  const channel = stereoField.getChannel(id, count);
  instruments[id] = {
    piano: new SplendidGrandPiano(ctx, { destination: channel.gain }),
    marimba: new Soundfont(ctx, { instrument: 'marimba', destination: channel.gain }),
  };
}
```

**Tradeoff:** More sample loading and memory. With 4 performers, that's ~2 piano + 2 marimba instances (since only ~1/3 play each instrument). Acceptable.

**Option B (lower memory): Single instruments routed through a dynamic destination**

smplr's `start()` does not accept a per-note destination. However, we could create per-performer GainNodes and route the instrument's output to them dynamically. This is fragile with smplr's internal architecture.

**Recommendation: Option A.** The memory cost is modest and the routing is clean.

### Modified Audio Graph

```
                          AudioContext.destination
                          /        |         \
                   panNode[0]  panNode[1]  panNode[2] ...
                      |           |           |
                   gain[0]     gain[1]     gain[2]
                   /    \      /    \      /    \
              voice(s)  piano  voice(s) marimba voice(s) piano
              (synth)          (synth)          (synth)

              PulseGenerator -> gainNode -> destination (center, unchanged)
```

### Component Changes for Stereo Spread

| Component | Action | Changes |
|-----------|--------|---------|
| `src/audio/stereo-field.ts` | **CREATE** | StereoField class: per-performer pan+gain chains |
| `src/audio/voice-pool.ts` | **MODIFY** | Remove masterGain connection at creation. Voices start disconnected. |
| `src/audio/scheduler.ts` | **MODIFY** | On claim: connect voice to StereoField channel. On release: disconnect. |
| `src/audio/sampler.ts` | **MODIFY** | Accept StereoField, create per-performer instrument instances |
| `src/audio/engine.ts` | **MODIFY** | Create StereoField, pass to VoicePool/Scheduler/SamplePlayer |
| `src/audio/types.ts` | **MODIFY** | Add stereo spread config to EnsembleEngineState if user-configurable |

---

## Feature 2: Seeded PRNG (Shareable Performances)

### Problem

Every `Math.random()` call produces unpredictable results. Two users starting the same configuration get completely different performances. To share a specific performance via URL, all randomness must be deterministic given a seed.

### Where Math.random() Is Called

Exhaustive audit of current codebase:

| File | Function | Call Count | Purpose |
|------|----------|------------|---------|
| `ensemble.ts` | `weightedChoice()` | 1 | Decision: advance/repeat/dropout |
| `ensemble.ts` | `randomInRange()` | 6 | Personality generation (via `generatePersonality()`) |
| `ensemble.ts` | `PerformerAgent.randomReps()` | 1 | Repetition count (2-8) |
| `ensemble.ts` | `PerformerAgent.tick()` (shouldRest) | 0 | (removed in ensemble agent model) |
| `ensemble.ts` | `handleEndgame()` | 1 | Staggered final dropout |
| `ensemble.ts` | `rejoinLogic()` | 1 | Rejoin probability check |
| `ensemble.ts` | `Ensemble constructor` | N | Entry delay per performer |
| `ensemble.ts` | `Ensemble.addAgent()` | 1 | Late-join entry delay |
| `velocity.ts` | `computeVelocity()` | 1 | Per-note jitter |
| `velocity.ts` | `generateVelocityPersonality()` | 2 | Per-performer loudness/jitter |

**Total: ~15 Math.random() calls per tick (across all agents) + personality generation at start.**

### Architecture Decision: Mulberry32 PRNG with Dependency Injection

**Use Mulberry32 because** it is a 32-bit seeded PRNG that fits in ~10 lines, has good statistical properties, a period of ~2^32 (4 billion -- far more than any performance needs), and requires zero dependencies. It returns values in [0, 1) just like `Math.random()`.

**Do NOT use seedrandom** (3.8KB minified, npm dependency) or `crypto.getRandomValues` (not seedable).

```typescript
// src/score/prng.ts (NEW)

/** Mulberry32: 32-bit seeded PRNG. Returns values in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate a random 32-bit seed for new performances. */
export function randomSeed(): number {
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}
```

### Injection Strategy

**Decision: Replace Math.random at the call sites, NOT globally.**

Globally overriding `Math.random` would affect third-party libraries (smplr, React, etc.) and is fragile. Instead, pass a `random()` function through the existing dependency chain.

```
Ensemble(count, patterns, mode, velocityConfig, random)
  -> PerformerAgent(id, patterns, ..., random)
    -> this.random = random  // used instead of Math.random()
    -> weightedChoice(options, random)
    -> computeVelocity(ctx)  // ctx gains a random field
```

### Integration with Ensemble

```typescript
// Modified Ensemble constructor:
constructor(
  count: number,
  patterns: Pattern[],
  mode: ScoreMode,
  velocityConfig: VelocityConfig,
  random: () => number = Math.random,  // backward-compatible default
) {
  this.random = random;
  // ... pass random to each PerformerAgent
}
```

Every `Math.random()` call in ensemble.ts and velocity.ts becomes `this.random()` or the passed-in `random` parameter.

### Seed-to-URL Encoding

```typescript
// Seed is a 32-bit unsigned integer -> 8 hex chars
// URL format: https://intempo.app/#seed=a1b2c3d4&mode=riley&bpm=120&count=4

interface PerformanceConfig {
  seed: number;
  mode: ScoreMode;
  bpm: number;
  performerCount: number;
}

function encodeConfig(config: PerformanceConfig): string {
  const params = new URLSearchParams({
    seed: config.seed.toString(16).padStart(8, '0'),
    mode: config.mode,
    bpm: config.bpm.toString(),
    n: config.performerCount.toString(),
  });
  return `#${params.toString()}`;
}

function decodeConfig(hash: string): PerformanceConfig | null {
  const params = new URLSearchParams(hash.replace('#', ''));
  const seedStr = params.get('seed');
  if (!seedStr) return null;
  return {
    seed: parseInt(seedStr, 16),
    mode: (params.get('mode') as ScoreMode) || 'riley',
    bpm: parseInt(params.get('bpm') || '120'),
    performerCount: parseInt(params.get('n') || '4'),
  };
}
```

### Data Flow for Seeded Performance

```
1. User clicks "Share" or starts fresh performance
   -> seed = randomSeed() OR seed from URL hash
   -> random = mulberry32(seed)

2. AudioEngine.start(seed?)
   -> Ensemble(count, patterns, mode, velocityConfig, mulberry32(seed))
     -> Each PerformerAgent gets the SAME random instance (sequential draws)
     -> Personality generation: deterministic
     -> Entry delays: deterministic
     -> All tick() decisions: deterministic

3. URL updated: window.location.hash = encodeConfig({ seed, mode, bpm, count })
   -> User copies URL and shares

4. Recipient opens URL
   -> decodeConfig(hash) extracts seed + config
   -> AudioEngine configured identically
   -> Ensemble seeded identically
   -> Exact same performance plays
```

### Critical Constraint: Single PRNG Stream

All agents MUST draw from the same PRNG instance in a deterministic order. If Agent 0 draws 3 random values per tick and Agent 1 draws 2, the sequence must be stable. The current architecture already processes agents in array order within `Ensemble.tick()`, so this is naturally deterministic as long as:

1. No async randomness (all random calls are synchronous in tick -- confirmed)
2. Agent array order is stable (it is: push-only, filter-on-removal with deterministic removal order)
3. No randomness outside the tick loop that could desync (personality is generated at construction, before ticking starts -- confirmed)

### Component Changes for Seeded PRNG

| Component | Action | Changes |
|-----------|--------|---------|
| `src/score/prng.ts` | **CREATE** | mulberry32, randomSeed functions |
| `src/score/seed-config.ts` | **CREATE** | URL encode/decode, PerformanceConfig type |
| `src/score/ensemble.ts` | **MODIFY** | Accept `random` param, replace all Math.random() |
| `src/score/velocity.ts` | **MODIFY** | Accept `random` param in computeVelocity, generateVelocityPersonality |
| `src/audio/engine.ts` | **MODIFY** | Accept optional seed, create PRNG, pass to Ensemble |
| `src/App.tsx` | **MODIFY** | Read/write URL hash, share button, seed display |

---

## Feature 3: Pattern Visualization

### Two Visualization Types

1. **Score Overview:** Bird's-eye view of all patterns with performer positions marked
2. **Per-Performer Geometry:** Visual indicator of current musical activity per performer card

### Score Overview: Horizontal Pattern Timeline

**Decision: Canvas-based (extend existing canvas infrastructure), NOT SVG or DOM.**

Rationale: The app already has a canvas renderer (`src/canvas/renderer.ts`) with HiDPI setup, rAF loop, and the theme system. Adding a second canvas component for the score overview reuses all this infrastructure. Canvas also performs better for the 53+ pattern cells that need to update every beat.

```
Score Overview Layout:

[1][2][3][4][5][6][7][8][9]...[53]    <- pattern cells (horizontal strip)
 ^        ^  ^                         <- performer position markers
 P1       P2 P3                        <- color-coded per performer
```

### Architecture

```typescript
// src/canvas/ScoreOverview.tsx (NEW - React component)
// src/canvas/score-renderer.ts (NEW - pure canvas draw functions)

interface ScoreOverviewProps {
  performers: PerformerState[];
  totalPatterns: number;
  playing: boolean;
}
```

The renderer draws:
- A horizontal strip of pattern cells (numbered 1-53)
- Colored markers above/below for each performer's current position
- The "band" window (min-max pattern range) highlighted
- Optional: note content preview per pattern cell (tiny dots for note pitches)

### Per-Performer Geometry: Activity Indicator on Performer Cards

**Decision: Extend existing `renderPerformers()` in renderer.ts with a small geometric visualization per card.**

Options considered:
- **Waveform/pulse ring:** Animated ring that pulses on note-on (visually compelling, lightweight)
- **Note dots:** Show current pattern's notes as dots in a circular arrangement
- **Progress arc:** Arc around the card showing repetition progress

**Recommendation: Repetition progress arc + note-on pulse.** The repetition progress is already available in `PerformerState` (`currentRep / totalReps`), and note-on events can be detected by comparing state changes.

```typescript
// Addition to renderPerformers() in renderer.ts:

// Draw repetition arc (partial circle, fills as reps progress)
const progress = p.status === 'playing' ? p.currentRep / p.totalReps : 0;
const arcRadius = 8;
const arcX = x + CELL_WIDTH - 16;
const arcY = y + CELL_HEIGHT / 2;
ctx.beginPath();
ctx.arc(arcX, arcY, arcRadius, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
ctx.strokeStyle = colors.accent;
ctx.lineWidth = 2;
ctx.stroke();
```

### Data Flow for Visualization

Visualization is **read-only** -- it consumes existing `EnsembleEngineState` with no modifications to the audio/ensemble layer.

```
Scheduler.fireStateChange()
  -> EnsembleEngineState { performers: PerformerState[] }
    -> App.tsx receives via onStateChange callback
      -> ScoreOverview component (new): reads performers[].patternIndex
      -> PerformerCanvas component (existing): reads performers[] (enhanced rendering)
```

**No new state needed.** All required data (patternIndex, currentRep, totalReps, status) is already in `PerformerState`.

### Optional Enhancement: Note-On Flash Events

To show note-on activity (a flash/pulse when a performer plays a note), we need a way to signal "this performer just played." Current `PerformerState` does not include this.

**Lightweight approach:** Add an `isActive` boolean or `lastNoteOnBeat` number to `PerformerState`:

```typescript
// In types.ts PerformerState:
lastNoteOnBeat: number;  // beat counter when last note was played
```

The renderer checks `if (currentBeat - p.lastNoteOnBeat < 2)` to show a flash effect. This requires passing `beatCounter` through state, which is trivial (add to `EnsembleEngineState`).

### Component Changes for Pattern Visualization

| Component | Action | Changes |
|-----------|--------|---------|
| `src/canvas/ScoreOverview.tsx` | **CREATE** | Score overview canvas component |
| `src/canvas/score-renderer.ts` | **CREATE** | Pure draw functions for score overview |
| `src/canvas/renderer.ts` | **MODIFY** | Add repetition arc + note-on flash to performer cards |
| `src/canvas/theme.ts` | **MODIFY** | Add colors/dimensions for score overview + new card elements |
| `src/audio/types.ts` | **MODIFY** | Add `lastNoteOnBeat` to PerformerState, `beatCounter` to EnsembleEngineState |
| `src/App.tsx` | **MODIFY** | Add ScoreOverview component to layout |

---

## Feature 4: Microtiming

### Problem

Currently, all notes are quantized to exact eighth-note grid positions. Real human performers introduce subtle timing deviations (5-20ms) that create groove and liveness.

### Architecture Decision: Timing Offset in Scheduler, NOT in Ensemble

**Rationale:** Microtiming is a time-domain operation. The Ensemble deals in abstract beat indices -- it has no concept of milliseconds or AudioContext time. The Scheduler is where beat indices become real timestamps (`nextNoteTime`). Microtiming offsets must be applied at the Scheduler level when converting beat position to AudioContext time.

This parallels the velocity decision: velocity is a musical decision (Ensemble level), but timing is a scheduling decision (Scheduler level). However, the *amount* of timing deviation should be personality-driven (generated at agent creation, like velocity personality).

### Microtiming Model

```typescript
// Add to AgentPersonality in ensemble.ts:
export interface AgentPersonality {
  // ... existing fields ...
  timingBias: number;     // -1 to +1: tendency to play early (-) or late (+)
  timingVariance: number; // 0.0 to 1.0: how much timing varies note-to-note
}

// Add to AgentNoteEvent:
export interface AgentNoteEvent {
  performerId: number;
  midi: number;
  duration: number;
  velocity: number;
  timingOffset: number;  // NEW: -1.0 to +1.0, normalized deviation
}
```

The Ensemble generates a normalized timing offset per note (using the seeded PRNG). The Scheduler converts this to actual milliseconds:

```typescript
// In Scheduler.scheduleBeat():
const maxOffsetMs = 15; // max microtiming deviation in ms
const maxOffsetSeconds = maxOffsetMs / 1000;
const actualOffset = event.timingOffset * maxOffsetSeconds;
const adjustedTime = time + actualOffset;

// Use adjustedTime instead of time for voice.node.port.postMessage and samplePlayer.play
```

### Microtiming Computation (in PerformerAgent)

```typescript
// In PerformerAgent.tick(), when generating the event:
const timingOffset = this.computeMicrotiming();

private computeMicrotiming(): number {
  const p = this._state.personality;
  // Bias + random jitter, clamped to [-1, 1]
  const jitter = (this.random() - 0.5) * 2 * p.timingVariance;
  return Math.max(-1, Math.min(1, p.timingBias * 0.3 + jitter));
}
```

### Interaction with Seeded PRNG

Microtiming uses the same seeded PRNG as all other random decisions. Since it draws from the same stream in deterministic order, seeded performances automatically include deterministic microtiming. No additional seeding infrastructure needed.

### Configurable Intensity

Like velocity humanization, microtiming should be toggleable and have intensity levels:

```typescript
// Extend VelocityConfig or create a parallel HumanizationConfig:
export interface HumanizationConfig {
  velocity: { enabled: boolean; intensity: 'subtle' | 'moderate' | 'expressive' };
  timing: { enabled: boolean; intensity: 'subtle' | 'moderate' | 'expressive' };
}

// Intensity maps to max offset:
//   subtle: 5ms
//   moderate: 12ms
//   expressive: 20ms
```

### Safety: Timing Offset Bounds

**Critical:** Timing offsets must never cause notes to schedule in the past (before `audioContext.currentTime`). The Scheduler's lookahead window is 100ms, so a max offset of 20ms is safe -- even a note scheduled 100ms ahead with a -20ms offset still lands 80ms in the future.

### Component Changes for Microtiming

| Component | Action | Changes |
|-----------|--------|---------|
| `src/score/ensemble.ts` | **MODIFY** | Add timingBias/timingVariance to personality, timingOffset to AgentNoteEvent, compute in tick() |
| `src/audio/scheduler.ts` | **MODIFY** | Apply timingOffset to scheduled note time |
| `src/audio/types.ts` | **MODIFY** | Add timing config to state types |
| `src/audio/engine.ts` | **MODIFY** | Expose timing humanization controls |
| `src/components/HumanizationToggle.tsx` | **MODIFY** | Add timing toggle alongside velocity toggle |

---

## Combined Architecture Diagram

```
                    URL Hash (#seed=..&mode=..&bpm=..&n=..)
                           |
                           v
                    AudioEngine (facade)
                    |   seed -> mulberry32(seed) -> random()
                    |
          Ensemble(count, patterns, mode, velocityConfig, random)
            |
            |-- PerformerAgent[0].tick(snapshot)
            |     uses random() for decisions, velocity jitter, timing offset
            |     -> AgentNoteEvent { performerId, midi, duration, velocity, timingOffset }
            |
            |-- PerformerAgent[1].tick(snapshot) ...
            |
            v
          Scheduler.scheduleBeat(time)
            |
            |-- For each event:
            |     adjustedTime = time + (event.timingOffset * maxOffsetSeconds)
            |     channel = stereoField.getChannel(event.performerId)
            |
            |     SYNTH path:
            |       voice = voicePool.claim()
            |       voice.node.disconnect()
            |       voice.node.connect(channel.gain)
            |       voice.node.port.postMessage({ noteOn, freq, adjustedTime, gain })
            |
            |     SAMPLE path:
            |       samplePlayer.play(instrument, performerId, midi, adjustedTime, duration, velocity)
            |       (per-performer instrument instance routed through channel.gain)
            |
            |     MIDI recording:
            |       midiRecorder.record(beatCounter, performerId, midi, duration, velocity)
            |
            v
          fireStateChange() -> EnsembleEngineState
            |
            +-> App.tsx
                  |-- ScoreOverview (new canvas: pattern timeline + performer markers)
                  |-- PerformerCanvas (enhanced: rep arc, note-on flash)
                  |-- ShareButton (new: copy URL with seed)
                  |-- HumanizationToggle (enhanced: velocity + timing controls)
```

## Patterns to Follow

### Pattern 1: Dependency Injection for Testability

**What:** Pass `random()` as a constructor parameter with `Math.random` as default. All randomness flows through the injected function.

**When:** Any system that needs deterministic replay or testing.

**Why:** Tests can inject a fixed-sequence PRNG to assert exact behavior. Seeded performances fall out naturally. No global state mutation.

### Pattern 2: Audio Graph as Late-Bound Connections

**What:** VoicePool voices are created unconnected. The Scheduler connects them to the appropriate per-performer pan chain at claim time and disconnects at release.

**When:** Per-note routing that varies by performer/instrument in a shared voice pool.

**Why:** Avoids multiplying voice count per performer. Keeps voice stealing working. Connection/disconnection is cheap (just graph edge manipulation, no buffer copies).

### Pattern 3: Normalized-Then-Scale for Physical Parameters

**What:** Timing offset and pan position are stored as normalized values (-1 to +1). Conversion to physical units (milliseconds, StereoPannerNode values) happens at the boundary.

**When:** Any parameter that crosses from musical domain to audio domain.

**Why:** Musical logic stays unit-free. Physical constraints (lookahead window, pan range) are applied once at the output boundary. Easy to adjust physical ranges without touching musical logic.

### Pattern 4: Read-Only Visualization

**What:** Visualization components only read from `EnsembleEngineState`. They never write back or modify audio/ensemble behavior.

**When:** Adding any display/visualization feature.

**Why:** Keeps the audio path pure and untouched. No risk of visualization bugs affecting audio timing. Easy to add/remove visualizations without regression risk.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Global Math.random Override

**What:** Replacing `Math.random` globally with a seeded PRNG.

**Why bad:** Affects all code including React internals, smplr sample loading, CSS transitions, and any future third-party code. Impossible to scope. Non-deterministic call order from framework code would desync the PRNG stream.

**Instead:** Inject `random()` through constructor parameters. Only ensemble/velocity code uses it.

### Anti-Pattern 2: Per-Performer Voice Pools for Stereo

**What:** Creating separate VoicePool instances per performer, each with its own pan position.

**Why bad:** 4 performers x 8 voices = 32 AudioWorkletNodes (vs current 8). Voice stealing becomes per-performer instead of global, wasting capacity. A quiet performer holds voices that a busy performer needs.

**Instead:** Shared voice pool with dynamic per-note connection routing.

### Anti-Pattern 3: Microtiming in the AudioWorklet

**What:** Implementing timing offsets inside `synth-processor.js` by delaying sample output.

**Why bad:** The AudioWorklet processes fixed 128-sample blocks. Sub-block timing requires sample-accurate offset tracking, adds complexity, and doesn't help the SamplePlayer path at all. The Scheduler already has sub-millisecond scheduling precision via `AudioContext.currentTime`.

**Instead:** Apply timing offset to the scheduled `time` parameter in the Scheduler (main thread), which the AudioContext handles with sample accuracy.

### Anti-Pattern 4: Storing Visualization State in Ensemble

**What:** Adding rendering-specific fields (colors, positions, animation state) to `AgentState` or `EnsembleSnapshot`.

**Why bad:** Couples musical logic to rendering. Ensemble should be framework-agnostic. Animation state changes at 60fps but ensemble state changes at ~4-8Hz (eighth notes at 120 BPM).

**Instead:** Visualization derives everything from `PerformerState`. Animation state (flash timers, interpolation) lives in the canvas renderer.

## Suggested Build Order

Dependencies dictate this order:

### Phase 1: Seeded PRNG (Foundation -- everything else depends on this)

1. Create `src/score/prng.ts` (mulberry32 + randomSeed)
2. Modify `ensemble.ts`: add `random` parameter, replace all `Math.random()` calls
3. Modify `velocity.ts`: add `random` parameter to computeVelocity and generateVelocityPersonality
4. Modify `engine.ts`: accept optional seed, create PRNG, pass to Ensemble
5. Unit test: same seed produces identical event sequences
6. Create `src/score/seed-config.ts` (URL encode/decode)
7. Modify `App.tsx`: read seed from URL hash on load, write on start

**Why first:** Seeded PRNG is the foundation for deterministic performances. Microtiming will use the same PRNG. Must be done before microtiming. The share URL feature requires this.

### Phase 2: Microtiming (Extends PRNG, extends humanization)

1. Add `timingBias` / `timingVariance` to `AgentPersonality`
2. Add `timingOffset` to `AgentNoteEvent`
3. Implement `computeMicrotiming()` in `PerformerAgent` using the seeded `random()`
4. Modify `Scheduler.scheduleBeat()`: apply timing offset to scheduled time
5. Add timing config to `HumanizationConfig`, expose in Engine
6. Update `HumanizationToggle` UI

**Why second:** Depends on PRNG (phase 1). Small, focused change. Completes the "humanization" feature set alongside existing velocity humanization.

### Phase 3: Stereo Spread (Independent audio graph change)

1. Create `src/audio/stereo-field.ts`
2. Modify `VoicePool`: voices start unconnected (remove masterGain connection in constructor)
3. Modify `Scheduler`: connect/disconnect voices through StereoField per note
4. Modify `SamplePlayer`: create per-performer instrument instances with StereoField routing
5. Modify `Engine`: create StereoField, pass to components, update spread on performer count changes
6. Handle edge cases: voice stealing with reconnection, performer add/remove

**Why third:** Independent of PRNG/microtiming. Requires careful audio graph work. Higher risk of audio glitches -- needs dedicated testing.

### Phase 4: Pattern Visualization (Pure UI, no audio changes)

1. Add `lastNoteOnBeat` to PerformerState, `beatCounter` to EnsembleEngineState
2. Create `src/canvas/score-renderer.ts` (pure draw functions)
3. Create `src/canvas/ScoreOverview.tsx` (React wrapper)
4. Enhance `src/canvas/renderer.ts` with repetition arc + note-on flash
5. Add ScoreOverview to App.tsx layout
6. Polish: responsive sizing, theme integration

**Why last:** Zero dependency on other features. Pure additive UI. Lowest risk. Can be shipped independently.

## Scalability Considerations

| Concern | 4 performers | 8 performers | 16 performers |
|---------|-------------|-------------|---------------|
| StereoPannerNodes | 4 nodes | 8 nodes | 16 nodes |
| Voice reconnections/sec | ~16 (4 voices/sec avg) | ~32 | ~64 |
| PRNG calls per tick | ~20 | ~40 | ~80 |
| Sample instances (smplr) | 2-3 | 4-5 | 8-10 |
| Score overview render | 53 cells + 4 markers | 53 + 8 markers | 53 + 16 markers |

All within comfortable limits. The most expensive item is smplr instrument instances (sample memory), but even 10 instances is manageable for modern browsers.

## Sources

- [StereoPannerNode - MDN](https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode) - pan property, -1 to +1, equal-power panning (HIGH confidence)
- [smplr GitHub](https://github.com/danigb/smplr) - `destination` option accepts AudioNode, confirmed via codebase + docs (HIGH confidence)
- [Mulberry32 PRNG](https://github.com/cprosche/mulberry32) - 32-bit seeded PRNG, ~10 lines, period ~2^32 (HIGH confidence)
- [Microtiming in music](https://pmc.ncbi.nlm.nih.gov/articles/PMC4542135/) - 5-20ms timing deviations create groove (HIGH confidence, academic source)
- [BeepBox](https://www.beepbox.co/) - precedent for URL hash containing all performance state (HIGH confidence)
- Direct codebase analysis of engine.ts, scheduler.ts, ensemble.ts, voice-pool.ts, sampler.ts, synth-processor.js, renderer.ts, theme.ts (HIGH confidence)
