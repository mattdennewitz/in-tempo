# Domain Pitfalls

**Domain:** Browser-based generative music performance engine (Web Audio API)
**Project:** InTempo -- v1.2 Polish (stereo spread, pattern visualization, shareable seeded performances, microtiming)
**Researched:** 2026-02-15
**Scope:** Pitfalls specific to adding stereo panning, seeded PRNG, pattern visualization, and microtiming offsets to the EXISTING InTempo architecture
**Confidence:** MEDIUM-HIGH (codebase analysis + Web Audio API docs + established PRNG knowledge)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken audio, or non-deterministic "deterministic" features.

---

### Pitfall 1: StereoPannerNode Not Following Voice Through Pool Reuse

**What goes wrong:** A `StereoPannerNode` is created per voice slot and inserted between the `AudioWorkletNode` and `masterGain`. The pan value is set when the voice is claimed (e.g., performer 0 pans left, performer 2 pans right). But the voice pool reuses nodes -- when voice index 2 is released by performer 0 and claimed by performer 3, the StereoPannerNode still has performer 0's pan position. The note plays from the wrong stereo position until someone remembers to update the pan value.

**Why it happens in THIS codebase:** `VoicePool.claim()` (voice-pool.ts line 41) returns `{ node, index }` but has no concept of "who" is claiming the voice. The caller (scheduler.ts `scheduleBeat()` line 180) knows the `event.performerId` but the voice pool does not. Voice stealing (line 48) silences the old voice and hands it to the new caller, but nothing in the current architecture resets per-voice routing state. Pan is routing state.

**Consequences:**
- Notes appear at the wrong stereo position after voice stealing
- The bug is intermittent -- only manifests when voices are reused across performers with different pan assignments
- With 4 performers and 8 voices (`performerCount * 2`), voice stealing is common during dense passages, so the bug will be audible frequently
- Sounds like notes "jumping" in the stereo field, which is disorienting

**Prevention:**
- Do NOT bake pan position into the voice pool's node graph. Instead, set pan value at claim time in the scheduler.
- Modify `claim()` or add a method that accepts a pan value: the StereoPannerNode's `.pan.setValueAtTime(panValue, time)` must be called every time a voice is claimed, using the AudioContext scheduled time (not immediately).
- The pan assignment must happen in `scheduleBeat()` right after `voicePool.claim()`, based on `event.performerId`. Use `voice.panner.pan.setValueAtTime(panForPerformer, time)` -- the `time` parameter ensures the pan change is sample-accurate with the note onset.
- For voice stealing: the 2ms fast decay of the stolen voice happens at the old pan position, then the new note attacks at the new pan position. This is correct behavior -- no special handling needed as long as pan is set per-claim.

**Detection:** Play with 4+ performers. Listen for notes that appear at wrong stereo positions. More reliably: log `{voiceIndex, performerId, panValue}` on every claim and verify pan matches performer.

**Phase:** Stereo spread. Must be the first architectural decision -- pan-per-claim, not pan-per-slot.

---

### Pitfall 2: Incomplete Seeded PRNG Replacement Breaks Determinism Silently

**What goes wrong:** The developer replaces `Math.random()` in `weightedChoice()` and `computeWeights()` with a seeded PRNG, tests that two runs with the same seed produce the same pattern sequence, ships it. But `Math.random()` is called in **13+ distinct locations** across 4 files (ensemble.ts, velocity.ts, generative.ts, euclidean.ts). Missing even one call site means the PRNG sequence diverges after that point, producing performances that start identical but gradually drift apart.

**Why it happens in THIS codebase:** `Math.random()` is used directly (not through a wrapper) in:
- `ensemble.ts`: `weightedChoice()` (line 88), `randomInRange()` (line 200), `randomReps()` (line 257), `handleEndgame()` (line 411), `rejoinLogic()` (line 448), constructor stagger delays (lines 559, 634)
- `velocity.ts`: jitter computation (line 86), `generateVelocityPersonality()` (lines 106-107)
- `generative.ts`: `randInt()` (line 52), `pick()` (line 56), `weightedPick()` (line 61), plus 7 more inline calls
- `euclidean.ts`: pitch selection (lines 44, 54), pattern generation (lines 68, 77, 87, 91, 101, 118, 120, 122)

That is **30+ individual `Math.random()` call sites**. Missing one produces a performance that diverges at an unpredictable point -- the hardest kind of bug to diagnose.

**Consequences:**
- Shared seed URLs produce "almost the same" performances -- same opening, diverging midway
- Users share a seed expecting identical results, get different performances, lose trust in the feature
- The divergence point depends on which call was missed, making reproduction non-deterministic from the developer's perspective
- If velocity jitter (velocity.ts line 86) is missed, the note sequence is identical but dynamics differ -- extremely subtle

**Prevention:**
- Create a single `SeededRandom` class that wraps a PRNG (use mulberry32 -- 32-bit, fast, zero dependencies, 4 lines of code). Do NOT use `seedrandom` npm package -- it is overkill and the global `Math.seedrandom()` override pattern is dangerous.
- Replace ALL `Math.random()` calls in the score/ directory with calls to an injected `SeededRandom` instance. Use grep to find every call site: `grep -rn "Math.random" src/score/`
- Thread the PRNG instance through constructors: `Ensemble` gets it, passes it to each `PerformerAgent`, which passes it to `computeVelocity()`. Pattern generators (`generative.ts`, `euclidean.ts`) receive it as a parameter.
- **Critically**: velocity jitter (velocity.ts line 86) must ALSO use the seeded PRNG. It is pure randomness that affects the musical output. Missing it produces identical note sequences with different dynamics.
- Write a determinism test: run `Ensemble.tick()` 100 times with seed "test", collect all events. Reset, run again with same seed. Assert byte-for-byte identical event arrays.
- Do NOT override `Math.random` globally. Other libraries (React internals, testing frameworks) use it.

**Detection:** The determinism test above catches this. Run it in CI. If it ever fails, a new `Math.random()` call was introduced without using the seeded PRNG.

**Phase:** Seeded PRNG. This is an all-or-nothing change. Partial replacement is worse than no replacement (false sense of determinism).

---

### Pitfall 3: Microtiming Offsets Push Notes Outside the Lookahead Window

**What goes wrong:** Microtiming humanization adds small random offsets (e.g., +/- 15ms) to the scheduled `time` parameter of each note. A note near the edge of the lookahead window gets pushed beyond it. The scheduler's `while (nextNoteTime < audioContext.currentTime + SCHEDULE_AHEAD_TIME)` loop (scheduler.ts line 138) has already advanced past this beat, so the note is scheduled in the past (the AudioContext plays it immediately, causing a timing glitch) or scheduled beyond the window (creating a gap where the note is late).

**Why it happens in THIS codebase:** The lookahead window is exactly 100ms (`SCHEDULE_AHEAD_TIME = 0.1`). The timer interval is 25ms. A +20ms microtiming offset on a note scheduled at `currentTime + 95ms` pushes it to `currentTime + 115ms`, which is beyond the current window. The next tick will not re-schedule this beat (it has already been processed and `nextNoteTime` has advanced). The note never plays.

**Consequences:**
- Notes randomly drop out when their microtiming offset pushes them past the lookahead boundary
- At faster tempos (180 BPM, eighth = 167ms), the 100ms window has less margin, and dropouts become more frequent
- The bug is tempo-dependent and offset-magnitude-dependent, making it appear random
- Negative offsets (early notes) can push notes before `audioContext.currentTime`, causing them to fire immediately rather than at the scheduled time -- they cluster at the current moment, sounding like a flamming effect

**Prevention:**
- Clamp microtiming offsets to stay within the lookahead window: `const clampedTime = Math.max(audioContext.currentTime + 0.005, Math.min(time + offset, audioContext.currentTime + SCHEDULE_AHEAD_TIME - 0.005))`
- Better approach: apply microtiming offsets AFTER the scheduling decision but BEFORE passing to `voice.node.port.postMessage()`. The offset modifies `time` in the `noteOn` message, not `nextNoteTime`. This keeps the scheduler's beat clock unaffected.
- Keep offsets small relative to the window: max +/- 10ms (0.01s) with a 100ms window gives plenty of margin. Real human microtiming is typically +/- 5-15ms.
- NEVER modify `nextNoteTime` with microtiming offsets. The beat clock must remain on-grid. Only the audio scheduling time of individual notes gets offset.
- For the MIDI recorder: record the original grid time (pre-offset) so MIDI export stays quantized. The microtiming is a playback-only humanization.

**Detection:** Play at 180 BPM with microtiming enabled at maximum intensity. Listen for dropped notes or notes that sound late/rushed. Log any note where `scheduledTime < audioContext.currentTime` (scheduled in the past).

**Phase:** Microtiming. Must be designed with awareness of the 100ms lookahead constraint.

---

### Pitfall 4: PRNG Call Order Diverges When Performer Count Changes

**What goes wrong:** The seeded PRNG produces a deterministic sequence: call 1 returns 0.42, call 2 returns 0.87, call 3 returns 0.13, etc. If performer count changes (3 performers vs 5 performers), each tick consumes a different number of PRNG calls (3 agents x N calls per agent vs 5 agents x N calls per agent). By tick 2, the PRNG sequences have diverged completely. A seed shared as "seed=abc123&performers=4" requires BOTH values to reproduce the performance.

**Why it happens in THIS codebase:** `Ensemble.tick()` iterates over all agents (line 578: `for (const agent of this.agents)`). Each agent's `tick()` may call `Math.random()` 0-3 times depending on state (decision logic, dropout check, rejoin probability). With 4 agents, tick N consumes ~8 PRNG calls. With 5 agents, tick N consumes ~10 calls. After one tick, all subsequent random values are shifted.

**Consequences:**
- Seeds are only reproducible with the same performer count, BPM, and score mode
- URL sharing requires encoding all parameters, not just the seed
- If a user changes performer count after sharing a seed URL, they get a different performance
- This is EXPECTED behavior but will be perceived as a bug if not communicated

**Prevention:**
- Include performer count, BPM, and score mode in the shareable URL: `?seed=abc123&performers=4&bpm=120&mode=riley`
- When loading a seed URL, lock all parameters to the shared values and disable the performer +/- controls (or warn that changing them breaks reproducibility)
- Consider using per-agent PRNG streams: derive each agent's seed from the master seed + agent ID (`masterSeed + "-agent-" + agentId`). This way, adding/removing agents does not affect other agents' sequences. This is a more robust but more complex approach.
- Document clearly: "Sharing a seed reproduces the same performance only with identical settings."

**Detection:** Generate two performances with seed "test", one with 4 performers, one with 5. If they start the same but diverge after beat 1, the PRNG is shared. If per-agent PRNGs are used, performers 0-3 should behave identically in both runs.

**Phase:** Seeded PRNG. Decide single-stream vs per-agent-stream before implementation.

---

## Moderate Pitfalls

---

### Pitfall 5: Stereo Panning Breaks MIDI Export Expectations

**What goes wrong:** Stereo pan positions are applied in the audio domain via `StereoPannerNode`. The MIDI recorder captures ensemble events (pitch, velocity, duration) but has no concept of panning. When users export MIDI and import into a DAW, all notes are centered. The stereo spatial arrangement they heard is lost. Users expect the MIDI to sound like what they heard.

**Why it happens:** Panning is an audio-domain concern. The MIDI recorder (midi-recorder.ts) records from the event stream, which carries `performerId`, `midi`, `duration`, and `velocity` but no pan information. MIDI does support panning via CC#10, but the recorder does not emit control changes.

**Prevention:**
- When adding stereo spread, also add a CC#10 (Pan) event at the start of each MIDI track, set to the performer's pan position. Map from StereoPannerNode's -1..+1 range to MIDI CC#10's 0-127 range: `Math.round((pan + 1) / 2 * 127)`.
- Insert the CC#10 event once per track at tick 0. If pan positions are static per performer (likely), this is a single event per track.
- This is a "nice to have" but its absence will be noticed by DAW users.

**Detection:** Export MIDI with stereo spread enabled. Import into DAW. Check if tracks have panning that matches the live performance.

**Phase:** Can be deferred to after stereo spread is working in audio. Not blocking.

---

### Pitfall 6: Pattern Visualization Canvas Fights Existing PerformerCanvas for rAF

**What goes wrong:** The existing `PerformerCanvas` runs a `requestAnimationFrame` loop (PerformerCanvas.tsx line 34-39) that redraws every frame. Adding a second canvas for pattern visualization that also runs its own rAF loop doubles the per-frame rendering work. On lower-powered devices, two independent rAF loops competing with the audio scheduler's `setTimeout` causes frame drops and potentially audible timing glitches.

**Why it happens in THIS codebase:** `PerformerCanvas` never stops its rAF loop -- it redraws even when nothing has changed (no dirty-checking). Adding a second always-redrawing canvas doubles this waste. The scheduler's 25ms `setTimeout` (scheduler.ts line 143) competes with rAF for main thread time.

**Consequences:**
- Dropped frames (janky UI) on mobile devices and low-end laptops
- In extreme cases, the scheduler's setTimeout fires late, causing notes to be scheduled past their intended time (audible as timing jitter)
- The audio glitches are hard to diagnose because they manifest as scheduler jitter, not canvas issues

**Prevention:**
- Use a single rAF loop that renders BOTH canvases. Create a render manager that calls both `renderPerformers()` and `renderPattern()` in sequence within one rAF callback.
- Better: add dirty-checking. Only redraw when state has changed. The `PerformerCanvas` currently redraws every frame because it uses a ref to always-current data. Instead, compare the current state hash with the previous frame's hash and skip rendering if unchanged. During silence (no notes firing), this eliminates nearly all rendering work.
- Even better: use a single shared canvas with two "regions" -- performer cards on top, pattern visualization below. One canvas, one rAF, one rendering pass.
- If using separate canvases, at minimum coordinate them through a shared rAF: `requestAnimationFrame(() => { renderA(); renderB(); })`.

**Detection:** Open Chrome DevTools Performance tab. Record 10 seconds of playback. Check if rAF callbacks exceed 4ms total. If they do, rendering is too expensive for the audio workload.

**Phase:** Pattern visualization. Must be designed with awareness of the existing rAF loop.

---

### Pitfall 7: StereoPannerNode Graph Insertion Breaks Voice Pool Dispose/Resize

**What goes wrong:** The current voice pool connects nodes as `voice -> masterGain -> destination`. Adding a StereoPannerNode creates `voice -> panner -> masterGain -> destination`. But `VoicePool.dispose()` (line 112) calls `voice.disconnect()` -- this disconnects the voice from the panner, but the panner remains connected to masterGain, leaking nodes. `VoicePool.resize()` (line 83) creates new voices and connects them to `masterGain`, but does not create panners for the new voices.

**Why it happens in THIS codebase:** The voice pool manages `AudioWorkletNode` instances directly. It has no abstraction for "voice with routing chain." Adding a panner means every operation that touches the voice's graph (create, connect, disconnect, dispose) must also handle the panner.

**Prevention:**
- Create a `VoiceSlot` abstraction: `{ node: AudioWorkletNode, panner: StereoPannerNode }`. The voice pool manages `VoiceSlot[]` instead of `AudioWorkletNode[]`.
- `dispose()` must disconnect both: `voice.disconnect(); panner.disconnect()`.
- `resize()` (grow path, line 88) must create both the AudioWorkletNode and StereoPannerNode, connected in chain.
- Alternatively, create the StereoPannerNode per-claim rather than per-slot. This avoids the graph management issue but creates/destroys nodes frequently. StereoPannerNode is cheap (no allocation, no processing when disconnected), so this is viable. Connect on claim: `voice -> tempPanner -> masterGain`. Disconnect tempPanner on release. But this adds create/GC overhead per note.
- Recommended: per-slot panners (cleaner, no per-note allocation).

**Detection:** Add 4 performers, play for 30 seconds, remove 2 performers (triggering potential voice pool resize). Check for audio graph leaks via `chrome://media-internals` or by monitoring AudioContext node count.

**Phase:** Stereo spread. Part of the voice pool modification.

---

### Pitfall 8: Microtiming Applied to Sampled Instruments Differently Than Synth

**What goes wrong:** The scheduler routes notes to either the synth voice pool (line 178) or the `SamplePlayer` (line 203). Microtiming offsets applied to voice pool notes via `postMessage({ type: 'noteOn', time: time + offset })` work because the AudioWorklet uses the `time` parameter for sample-accurate scheduling. But `SamplePlayer.play()` calls smplr's `start()` with a `time` parameter that may handle offsets differently -- smplr may quantize to audio block boundaries or ignore sub-block offsets.

**Why it happens:** The synth worklet and smplr are different audio engines with different timing precision. The worklet processes at sample rate. smplr uses Web Audio's built-in scheduling which rounds to audio buffer boundaries (typically 128 samples = ~2.9ms at 44.1kHz).

**Prevention:**
- Test microtiming precision for both paths. Schedule a synth note and a sampled note at `time + 0.010` (10ms offset). Verify both actually play 10ms late (not quantized differently).
- If smplr quantizes, document the precision difference and either: (a) accept it (2.9ms quantization is below perceptual threshold for most people), or (b) apply microtiming only to synth voices.
- Apply the same offset calculation to both paths. Even if precision differs at the audio engine level, the scheduling intent should be identical.

**Detection:** Record both a synth note and a sampled note with the same microtiming offset. Compare onset times in an audio editor. If they differ by more than 3ms, the engines handle timing differently.

**Phase:** Microtiming. Test both audio paths.

---

### Pitfall 9: Seeded Generative Mode Regenerates Patterns on Every Start

**What goes wrong:** `generateGenerativePatterns()` (generative.ts) is called when switching to generative mode (`getPatternsForMode('generative')`). If the user shares a seed for a generative-mode performance, the pattern generation itself must also be seeded. But the current `setScoreMode()` in engine.ts (line 222) calls `getPatternsForMode()` which calls `generateGenerativePatterns()` which uses `Math.random()` -- NOT the seeded PRNG. Even if the ensemble AI is properly seeded, the underlying patterns it navigates are different on each run.

**Why it happens in THIS codebase:** Pattern generation is a separate phase from ensemble playback. The seeded PRNG must be active BEFORE patterns are generated, and the same PRNG sequence must be used for both pattern generation and ensemble decisions.

**Consequences:**
- In generative mode, sharing a seed produces completely different music (different patterns, not just different performer decisions)
- In riley mode, this is not an issue (patterns are static from `PATTERNS` constant)
- In euclidean mode, `generateEuclideanPatterns()` also uses `Math.random()` and has the same problem

**Prevention:**
- Seed the PRNG BEFORE calling `getPatternsForMode()`. The initialization order must be: (1) create seeded PRNG from seed string, (2) generate patterns using the PRNG, (3) create Ensemble with those patterns and the same PRNG (continuing the sequence).
- This means the PRNG must be passed into `generateGenerativePatterns()` and `generateEuclideanPatterns()` as a parameter.
- For riley mode, pattern generation can be skipped (static), but the PRNG must still be initialized at the same point in the startup sequence so the ensemble gets the same PRNG state regardless of mode.

**Detection:** Load a generative-mode seed URL twice. If the actual patterns differ (different note content, not just different performer decisions), pattern generation was not seeded.

**Phase:** Seeded PRNG. Must cover pattern generation AND ensemble decisions.

---

### Pitfall 10: Pan Position Assignment Is Ambiguous for Dynamic Performer Add/Remove

**What goes wrong:** Stereo spread assigns pan positions to performers (e.g., evenly distributed from -1 to +1). With 4 performers: -1.0, -0.33, +0.33, +1.0. When a 5th performer is added via `addPerformer()`, the pan positions should redistribute. But the existing performers are already playing with their original positions. Redistributing requires either: (a) abruptly changing live performers' pan (audible stereo jump), or (b) not redistributing (the new performer gets an arbitrary position, breaking the even spread).

**Why it happens:** `Ensemble.addAgent()` (ensemble.ts line 626) assigns a new agent ID and returns it. There is no callback or event that triggers pan recalculation. The scheduler does not know that pan positions need updating for existing performers.

**Prevention:**
- Assign pan positions based on performer ID modulo a fixed spread, not based on performer count. For example: `pan = ((id * GOLDEN_RATIO) % 1.0) * 2 - 1` distributes performers quasi-randomly but deterministically across the stereo field. Adding/removing performers does not affect others' positions.
- Alternatively: use a fixed pan table indexed by performer creation order (performer 0 = center-left, 1 = center-right, 2 = far-left, 3 = far-right, etc.). New performers fill the next slot without disturbing existing ones.
- Do NOT use `pan = (index / (count - 1)) * 2 - 1` because it depends on count, which changes.

**Detection:** Start with 4 performers. Listen to the stereo image. Add a 5th performer. If existing notes audibly shift in the stereo field, pan positions are count-dependent.

**Phase:** Stereo spread. Design the pan assignment strategy before implementation.

---

## Minor Pitfalls

---

### Pitfall 11: Pattern Visualization Rendering Complexity Scales with Pattern Length

**What goes wrong:** Pattern visualization draws the current pattern's notes as a visual representation (e.g., dots on a staff, cells in a grid). In generative mode, patterns can have up to 32 notes (generative.ts line 224: `maxNotes = 32` in climax phase). Drawing 32 notes per performer per frame (4 performers = 128 elements) is fine. But if the visualization shows multiple patterns (history or preview), or shows all performers' patterns simultaneously with animation, the rendering cost grows quadratically.

**Prevention:**
- Limit visualization to one pattern per performer (the current pattern only)
- Use dirty-flag rendering: only redraw when a performer advances to a new pattern
- Pre-render pattern visualizations as offscreen canvases and blit them, rather than re-drawing note-by-note each frame
- If showing pattern history, limit to the last 3-4 patterns with scroll

**Detection:** Switch to generative mode with 8 performers. Check if frame rate drops during climax phase (when patterns are longest).

**Phase:** Pattern visualization. Design for worst-case pattern length.

---

### Pitfall 12: Mulberry32 PRNG Period Too Short for Very Long Performances

**What goes wrong:** Mulberry32 has a period of 2^32 (~4.3 billion values). A 45-minute In C performance at 120 BPM with 4 performers consuming ~10 PRNG calls per eighth note = 120 * 2 * 45 * 10 = 108,000 calls. This is well within the period. But if the PRNG is also used for pattern generation (50-80 patterns, each consuming ~50 PRNG calls = 4,000 calls), the total is still only ~112,000. This is fine -- mulberry32's period is more than sufficient.

**Why this is a MINOR pitfall:** It is technically not a problem for this application. Documenting it to prevent over-engineering: do NOT reach for a cryptographic PRNG or a 64-bit algorithm. Mulberry32 is adequate.

**Prevention:**
- Use mulberry32. It is 4 lines of code, zero dependencies, and more than sufficient for this use case.
- Implementation: `function mulberry32(seed: number) { return function() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }`
- Seed from string: hash the seed string to a 32-bit integer (use a simple hash like `str.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0)`)

**Phase:** Seeded PRNG. Use mulberry32, do not over-engineer.

---

### Pitfall 13: Microtiming Offsets Not Recorded to MIDI (Intentional but Confusing)

**What goes wrong:** Microtiming offsets are applied to the audio scheduling time but the MIDI recorder captures grid-quantized beats (by design -- see Pitfall 3 prevention). Users who export MIDI after hearing a humanized performance get a perfectly quantized MIDI file. This is correct behavior, but users may perceive it as a bug ("the MIDI sounds robotic compared to the live performance").

**Prevention:**
- This is the correct design: MIDI export should be grid-quantized for maximum DAW compatibility. Microtiming is a playback-only humanization.
- Document this in the UI: "MIDI export captures the musical structure. Microtiming humanization is applied during live playback only."
- Optionally: offer a "humanized MIDI" export toggle that writes microtiming offsets as tick deviations. This is a future enhancement, not a v1.2 requirement.

**Phase:** Microtiming + MIDI export intersection. No code change needed, just documentation.

---

### Pitfall 14: Stereo Panning Inaudible on Mono Devices / Speakerphone

**What goes wrong:** Careful stereo panning assignments are inaudible on phones held in portrait mode (mono speaker), Bluetooth speakers in mono mode, and accessibility settings that sum to mono. The stereo spread is the primary visual-to-audio differentiation feature -- if inaudible, performers sound identical.

**Prevention:**
- Do not rely on panning as the ONLY differentiator. The instrument assignment system (synth, piano, marimba) already provides timbral differentiation. Panning is additive, not primary.
- Verify the mix sounds good in mono: sum L+R and listen. If any performer disappears or gets louder (phase issues), the panning is too aggressive.
- StereoPannerNode uses equal-power panning, which maintains perceived loudness at all positions. This is already the correct algorithm -- no custom implementation needed.

**Phase:** Stereo spread. Test in mono.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Stereo spread: voice pool integration | Pan not following voice reuse (Pitfall 1) | Set pan at claim time, not at pool creation time |
| Stereo spread: voice pool integration | Dispose/resize graph leaks (Pitfall 7) | VoiceSlot abstraction with panner included |
| Stereo spread: pan assignment | Dynamic add/remove breaks spread (Pitfall 10) | ID-based pan assignment, not count-based |
| Stereo spread: MIDI export | Pan positions lost in export (Pitfall 5) | Add CC#10 at track start |
| Seeded PRNG: Math.random replacement | Incomplete replacement (Pitfall 2) | grep ALL call sites, replace ALL, determinism test |
| Seeded PRNG: call order | Performer count changes sequence (Pitfall 4) | Per-agent PRNG streams or encode all params in URL |
| Seeded PRNG: generative/euclidean | Pattern generation not seeded (Pitfall 9) | Seed PRNG before pattern generation |
| Pattern visualization: rendering | Two rAF loops competing (Pitfall 6) | Single rAF loop, dirty-checking, shared canvas |
| Pattern visualization: scaling | Long patterns in generative mode (Pitfall 11) | Limit to current pattern, dirty-flag rendering |
| Microtiming: scheduler | Offsets exceed lookahead window (Pitfall 3) | Clamp offsets, never modify nextNoteTime |
| Microtiming: dual audio paths | Synth vs sampler timing precision (Pitfall 8) | Test both paths, accept sub-block quantization |
| Microtiming: MIDI export | Quantized export surprises users (Pitfall 13) | Document intentional design, optional future toggle |

## Summary of Risk by Severity

**The single most dangerous pitfall for this milestone** is Pitfall 2 (incomplete seeded PRNG replacement). With 30+ `Math.random()` call sites across 4 files, missing even one produces a "deterministic" feature that silently fails. The failure mode is subtle -- performances start identical and diverge unpredictably -- making it extremely hard to debug without a comprehensive determinism test. This is an all-or-nothing change.

**The second most dangerous** is Pitfall 3 (microtiming offsets exceeding the lookahead window). This produces randomly dropped notes that depend on tempo, offset magnitude, and scheduling timing. The bug is intermittent and tempo-dependent, making it hard to reproduce. The 100ms lookahead window is tight, and offsets must be carefully clamped.

**The most architecturally impactful** is Pitfall 1 (StereoPannerNode not following voice reuse). This requires modifying the voice pool's interface and the scheduler's voice claim flow. Getting this wrong early means reworking the audio graph later.

**The most commonly underestimated** is Pitfall 4 (PRNG call order diverging with performer count). Developers assume "same seed = same result" without realizing the PRNG sequence is consumed differently based on the number of agents. This must be either solved architecturally (per-agent streams) or communicated clearly (all parameters in the shareable URL).

## Sources

- InTempo codebase analysis: voice-pool.ts, scheduler.ts, ensemble.ts, velocity.ts, generative.ts, euclidean.ts, engine.ts, PerformerCanvas.tsx, renderer.ts (direct code review) -- HIGH confidence
- [StereoPannerNode MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode) -- pan.setValueAtTime for sample-accurate panning -- HIGH confidence
- [Web Audio scheduling best practices (web.dev)](https://web.dev/audio-scheduling/) -- lookahead window timing constraints -- HIGH confidence
- [Web Audio timing tutorials (IRCAM)](https://ircam-ismm.github.io/webaudio-tutorials/scheduling/timing-and-scheduling.html) -- lookahead/period relationship, jitter mitigation -- HIGH confidence
- [seedrandom (npm)](https://www.npmjs.com/package/seedrandom) -- evaluated and rejected in favor of inline mulberry32 for simplicity -- MEDIUM confidence
- [mulberry32 PRNG](https://gist.github.com/blixt/f17b47c62508be59987b) -- simple 32-bit PRNG, adequate period for this use case -- HIGH confidence (well-established algorithm)
- [tc39 proposal-seeded-random](https://github.com/tc39/proposal-seeded-random) -- native seeded PRNG not yet available, must polyfill -- MEDIUM confidence
- MIDI CC#10 (Pan) specification -- standard controller number for stereo position in MIDI -- HIGH confidence
