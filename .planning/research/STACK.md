# Technology Stack: v1.2 Polish Features

**Project:** InTempo -- Browser-Based Generative Performance Engine
**Researched:** 2026-02-15
**Scope:** Stereo spread, seeded PRNG (shareable performances), pattern visualization, microtiming (swing/rubato)

## Existing Stack (validated, not re-researched)

React 19 + Vite 7 + TypeScript 5.9 + Tailwind CSS v4 + shadcn/ui, Web Audio API with AudioWorklet, smplr ^0.16.4 for sampled instruments, midi-writer-js ^3.1.1 for MIDI export, Canvas 2D performer grid, four-layer velocity humanization, lookahead scheduler with eighth-note beat clock, VoicePool with voice stealing.

---

## New Dependencies

### Seeded PRNG: Zero-Dependency Mulberry32

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Mulberry32 (hand-rolled) | N/A | Deterministic random number generation for reproducible performances | ~15 lines of TypeScript. No library needed. Mulberry32 is a proven 32-bit PRNG with good statistical quality for game/music applications. Period of ~4 billion -- far more than InTempo will ever consume in a single performance. Avoids adding a dependency for what is fundamentally a hash function. | HIGH |

**Why not a library:**

| Library | Why Rejected |
|---------|-------------|
| seedrandom (3.0.5) | CommonJS-first. Requires `@types/seedrandom` separately. Last updated years ago. The ESM story is fragmented across forks (esm-seedrandom, ts-seedrandom). For ~15 lines of code, a dependency adds more complexity than it removes. |
| esm-seedrandom | Fork of seedrandom ported to ESM. Low adoption. Adds a dependency for a trivial algorithm. |
| pure-rand (6.0.0) | Excellent library (TypeScript-native, immutable API, multiple algorithms). But its functional style (`[value, nextRng] = rng.next()`) is a poor fit for InTempo's imperative `Math.random()` call sites. Refactoring ~40 call sites to thread immutable state would be high-churn for no musical benefit. Overkill. |

**Implementation (complete):**

```typescript
// src/lib/prng.ts -- ~15 lines

export function createPRNG(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Usage: drop-in Math.random() replacement
const rng = createPRNG(12345);
rng(); // 0.xxxxx -- always the same sequence for seed 12345
```

**Seed encoding for shareable URLs:** Use a 6-character base36 string in URL search params (`?seed=abc123`). Decode to integer via `parseInt(seed, 36)`. This gives ~2.1 billion unique seeds in a compact, URL-safe format. No additional library needed.

```typescript
// Encode: Math.floor(Math.random() * 2_147_483_647).toString(36) -> "1a2b3c"
// Decode: parseInt("1a2b3c", 36) -> number
// URL:    https://intempo.app/?seed=1a2b3c&mode=riley&bpm=120&performers=6
```

### No Other New Dependencies Required

Stereo spread, pattern visualization, and microtiming are all built on Web APIs and patterns already in the codebase. Zero new npm packages.

---

## Feature-by-Feature Stack Decisions

### 1. Stereo Spread: Web Audio StereoPannerNode (built-in)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| StereoPannerNode | Web Audio API (baseline since April 2021) | Per-performer stereo positioning | Native browser API. Equal-power panning algorithm built in. `pan` AudioParam supports a-rate automation (smooth panning transitions). Range -1 (left) to +1 (right). Zero bundle cost. | HIGH |

**Integration with existing audio graph:**

The current audio graph routes all sound through two paths to `audioContext.destination`:
- VoicePool: `AudioWorkletNode -> masterGain -> destination`
- SamplePlayer: `smplr instrument -> masterGain -> destination`

Stereo panning must be inserted **per-performer**, not per-voice-pool. This means the panner node lives between the instrument output and the shared gain stage.

**Architecture change -- Per-performer channel strips:**

```
Before:  voice.node -> voicePool.masterGain -> destination
After:   voice.node -> performerPanner -> performerGain -> masterBus -> destination
```

Each performer gets a `StereoPannerNode` with a deterministic pan position based on performer count:

```typescript
// Spread N performers evenly across stereo field
// Performer 0: -0.8, Performer 1: +0.8, Performer 2: -0.4, etc.
function panPosition(performerId: number, totalPerformers: number): number {
  if (totalPerformers <= 1) return 0;
  const spread = 0.8; // don't hard-pan to edges
  return ((performerId / (totalPerformers - 1)) * 2 - 1) * spread;
}
```

**Impact on VoicePool:** Currently voices connect to a shared `masterGain`. With per-performer panning, claimed voices must be routed to the correct performer's panner. This requires the Scheduler to pass performer context when claiming voices, or (simpler) disconnect/reconnect the voice output to the appropriate panner at claim time.

**Impact on SamplePlayer:** smplr instruments connect to a shared `masterGain`. Per-performer panning requires either:
- (A) Multiple smplr instances (one per performer) -- wasteful, duplicates sample memory
- (B) Route smplr output through a splitter, then per-performer panners -- complex, smplr doesn't expose per-note routing
- (C) **Recommended:** Create per-performer `GainNode -> StereoPannerNode` chains, and pass them as `destination` to smplr's `start()` call. smplr's `start({ destination })` option allows per-note output routing.

**Confidence note:** smplr's per-note `destination` option needs verification during implementation. If unavailable, fall back to approach (A) with 3 instances (one per instrument type, panning at the instrument level rather than performer level). This would still provide spatial separation between instrument groups.

### 2. Seeded PRNG: Replace Math.random() Calls

**Scope of change:** The codebase has ~40 `Math.random()` calls across 5 files:

| File | Call Count | Purpose |
|------|-----------|---------|
| `src/score/ensemble.ts` | ~15 | Weighted choices, personality generation, entry delays, dropout/rejoin |
| `src/score/performer.ts` | ~4 | Repetition counts, pattern skip probability |
| `src/score/velocity.ts` | ~4 | Jitter, personality generation |
| `src/score/euclidean.ts` | ~12 | Pitch selection, rhythm generation, rotation |
| `src/score/generative.ts` | ~10 | Interval selection, rest probability, motif transform |

**Strategy:** Thread a `rng: () => number` function through `Ensemble` -> `PerformerAgent` -> score generators. The PRNG instance lives on `Ensemble` (created from seed at construction time). All downstream consumers receive `rng` instead of calling `Math.random()`.

**What stays non-deterministic:** Velocity jitter. The `computeVelocity()` jitter layer uses `Math.random()` intentionally -- velocity micro-variation should differ on replay to keep the "live" feel. Only structural decisions (pattern choice, advancement, dropout) need determinism for shareable performances.

### 3. Pattern Visualization: Canvas 2D (already in stack)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Canvas 2D API | Browser built-in | Abstract geometry per performer + score overview | Already used for performer grid (`src/canvas/renderer.ts`). Team has working Canvas infrastructure (HiDPI setup, theme system, requestAnimationFrame). Adding a second canvas or expanding the existing one is incremental. No WebGL or library needed for 2D geometric shapes. | HIGH |

**What NOT to add:**

| Temptation | Why Avoid |
|------------|-----------|
| p5.js | 500KB+ library. Canvas 2D API is sufficient for geometric shapes. p5.js is for creative coding exploration, not production UI components. |
| Three.js / WebGL | 3D is unnecessary. The visualization is abstract 2D geometry (circles, arcs, polygons). WebGL adds GPU context management complexity for zero visual benefit. |
| D3.js | Data visualization library. The pattern visualization is generative art, not charts. D3's DOM-bindng model conflicts with Canvas rendering. |
| SVG | Performer count is dynamic (2-16), each with animated shapes. Canvas is more performant for frequent redraws than SVG DOM manipulation. The existing canvas infrastructure proves this approach works. |

**Two visualization targets:**

1. **Per-performer abstract geometry:** Each performer gets a procedurally generated shape based on their personality parameters (advanceBias, repeatBias, dropoutBias, baseLoudness). The shape animates based on current state (playing/silent/complete, current pattern, repetition count). This replaces or augments the current card-based performer grid.

2. **Score overview / timeline:** A horizontal track showing all patterns with performer positions marked. Shows the "band" of active patterns and each performer's progress. This is a new component, not a modification of the existing canvas.

Both use the existing `PALETTE` from `src/canvas/theme.ts` and the `setupCanvas()` HiDPI helper from `src/canvas/renderer.ts`.

### 4. Microtiming (Swing/Rubato): Scheduler Timing Offsets

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Scheduler timing math | Existing code | Add per-beat timing offsets for swing and rubato feel | Pure arithmetic on `nextNoteTime` in the existing Scheduler. No library or API needed. The lookahead scheduler already works with sub-millisecond AudioContext timing. | HIGH |

**Swing implementation:**

Swing delays every other eighth note by a percentage of the eighth-note duration. The existing `advanceTime()` method is the single point of change:

```typescript
// Current:
private advanceTime(): void {
  const secondsPerEighth = 60 / (this._bpm * 2);
  this.nextNoteTime += secondsPerEighth;
}

// With swing:
private advanceTime(): void {
  const secondsPerEighth = 60 / (this._bpm * 2);
  const isOffbeat = this.beatCounter % 2 === 1;
  const swingOffset = isOffbeat ? secondsPerEighth * this._swingAmount : 0;
  // Compensate: shorten the following on-beat by the same amount
  const compensation = !isOffbeat && this._swingAmount > 0
    ? -secondsPerEighth * this._swingAmount : 0;
  this.nextNoteTime += secondsPerEighth + swingOffset + compensation;
}
```

`swingAmount` range: 0.0 (straight) to 0.33 (triplet swing). Default 0.0.

**Rubato implementation:**

Rubato adds per-performer timing variation -- slight early/late offsets to note start times. This is applied in `scheduleBeat()` when scheduling individual notes, not in `advanceTime()` (which controls the global grid).

```typescript
// In scheduleBeat(), per-event:
const rubatoOffset = this._rubatoEnabled
  ? (rng() - 0.5) * secondsPerEighth * this._rubatoAmount * 2
  : 0;
const noteTime = time + rubatoOffset;
```

`rubatoAmount` range: 0.0 to 0.08 (max ~8% of beat duration). Subtle values (0.02-0.04) create a natural "breathing" feel without audible timing errors.

**Critical constraint:** Rubato offsets must never push a note past the next beat boundary, or notes will overlap/reorder. Clamp: `Math.max(-secondsPerEighth * 0.3, Math.min(secondsPerEighth * 0.3, rubatoOffset))`.

---

## Recommended Stack (Complete)

### Core Framework (unchanged)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | ^19.2.0 | UI framework | Existing |
| Vite | ^7.3.1 | Build tool | Existing |
| TypeScript | ~5.9.3 | Type safety | Existing |
| Tailwind CSS | ^4.1.18 | Styling | Existing |
| shadcn/ui | ^3.8.4 | UI components | Existing |

### Audio (unchanged + StereoPannerNode)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Web Audio API | Browser built-in | Audio synthesis and routing | Existing |
| AudioWorklet | Browser built-in | Low-latency synth processing | Existing |
| StereoPannerNode | Browser built-in | Per-performer stereo positioning | **NEW.** Native equal-power panning. Baseline browser support since April 2021. |
| smplr | ^0.16.4 | Sampled piano + marimba | Existing |

### Score/Composition (unchanged + Mulberry32)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| midi-writer-js | ^3.1.1 | MIDI file export | Existing |
| Mulberry32 PRNG | Hand-rolled (~15 LOC) | Deterministic performance replay | **NEW.** Zero-dependency. Drop-in Math.random() replacement. Enables shareable seed URLs. |

### Visualization (unchanged, expanded use)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Canvas 2D API | Browser built-in | Performer geometry + score overview | Existing infrastructure expanded. No new libraries. |

---

## What NOT to Add

| Temptation | Why Avoid |
|------------|-----------|
| seedrandom / esm-seedrandom | Dependency for ~15 lines of trivial code. ESM support is fragmented across forks. |
| pure-rand | Excellent library but functional/immutable API requires refactoring ~40 call sites to thread state. Poor fit for InTempo's imperative style. |
| p5.js | 500KB creative coding framework. Canvas 2D API is sufficient. |
| Three.js / WebGL | 3D rendering for 2D geometric visualization. Unnecessary complexity. |
| D3.js | Data visualization library. Wrong abstraction for generative art. |
| Tone.js | Full audio framework. Would conflict with existing AudioWorklet/VoicePool architecture. |
| Web Audio PannerNode (3D) | Full HRTF 3D spatialization. StereoPannerNode is simpler and correct for stereo spread. |
| Howler.js | Audio playback library. Already have Web Audio API direct control. |
| URL shortener service | For sharing seeds. Base36 seeds are already compact (6 chars). No external service needed. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| PRNG | Mulberry32 (hand-rolled) | seedrandom | Dependency overhead for trivial algorithm; ESM fragmentation |
| PRNG | Mulberry32 (hand-rolled) | pure-rand | Functional API mismatches imperative call sites; high refactor churn |
| PRNG | Mulberry32 (hand-rolled) | SFC32 | Slightly better statistical quality but requires 4 seed values instead of 1. One seed is simpler for URL sharing. |
| Stereo panning | StereoPannerNode | PannerNode (3D) | 3D spatialization is overkill for left-right spread. StereoPannerNode is purpose-built for this. |
| Stereo panning | Per-performer panners | Global stereo widener | Per-performer gives spatial separation by instrument/voice. Global widener would just make the mix "wider" without positional meaning. |
| Visualization | Canvas 2D (existing) | SVG | Higher repainting cost for animated elements at 60fps with 16 performers. |
| Visualization | Canvas 2D (existing) | WebGL via regl/twgl | Overkill. No GPU-intensive rendering needed for geometric shapes. |
| Microtiming | Scheduler math | External tempo library | No library exists that integrates with custom lookahead schedulers. Swing/rubato are 10-15 lines of arithmetic. |

---

## Installation

```bash
# No new npm dependencies required.
# All v1.2 features use browser-native APIs and hand-rolled algorithms.

# The only new file is:
# src/lib/prng.ts (~15 lines)
```

---

## Sources

- [StereoPannerNode - MDN](https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode) -- pan AudioParam range -1 to +1, equal-power algorithm, baseline since April 2021
- [StereoPannerNode.pan - MDN](https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode/pan) -- a-rate AudioParam, default 0
- [Mulberry32 PRNG reference](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c) -- Original implementation, period analysis, known limitations (~1/3 of uint32 values unreachable, acceptable for music)
- [Mulberry32 deterministic randomness guide](https://emanueleferonato.com/2026/01/08/understanding-how-to-use-mulberry32-to-achieve-deterministic-randomness-in-javascript/) -- JavaScript implementation with class-based and closure-based patterns
- [pure-rand GitHub](https://github.com/dubzzz/pure-rand) -- Evaluated v6.0.0, TypeScript-native, immutable API (rejected for impedance mismatch)
- [seedrandom GitHub](https://github.com/davidbau/seedrandom) -- Evaluated v3.0.5, CJS-first, state() method for serialization (rejected for ESM fragmentation)
- [Web Audio timing tutorial](https://catarak.github.io/blog/2014/12/02/web-audio-timing-tutorial/) -- Lookahead scheduling pattern, AudioContext.currentTime precision
- [Web Audio scheduling (IRCAM)](https://ircam-ismm.github.io/webaudio-tutorials/scheduling/timing-and-scheduling.html) -- Schedule-ahead pattern, setTimeout + AudioContext clock coordination
- Existing codebase analysis: `src/audio/scheduler.ts` (lookahead scheduler), `src/audio/voice-pool.ts` (voice routing), `src/audio/sampler.ts` (smplr integration), `src/audio/engine.ts` (audio graph), `src/canvas/renderer.ts` (Canvas 2D infrastructure), `src/score/ensemble.ts` (~15 Math.random calls), `src/score/velocity.ts` (jitter layer)
