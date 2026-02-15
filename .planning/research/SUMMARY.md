# Project Research Summary

**Project:** InTempo v1.2 Polish Features
**Domain:** Browser-based generative music performance engine with Web Audio API
**Researched:** 2026-02-15
**Confidence:** HIGH

## Executive Summary

InTempo v1.2 adds four polish features to the existing generative performance engine: stereo spread, seeded deterministic replay (shareable performances), pattern visualization, and microtiming humanization. Research shows these features integrate cleanly with the existing AudioWorklet/scheduler/ensemble architecture with zero new npm dependencies. The recommended approach uses Web Audio's built-in StereoPannerNode for spatial positioning, hand-rolled Mulberry32 PRNG (15 lines) for deterministic replay, Canvas 2D API (already in codebase) for visualization, and scheduler timing offsets for microtiming.

The most critical risk is incomplete seeded PRNG replacement. With 30+ Math.random() call sites across ensemble, velocity, and score generators, missing even one breaks determinism silently. A comprehensive refactor with exhaustive testing is essential. The second major risk is microtiming offsets exceeding the 100ms lookahead window, causing dropped notes. Offsetting scheduled time (not the beat clock) and clamping to safe bounds prevents this.

Build order must respect dependencies: seeded PRNG first (foundation for microtiming), then microtiming (extends PRNG), then stereo spread (independent audio graph change), finally pattern visualization (pure UI, zero audio dependencies). This minimizes integration complexity and isolates high-risk changes.

## Key Findings

### Recommended Stack

All v1.2 features use browser-native APIs and hand-rolled algorithms. Zero new npm dependencies required.

**Core technologies:**
- **Mulberry32 PRNG (hand-rolled)**: Deterministic random for reproducible performances. 15 lines of TypeScript, no library needed. Period of 4 billion values far exceeds any performance duration. Base36 seed encoding produces compact 6-character shareable URLs.
- **StereoPannerNode (Web Audio API)**: Per-performer stereo positioning. Native equal-power panning with -1 to +1 range. Baseline browser support since April 2021. Zero bundle cost.
- **Canvas 2D API (existing)**: Pattern visualization via existing canvas infrastructure. No p5.js, Three.js, or D3.js needed. Canvas outperforms SVG for animated multi-performer displays.
- **Scheduler timing math (existing)**: Microtiming via per-beat timing offsets. Pure arithmetic on nextNoteTime in the existing lookahead scheduler. No library or API needed.

**What NOT to add:**
- seedrandom / pure-rand — dependency overhead for 15 lines of trivial code
- p5.js / Three.js / D3.js — 500KB+ libraries for 2D geometric visualization
- PannerNode (3D audio) — 3D spatialization overkill for stereo spread
- External tempo library — no library integrates with custom lookahead schedulers

### Expected Features

**Must have (table stakes):**
- **Per-performer pan position** — spatial separation for 4+ simultaneous voices, prevents mono center blob
- **Same seed = same performance** — core promise of deterministic replay
- **Visible seed display + copy/share** — enables shareability
- **Visual note activity** — see WHEN a performer plays, not just pattern number
- **Swing parameter** — universally understood timing humanization (50-67% triplet swing)
- **Per-performer timing variation** — slight rush/drag offsets create ensemble feel

**Should have (differentiators):**
- **URL-encoded seed sharing** — seed + mode + BPM + performer count in query string, paste link to replay
- **Abstract ensemble score view** — horizontal timeline showing all performers' pattern positions, reveals canonic phasing
- **Performer color coding by instrument** — synth/piano/marimba distinct hues
- **Rubato (tempo breathing)** — slow global tempo fluctuation, shared temporal elasticity
- **Performer rush/drag personality** — some performers consistently early/late, chamber ensemble feel

**Defer (v2+):**
- 3D spatial audio (PannerNode/HRTF) — overkill for 4-16 performers, inaudible on laptop speakers
- User-adjustable per-performer pan sliders — breaks "spectator only" design philosophy
- Backend/database for seed storage — URL query strings achieve shareability with zero infrastructure
- Real-time waveform/spectrum visualization — doesn't communicate ensemble structure
- MIDI-synchronized video export — enormous scope, niche use case

### Architecture Approach

All four features integrate into the existing three-layer architecture (Ensemble -> Scheduler -> Audio Graph) with minimal coupling. Seeded PRNG flows through dependency injection (Ensemble creates it, passes to agents and score generators). Stereo spread uses per-performer StereoPannerNode chains inserted between voice/sample output and destination. Pattern visualization is read-only, consuming existing EnsembleEngineState with no audio path modifications. Microtiming applies timing offsets at the Scheduler level when converting beat indices to AudioContext time.

**Major components:**

1. **StereoField (NEW)** — Manages per-performer gain+pan chains. Each performer gets a StereoPannerNode with deterministic pan position based on ID. VoicePool voices connect/disconnect per-note at claim time. SamplePlayer creates per-performer instrument instances routed through performer channels.

2. **Seeded PRNG (NEW)** — Mulberry32 function lives in src/score/prng.ts. Ensemble constructor receives optional seed, creates PRNG, passes to all agents. ALL Math.random() calls in ensemble.ts, velocity.ts, generative.ts, euclidean.ts replaced with this.random(). URL encode/decode in src/score/seed-config.ts serializes seed + mode + BPM + performer count.

3. **Microtiming personality (EXTEND)** — Add timingBias (-1 to +1) and timingVariance (0 to 1) to AgentPersonality. Add timingOffset to AgentNoteEvent. Scheduler applies offset to scheduled note time (not beat clock). Shares humanization toggle with existing velocity system.

4. **Pattern visualization (EXTEND)** — Extend existing PerformerCanvas with repetition progress arc and note-on flash. Add ScoreOverview component (new Canvas 2D) showing horizontal pattern timeline with performer markers. Both render read-only state via existing rAF loop, no audio coupling.

**Critical patterns:**
- **Dependency injection for testability** — Pass random() as constructor parameter with Math.random default. Tests inject fixed-sequence PRNG.
- **Audio graph late-bound connections** — VoicePool voices created unconnected. Scheduler connects to per-performer pan chain at claim time, disconnects at release.
- **Normalized-then-scale for physical parameters** — Timing offset and pan stored as -1 to +1. Conversion to milliseconds/StereoPannerNode values happens at boundary.
- **Read-only visualization** — Visualization only reads EnsembleEngineState, never writes back.

### Critical Pitfalls

1. **Incomplete seeded PRNG replacement (CRITICAL)** — With 30+ Math.random() call sites across 5 files, missing even one breaks determinism silently. Performances start identical, diverge unpredictably. MUST use grep to find ALL call sites, replace ALL, and write determinism test asserting byte-for-byte identical event sequences across runs.

2. **Microtiming offsets exceed lookahead window (CRITICAL)** — 100ms lookahead window is tight. +20ms offset on note at currentTime + 95ms pushes it beyond window, causing dropped notes. MUST clamp offsets to stay within window. Apply offset to scheduled note time (NOT nextNoteTime beat clock). Keep max offset small (10-15ms). Never modify nextNoteTime with microtiming.

3. **StereoPannerNode not following voice reuse (HIGH)** — Voice pool reuses nodes across performers. Pan value set at pool creation time means voice 2 plays performer 3's note at performer 0's pan position. MUST set pan at claim time via voice.panner.pan.setValueAtTime(panValue, time), not at pool creation. Pan assignment is per-claim, not per-slot.

4. **PRNG call order diverges with performer count (HIGH)** — 3 performers consume different PRNG sequence than 5 performers. Seed URLs MUST encode all parameters (seed + mode + BPM + performer count) to be reproducible. Alternative: per-agent PRNG streams derived from master seed + agent ID.

5. **Pattern generation not seeded (MODERATE)** — generateGenerativePatterns() and generateEuclideanPatterns() use Math.random(). Even if ensemble is seeded, underlying patterns differ on each run. MUST seed PRNG BEFORE pattern generation, pass to generators, continue same sequence to Ensemble.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Seeded PRNG Foundation
**Rationale:** Seeded PRNG is the foundation for deterministic performances. Microtiming depends on it (timing jitter must be seeded). Must be comprehensive (all-or-nothing) to avoid silent failures. Build this first before anything that consumes the PRNG.

**Delivers:** Shareable seed URLs, identical performances across runs, foundation for microtiming

**Addresses:**
- Same seed = same performance (FEATURES.md table stakes)
- Visible seed display + copy/share (table stakes)
- URL-encoded seed sharing (differentiator)

**Avoids:** Pitfall 2 (incomplete replacement), Pitfall 4 (call order divergence), Pitfall 9 (pattern generation not seeded)

**Implementation:**
1. Create src/score/prng.ts with Mulberry32 + randomSeed
2. Replace ALL Math.random() in ensemble.ts, velocity.ts, generative.ts, euclidean.ts
3. Thread random() through Ensemble -> agents -> score generators
4. Create seed-config.ts for URL encode/decode
5. Update App.tsx to read/write URL hash
6. Write determinism test (100 ticks, same seed, assert identical events)

**Research flag:** Standard patterns (PRNG well-documented, skip research-phase)

### Phase 2: Microtiming Humanization
**Rationale:** Extends seeded PRNG (uses random() for timing jitter). Small focused change completing the "humanization" feature set alongside existing velocity. Must be built after PRNG to ensure deterministic microtiming.

**Delivers:** Swing, per-performer rush/drag personality, optional rubato, shared humanization toggle

**Addresses:**
- Swing parameter (FEATURES.md table stakes)
- Per-performer timing variation (table stakes)
- Rubato tempo breathing (differentiator)
- Performer rush/drag personality (differentiator)

**Avoids:** Pitfall 3 (offsets exceed lookahead), Pitfall 8 (synth vs sampler precision)

**Implementation:**
1. Add timingBias/timingVariance to AgentPersonality
2. Add timingOffset to AgentNoteEvent
3. Implement computeMicrotiming() in PerformerAgent using seeded random()
4. Modify Scheduler.scheduleBeat() to apply timing offset (clamped to safe bounds)
5. Add timing config to HumanizationConfig
6. Update HumanizationToggle UI

**Research flag:** Standard patterns (swing well-documented, skip research-phase)

### Phase 3: Stereo Spread
**Rationale:** Independent of PRNG/microtiming. Requires careful audio graph work with higher risk of audio glitches. Isolate this change to dedicated testing phase. Build after core features to avoid cascading rework.

**Delivers:** Per-performer spatial positioning, even stereo distribution, deterministic pan assignment

**Addresses:**
- Per-performer pan position (FEATURES.md table stakes)
- Deterministic pan assignment (table stakes)
- Even stereo distribution (table stakes)

**Avoids:** Pitfall 1 (pan not following voice reuse), Pitfall 7 (dispose/resize graph leaks), Pitfall 10 (dynamic add/remove breaks spread)

**Implementation:**
1. Create src/audio/stereo-field.ts
2. Modify VoicePool: voices start unconnected
3. Modify Scheduler: connect/disconnect voices through StereoField per-note
4. Modify SamplePlayer: per-performer instrument instances with StereoField routing
5. Modify Engine: create StereoField, update spread on performer count changes
6. Add CC#10 (Pan) to MIDI export for DAW compatibility

**Research flag:** Needs phase research (audio graph modifications, edge cases in voice stealing)

### Phase 4: Pattern Visualization
**Rationale:** Pure UI, zero audio dependencies. Can be built in parallel with anything but most meaningful after musical features are in place. Lowest risk, can be shipped independently.

**Delivers:** Note activity indicators, repetition progress arcs, score overview timeline

**Addresses:**
- Visual note activity (FEATURES.md table stakes)
- Pattern progress (table stakes)
- Abstract ensemble score view (differentiator)
- Performer color coding (differentiator)

**Avoids:** Pitfall 6 (two rAF loops competing), Pitfall 11 (rendering scales with pattern length)

**Implementation:**
1. Add lastNoteOnBeat to PerformerState, beatCounter to EnsembleEngineState
2. Create src/canvas/score-renderer.ts (pure draw functions)
3. Create src/canvas/ScoreOverview.tsx (React wrapper)
4. Enhance src/canvas/renderer.ts with repetition arc + note-on flash
5. Add ScoreOverview to App.tsx layout
6. Use single rAF loop with dirty-checking

**Research flag:** Standard patterns (Canvas 2D well-documented, skip research-phase)

### Phase Ordering Rationale

- **PRNG must come first:** Microtiming depends on it for deterministic timing jitter. Pattern generation (generative/euclidean modes) must be seeded before ensemble creation. This is the foundation for all randomness.

- **Microtiming after PRNG:** Uses the same random() stream. Small change extending existing humanization system. Must clamp offsets to respect 100ms lookahead constraint.

- **Stereo spread independent:** No dependency on PRNG/microtiming. High-risk audio graph work isolated to dedicated phase. Voice pool connection/disconnection per-note requires careful edge case handling.

- **Visualization last:** Zero coupling to audio path. Pure UI additive feature. Can be deferred or shipped separately. Lowest implementation risk.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (Stereo spread):** Audio graph edge cases in voice stealing, per-performer instrument instances vs routing, dispose/resize graph management

Phases with standard patterns (skip research-phase):
- **Phase 1 (Seeded PRNG):** PRNG algorithms well-documented, dependency injection pattern established
- **Phase 2 (Microtiming):** Swing/rubato patterns well-documented in music production, scheduler timing math straightforward
- **Phase 4 (Visualization):** Canvas 2D rendering well-documented, existing infrastructure in codebase

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified via MDN/npm. Existing codebase analysis confirms integration points. Zero new dependencies needed. |
| Features | HIGH | Table stakes identified via codebase needs (existing mono/quantized limitations). Differentiators based on generative music app patterns. |
| Architecture | HIGH | Direct codebase analysis of engine.ts, scheduler.ts, ensemble.ts, voice-pool.ts. Integration points clearly defined. Patterns proven in existing code. |
| Pitfalls | HIGH | Critical pitfalls derived from codebase analysis (30+ Math.random call sites counted). Lookahead window constraint measured (100ms). Voice reuse pattern verified. |

**Overall confidence:** HIGH

### Gaps to Address

- **smplr per-note destination routing:** STACK.md notes smplr's start() may not support per-note destination override. Need to verify during Phase 3 implementation. Fallback: per-performer instrument instances (acceptable memory cost).

- **Microtiming precision difference between synth and sampler:** Web Audio quantizes to audio buffer boundaries (128 samples = ~2.9ms at 44.1kHz). Synth worklet has sample-accurate timing. Difference may be perceptible. Test during Phase 2, accept sub-block quantization if below perceptual threshold.

- **Pan position assignment for dynamic add/remove:** Pitfall 10 notes ambiguity in redistributing pan on performer count change. Use ID-based (not count-based) assignment: pan = ((id * GOLDEN_RATIO) % 1.0) * 2 - 1. Decide during Phase 3 planning.

- **PRNG stream strategy:** Pitfall 4 notes single-stream vs per-agent-stream tradeoff. Single stream simpler but performer-count-sensitive. Per-agent streams robust but complex. Decide during Phase 1 planning based on shareable URL UX preference.

## Sources

### Primary (HIGH confidence)
- InTempo codebase analysis — engine.ts, scheduler.ts, ensemble.ts, voice-pool.ts, sampler.ts, velocity.ts, generative.ts, euclidean.ts, renderer.ts (direct code review, 30+ Math.random call sites counted, 100ms lookahead verified)
- [StereoPannerNode - MDN](https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode) — pan property -1 to +1, equal-power algorithm, baseline support April 2021
- [Web Audio scheduling - web.dev](https://web.dev/articles/audio-scheduling) — lookahead scheduling pattern, AudioContext.currentTime precision
- [Web Audio scheduling - IRCAM](https://ircam-ismm.github.io/webaudio-tutorials/scheduling/timing-and-scheduling.html) — schedule-ahead pattern, setTimeout + AudioContext coordination
- [Mulberry32 PRNG reference](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c) — 32-bit seeded PRNG, period ~2^32, 15 lines

### Secondary (MEDIUM confidence)
- [smplr GitHub](https://github.com/danigb/smplr) — destination option accepts AudioNode (confirmed via docs, needs runtime verification)
- [seedrandom - npm](https://www.npmjs.com/package/seedrandom) — evaluated, rejected for ESM fragmentation
- [pure-rand - npm](https://www.npmjs.com/package/pure-rand) — evaluated, rejected for functional API impedance mismatch
- [Microtiming in music - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4542135/) — 5-20ms timing deviations create groove (academic source)
- [BeepBox](https://www.beepbox.co/) — precedent for URL hash containing all performance state

---
*Research completed: 2026-02-15*
*Ready for roadmap: yes*
