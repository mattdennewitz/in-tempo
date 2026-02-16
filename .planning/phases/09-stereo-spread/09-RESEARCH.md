# Phase 9: Stereo Spread - Research

**Researched:** 2026-02-15
**Domain:** Web Audio stereo panning, per-performer spatial positioning
**Confidence:** HIGH

## Summary

Stereo spread assigns each performer a distinct position in the stereo field using the Web Audio API's `StereoPannerNode`. The core challenge is that InTempo has three distinct audio paths -- synth voices (AudioWorklet via VoicePool), piano (smplr SplendidGrandPiano), and marimba (smplr Soundfont) -- each with different routing architectures. Synth voices route through VoicePool's shared `masterGain`; sampled instruments route through SamplePlayer's shared `masterGain`. Neither path currently supports per-performer panning.

The key architectural decision is where to insert `StereoPannerNode` instances. For synth voices, each `AudioWorkletNode` in the VoicePool can be disconnected from the shared masterGain and reconnected through a per-performer pan node. However, the VoicePool uses voice stealing -- a single voice may play notes for different performers across its lifetime -- so pan must be set dynamically when a voice is claimed, not statically at creation. For sampled instruments (piano/marimba), smplr does NOT support per-note audio routing. The `SampleStart` type has no `destination` field; all notes from a `SplendidGrandPiano` or `Soundfont` instance route through the instrument's single `output` channel. This means per-performer panning for sampled instruments requires either: (a) creating one smplr instrument instance per performer (expensive -- each loads its own sample buffers), or (b) creating one smplr instrument instance per unique pan position and routing performers with the same pan position to the same instance.

Pan positions are computed deterministically from performer ID and total performer count, using even distribution across the stereo field. With the seeded PRNG from Phase 7, the same performer ID always maps to the same pan value, satisfying STE-02. The distribution formula `pan = -1 + (2 * i) / (n - 1)` for `n` performers produces even spread from hard left (-1) to hard right (+1), satisfying STE-03.

**Primary recommendation:** Use `StereoPannerNode` (one per performer). For synth voices, dynamically set the pan value when a voice is claimed in the scheduler. For sampled instruments, create per-performer smplr instances routed through per-performer pan nodes, sharing a `CacheStorage` to avoid redundant network fetches. Accept the memory cost (sample buffers are shared via the browser's HTTP cache, but decoded AudioBuffers are duplicated per instance).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio `StereoPannerNode` | Built-in | Stereo positioning per performer | Native API, lightweight, single `pan` parameter (-1 to +1) |
| Web Audio `GainNode` | Built-in | Per-performer volume control and master mix | Already used throughout codebase |
| SeededRng (src/score/rng.ts) | Internal | Deterministic pan assignment shuffle | Phase 7 foundation; ensures same seed = same pan positions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| smplr `CacheStorage` | 0.16.4 | Share downloaded samples across multiple instrument instances | When creating per-performer piano/marimba instances to avoid redundant CDN fetches |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `StereoPannerNode` | `PannerNode` (3D/HRTF) | Explicitly out of scope per requirements. StereoPannerNode is simpler, lighter, and sufficient for stereo positioning |
| Per-performer smplr instances | Single instance + ChannelSplitterNode post-processing | smplr's internal routing is opaque; post-processing the mixed output cannot separate per-note audio. Per-performer instances are the only reliable approach |
| Deterministic formula for pan positions | PRNG-shuffled pan slots | Formula is simpler and guarantees even spread. PRNG shuffle could cluster positions. Use deterministic formula with optional PRNG shuffle of slot assignment |

**Installation:**
```bash
# No new dependencies required
```

## Architecture Patterns

### Recommended Project Structure
```
src/audio/
  panner.ts          # NEW: Pan position computation + StereoPannerNode management
  panner.test.ts     # NEW: Unit tests for pan computations
  sampler.ts         # MODIFY: Support per-performer instances with pan routing
  voice-pool.ts      # MODIFY: Route voices through per-performer pan nodes
  scheduler.ts       # MODIFY: Pass performer pan context when claiming voices / playing samples
  engine.ts          # MODIFY: Create pan infrastructure during initialize()
  types.ts           # MODIFY: Add pan position to PerformerState
```

### Pattern 1: Even Pan Distribution
**What:** Compute deterministic pan positions that spread performers evenly across the stereo field.
**When to use:** At ensemble creation and when performers are added/removed.
**Example:**
```typescript
/**
 * Compute pan positions for n performers, evenly distributed from -1 to +1.
 * For 1 performer: center (0).
 * For 2 performers: -1, +1.
 * For n performers: -1 + 2*i/(n-1) for i in [0, n-1].
 *
 * Slot assignment is shuffled using SeededRng so performer 0 isn't always hard-left.
 */
export function computePanPositions(count: number, rng: SeededRng): number[] {
  if (count === 1) return [0];

  // Generate evenly-spaced slots
  const slots: number[] = [];
  for (let i = 0; i < count; i++) {
    slots.push(-1 + (2 * i) / (count - 1));
  }

  // Fisher-Yates shuffle with seeded RNG for deterministic assignment
  for (let i = slots.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  return slots;
}
```

### Pattern 2: Per-Performer StereoPannerNode
**What:** Each performer gets a dedicated `StereoPannerNode` that all their audio routes through.
**When to use:** Created during engine initialization, one per performer.
**Example:**
```typescript
// Per-performer pan node creation
function createPerformerPanNode(
  audioContext: AudioContext,
  panValue: number,
  destination: AudioNode,
): StereoPannerNode {
  const panner = audioContext.createStereoPanner();
  panner.pan.value = panValue;
  panner.connect(destination);
  return panner;
}
```

### Pattern 3: Dynamic Voice Routing in Scheduler
**What:** When the scheduler claims a synth voice and schedules a note, it routes that voice through the correct performer's pan node.
**When to use:** Every synth note in `scheduleBeat()`.
**Example:**
```typescript
// In scheduleBeat(), for synth voices:
const voice = this.voicePool.claim();

// Disconnect from default destination, connect through performer's pan node
voice.node.disconnect();
voice.node.connect(this.performerPanNodes.get(event.performerId)!);

// Schedule the note as before
voice.node.port.postMessage({ type: 'noteOn', frequency, time: offsetTime, gain: ... });
```
**Caveat:** Frequent disconnect/connect calls on AudioWorkletNodes may cause clicks. An alternative is to maintain a fixed voice-to-panNode mapping and accept that voice stealing may briefly route a voice through the wrong pan position during the crossfade. See Pitfall 3.

### Pattern 4: Per-Performer Sampled Instruments
**What:** Instead of one shared piano and one shared marimba, create one instance per performer that uses that instrument type. Route each through the performer's pan node.
**When to use:** During SamplePlayer initialization.
**Example:**
```typescript
// Create per-performer piano/marimba instances
// smplr CacheStorage ensures samples are fetched once from CDN
const storage = new CacheStorage();

for (const performer of performers) {
  const instrument = assignInstrument(performer.id);
  if (instrument === 'piano') {
    const piano = new SplendidGrandPiano(audioContext, {
      destination: performerPanNodes.get(performer.id)!,
      storage,
    });
    await piano.load;
    performerInstruments.set(performer.id, piano);
  } else if (instrument === 'marimba') {
    const marimba = new Soundfont(audioContext, {
      instrument: 'marimba',
      destination: performerPanNodes.get(performer.id)!,
      storage,
    });
    await marimba.load;
    performerInstruments.set(performer.id, marimba);
  }
}
```

### Pattern 5: Simpler Alternative -- Instrument-Level Panning (Fallback)
**What:** Instead of per-performer instances, create 2-3 instances per instrument type at different pan positions, and assign performers to the nearest instance.
**When to use:** If per-performer instances prove too memory-heavy or slow to load.
**Example:**
```typescript
// 3 piano instances at left, center, right
const pianoLeft = new SplendidGrandPiano(ctx, { destination: panNodeLeft, storage });
const pianoCenter = new SplendidGrandPiano(ctx, { destination: panNodeCenter, storage });
const pianoRight = new SplendidGrandPiano(ctx, { destination: panNodeRight, storage });

// Map performer to nearest instance based on their pan position
function getPerformerInstrument(performerId: number, pan: number): SplendidGrandPiano {
  if (pan < -0.33) return pianoLeft;
  if (pan > 0.33) return pianoRight;
  return pianoCenter;
}
```
**Tradeoff:** Coarser spatial resolution for sampled instruments (3 positions instead of N), but dramatically fewer instances to load. Given max 16 performers with ~5-6 pianos, this reduces from 6 piano instances to 3.

### Anti-Patterns to Avoid
- **PannerNode with HRTF:** Explicitly out of scope. Adds latency, complexity, and most users on laptop speakers won't benefit from 3D positioning.
- **Panning in the AudioWorkletProcessor:** Adding pan logic inside `synth-processor.js` would require stereo output from the worklet. The current mono worklet + external StereoPannerNode is cleaner and more flexible.
- **Shared voice pool with static pan assignment:** Voices are pooled and stolen, so a voice's performer changes over time. Pan must be dynamic or voices must be partitioned per performer (wasteful).
- **Creating new smplr instances per note:** Each instance loads samples. Creating them per note would be catastrophically slow. Create them per performer at initialization.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stereo panning algorithm | Custom gain-splitting to L/R channels | `StereoPannerNode` | Native implementation handles equal-power panning correctly; hand-rolled gain splitting produces volume dips at center |
| Sample caching across instances | Custom AudioBuffer sharing | smplr `CacheStorage` | CacheStorage uses browser Cache API to avoid redundant network fetches; decoded buffers are managed by smplr internally |

**Key insight:** `StereoPannerNode` uses equal-power panning (constant-power crossfade between channels), which prevents the perceived volume dip at center that naive linear panning produces. This is a one-line creation (`audioContext.createStereoPanner()`) versus a multi-line gain calculation with `Math.cos`/`Math.sin`.

## Common Pitfalls

### Pitfall 1: Voice Stealing Breaks Pan Position
**What goes wrong:** A synth voice is claimed for performer A (panned left), then stolen for performer B (panned right). If the voice is still connected to performer A's pan node, performer B's note plays from the wrong position.
**Why it happens:** VoicePool.claim() returns the oldest voice, which may still be connected to a different performer's pan node.
**How to avoid:** In the scheduler, when claiming a voice, always disconnect it from its current destination and reconnect to the correct performer's pan node before sending the noteOn message. The ~2ms voice-steal decay in the synth processor provides a natural crossfade that masks the routing change.
**Warning signs:** Notes briefly appearing at wrong pan positions, especially during dense passages with many voice steals.

### Pitfall 2: Memory Explosion from Per-Performer Sampled Instruments
**What goes wrong:** Creating 16 SplendidGrandPiano instances loads 16 copies of decoded audio buffers into memory. Piano samples are large (tens of MB decoded).
**Why it happens:** smplr decodes audio buffers per instance even if the raw files are cached.
**How to avoid:** Use the fallback Pattern 5 (3 instances per instrument type at left/center/right). Alternatively, profile actual memory usage -- with `CacheStorage`, the network cost is eliminated; only decoded buffer memory grows. For max 16 performers with ~5-6 pianos, this is 5-6 instances, which may be acceptable on desktop.
**Warning signs:** Page memory exceeding 500MB, initialization taking >5 seconds, mobile/low-memory devices crashing.

### Pitfall 3: Audio Clicks from Disconnect/Connect
**What goes wrong:** Calling `node.disconnect()` then `node.connect(newDest)` on an AudioWorkletNode that is currently producing audio causes an audible click.
**Why it happens:** The disconnect creates a momentary gap in the audio graph before the new connection is established.
**How to avoid:** Two options: (a) Use a GainNode crossfade -- fade the voice to zero, disconnect/reconnect, fade back up. The synth processor's 2ms voice-steal decay already does this if you send a `stop` before the routing change. (b) Keep voices permanently connected to ALL performer pan nodes via a fan-out, and control routing with per-connection GainNodes (0 or 1). This is complex but click-free. **Recommended:** Option (a) -- the voice steal mechanism already handles this gracefully.
**Warning signs:** Audible clicks or pops during voice steals in dense passages.

### Pitfall 4: Pan Position Recalculation on Add/Remove Performer
**What goes wrong:** When a performer is added or removed during playback, all pan positions shift (since positions depend on count). This causes audible spatial jumps for all performers.
**Why it happens:** The even-distribution formula `pan = -1 + 2*i/(n-1)` changes all values when n changes.
**How to avoid:** Assign pan positions at ensemble creation time and keep them stable. When a performer is added, assign the new performer a position that fills the largest gap in the current distribution. When a performer is removed, leave the remaining performers' positions unchanged. This means positions are only perfectly even at creation time, but they remain stable during playback.
**Warning signs:** All performers audibly shifting position when one is added or removed.

### Pitfall 5: Pulse Generator Not Panned
**What goes wrong:** The pulse generator (high C reference pulse) currently connects directly to `audioContext.destination`. If all performers are panned away from center, the pulse sits at center and sounds disconnected from the ensemble.
**Why it happens:** PulseGenerator is not a performer and has no pan assignment.
**How to avoid:** Keep the pulse at center (pan=0). This is musically correct -- the pulse is a metronome reference, not a performer. It should be spatially neutral.
**Warning signs:** None -- center is correct.

### Pitfall 6: RNG Call Order for Pan Positions
**What goes wrong:** Adding pan position computation to the initialization sequence changes the PRNG call order, which changes all subsequent random values (personality, entry delays, etc.) for a given seed.
**Why it happens:** Single shared RNG stream (Phase 7 decision).
**How to avoid:** Compute pan positions AFTER all other ensemble initialization (personality generation, entry delays). This way, adding pan computation appends new RNG calls at the end rather than inserting them in the middle. Seeds from before Phase 9 will still produce different performances, but the change is minimized. Document that seed behavior changes.
**Warning signs:** Comparison tests against pre-Phase-9 recordings will show different performer behaviors.

## Code Examples

### StereoPannerNode Creation and Usage
```typescript
// Source: Web Audio API specification (W3C)
// StereoPannerNode is a simple stereo positioner with a single 'pan' AudioParam
const panner = audioContext.createStereoPanner();
panner.pan.value = -0.5; // 50% left
panner.connect(audioContext.destination);

// pan.value range: -1 (hard left) to +1 (hard right), 0 = center
// Uses equal-power panning (no volume dip at center)
```

### Connecting smplr Instruments to Custom Destination
```typescript
// Source: smplr library API (verified from index.d.ts)
// Both SplendidGrandPiano and Soundfont accept a 'destination' option
import { SplendidGrandPiano, Soundfont, CacheStorage } from 'smplr';

const storage = new CacheStorage();
const panNode = audioContext.createStereoPanner();
panNode.pan.value = 0.3;
panNode.connect(masterGain);

const piano = new SplendidGrandPiano(audioContext, {
  destination: panNode,  // Routes all piano output through this pan node
  storage,               // Shares cached downloads across instances
});
await piano.load;
```

### Pan Position Assignment for N Performers
```typescript
// Deterministic, evenly-distributed pan positions
function assignPanPositions(count: number, rng: SeededRng): Map<number, number> {
  const positions = new Map<number, number>();
  if (count === 1) {
    positions.set(0, 0); // Single performer at center
    return positions;
  }

  // Generate evenly-spaced slots
  const slots: number[] = [];
  for (let i = 0; i < count; i++) {
    slots.push(parseFloat((-1 + (2 * i) / (count - 1)).toFixed(4)));
  }

  // Shuffle slot assignment (not the slots themselves) using seeded RNG
  const indices = Array.from({ length: count }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  for (let i = 0; i < count; i++) {
    positions.set(i, slots[indices[i]]);
  }

  return positions;
}
```

### Integration Point: Scheduler.scheduleBeat() with Panning
```typescript
// Modified scheduleBeat() routing synth voices through per-performer pan nodes
if (instrument === 'synth') {
  const voice = this.voicePool.claim();
  const frequency = midiToFrequency(event.midi);

  // Route through performer's pan node
  voice.node.disconnect();
  const panNode = this.performerPanNodes.get(event.performerId);
  if (panNode) {
    voice.node.connect(panNode);
  }

  voice.node.port.postMessage({ type: 'noteOn', frequency, time: offsetTime, gain: event.velocity * 0.3 });
  // ... release timer as before
} else {
  // Route through per-performer sampled instrument (already connected to correct pan node)
  const playerInstrument = this.performerInstruments.get(event.performerId);
  if (playerInstrument) {
    const smplrVelocity = Math.round(event.velocity * 127);
    playerInstrument.start({ note: event.midi, time: offsetTime, duration: noteDurationSeconds, velocity: smplrVelocity });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `PannerNode` (3D positioning) | `StereoPannerNode` (2D stereo) | Chrome 42+ / 2015 | Simpler API for stereo-only use cases |
| Manual gain splitting (L/R) | `StereoPannerNode` equal-power | Always available | Native equal-power panning prevents volume dips |

**Deprecated/outdated:**
- None. `StereoPannerNode` is stable and universally supported (all modern browsers since 2015+).

## Open Questions

1. **Per-performer vs. per-instrument-group smplr instances?**
   - What we know: smplr has no per-note destination routing. Per-performer instances (up to 16) each decode their own audio buffers. Per-group instances (3 per instrument type = left/center/right) reduce memory at the cost of coarser spatial resolution.
   - What's unclear: Actual memory cost of decoded SplendidGrandPiano buffers. If each instance adds ~20MB decoded, 6 piano instances = 120MB, which is borderline.
   - Recommendation: Start with per-group (3 positions per instrument type). If memory is acceptable, upgrade to per-performer. Profile during implementation. The architecture should support both approaches with minimal refactoring -- the key abstraction is "given a performerId, return the smplr instrument instance to use."

2. **Should voice pool be partitioned per-performer instead of shared?**
   - What we know: Currently all voices are in one pool. Per-performer partitioning would eliminate the need for dynamic disconnect/connect but wastes voices (a silent performer's voices sit idle).
   - What's unclear: Whether dynamic disconnect/connect causes audible clicks.
   - Recommendation: Keep the shared pool with dynamic routing. The synth processor's 2ms voice-steal decay provides a natural crossfade. If clicks are audible in testing, switch to per-performer partitioning.

3. **Pan position stability when performers are added/removed during playback?**
   - What we know: Pan positions computed from performer count change when count changes. During playback, performers can be added/removed.
   - What's unclear: Whether the spatial jump is noticeable.
   - Recommendation: Assign pan positions at ensemble creation and store them. New performers get a position filling the largest gap. Removed performers' positions are freed but remaining performers don't move.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/audio/voice-pool.ts` -- voice pool routing, masterGain, voice stealing mechanism
- Codebase analysis: `src/audio/sampler.ts` -- smplr SplendidGrandPiano and Soundfont instantiation, destination routing
- Codebase analysis: `src/audio/scheduler.ts` -- note scheduling, instrument routing in scheduleBeat()
- Codebase analysis: `src/audio/engine.ts` -- initialization sequence, performer management
- Codebase analysis: `src/score/ensemble.ts` -- performer creation, PRNG call order, AgentNoteEvent
- smplr type definitions: `node_modules/smplr/dist/index.d.ts` -- SampleStart type (no per-note destination), SplendidGrandPianoConfig (has destination), SoundfontOptions (has destination), CacheStorage class
- Web Audio API: `StereoPannerNode` -- built-in, pan AudioParam range -1 to +1, equal-power panning

### Secondary (MEDIUM confidence)
- smplr memory characteristics: Each instrument instance decodes its own AudioBuffers. CacheStorage prevents redundant network fetches but not redundant decoding. Actual memory per piano instance needs runtime profiling.

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - StereoPannerNode is a stable, well-documented Web Audio API node; no external dependencies needed
- Architecture: HIGH - All three audio paths (synth, piano, marimba) analyzed; routing constraints verified from smplr type definitions
- Pitfalls: HIGH - Voice stealing, memory, and click concerns are well-understood Web Audio patterns; smplr per-note routing limitation confirmed from type definitions

**Research date:** 2026-02-15
**Valid until:** 2026-06-15 (stable domain, no moving targets)
