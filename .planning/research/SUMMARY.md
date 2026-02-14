# Project Research Summary

**Project:** InTempo -- Browser-Based Generative Performance Engine
**Domain:** Generative music / Web Audio application
**Researched:** 2026-02-14
**Confidence:** MEDIUM

## Executive Summary

InTempo is a browser-based generative music performance engine that simulates multiple autonomous performers playing Terry Riley's "In C" with emergent ensemble AI behavior. The research reveals that building this correctly requires understanding a critical architectural constraint: **Web Audio API scheduling and JavaScript timers operate in fundamentally incompatible time domains**. The entire application must be structured around the "lookahead scheduler" pattern (Chris Wilson's "A Tale of Two Clocks") or timing will be fatally broken.

The recommended approach is to build directly on the raw Web Audio API rather than using abstraction libraries like Tone.js. Tone.js fights against the custom scheduling requirements for 10-30 simultaneous AI-driven performers, adds 150KB bundle weight for functionality that only requires ~200 lines of custom code, and makes debugging timing issues far harder. The stack is deliberately minimal: React 19 + Vite for UI, Zustand for state, shadcn/ui for components, and the native Web Audio API for audio -- no audio libraries at all. This keeps the audio scheduling loop transparent and eliminates abstraction-layer timing interference.

The critical risks are: (1) using JavaScript timers for musical timing instead of the lookahead pattern (causes rewrite-level architectural failure), (2) audio node memory leaks during long performances (In C can last 45-90 minutes), and (3) React render cycles blocking the audio scheduler on the main thread. The architecture must separate concerns cleanly: pure state machines for performer AI, lookahead scheduler for audio, and React as a thin presentation layer that never touches AudioContext directly.

## Key Findings

### Recommended Stack

The stack research identified a crucial architectural decision: **avoid Tone.js despite it being the standard Web Audio library**. Tone.js manages its own Transport clock and scheduling queue, which conflicts with InTempo's need for direct control over 10-30 simultaneous AI performers each with independent scheduling requirements. Building on raw Web Audio API produces more upfront code (~200 lines for a SchedulerService) but dramatically simpler debugging and optimization. The Web Audio API's AudioContext scheduling with lookahead provides sample-accurate timing, which is non-negotiable for ensemble synchronization.

**Core technologies:**
- **React 19 + Vite + TypeScript**: Project constraint. Concurrent features help keep UI responsive during heavy audio scheduling. Vite's fast HMR and native ESM support are ideal for development iteration.
- **Raw Web Audio API (no Tone.js)**: Direct control over AudioContext scheduling for multi-performer coordination. OscillatorNode, GainNode, StereoPannerNode, AudioBufferSourceNode are all that's needed. AudioWorklet for custom synthesis on the audio thread.
- **Zustand**: 1KB state management that doesn't try to manage audio state. Perfect for performer states, performance config, UI state. Selector pattern prevents unnecessary re-renders.
- **shadcn/ui + Tailwind CSS 4**: Zero-runtime component library (generates source files, not a dependency). Critical when every JS cycle matters for audio. Tailwind v4's CSS-first config integrates cleanly.
- **Canvas 2D API (no Three.js/Pixi.js)**: Abstract 2D geometry visualizations don't need 3D engines or WebGL sprite renderers. Canvas 2D is 100KB+ lighter and rendering can be throttled independently of audio.
- **@tonaljs/tonal**: Tree-shakeable music theory for algorithmic score generation. Use only for note/scale calculations, never for audio playback.

**Critical version notes:** All versions (React ^19, Vite ^6, TypeScript ^5.7, Tailwind ^4, Zustand ^5) are based on training data through May 2025 and must be verified with `npm view` before scaffolding.

### Expected Features

Research into comparable applications (generative.fm, Chrome Music Lab, Strudel, Gibber, Orca) reveals clear feature expectations.

**Must have (table stakes):**
- Audio playback start/stop with proper AudioContext resume on user gesture (browser autoplay policy)
- Musical output that sounds pleasant (tuning correct, timbres smooth, rhythm coherent)
- Responsive UI during playback (audio and React must be fully decoupled)
- Master volume control and graceful start/end (no abrupt cuts)
- BPM/tempo control with loading state indicators
- Works without interaction after start (core to generative/spectator model)
- Error recovery and browser compatibility messaging

**Should have (differentiators):**
- **Emergent ensemble AI behavior**: Context-aware performers that "listen" to each other (density-awareness, unison-seeking, dropout/rejoin logic). No other browser generative app simulates believable ensemble musicians. This is THE core differentiator.
- **Multiple composition modes**: Riley's patterns, generative (algorithmic), Euclidean rhythms. One engine, three distinct musical experiences.
- **Dynamic performer count**: Add/remove performers mid-performance to change texture in real-time
- **Per-performer abstract geometry visualization**: Each performer has unique visual identity tied to musical state
- **Stereo field placement**: Performers spread across stereo field creates spatial depth uncommon in browser audio
- **Natural performance arc**: Beginning (staggered entry), middle (density peaks, phase relationships), end (performers reaching final pattern and dropping out). Rare in generative apps which tend toward infinite loops.

**Defer (v2+):**
- Recording/audio export (MediaRecorder quality is inconsistent, OfflineAudioContext complexity)
- Mobile layout (touch/small screen adds disproportionate complexity; iOS Safari audio restrictions)
- Real-time multiplayer (network audio sync is an unsolved hard problem in browsers)
- MIDI output (niche use case, inconsistent browser support)
- Social features, persistent state, complex parameter tweaking during performance

**Anti-features (explicitly don't build):**
- User playing along or conducting (breaks spectator model -- the constraint IS the feature)
- Complex effect chains/EQ UI (users are spectators, not audio engineers)
- Tutorial/onboarding flow (if it needs a tutorial, the UI has failed)

### Architecture Approach

Three-layer separation is essential: **Score/Data**, **Engine/Simulation**, **Audio/Rendering**. React UI is a thin presentation layer that observes engine state but never touches AudioContext directly. The critical boundary is between main thread (UI + simulation) and audio thread (Web Audio API scheduling).

**Major components:**

1. **ScoreManager** — Holds pattern data for all score modes (Riley's 53 patterns, generated, Euclidean). Pure data, no timing. Generates algorithmic scores on demand.

2. **PerformanceEngine** — Transport control (play/pause/stop/reset). Runs the lookahead tick loop via setInterval (~25ms). Advances simulation time. Orchestrates performer decisions each tick.

3. **PerformerAgent[]** — One per simulated performer. Each is a **pure state machine**: function of (own state + ensemble snapshot) -> (new state + note events). Decides: advance to next pattern? repeat? drop out? rejoin? Pure logic, no audio, fully testable without AudioContext.

4. **EnsembleState** — Immutable snapshot of all performers' positions/statuses, created each tick. Prevents order-of-evaluation bugs. All performers see the same world state when making decisions.

5. **AudioScheduler** — The Chris Wilson lookahead scheduler. Runs setInterval (~25ms) that looks ahead (~100ms) and schedules notes falling in that window using `AudioContext.currentTime`. Converts note events into Web Audio API calls. **This is the single most critical component** -- if this pattern is wrong, everything breaks.

6. **VoiceManager** — Manages instrument assignment and voice creation. Each performer gets assigned a voice type (synth or sampled instrument) at performance start. Creates appropriate AudioNodes per note.

7. **StereoMixer** — Per-performer signal chain: source -> gain -> panner -> master. DynamicsCompressorNode on master bus prevents clipping with 20+ performers.

**Key patterns:**
- **Lookahead scheduler** (Pattern 1, HIGH confidence): JavaScript setInterval only wakes up scheduler; precise note timing uses `AudioContext.currentTime`. This bridges unreliable JS timers (5-25ms jitter) with sample-accurate audio clock.
- **Performer as pure state machine** (Pattern 2): `(state + ensemble snapshot) -> (new state + note events)`. Fully testable, reproducible with seeded RNG.
- **Immutable ensemble snapshot** (Pattern 3): Frozen snapshot each tick prevents order-of-evaluation bugs.
- **Score as static data** (Pattern 4): All patterns pre-computed before performance. Zero runtime cost during playback.
- **Audio graph setup once** (Pattern 5): Build per-performer signal chains once; only create/destroy ephemeral source nodes per note.

### Critical Pitfalls

Research identified 15 pitfalls across three severity levels. The top 5 critical pitfalls that cause rewrites or broken audio:

1. **Using setTimeout/setInterval for note scheduling** — JavaScript timer jitter (5-50ms) destroys rhythmic coherence. Multi-performer synchronization becomes impossible. Audible "flamming" on unison passages. Complete timing collapse when tab loses focus. **MUST use lookahead scheduler pattern from Phase 1**. Non-negotiable architectural foundation.

2. **Ignoring AudioContext autoplay policy** — AudioContext starts in "suspended" state by default. Audio calls produce silence. **Gate entire app start behind user gesture that calls `audioContext.resume()`**. Test in fresh incognito window. Simple to fix but easy to forget.

3. **AudioParam scheduling collisions** — Multiple parts of code schedule overlapping AudioParam changes. Ramps from unexpected values cause clicks/pops. **Always call `setValueAtTime(currentValue, now)` before any ramp**. Use 2-5ms ramps instead of instant changes. Build envelope abstraction early (Phase 1-2).

4. **Creating and never disconnecting audio nodes (memory leaks)** — Nodes stay connected even after `oscillator.stop()`. Memory grows unbounded. Audio thread overloads. Glitches appear 10-30 minutes into performance -- **showstopper for 45-90 minute In C performances**. **Call `disconnect()` on all nodes after note completes**. Use `onended` event to trigger cleanup. Implement voice pool. Design this into Phase 1.

5. **Synchronizing visual updates with audio time** — Audio scheduled ~100ms ahead on audio thread; visuals reflect "now" on main thread at 16ms granularity. Naive approaches create 50-150ms visual lag/lead. **Maintain event log: when note scheduled at audioTime T, store event. In requestAnimationFrame, read `audioContext.currentTime` and scan for events where `audioTime <= currentTime`**. Design the bridge into scheduler in Phase 1 even if visuals come in Phase 3.

**The single most dangerous pitfall** is #1 (JS-timer-based scheduling). If timing foundation is wrong, everything built on top -- multi-performer sync, AI decisions, visual sync -- will be unreliable. **The second most dangerous** is #4 (memory leaks) due to long performance durations. **The most insidious** is #5 (audio-visual sync) because it won't be apparent until Phase 3 but requires Phase 1 scheduler changes.

## Implications for Roadmap

Based on combined research, the dependency graph dictates a clear build sequence. The architecture allows **two parallel streams that converge at integration**: (1) score data + performer AI can be built and tested without any audio code, and (2) audio scheduler can be built and tested with hardcoded notes without AI.

### Phase 1: Audio Foundation + Score Data
**Rationale:** The lookahead scheduler is foundational. If timing is wrong, everything breaks. Score data model has zero dependencies and is needed by both AI and audio streams. Building these together establishes the architectural boundaries correctly from day one.

**Delivers:**
- AudioContext setup with autoplay policy handling (user gesture for resume)
- AudioScheduler with lookahead pattern (100ms lookahead, 25ms setInterval)
- Riley's 53 patterns encoded as static data (Pattern, Note, Score types)
- ScoreManager holding pattern data
- Basic synth voice (OscillatorNode only, no samples yet)
- Per-performer signal chain (GainNode + StereoPannerNode -> DynamicsCompressorNode -> destination)
- Voice lifecycle management (disconnect on ended event)
- Transport controls in React UI (start/stop/reset)
- BPM configuration

**Addresses:**
- **Table stakes features**: Audio playback start/stop, audible musical output, volume control, BPM control, loading state, AudioContext readiness
- **STACK.md**: Web Audio API foundation, React/Vite scaffold, Zustand for config state, shadcn/ui for controls

**Avoids:**
- **Pitfall 1**: Lookahead scheduler implemented correctly from start
- **Pitfall 2**: Autoplay policy handled explicitly
- **Pitfall 3**: Envelope abstraction built early
- **Pitfall 4**: Voice lifecycle with disconnect designed in
- **Pitfall 10**: Context state change handling for tab backgrounding
- **Pitfall 11**: Single-use source nodes pattern established

**Research flag**: SKIP -- Web Audio scheduling is well-documented. Chris Wilson's pattern is canonical. Implementation is straightforward.

---

### Phase 2: Ensemble AI + Multi-Performer Engine
**Rationale:** With audio foundation solid, add the core differentiator: autonomous performers with emergent behavior. This phase can be developed largely in parallel with Phase 1 (pure state machines, testable without audio) and integrated once Phase 1 is stable.

**Delivers:**
- PerformerAgent state machine (pure function: state + snapshot -> new state + note events)
- PerformanceEngine orchestrator (tick loop, transport state, performer array management)
- EnsembleState snapshot mechanism (immutable, prevents order-of-evaluation bugs)
- Performer AI decision logic:
  - Pattern advancement vs. repetition
  - Density-awareness (drop out when crowded, rejoin when sparse)
  - Proximity/unison-seeking (stay within pattern band)
  - Dropout/rejoin behavior
- Staggered entry and natural ending
- Multiple simultaneous performers (5-20 target range)
- Per-performer status display in React UI (pattern number, playing/silent indicator)
- Integration of PerformerAgent decisions -> AudioScheduler note events

**Addresses:**
- **Core differentiator**: Emergent ensemble AI behavior (density-awareness, unison-seeking, dropout/rejoin)
- **Table stakes features**: Responsive UI during playback (full audio/UI decoupling verified)
- **FEATURES.md**: Natural performance arc, faithful "In C" rules (sequential traversal, pattern band)
- **ARCHITECTURE.md**: Performer as pure state machine, immutable ensemble snapshot patterns

**Avoids:**
- **Pitfall 9**: React re-renders disrupting scheduler (engine runs outside React's render cycle)
- **Anti-pattern 2**: Performer AI in audio thread (all AI on main thread)
- **Anti-pattern 3**: React state as source of truth (engine owns state, React subscribes)
- **Anti-pattern 4**: One giant tick function (clean separation: Engine orchestrates, Agent decides, Scheduler plays)

**Research flag**: NEEDS RESEARCH (moderate) -- Performer AI behavior tuning. The state machine structure is clear, but the weights/probabilities for "feeling alive" vs. "sounding chaotic" will need iteration. Consider `/gsd:research-phase` for AI behavior patterns in ensemble systems or multi-agent coordination.

---

### Phase 3: Visualization + Audio Polish
**Rationale:** With working ensemble playback, add the visual spectator experience and improve audio quality. Visualization depends on performer state from Phase 2. Audio polish (additional instruments, effects) is additive.

**Delivers:**
- Abstract geometry visualization per performer (Canvas 2D)
- Visual state tied to musical state (pattern index, playing/silent, note onset)
- Audio-visual sync bridge (event log + `audioContext.currentTime` reads in rAF)
- Sampled instruments (decode audio buffers in loading phase)
- Instrument variety (multiple synth types + samples, randomly assigned)
- Toggleable steady pulse (high C eighth notes)
- Dynamic performer add/remove during performance (resource lifecycle)
- Audio polish: reverb, gentle compression, proper gain staging
- GT Canon font loading, Semafor/FT-inspired color palette
- Master volume control UI

**Addresses:**
- **Differentiator features**: Per-performer abstract geometry, stereo field placement, configurable instrument palette
- **Table stakes features**: Visual feedback that something is happening, graceful start/end
- **STACK.md**: Canvas 2D API for visualization, @tonaljs/tonal for note calculations, GT Canon font integration
- **FEATURES.md**: Spectator-only interaction model, instrument palette

**Avoids:**
- **Pitfall 5**: Audio-visual sync (event log bridge implemented using Phase 1 scheduler hooks)
- **Pitfall 7**: Clipping with many performers (DynamicsCompressorNode, gain staging)
- **Pitfall 8**: Blocking main thread during decode (all samples loaded before performance, with progress UI)
- **Pitfall 9**: React renders blocking scheduler (Canvas outside React DOM diffing, memo/virtualization)
- **Pitfall 6**: Sample rate mismatch (provide 48kHz samples)

**Research flag**: SKIP (visualization) -- Canvas 2D patterns are straightforward. NEEDS RESEARCH (light) for sampled instruments -- audio buffer loading/caching patterns are well-documented but instrument selection/mixing may need domain research if aiming for specific timbral aesthetic.

---

### Phase 4: Additional Composition Modes
**Rationale:** With core Riley mode working and polished, add replay value through alternative score generation. These modes share the same engine/performer/audio infrastructure and differ only in score generation.

**Delivers:**
- Generative score mode (algorithmic pattern generation "in the style of In C")
- Euclidean rhythm mode (Bjorklund's algorithm for polyrhythmic patterns)
- Score mode selector UI
- URL-encoded configurations (shareable seeds, BPM, performer count, mode)
- "About" modal explaining In C concept and modes

**Addresses:**
- **Differentiator features**: Multiple composition modes, URL-encoded shareable configs
- **FEATURES.md**: Generative and Euclidean modes
- **STACK.md**: @tonaljs/tonal for generative mode note/scale calculations, Euclidean algorithm implementation (~30 lines, no dependency)
- **ARCHITECTURE.md**: Score as static data pattern (modes produce same data structure)

**Avoids:**
- **Anti-feature**: Persistent state/database (URL encoding is stateless, zero backend)
- **Anti-feature**: Social features (URL sharing is sufficient)

**Research flag**: NEEDS RESEARCH (moderate) -- Generative mode requires defining "in the style of In C." What makes a pattern feel like Riley's aesthetic? Pattern length distribution, pitch range, rhythmic density, intervallic relationships. Consider `/gsd:research-phase` for Terry Riley's compositional style or minimalist pattern generation.

---

### Phase Ordering Rationale

- **Phase 1 before Phase 2**: Audio timing is foundational. The lookahead scheduler must be correct before any ensemble behavior is added. Testing single-voice playback with hardcoded notes verifies timing before AI complexity.

- **Phase 2 parallel with Phase 1 (partially)**: Performer AI state machines can be developed and unit-tested without audio. PerformerAgent + EnsembleState logic has zero audio dependencies. Integration happens after Phase 1 audio is stable.

- **Phase 3 after Phase 2**: Visualization needs performer state data (pattern index, playing/silent) from Phase 2. Audio-visual sync bridge reads from the AudioScheduler built in Phase 1. Cannot be built earlier.

- **Phase 4 last**: Alternative score modes are additive. Riley mode validates the entire engine (score -> AI -> audio -> visuals). Once that loop works, other modes slot in cleanly because they produce the same Score data structure.

**Dependency insight from architecture research**: Score data model and PerformerAgent AI can be built and tested before any audio code exists. AudioScheduler can be tested with hardcoded notes before AI exists. These streams converge at integration (end of Phase 2). This parallelization potential can accelerate development if resources allow.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2** (moderate priority): Performer AI behavior tuning. State machine structure is clear from research, but the decision weights/probabilities for ensemble dynamics may need iteration or domain research on multi-agent coordination patterns.
- **Phase 4** (moderate priority): Generative score mode requires defining Riley's compositional aesthetic. Pattern characteristics that produce the "In C feel" need musicological research or analysis of the original 53 patterns.
- **Phase 3** (low priority, only if aiming for specific sound): Sampled instrument selection for timbral palette. Audio buffer loading is standard, but choosing/designing instruments for a cohesive sonic aesthetic may need domain input.

**Phases with standard patterns (skip research-phase):**
- **Phase 1**: Web Audio scheduling is extremely well-documented. Chris Wilson's "A Tale of Two Clocks" is canonical and universally cited. Implementation is straightforward.
- **Phase 3** (visualization): Canvas 2D rendering patterns are well-established. Abstract geometry drawing is straightforward.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core recommendations (raw Web Audio over Tone.js, Zustand, shadcn/ui) are HIGH confidence based on architectural constraints. Version numbers (React 19, Vite 6, etc.) are MEDIUM -- based on training data through May 2025, must verify with npm. |
| Features | MEDIUM | Table stakes and differentiators are HIGH confidence -- derived from well-known reference apps (generative.fm, Chrome Music Lab, Strudel) and training data on Web Audio app expectations. Anti-features are design choices (HIGH confidence in rationale). Overall MEDIUM due to no live source verification. |
| Architecture | HIGH | Lookahead scheduler pattern is canonical (Chris Wilson, MDN, universally cited). Pure state machine + immutable snapshot patterns are established CS patterns. Component boundaries are clear from domain analysis. Web Audio API lifecycle and semantics are stable spec. |
| Pitfalls | HIGH | Critical pitfalls (#1-6) are well-documented Web Audio issues with known solutions. The lookahead pattern, AudioContext autoplay policy, AudioParam automation rules, and node lifecycle management are stable API behaviors unlikely to have changed. Moderate/minor pitfalls are based on established best practices. |

**Overall confidence:** MEDIUM

The architectural approach and critical patterns (lookahead scheduler, state machine performers, audio/UI separation) are HIGH confidence -- these are established, well-documented approaches. The stack recommendations are sound based on architectural constraints. The confidence is rated MEDIUM overall due to:
1. Version numbers based on training data through May 2025 (must verify)
2. No live web search or npm registry access during research
3. Performer AI behavior tuning will require iteration (research gave structure but not weights)
4. Generative score mode aesthetic needs definition

### Gaps to Address

**Version verification (before Phase 1 scaffolding):**
All package versions must be verified with `npm view <pkg> version`:
- React (expected ^19.0), Vite (^6.x), TypeScript (^5.7), Tailwind CSS (^4.0), Zustand (^5.0), @tonaljs/tonal (^6.x), Vitest (^2.x), ESLint (^9.x), lucide-react (^0.460+)
- Action: Run `npm view` commands before `npm create vite` to get current versions

**Performer AI behavior parameters (Phase 2):**
Research provided state machine structure and decision types (advance/repeat/dropout/rejoin/unison-seek) but not the weights, thresholds, or probabilities that make it "feel alive" vs. "sound chaotic." This requires iteration.
- Action: Build the state machine with tunable constants. Expect iteration on density thresholds, pattern-band proximity weights, dropout probability curves. Consider A/B testing different parameter sets.

**Generative score mode aesthetic (Phase 4):**
"Generate patterns in the style of In C" needs concrete definition. What are Riley's pattern characteristics? Length distribution (1-20 beats), pitch range (C4-C6 typical), rhythmic density, intervallic relationships (mostly stepwise, occasional leaps)?
- Action: Analyze Riley's 53 patterns statistically before Phase 4. Extract distributions and rules. Or consider `/gsd:research-phase generative-score` for Terry Riley's compositional style during Phase 4 planning.

**Sampled instrument selection (Phase 3, optional):**
Research confirms audio buffer loading patterns are standard, but choosing specific instruments for a cohesive timbral palette is a design decision. Do we want piano, mallet percussion, woodwinds, strings? What aesthetic?
- Action: This is a creative direction decision, not a technical gap. Default to a standard set (piano, vibraphone, marimba, flute, clarinet -- typical In C instrumentation) and iterate if needed.

**Browser testing matrix (Phase 1):**
Research confirms Chromium-first approach is correct, but Safari behavior (especially AudioContext autoplay policy, AudioWorklet support) may differ.
- Action: Test in Safari and Firefox during Phase 1. Provide graceful degradation messaging if unsupported. The research confirms Web Audio API is well-supported, but autoplay policy nuances vary.

## Sources

### Primary (HIGH confidence)

**From training data (Web Audio API, stable specifications):**
- Chris Wilson, "A Tale of Two Clocks" (HTML5Rocks/web.dev) -- canonical Web Audio scheduling pattern, universally cited
- MDN Web Audio API documentation -- AudioContext, AudioParam automation, autoplay policy, node lifecycle, sample-accurate scheduling
- W3C Web Audio API specification -- AudioWorklet, render quantum, node semantics, AudioParam timeline
- Chrome autoplay policy documentation -- user gesture requirement for AudioContext

**From training data (reference applications and ecosystem):**
- generative.fm (Alex Bainter) -- ambient generative music, Web Audio + Tone.js, spectator model
- Chrome Music Lab (Google Creative Lab) -- educational Web Audio experiments, visualization patterns
- Strudel (TidalCycles browser port) -- pattern-based live coding, browser scheduling
- Tone.js ecosystem and documentation (v15.x, mid-2024) -- abstraction patterns and limitations
- Terry Riley's "In C" performance practice and rules -- sequential traversal, pattern band, ensemble dynamics

### Secondary (MEDIUM confidence)

**From training data (versions and ecosystem state as of May 2025):**
- React 19 stable release (early 2025) -- concurrent features, expected current
- Vite 6 release (late 2024) -- expected current
- Tailwind CSS v4 release (early 2025) -- CSS-first config
- Zustand v5, TypeScript 5.7, Vitest v2 -- inferred current versions based on release cadence

**From training data (general patterns):**
- Game engine architecture patterns -- simulation ticks, snapshot-based evaluation, pure state machines
- Bjorklund's algorithm (2003) -- Euclidean rhythm generation for SNS timing system
- @tonaljs/tonal library -- music theory calculations, tree-shakeable API

### Tertiary (LOW confidence, needs validation)

**Inferred from training data:**
- lucide-react version (^0.460+) -- low confidence, verify
- Specific npm package versions -- all should be checked with `npm view` before scaffolding

**Note on research limitations:**
Web search (WebSearch, WebFetch) and npm registry access were unavailable during research. All findings are based on training data with knowledge cutoff ~May 2025. Core architectural patterns (Web Audio API, scheduling patterns, React ecosystem) are stable and unlikely to have changed significantly. Version numbers must be verified. Browser autoplay policy and Web Audio API semantics are stable specifications.

---

**Research completed:** 2026-02-14
**Ready for roadmap:** Yes

**Next steps:**
- Orchestrator proceeds to requirements definition using this summary
- Roadmapper will structure phases based on implications above
- Phase-specific research flags guide when to invoke `/gsd:research-phase` during detailed planning
