# Feature Landscape

**Domain:** v1.2 Polish features for browser-based generative performance engine (stereo spread, pattern visualization, shareable seeded performances, microtiming)
**Researched:** 2026-02-15
**Scope:** New milestone features only. Existing features (3 composition modes, 4 performers, velocity humanization, MIDI export, transport controls, BPM, humanization toggle, canvas performer cards) are NOT in scope.
**Confidence:** MEDIUM-HIGH (Web Audio API panning verified via MDN; seeded PRNG libraries verified via npm; microtiming patterns well-documented in music production; visualization patterns from direct codebase analysis)

## Context: What Already Exists

The following are already built and inform dependency analysis:

- **Scheduler** (`scheduler.ts`): Fixed eighth-note beat clock with lookahead scheduling. Notes scheduled at precise `AudioContext.currentTime` offsets. This is the integration point for microtiming.
- **VoicePool** (`voice-pool.ts`): AudioWorkletNodes connected to a shared `masterGain -> destination`. No per-performer panning. This is the integration point for stereo spread (synth voices).
- **SamplePlayer** (`sampler.ts`): smplr piano/marimba connected to a shared `masterGain -> destination`. No per-performer panning. Integration point for stereo spread (sampled instruments).
- **Ensemble** (`ensemble.ts`): Uses `Math.random()` everywhere -- personality generation, weighted choices, repetition counts, entry delays, dropout/rejoin. ~30 call sites. This is what must be seeded for deterministic replay.
- **Velocity system** (`velocity.ts`): Also uses `Math.random()` for jitter. Another seeding target.
- **Score generators** (`generative.ts`, `euclidean.ts`): Heavy `Math.random()` usage for pattern generation. Must be seeded for reproducible scores.
- **Canvas renderer** (`renderer.ts`): Draws a static grid of performer cards showing pattern number and status. Uses `requestAnimationFrame` loop. Integration point for pattern visualization.
- **PerformerState** (`types.ts`): Exposes `id`, `patternIndex`, `status`, `currentRep`, `totalReps`, `instrument`. Visualization data source.

## Table Stakes

Features users expect for each capability. Missing these and the feature feels broken or pointless.

### Stereo Spread

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Per-performer pan position** | When multiple performers play simultaneously, placing them at distinct stereo positions creates spatial separation. Without this, 4+ simultaneous voices collapse into a mono center blob. Basic expectation for any multi-source audio app. | Low | Insert `StereoPannerNode` per performer between voice/sampler output and destination |
| **Deterministic pan assignment** | Pan positions should be stable across reset/restart. Performer 1 always at the same position. Random repositioning every reset would be disorienting. | Low | Map performer ID to pan position with a fixed function (like the existing `assignInstrument`) |
| **Even stereo distribution** | Performers should spread evenly across the stereo field, not cluster left or right. With 4 performers, something like [-0.6, -0.2, 0.2, 0.6] reads as a natural ensemble seating arrangement. | Low | Linear distribution formula based on performer count |

### Seeded Deterministic Replay

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Same seed = same performance** | The core promise. Given the same seed, score mode, BPM, and performer count, every `Math.random()` call produces the same sequence, yielding an identical performance. | High | Replace ALL ~30 `Math.random()` call sites across ensemble, velocity, and score generators with a seeded PRNG |
| **Visible seed display** | Users need to see what seed produced the current performance. Otherwise shareability is impossible. A short alphanumeric code displayed in the UI. | Low | Display current seed string in transport area |
| **Copy/share seed** | One-click copy to clipboard. The minimum viable sharing mechanism. | Low | Clipboard API button next to seed display |

### Pattern Visualization

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Visual indication of note activity** | Users should see WHEN a performer plays a note, not just what pattern number they are on. The current cards show static info; they need a pulse or flash on note events. | Low | Pass note events to renderer, trigger visual feedback on the existing performer cards |
| **Pattern progress within repetitions** | The current display shows "P 12" but gives no sense of where in the pattern the performer is. A simple progress indicator (dot position, bar fill) communicates temporal position. | Low | Use existing `currentRep`/`totalReps` and `noteIndex` data |

### Microtiming (Swing / Rubato)

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Swing parameter** | Shifts every other eighth note forward in time, creating a shuffle feel. The most universally understood timing humanization. Range 50% (straight) to ~67% (triplet swing). | Medium | Modify `advanceTime()` in scheduler to alternate between short and long eighth-note intervals |
| **Per-performer timing variation** | Just like real musicians don't play in perfect unison, each performer should have slight timing offsets. Without this, swing sounds mechanical because every performer swings identically. | Medium | Per-performer timing offset added to note schedule time in `scheduleBeat()` |

## Differentiators

Features that elevate InTempo beyond typical generative music apps. Not expected, but create delight.

### Stereo Spread

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **Dynamic pan on dropout/rejoin** | When a performer goes silent, their stereo position "fades" (or other performers subtly redistribute). Creates a spatial sense of performers entering and leaving the stage. | Medium | Read performer status changes, animate pan values via `AudioParam.linearRampToValueAtTime` |
| **Instrument-based depth** | Piano slightly wider, marimba centered, synth narrow. Creates a sense of acoustic staging where different instruments occupy different spatial zones. | Low | Modify pan distribution formula to incorporate instrument type |

### Seeded Deterministic Replay

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **URL-encoded seed sharing** | Encode seed + mode + BPM + performer count in a URL query string. Paste the link, the recipient hears the exact same performance. Massively lowers sharing friction vs "copy this seed and also set mode to euclidean and BPM to 140." | Medium | URL serialization/deserialization of engine config, read on app mount |
| **Seed input field** | Let users paste a seed to replay a specific performance. Combined with URL sharing, this enables a "performance gallery" without any backend. | Low | Text input that seeds the engine on next start |
| **Random new seed button** | Quick way to get a fresh unique performance. Uses `crypto.randomUUID()` or similar for the seed string, displayed for later sharing. | Low | Button in UI, generate seed, pass to engine |
| **"Performance ID" display** | Instead of showing a raw seed like "a7f3bc92", show a human-friendly name like "Coral Meadow #7392." Makes sharing more memorable and social. | Low | Deterministic name generator from seed hash (adjective + noun + number) |

### Pattern Visualization

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **Abstract ensemble "score view"** | A horizontal timeline showing all performers' pattern positions as colored dots/lines, revealing the canonic phasing that IS the musical magic of In C. Think a simplified piano-roll or Conlon Nancarrow-style player piano visualization. Users finally SEE the emergent structure they HEAR. | High | New canvas component, maps performer positions to a scrolling timeline, needs beat-synchronized rendering |
| **Note event ripples/particles** | Small visual bursts on note events that decay over time. Creates an ambient, living feel that matches the generative music aesthetic. Works well with the existing "aquarium" spectator philosophy. | Medium | Particle system in canvas renderer, triggered by note events from scheduler |
| **Performer color coding by instrument** | Synth, piano, marimba each get a distinct hue. Matches the timbral variety users hear with visual variety they see. | Low | Extend `STATE_COLORS` theme with instrument-based color variants |
| **Phase relationship indicator** | Show how far apart performers are from each other in the pattern sequence. The core aesthetic of In C is the gradual drift and convergence. Making this visible deepens understanding. | Medium | Compute and display min/max/spread from `PerformerState.patternIndex` values |

### Microtiming

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **Rubato (tempo breathing)** | Subtle global tempo fluctuation -- slight accelerando and ritardando that makes the entire ensemble breathe together. Different from per-performer jitter; this is a shared temporal elasticity. | Medium | Modulate BPM on a slow LFO cycle (e.g., +/- 2-3 BPM over 8-16 beats), applied in `advanceTime()` |
| **Performer "rush/drag" personality** | Some performers consistently play slightly ahead of the beat (rush), others slightly behind (drag). Creates the same natural temporal spread you hear in acoustic chamber ensembles. | Low | Add `timingBias` field to `AgentPersonality` (-0.02 to +0.02 seconds), applied as offset in `scheduleBeat()` |
| **Density-responsive timing looseness** | When density is low (few performers active), timing is tighter. When density is high, timing loosens slightly. Mimics how ensembles get "looser" as more players contribute. | Low | Scale per-performer timing jitter by `snapshot.density` |

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **3D spatial audio (PannerNode/HRTF)** | PannerNode with HRTF is dramatically more complex than StereoPannerNode, requires head-related transfer functions, and most users listen on laptop speakers where 3D panning is inaudible. Overkill for an ensemble of 4-16 performers. | Use `StereoPannerNode` for simple L/R stereo spread. Sounds great on headphones which is the target listening mode. |
| **User-adjustable per-performer pan sliders** | Breaks the "spectator only" design philosophy. The user watches, not mixes. Adding mixer controls turns InTempo into a DAW and contradicts the emergent/autonomous performer concept. | Automatic deterministic pan assignment. No user controls. |
| **Backend/database for seed storage** | Massive scope creep. A URL with encoded parameters achieves shareability without any server infrastructure. | URL query string encoding. Zero backend. |
| **QR code generation for sharing** | Nice-to-have but adds a dependency and UI complexity for a feature that "copy link" already solves. | Copy-to-clipboard for URL. |
| **Real-time waveform/spectrum visualization** | AnalyserNode FFT visualization is a different category of feature that requires continuous audio analysis. It doesn't communicate the ensemble structure (who plays what pattern) which is the actual interesting information. | Abstract pattern/position visualization that shows musical structure, not audio signal. |
| **Per-performer swing amount** | Too many degrees of freedom. The aesthetic goal is a shared groove feel with slight per-performer variation on top. Giving each performer independent swing amounts would sound chaotic, not groovy. | Single global swing parameter + per-performer timing bias (rush/drag personality). |
| **Complex tempo curves / automation** | Tempo automation requires a timeline editor UI, curve interpolation, and fundamentally changes the "set it and forget it" spectator experience. | Simple rubato (slow sinusoidal tempo breathing) that requires zero user input. |
| **Beat-synced visual effects (strobe, flash)** | Accessibility concern (photosensitive seizures). Aggressive visual effects also distract from the meditative quality of the music. | Subtle note event indicators (gentle pulse, fade) rather than sharp flashes. |
| **MIDI-synchronized video export** | Video rendering is a completely different technology domain (MediaRecorder + Canvas capture). Enormous scope for a niche use case. | Users can screen-record if they want video. |

## Feature Dependencies

```
STEREO SPREAD
  VoicePool.masterGain -> destination  (current: mono)
  SamplePlayer.masterGain -> destination  (current: mono)
    |
    v
  Per-performer StereoPannerNode chain:
    voice/sample output -> panNode -> masterGain -> destination
    |
    Requires: performer ID -> pan position mapping function
    Requires: panNode creation during engine init / performer add
    Requires: SamplePlayer refactor to route per-instrument to pan nodes

SEEDED REPLAY
  Math.random() (30+ call sites across 5 files)
    |
    v
  Seeded PRNG instance (single source of randomness)
    |
    Requires: PRNG library or inline mulberry32
    Requires: Seed generation (crypto.randomUUID or similar)
    Requires: ensemble.ts, velocity.ts, generative.ts, euclidean.ts, performer.ts refactored
    Requires: Seed passed through Engine -> Ensemble -> Agents -> Score generators
    Requires: UI for seed display + copy + input
    Requires: URL serialization for shareable links

PATTERN VISUALIZATION
  PerformerCanvas (existing rAF loop rendering performer cards)
    |
    v
  Enhanced renderer with note event indicators + progress
    |
    Requires: Note event data passed from scheduler to renderer
    Requires: Extended PerformerState or separate event channel
    Note: Canvas already runs at 60fps via rAF, just needs more data

MICROTIMING
  Scheduler.advanceTime() (fixed eighth-note interval)
  Scheduler.scheduleBeat() (fixed time per note)
    |
    v
  Variable timing per eighth note:
    - Global swing: alternate long/short eighth notes
    - Per-performer offset: shift individual note times
    - Rubato: slow modulation of effective BPM
    |
    Requires: Swing parameter in engine state
    Requires: Per-performer timing personality (extends AgentPersonality)
    Requires: Rubato LFO state in scheduler
    Requires: Humanization system must be enabled (shares toggle)
```

### Cross-Feature Dependencies

```
Seeded Replay -> Microtiming:
  Microtiming's per-performer timing jitter uses random values.
  These MUST be seeded for deterministic replay.
  Build seeded PRNG first, then microtiming uses it.

Seeded Replay -> Stereo Spread:
  Stereo spread is deterministic by design (performer ID maps to pan).
  No dependency on seeded PRNG. Independent.

Seeded Replay -> Pattern Visualization:
  Visualization is a read-only view of state. No dependency.
  But: deterministic replay means the visualization is also deterministic,
  which is a nice side effect for sharing ("see the same thing I see").

Microtiming -> Velocity Humanization (existing):
  Both are "humanization" layers. Should share the same enable toggle
  and intensity control. Microtiming is the temporal companion to
  velocity's dynamic humanization.
```

## Implementation Complexity Assessment

### Stereo Spread: LOW-MEDIUM

The Web Audio API's `StereoPannerNode` is purpose-built for this. Each node has a single `pan` AudioParam ranging from -1 (full left) to 1 (full right) using an equal-power panning algorithm. Browser support is universal (Chrome, Firefox, Safari, Edge).

The main complexity is plumbing: the current architecture routes all synth voices through a shared `VoicePool.masterGain` and all samples through a shared `SamplePlayer.masterGain`. Per-performer panning requires inserting a `StereoPannerNode` per performer in between. For synth voices this means the voice pool needs performer-aware routing (currently voices are anonymous). For sampled instruments, smplr's `start()` method schedules notes internally, so panning must be applied to the smplr instrument's output node or by creating per-performer instrument instances (more expensive).

Practical approach: Create a `StereoField` class that owns N `StereoPannerNode` instances (one per performer), each connected to the audio destination. Route each performer's audio through their assigned pan node. The scheduler already knows `event.performerId`, so routing is straightforward.

### Seeded Replay: HIGH

This is the hardest feature because it requires touching the most code. There are ~30 `Math.random()` call sites across 5 files that must ALL be replaced with a seeded PRNG. Missing even one breaks determinism.

Recommended PRNG: Inline a mulberry32 implementation (8 lines of code). No npm dependency needed. Alternatively, use `rand-seed` (TypeScript, supports mulberry32, sfc32, xoshiro128). The seedrandom package is larger and older but battle-tested.

The critical design decision: how to thread the PRNG instance through the system. Options:
1. **Single global PRNG** -- simplest but makes testing harder
2. **Per-ensemble PRNG** -- Ensemble creates it, passes to agents and score generators
3. **Per-agent PRNG** (derived from master seed + agent ID) -- enables parallel agent execution but unnecessary for this codebase

Recommendation: Option 2. The Ensemble already coordinates everything. Create the PRNG in the Ensemble constructor from the seed, pass it down to PerformerAgent and score generators.

### Pattern Visualization: LOW-MEDIUM

The canvas infrastructure already exists and runs at 60fps. The renderer needs more data (note events, progress) and more drawing code, but no architectural changes. The main design challenge is aesthetic: what looks good and communicates musical structure without being distracting.

### Microtiming: MEDIUM

Swing is a well-understood modification to the scheduler's timing. The scheduler's `advanceTime()` currently adds a fixed `secondsPerEighth`. For swing, odd-numbered eighth notes get slightly longer, even-numbered get shorter (maintaining the same average tempo). This is ~10 lines of code in `advanceTime()`.

Per-performer timing offset is also straightforward: in `scheduleBeat()`, add `personality.timingBias` to the scheduled `time` for each event. The infrastructure for this is already clean because each event carries a `performerId`.

Rubato (tempo breathing) is a slow sine modulation of the effective BPM, applied globally in `advanceTime()`. Simple math, minimal code.

## MVP Recommendation

Build in this order due to dependencies and progressive value delivery:

1. **Stereo Spread** -- Immediate audible improvement, lowest risk, no dependencies on other features
   - Per-performer StereoPannerNode chain
   - Deterministic pan assignment by performer ID
   - Even distribution across stereo field

2. **Seeded Replay** -- Foundational for sharing and must be done before microtiming
   - Inline mulberry32 or `rand-seed` PRNG
   - Replace all Math.random() call sites
   - Seed display in UI + copy button
   - URL-encoded shareable links

3. **Microtiming** -- Depends on seeded PRNG being in place for deterministic timing jitter
   - Global swing parameter (50-67%)
   - Per-performer rush/drag personality
   - Optional rubato (slow tempo breathing)
   - Shares humanization toggle with existing velocity system

4. **Pattern Visualization** -- Can be built in parallel with anything, but seeing the patterns is most meaningful after all musical features are in place
   - Note event visual indicators on performer cards
   - Pattern progress bars
   - Optional: abstract score view showing ensemble phasing

**Defer to later milestone:**
- URL-encoded sharing with full config (nice but not essential for v1.2)
- Abstract score view timeline (high complexity, separate feature)
- Dynamic pan on dropout/rejoin (polish on top of polish)
- Performance ID friendly names (fun but cosmetic)

## Sources

- [StereoPannerNode - MDN](https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode) -- Web Audio API stereo panning, pan property -1 to 1, equal-power algorithm (HIGH confidence -- official docs)
- [StereoPannerNode: pan property - MDN](https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode/pan) -- AudioParam interface for pan automation (HIGH confidence -- official docs)
- [Web Audio spatialization basics - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics) -- StereoPannerNode vs PannerNode comparison, when to use which (HIGH confidence -- official docs)
- [seedrandom - npm](https://www.npmjs.com/package/seedrandom) -- Seeded PRNG for JavaScript, multiple algorithm support (MEDIUM confidence -- npm verified)
- [rand-seed - npm](https://www.npmjs.com/package/rand-seed) -- TypeScript seeded PRNG with mulberry32 and sfc32 (MEDIUM confidence -- npm verified)
- [Prando - GitHub](https://github.com/zeh/prando) -- Deterministic PRNG designed for games/UI replay (MEDIUM confidence -- GitHub verified)
- [Advanced techniques: Creating and sequencing audio - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques) -- Lookahead scheduling pattern for precise timing (HIGH confidence -- official docs)
- [A tale of two clocks - web.dev](https://web.dev/articles/audio-scheduling) -- AudioContext.currentTime precision for scheduling, setTimeout lookahead pattern (HIGH confidence -- Google developer docs)
- [Fugue Machine Rubato](https://alexandernaut.com/fugue-machine-rubato/) -- Non-linear time engine for sequencers, rubato/swing implementation reference (MEDIUM confidence -- product reference)
- [Generative Music Patterns](http://generative-music-patterns.schloss-post.com/) -- Visual approaches to generative music pattern display (MEDIUM confidence -- academic reference)
- InTempo codebase review: `src/audio/scheduler.ts`, `src/audio/voice-pool.ts`, `src/audio/sampler.ts`, `src/score/ensemble.ts`, `src/score/velocity.ts`, `src/score/generative.ts`, `src/score/euclidean.ts`, `src/canvas/renderer.ts` (HIGH confidence -- direct code reading)
