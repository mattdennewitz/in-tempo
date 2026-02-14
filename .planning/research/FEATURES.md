# Feature Landscape

**Domain:** Browser-based generative music performance engine
**Researched:** 2026-02-14
**Confidence:** MEDIUM (training data knowledge of generative.fm, Chrome Music Lab, Tone.js ecosystem, Strudel, Gibber; no live verification available)

## Reference Applications

| Application | Type | Key Features | Relevance to InTempo |
|---|---|---|---|
| generative.fm | Ambient generative streaming | Infinite playback, multiple generators, background listening, timer/sleep mode | Generative audio in browser, spectator model |
| Chrome Music Lab | Interactive music education | Visual experiments (Song Maker, Rhythm, Spectrogram, etc.), touch/click interaction | Web Audio basics, visualization patterns |
| Strudel (TidalCycles port) | Live coding music | Pattern language, real-time code evaluation, multi-voice, visualization | Algorithmic composition in browser, pattern systems |
| Gibber | Live coding audiovisual | Code-based music generation, WebGL visuals synced to audio, collaborative | Audio + visualization pairing |
| Tone.js demos | Library showcases | Synth playgrounds, sequencers, effects chains, interactive controls | Web Audio abstraction patterns |
| Orca | Visual programming sequencer | Grid-based operators, MIDI/OSC output, spatial layout | Multi-agent musical behavior on a grid |
| Patatap | Audiovisual toy | Keystroke-triggered sounds + animations, minimal UI | Sound-visual pairing, aesthetic focus |

## Table Stakes

Features users expect from any browser-based generative music application. Missing any of these and InTempo feels broken or amateurish.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| **Audio playback start/stop** | Fundamental. Every music app has play/pause. Web Audio requires user gesture to start AudioContext. | Low | Must handle AudioContext resume on user gesture (browser autoplay policy) |
| **Audible output that sounds musical** | Users will close the tab in seconds if it sounds like random noise. Timbres must be pleasant, tuning correct, rhythm coherent. | High | This is the core product. Synth/sample quality is paramount. |
| **Responsive UI during playback** | If the UI freezes or stutters during audio, trust is destroyed. Audio and UI must be decoupled. | Medium | Web Audio runs on separate thread; React rendering must not block audio scheduling |
| **Volume control** | Every audio application needs a master volume. Users will mute the tab otherwise. | Low | Single gain node at output |
| **Visual feedback that something is happening** | Generative music is invisible by nature. Without visual motion, users wonder if the app is working. | Medium | Per-performer status indicators at minimum |
| **Graceful start and end** | Abrupt starts (all voices at once) and abrupt stops (audio cuts mid-note) feel broken. | Medium | Staggered entry and fadeout are musically correct for "In C" anyway |
| **BPM / tempo control** | Standard in any rhythm-based music app. Users expect to adjust speed. | Low | Must be settable before performance; mid-performance changes are a stretch goal |
| **Loading state / audio readiness indicator** | Web Audio samples and AudioWorklets take time to load. Users need to know when the app is ready. | Low | Show loading progress, disable play until ready |
| **Works without interaction after start** | Generative music apps are "set and forget." If it requires ongoing clicks to keep playing, it's not generative. | Low | Core to spectator model -- this is already the design intent |
| **Error recovery / browser compatibility messaging** | Web Audio has quirks. Safari has different behavior. Users need clear messaging when something fails. | Low | Target Chromium-first, but graceful degradation messaging |

## Differentiators

Features that set InTempo apart from the generative music landscape. These are not expected but create the unique value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Emergent ensemble AI behavior** | No other browser generative app simulates believable ensemble musicians making context-aware decisions. generative.fm uses procedural generation; Chrome Music Lab is interactive toys; Strudel is user-coded patterns. InTempo's performers "listen" to each other. | High | Core differentiator. Density-awareness, unison-seeking, dropout/rejoin logic. Must feel alive, not random. |
| **Multiple composition modes (Riley / Generative / Euclidean)** | One engine, three distinct musical experiences. Most browser music apps do one thing. This gives replay value and musical range. | Medium | Modes share the same performer/scheduling engine but differ in score generation |
| **Dynamic performer count** | Adding/removing performers mid-performance changes the texture in real-time. Most generative apps have fixed voice counts. | Medium | Must handle audio resource management (creating/destroying oscillators/samplers gracefully) |
| **Per-performer abstract geometry visualization** | Transforms spectating into a visual experience. Each performer has a unique visual identity tied to their musical state. Patatap showed sound-visual pairing works; InTempo makes it continuous and per-agent. | High | Needs performant rendering (Canvas or WebGL) that doesn't compete with audio thread |
| **Faithful "In C" rule system** | Musicologically grounded -- not arbitrary rules. Sequential traversal, pattern band enforcement, natural ending. Appeals to music nerds and minimalism fans who know the piece. | Medium | The rules themselves are simple; making them produce compelling results is the challenge |
| **Stereo field placement** | Performers spread across the stereo field creates spatial depth uncommon in browser audio apps. Most browser music is mono or simple stereo. | Low | StereoPannerNode per performer. Simple but effective. |
| **Spectator-only interaction model** | Counterintuitive but powerful: you configure and watch. Like a musical aquarium or fireplace. This is a deliberate design choice, not a missing feature. Aligns with how "In C" actually works -- the audience watches. | Low | The "feature" is restraint. UI must make it clear this is intentional. |
| **Natural performance arc** | Performances have a beginning (staggered entry), middle (density peaks, phase relationships), and end (performers reaching pattern 53 and dropping out). This narrative arc is rare in generative apps, which tend toward infinite/looping. | Medium | Score precalculation enables this. The AI behavior shapes the arc. |
| **Configurable instrument palette** | Mix of synthesis and samples, randomly assigned. Each performance sounds different not just structurally but timbrally. | Medium | Requires building a decent instrument library. Sample loading adds complexity. |

## Anti-Features

Features to explicitly NOT build. Each is a deliberate design choice.

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **User plays along / conducts** | Breaks the spectator model. The magic of "In C" is emergent behavior from autonomous performers. User intervention makes it a sequencer, not a simulation. | Let users configure parameters before performance, then watch. The constraint IS the feature. |
| **Real-time multiplayer** | Massive complexity (WebRTC/WebSocket sync, latency compensation, conflict resolution) for uncertain value. Network audio sync is an unsolved hard problem in browsers. | Single-user local experience. Revisit in v2 only if validated. |
| **MIDI output** | Adds complexity, requires MIDI device handling, serves a tiny niche of users who would connect hardware. Browser MIDI API support is inconsistent. | Browser audio output only. The experience is self-contained. |
| **Recording / audio export** | MediaRecorder API quality is inconsistent. Offline rendering via OfflineAudioContext is complex to wire up. Defer to v2. | Users can use system audio capture (e.g., BlackHole, OBS) if they want to record. |
| **Mobile layout** | Touch targets, small screens, and mobile audio restrictions (especially iOS Safari) add disproportionate complexity. The visualization needs screen real estate. | Desktop-first. Responsive enough not to break on tablets, but not optimized for phones. |
| **Social features (sharing, profiles, likes)** | This is a performance engine, not a social platform. Adding accounts and sharing infrastructure distracts from the core experience. | Share via URL with encoded performance parameters (seed, BPM, performer count). Stateless sharing. |
| **Complex parameter tweaking during performance** | Exposes internals, makes the UI complex, breaks the "aquarium" simplicity. Too many knobs turns it into a DAW. | Pre-performance configuration only. Keep the running performance clean and visual. |
| **Persistent state / saved performances** | Database, auth, storage infrastructure for something that should be ephemeral. Each performance is unique -- that's the point. | URL-encoded seeds for reproducible configurations. No backend needed. |
| **Tutorial / onboarding flow** | The app should be immediately understandable. If it needs a tutorial, the UI has failed. A brief "About" modal is sufficient. | Self-explanatory UI. "About" link explaining the concept of "In C" for curious users. |
| **Equalizer / effects chain UI** | Turns it into a mixing console. Users are spectators, not audio engineers. | Bake good reverb/effects into the instrument design. The mix should sound good by default. |

## Feature Dependencies

```
AudioContext initialization → All audio features
  |
  +→ Instrument loading (synths + samples) → Performer audio output
  |    |
  |    +→ Stereo panning → Spatial placement
  |    +→ Volume control → Master gain
  |
  +→ Score generation (Riley patterns / Generative / Euclidean)
  |    |
  |    +→ Performer AI behavior → Ensemble emergent behavior
  |         |
  |         +→ Dynamic performer add/remove
  |         +→ Natural performance arc (staggered start/end)
  |
  +→ Pulse (eighth-note high C) → Toggleable during performance
  |
  +→ BPM clock → Drives all scheduling

Score generation → Per-performer visualization (needs pattern data)
  |
  +→ Abstract geometry rendering → Canvas/WebGL setup

Performer AI → Per-performer status display (playing/silent, pattern number)

UI Framework (React + shadcn) → All controls and display
  |
  +→ Pre-performance config (BPM, performer count, mode selection)
  +→ Performance controls (start/stop/reset)
  +→ Performance display (visualizations + status)
```

## MVP Recommendation

**Phase 1 -- Audio engine with Riley's patterns (table stakes + core differentiator):**
1. AudioContext setup with proper browser autoplay handling
2. Riley's 53 patterns encoded as score data
3. Single-voice playback with correct timing (Web Audio scheduling)
4. Basic synth instruments (no samples yet)
5. Play / stop / reset controls
6. BPM configuration

**Phase 2 -- Ensemble behavior (the differentiator):**
1. Multiple simultaneous performers
2. Performer AI (density-awareness, pattern-band enforcement, dropout/rejoin)
3. Stereo panning per performer
4. Per-performer status display (pattern number, playing/silent)
5. Staggered entry and natural ending

**Phase 3 -- Visualization + Polish:**
1. Abstract geometry visualization per performer
2. Instrument variety (additional synths + samples)
3. Toggleable pulse
4. Dynamic performer add/remove during performance
5. Volume control and audio polish (reverb, gentle compression)

**Phase 4 -- Additional modes:**
1. Generative score mode (algorithmic pattern generation in the style of In C)
2. Euclidean rhythm mode
3. URL-encoded shareable configurations

**Defer entirely:**
- Recording/export: adds complexity without validating core value
- Mobile: not the target audience for v1
- Multiplayer: unsolved hard problem, not needed for core experience

## Complexity Budget

| Feature Area | Estimated Effort | Risk Level |
|---|---|---|
| Web Audio scheduling engine | High | Medium -- well-documented APIs but timing subtleties are real |
| Riley's 53 patterns as data | Low | Low -- the patterns are published and well-known |
| Performer AI behavior | High | High -- "feeling alive" is subjective; will need iteration |
| Synth instrument design | Medium | Medium -- Tone.js or raw Web Audio both work; sound quality takes tuning |
| Sample loading + playback | Medium | Low -- standard Web Audio pattern |
| Abstract geometry visualization | High | Medium -- performance concerns when rendering many performers |
| Euclidean rhythm generation | Low | Low -- Bjorklund's algorithm is simple and well-documented |
| Generative score mode | Medium | Medium -- defining "in the style of In C" requires musical decisions |
| Dynamic performer management | Medium | Medium -- resource lifecycle management |

## Sources

- Training data knowledge of generative.fm (Alex Bainter's ambient generative music platform, Web Audio + Tone.js based)
- Training data knowledge of Chrome Music Lab (Google Creative Lab, educational Web Audio experiments)
- Training data knowledge of Tone.js (Web Audio framework, widely used in browser music apps)
- Training data knowledge of Strudel (TidalCycles port to browser, pattern-based live coding)
- Training data knowledge of Gibber (live coding environment with audio + visuals)
- Training data knowledge of Orca (Hundred Rabbits, visual programming sequencer)
- Training data knowledge of Terry Riley's "In C" performance practice and rules
- Training data knowledge of Web Audio API capabilities and browser constraints

**Confidence note:** All findings are based on training data (cutoff ~early 2025). Web search and live documentation verification were unavailable. Feature landscapes of referenced applications may have changed. Core Web Audio API capabilities and browser constraints are stable and unlikely to have shifted significantly.
