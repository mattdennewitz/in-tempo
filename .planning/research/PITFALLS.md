# Domain Pitfalls

**Domain:** Browser-based generative music performance engine (Web Audio API)
**Project:** InTempo -- generative "In C" engine with multiple simulated performers
**Researched:** 2026-02-14
**Confidence:** MEDIUM (based on established Web Audio API knowledge; live source verification was unavailable)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken timing, or unusable audio output.

---

### Pitfall 1: Using setTimeout/setInterval for Note Scheduling

**What goes wrong:** Developers schedule audio events using JavaScript timers (`setTimeout`, `setInterval`, or `requestAnimationFrame`) instead of the Web Audio API's own clock. JS timers run on the main thread and are subject to event loop delays of 4-50ms+ (or hundreds of ms when the tab is backgrounded). This produces audible timing jitter that destroys rhythmic coherence -- fatal for an "In C" performance where multiple performers must share a pulse.

**Why it happens:** It is the intuitive approach -- "play this note in 500ms" maps naturally to `setTimeout`. Tutorials and simple examples often use this pattern. The Web Audio scheduling model (pre-scheduling onto the audio thread's timeline) is less obvious.

**Consequences:**
- Rhythmic drift between performers (some notes land early/late by 10-50ms)
- Audible "flamming" on unison passages
- Complete timing collapse when the tab loses focus or the main thread is busy (React re-renders, GC pauses)
- Cannot be fixed incrementally; requires architectural rewrite of the scheduling layer

**Prevention:**
- Use the "lookahead scheduler" pattern (Chris Wilson's "A Tale of Two Clocks"): a `setInterval` or `setTimeout` fires frequently (every ~25ms) to check what notes fall within a lookahead window (~100ms), then schedules them precisely using `AudioContext.currentTime` + offset via `start(when)`, `AudioParam.setValueAtTime(value, when)`, etc.
- All musical time decisions happen in AudioContext time, never in JS Date/performance.now time
- The JS timer is only a "wake-up call" to push events onto the audio thread's queue
- Maintain a mapping: `musicalBeat -> audioContextTime` so performers can schedule against a shared timeline

**Detection:** If you see `setTimeout(playNote, delayMs)` without any reference to `AudioContext.currentTime`, the pattern is wrong.

**Phase:** Must be correct from Phase 1 (core audio engine). This is foundational.

---

### Pitfall 2: Ignoring the AudioContext Autoplay Policy

**What goes wrong:** The `AudioContext` is created in a "suspended" state by default in all modern browsers. Audio calls silently produce nothing. Developers create the context at page load, schedule audio, hear silence, and begin a debugging spiral.

**Why it happens:** The autoplay policy (introduced circa 2018 in Chrome, now universal) requires a user gesture (click, tap, keypress) before an `AudioContext` can enter the "running" state. This is well-documented but still catches developers because it works fine in some dev scenarios (e.g., when DevTools is open or after a previous gesture in the same origin).

**Consequences:**
- No audio on first interaction if context was created too early
- Race conditions where some audio paths work and others do not
- Workarounds like creating multiple contexts (which causes worse problems)

**Prevention:**
- Create the `AudioContext` lazily on the first user interaction, OR create it at load and call `audioContext.resume()` inside a click/keypress handler
- Gate the entire application start behind a "Click to Begin Performance" button that calls `resume()`
- For InTempo specifically: the performance should have an explicit "Start" action anyway (musical performances begin deliberately), so wire `resume()` to that
- Always check `audioContext.state === 'running'` before assuming audio works

**Detection:** Test the app in a fresh incognito window with no prior interactions. If you hear nothing on first load, this is the issue.

**Phase:** Phase 1. Must be handled at context creation. Simple to fix but easy to forget.

---

### Pitfall 3: AudioParam Scheduling Collisions and Ramps

**What goes wrong:** Multiple parts of the code schedule `AudioParam` changes (gain, frequency, pan) that overlap in time. The Web Audio spec throws errors or produces unexpected values when automation events conflict. Common scenario: you schedule a `linearRampToValueAtTime` but forget to anchor it with a `setValueAtTime` first, causing the ramp to start from an unexpected value (often 0).

**Why it happens:** AudioParam automation is a timeline-based system with strict ordering rules that differ from typical imperative programming. The spec says a `linearRampToValueAtTime` ramps FROM the previous scheduled event's value, not from the "current" value. If there is no previous event, behavior is implementation-defined and often wrong.

**Consequences:**
- Clicks and pops from sudden value jumps (gain going 0 -> 1 instantly)
- Notes that are silent because a ramp targeted the wrong start value
- Intermittent bugs that depend on scheduling order
- Gain envelopes that "work" in isolation but break when overlapping with other automation

**Prevention:**
- Always call `setValueAtTime(currentValue, now)` before any ramp
- Use `cancelScheduledValues(time)` before re-scheduling on the same param
- Build a thin envelope abstraction (attack-decay-sustain-release) that encapsulates the correct AudioParam call sequence
- For gain changes (note on/off), always use short ramps (2-5ms) instead of instant value changes to avoid clicks: `gain.setValueAtTime(0, startTime); gain.linearRampToValueAtTime(1, startTime + 0.005);`
- Never directly set `audioParam.value` on a param that also has scheduled automation

**Detection:** Clicks/pops on note start or stop. Console errors mentioning automation timeline conflicts.

**Phase:** Phase 1-2 (when building the synth voice and sampler abstractions). Build the envelope helper early and use it everywhere.

---

### Pitfall 4: Creating and Never Disconnecting Audio Nodes (Memory Leaks)

**What goes wrong:** Each note creates `OscillatorNode`, `GainNode`, `StereoPannerNode`, etc. These nodes are never disconnected or allowed to be garbage collected. With 20+ simulated performers each playing notes continuously, memory grows unbounded and audio performance degrades.

**Why it happens:** Web Audio nodes are retained as long as they are connected to the audio graph, even after an `OscillatorNode` has stopped. The GC cannot collect them. Developers assume `oscillator.stop()` cleans everything up -- it does not.

**Consequences:**
- Memory usage grows linearly with performance duration
- Audio thread becomes overloaded with dead-but-connected nodes
- Glitches and dropouts appear 10-30 minutes into a performance
- On long "In C" performances (which can last 45-90 minutes), this is a showstopper

**Prevention:**
- Call `disconnect()` on all nodes in the signal chain after a note completes
- Use the `ended` event on `OscillatorNode` or `AudioBufferSourceNode` to trigger cleanup: `osc.onended = () => { osc.disconnect(); gainNode.disconnect(); }`
- Implement a voice pool/allocator that reuses gain/panner nodes and only creates new source nodes per note
- Monitor `performance.memory` (Chrome) or use DevTools Memory panel during extended testing
- Set a hard limit on simultaneous active voices and implement voice stealing

**Detection:** Open Chrome DevTools Memory tab. Run the performance for 10 minutes. If the JS heap or audio node count grows steadily, you have a leak.

**Phase:** Phase 1-2. The voice lifecycle management must be designed in from the start, not bolted on.

---

### Pitfall 5: Synchronizing Visual Updates with Audio Time

**What goes wrong:** React state updates and `requestAnimationFrame` callbacks run on the main thread at ~16ms granularity (60fps) with jitter. Audio events are scheduled on the audio thread at sample-accurate precision. Naive approaches either: (a) trigger visuals from the same JS timer that schedules audio (visuals lag behind audio by the lookahead amount), or (b) try to trigger audio from visual frame callbacks (audio timing suffers).

**Why it happens:** Audio and visuals operate in fundamentally different time domains. Audio needs to be pre-scheduled ~100ms ahead; visuals should reflect what is happening "now." These are irreconcilable without an explicit bridging mechanism.

**Consequences:**
- Visuals that are 50-150ms ahead of or behind the audio
- Per-performer geometry animations that drift from their actual musical output
- User perception that the system is "broken" even when audio timing is perfect
- Attempting to fix by reducing lookahead degrades audio stability

**Prevention:**
- Maintain a shared event log: when the scheduler queues a note at `audioTime = T`, also store `{performer, note, audioTime: T}` in a buffer
- In `requestAnimationFrame`, read `audioContext.currentTime` and scan the buffer for events where `audioTime <= currentTime` to drive visual updates
- This means visuals react to audio events as they actually play (not when they were scheduled)
- Accept ~16ms visual jitter as unavoidable and design animations that tolerate it (smooth transitions, not hard frame-exact sync)
- For InTempo: abstract geometry visualizations are forgiving -- use easing/interpolation so a 16ms offset is imperceptible

**Detection:** Record the screen and audio simultaneously. Slow down playback. If visual cues consistently lead or lag the audio, the bridge is broken.

**Phase:** Phase 2-3 (visualization layer). But the event log/bridge must be designed into the scheduler in Phase 1.

---

### Pitfall 6: Single AudioContext Sample Rate Mismatch with Samples

**What goes wrong:** The `AudioContext` is created with the system's default sample rate (often 48000Hz on desktop). Audio samples (WAV/MP3/OGG files for sampled instruments) are recorded at a different rate (commonly 44100Hz). `decodeAudioData` resamples automatically, but if the context sample rate does not match the hardware, an additional resampling layer is introduced, degrading quality or introducing latency.

**Why it happens:** Developers rarely think about sample rate. The default "just works" until quality-sensitive listening reveals artifacts, or until someone tests on hardware with a different native rate.

**Consequences:**
- Subtle pitch or quality artifacts on sampled instruments
- Different audio character on different machines
- Increased CPU from double resampling

**Prevention:**
- Let the `AudioContext` use the system default sample rate (do not force it)
- Provide samples at both 44100Hz and 48000Hz, or at 48000Hz (the most common desktop default)
- If quality is critical, check `audioContext.sampleRate` at startup and load the matching sample set
- For synth oscillators this is a non-issue (they generate at the context rate natively)

**Detection:** Compare sampled instrument output on machines with different audio hardware. Listen for aliasing artifacts on high-frequency content.

**Phase:** Phase 2 (when adding sampled instruments). Low risk for the synth-first approach.

---

## Moderate Pitfalls

---

### Pitfall 7: GainNode for Mixing Instead of Proper Gain Staging

**What goes wrong:** All performers route through individual `GainNode`s to a single destination. With 20+ performers playing simultaneously, summed amplitudes clip the output (exceed 1.0), causing harsh digital distortion. Developers then add a master gain and set it to `1/numPerformers`, making quiet passages inaudible.

**Prevention:**
- Implement proper gain staging: each performer's output goes through a per-performer gain, then a submix bus, then a master compressor/limiter (`DynamicsCompressorNode`), then the destination
- Use a `DynamicsCompressorNode` as a safety limiter on the master bus (threshold: -6dB, ratio: 12:1) to prevent clipping without destroying dynamics
- Scale per-performer gains based on the number of active performers, but with a curve (not linear division): `perGain = 1 / Math.sqrt(activePerformers)` is a reasonable starting point
- Test with all performers playing fortissimo simultaneously

**Detection:** Distorted/crunchy output when many performers play at once. Waveform visualization showing flat-topped clipping.

**Phase:** Phase 1-2 (audio graph architecture). Design the bus structure before adding performers.

---

### Pitfall 8: Blocking the Main Thread During Audio Buffer Decoding

**What goes wrong:** Loading sampled instruments involves fetching audio files and calling `decodeAudioData()`. If many samples are decoded synchronously (or if large files are fetched on the main thread), the UI freezes and the audio scheduler's `setInterval` callbacks are delayed, causing timing glitches during loading.

**Prevention:**
- Decode all audio buffers during an explicit loading phase (before the performance starts), with a progress indicator
- Use `decodeAudioData()` (which returns a Promise) and decode sequentially or in small batches, not all at once (parallel decoding can spike memory)
- Cache decoded `AudioBuffer` objects; never re-decode the same sample
- If loading during performance is needed, use a Web Worker for fetch + `OfflineAudioContext` for decoding (though `OfflineAudioContext` in workers has limited support)

**Detection:** UI jank or audio dropouts when switching instrument sets or loading new samples.

**Phase:** Phase 2 (sampled instruments). Build the asset loading pipeline with this in mind.

---

### Pitfall 9: React Re-renders Disrupting the Audio Scheduler

**What goes wrong:** The audio scheduling loop runs on the main thread. Heavy React re-renders (especially with 20+ performer visualization components updating at 60fps) can block the main thread for long enough that the scheduler misses its window, causing notes to be scheduled late.

**Prevention:**
- Keep the audio scheduler completely outside React's render cycle. It should be a plain JS module, not a React hook that re-runs on render
- Use `React.memo`, `useMemo`, and virtualization to minimize render cost for performer visualizations
- Consider `requestAnimationFrame` for visual updates and `setInterval` (or a dedicated scheduling timer via `setTimeout` chain) for the audio scheduler -- do NOT combine them
- Profile with Chrome DevTools Performance tab: if any single frame exceeds the lookahead window (~100ms), you will get audio glitches
- If visualization is heavy, move it to `<canvas>` or WebGL (outside React's DOM diffing) rather than SVG/DOM elements
- Use `React.startTransition` or `useDeferredValue` for non-critical UI updates to prevent them from blocking the scheduler

**Detection:** Audio glitches that correlate with visual complexity. Glitches that disappear when visualizations are disabled.

**Phase:** Phase 2-3 (when visualizations are added). But the scheduler must be isolated from React from Phase 1.

---

### Pitfall 10: Not Handling AudioContext State Changes (Interruptions)

**What goes wrong:** The `AudioContext` can be suspended by the browser when the tab is backgrounded, when the system goes to sleep, or when another app takes exclusive audio control. The scheduler keeps running (or stops, depending on implementation) but `audioContext.currentTime` freezes. When the context resumes, there is a time gap that breaks all scheduled events.

**Prevention:**
- Listen for `audioContext.onstatechange` events
- When state changes to `'suspended'` or `'interrupted'`, pause the musical clock and stop scheduling
- When state returns to `'running'`, resync: calculate how much musical time was lost, reset the beat-to-audioTime mapping, and resume scheduling from the current musical position
- For InTempo: since it targets desktop Chromium primarily, tab backgrounding is the main risk. Consider adding a visible warning: "Performance paused -- tab was backgrounded"
- Chrome throttles `setInterval` to 1Hz in background tabs; this alone will break the scheduler

**Detection:** Play a performance, switch to another tab for 30 seconds, switch back. If audio is garbled or the performance has jumped ahead/behind, this is the issue.

**Phase:** Phase 1 (core scheduler). The resync logic is part of the clock infrastructure.

---

### Pitfall 11: OscillatorNode and AudioBufferSourceNode Are Single-Use

**What goes wrong:** Developers try to call `start()` on an `OscillatorNode` or `AudioBufferSourceNode` more than once. The spec mandates that these nodes can only be started once; calling `start()` again throws an `InvalidStateError`. This leads to either errors or workarounds that create architectural problems.

**Prevention:**
- Treat `OscillatorNode` and `AudioBufferSourceNode` as disposable, per-note objects
- Create a new source node for every note onset
- Reuse the surrounding infrastructure (gain nodes, panner nodes, filter nodes) via a voice pool, but always create fresh source nodes
- The voice pool pattern: pre-allocate N voice "slots" each with gain + panner + effects chain; for each note, create a new OscillatorNode/AudioBufferSourceNode, connect it to an available slot, and release the slot on `ended`

**Detection:** Console errors about `InvalidStateError` on `start()`. Or a pattern of `oscillator.stop(); oscillator = new OscillatorNode(...)` scattered throughout the codebase rather than encapsulated.

**Phase:** Phase 1. Core voice management.

---

### Pitfall 12: Accumulating Latency from AudioParam Automation Queue

**What goes wrong:** If the scheduler queues many automation events far into the future (e.g., scheduling the next 10 seconds of automation at once), and then musical parameters change (tempo change, performer AI decides to skip ahead), you cannot easily cancel or modify those already-queued events. `cancelScheduledValues` cancels everything after a given time, which may also cancel events you wanted to keep.

**Prevention:**
- Keep the lookahead window short: 100-200ms maximum. Only schedule notes within this window.
- Never schedule automation more than one lookahead window into the future
- For InTempo's AI performers: the AI decision-making should happen at least one lookahead window before the musical moment it affects, which is easily achievable for phrase-level decisions
- If you need to cancel, use `cancelAndHoldAtTime(time)` (where supported) to cancel future events while holding the current value, preventing clicks

**Detection:** Tempo changes or performer state changes that take effect noticeably late (by the length of the over-scheduled window).

**Phase:** Phase 1 (scheduler design). The lookahead window size is a core design parameter.

---

## Minor Pitfalls

---

### Pitfall 13: StereoPannerNode vs PannerNode Confusion

**What goes wrong:** Developers use `PannerNode` (3D spatial audio, computationally expensive) when they only need left-right panning. For InTempo's stereo field placement of performers, `StereoPannerNode` is the correct choice but it is easy to pick the wrong one from autocomplete or documentation.

**Prevention:**
- Use `StereoPannerNode` for simple stereo panning (pan value from -1 to 1)
- Reserve `PannerNode` only if 3D spatialization is a future feature
- `StereoPannerNode` is cheaper and its behavior is more predictable for stereo mixing

**Detection:** Unexpectedly high CPU usage from panning. Panning behavior that does not match a simple left-right model.

**Phase:** Phase 1 (audio graph design).

---

### Pitfall 14: Forgetting to Handle decodeAudioData Errors

**What goes wrong:** `decodeAudioData` fails silently (older callback API) or rejects its promise on corrupt/unsupported files. Without error handling, a single bad sample file causes the entire sampled instrument to be undefined, leading to runtime errors during performance.

**Prevention:**
- Always use the Promise-based API and handle rejections
- Provide fallback behavior: if a sample fails to load, substitute a synth voice or a neighboring pitch's sample
- Validate all audio files during the build/asset pipeline, not just at runtime

**Detection:** A performer goes silent when it should be playing a sampled note. Console shows unhandled promise rejection from `decodeAudioData`.

**Phase:** Phase 2 (sampled instruments).

---

### Pitfall 15: Assuming Consistent AudioContext.currentTime Resolution

**What goes wrong:** `AudioContext.currentTime` advances in blocks (typically 128 samples = ~2.67ms at 48kHz). Developers assume it is a smooth real-time clock and use it for sub-block-size timing decisions. The scheduler may read the same `currentTime` value across multiple `setInterval` callbacks if they fire within the same audio processing block.

**Prevention:**
- Understand that `currentTime` is quantized to the audio render quantum (~2.67ms)
- This does not affect scheduling precision (scheduled events within a block are still sample-accurate)
- But it means the lookahead calculation should account for this: the effective timing resolution for "has this note passed?" checks is the render quantum, not arbitrary precision
- This is rarely a problem in practice but can cause confusion during debugging

**Detection:** Logging `audioContext.currentTime` from rapid successive calls and seeing the same value.

**Phase:** Phase 1 (scheduler). Awareness issue, not usually a code change.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Core scheduler (Phase 1) | setTimeout-based timing (Pitfall 1) | Implement lookahead scheduler from day one; never use JS timers for musical timing |
| Core scheduler (Phase 1) | AudioContext autoplay (Pitfall 2) | Gate everything behind user gesture; test in fresh browser session |
| Core scheduler (Phase 1) | Context suspension on tab switch (Pitfall 10) | Build pause/resume/resync into the clock from the start |
| Core scheduler (Phase 1) | Over-scheduling the lookahead (Pitfall 12) | Cap lookahead at 100-200ms; make it a tunable constant |
| Voice/synth engine (Phase 1-2) | AudioParam ramp bugs (Pitfall 3) | Build an envelope abstraction that encapsulates correct call sequences |
| Voice/synth engine (Phase 1-2) | Node memory leaks (Pitfall 4) | Implement voice pool with disconnect-on-ended cleanup |
| Voice/synth engine (Phase 1-2) | Reusing single-use nodes (Pitfall 11) | Voice pool creates fresh source nodes per note |
| Mixing/output (Phase 1-2) | Clipping with many performers (Pitfall 7) | DynamicsCompressorNode on master bus; gain staging from the start |
| Sampled instruments (Phase 2) | Decode blocking main thread (Pitfall 8) | Load all samples before performance starts; show progress |
| Sampled instruments (Phase 2) | Sample rate mismatch (Pitfall 6) | Provide 48kHz samples; check context.sampleRate at startup |
| Visualization (Phase 2-3) | Audio-visual desync (Pitfall 5) | Event log bridge reading audioContext.currentTime in rAF |
| Visualization (Phase 2-3) | React renders blocking scheduler (Pitfall 9) | Scheduler runs outside React; canvas-based visuals if DOM is too heavy |

## Summary of Risk by Severity

**The single most dangerous pitfall for InTempo** is Pitfall 1 (JS-timer-based scheduling). If the timing foundation is wrong, everything built on top -- multi-performer synchronization, AI decision-making, visual sync -- will be unreliable. The lookahead scheduler pattern is non-negotiable.

**The second most dangerous** is Pitfall 4 (memory leaks from undisconnected nodes). An "In C" performance can last 45-90 minutes with 20+ performers producing continuous notes. Without proper voice lifecycle management, the application will degrade and eventually crash during a performance.

**The most insidious** is Pitfall 5 (audio-visual sync). It will not be apparent until the visualization layer is added, but the fix requires changes to the scheduler. The event log bridge must be designed into Phase 1's scheduler even if visuals come later.

## Sources

- Chris Wilson, "A Tale of Two Clocks" (HTML5Rocks, scheduling pattern reference) -- HIGH confidence, this is the canonical Web Audio scheduling reference
- MDN Web Audio API documentation (AudioParam automation, autoplay policy, node lifecycle) -- HIGH confidence
- Web Audio API W3C specification (node lifecycle, AudioParam semantics, render quantum) -- HIGH confidence
- Chrome autoplay policy documentation -- HIGH confidence
- Training data knowledge of Web Audio patterns and common issues -- MEDIUM confidence (verified against known spec behavior but not against live 2026 sources)
