# Domain Pitfalls

**Domain:** Browser-based generative music performance engine (Web Audio API)
**Project:** InTempo -- generative "In C" engine with multiple simulated performers
**Researched:** 2026-02-15
**Scope:** MIDI file export, velocity humanization, default 4 performers -- pitfalls specific to adding these features to the existing architecture
**Confidence:** MEDIUM-HIGH (codebase analysis + verified library APIs + established MIDI spec knowledge)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken output, or unusable MIDI files.

---

### Pitfall 1: AudioContext Time to MIDI Tick Conversion Drift

**What goes wrong:** The existing scheduler tracks time as floating-point `AudioContext.currentTime` seconds. MIDI files use integer ticks at a fixed resolution (PPQ/PPQN). Converting float seconds to integer ticks introduces cumulative rounding errors. Over a 45-minute In C performance with eighth-note resolution, even tiny per-note rounding errors accumulate into audible timing drift in the exported MIDI -- notes shift by tens of milliseconds relative to the grid.

**Why it happens:** The scheduler's `nextNoteTime` accumulates via `+= secondsPerEighth` (line 209 of scheduler.ts), which itself is a floating-point division (`60 / (bpm * 2)`). At 120 BPM, one eighth = 0.25s exactly, but at 137 BPM it is 0.2189781... repeating. Each note adds a fresh rounding error. When converting to integer MIDI ticks, these errors do not cancel out -- they accumulate in one direction.

**Consequences:**
- Exported MIDI file drifts out of sync with a metronome grid
- Multi-track MIDI imports into DAWs show notes slightly off-grid, requiring manual quantization
- The drift is proportional to performance length -- short tests pass, long performances fail
- If BPM changes mid-performance, the conversion error compounds at the transition

**Prevention:**
- Maintain a parallel integer tick counter alongside the float AudioContext time. Increment by a fixed integer tick count per eighth note (e.g., with PPQ=480, one eighth = 240 ticks, always exact).
- Use the tick counter as the authoritative timeline for MIDI export; use AudioContext time only for audio scheduling.
- Choose PPQ=480 (industry standard, evenly divisible by common subdivisions: quarter=480, eighth=240, sixteenth=120, triplet-eighth=160).
- Never derive MIDI ticks from AudioContext seconds. Derive both audio time and MIDI ticks independently from the same musical beat counter.

**Detection:** Export a 10-minute performance at a non-round BPM (e.g., 137). Import into a DAW. Snap-to-grid and check if late notes are consistently early or late.

**Phase:** MIDI export foundation. Must be designed before any note recording begins.

---

### Pitfall 2: Velocity Has No Path Through the Existing Architecture

**What goes wrong:** The current `AgentNoteEvent` interface returns `{ performerId, midi, duration }` -- there is no velocity field. The synth processor's `maxGain` is hardcoded to 0.3. The `SamplePlayer.play()` method does not pass a velocity parameter to smplr's `start()`. Adding velocity requires changes at every layer: ensemble AI -> scheduler -> voice pool/worklet -> sampler. Developers who add velocity at only one layer (e.g., just the MIDI export) produce files that do not match what was heard during playback.

**Why it happens:** Velocity was not part of the original design. It is a cross-cutting concern that touches: (1) the AI decision layer (generating velocity values), (2) the event transport (carrying velocity through `AgentNoteEvent`), (3) the AudioWorklet synth (scaling `maxGain` by velocity), (4) the smplr sampler (passing `velocity` to `start()`), and (5) the MIDI recorder (writing velocity to the file). Missing any one layer creates an inconsistency.

**Consequences:**
- If velocity is in MIDI export but not in audio: exported file sounds different from the live performance
- If velocity is in audio but not MIDI: exported MIDI is flat and lifeless (all notes at default velocity)
- If velocity is added to sampler but not synth worklet: piano and marimba respond to dynamics but synth voices do not, creating unnatural balance shifts
- Partial implementation is worse than no implementation -- it misleads users about what they are hearing vs. exporting

**Prevention:**
- Add `velocity: number` (0-127) to `AgentNoteEvent` first. This is the single source of truth.
- Flow it through every consumer simultaneously:
  1. `Ensemble.tick()` returns events with velocity
  2. Scheduler passes velocity to `voice.node.port.postMessage({ type: 'noteOn', frequency, time, velocity })`
  3. Synth processor multiplies `this.maxGain` by `velocity / 127`
  4. `SamplePlayer.play()` passes `velocity` to `target.start({ note: midi, time, duration, velocity })`
  5. MIDI recorder stores the velocity value directly (it is already 0-127)
- Implement all five in a single milestone. Do not ship velocity in only one path.

**Detection:** Play a performance with velocity enabled. Export MIDI. Import into a DAW with the same instruments. A/B compare. Dynamics should match.

**Phase:** Velocity humanization milestone. All five layers in a single coordinated change.

---

### Pitfall 3: midi-writer-js Velocity Scale Mismatch (0-100 vs 0-127)

**What goes wrong:** The `midi-writer-js` library uses a velocity range of **1-100** (percentage-based), not the MIDI standard 0-127. Developers who pass raw MIDI velocity values (0-127) to `NoteEvent({ velocity: midiVelocity })` get values silently clamped or misinterpreted. A velocity of 100 intended as "moderately loud" (78% of 127) becomes "maximum" (100% of 100). A velocity of 127 may be clamped to 100.

**Why it happens:** midi-writer-js made a non-standard API choice to use percentages instead of raw MIDI values. This is not prominently documented and contradicts developer expectations. smplr uses 0-127 (standard MIDI). The two libraries use different scales for the same concept.

**Consequences:**
- All exported velocities are wrong -- compressed into the top ~20% of the dynamic range
- Quiet notes (velocity 30-50) become inaudible or all sound the same
- Humanization curves are destroyed by the scale mismatch
- The bug is subtle: MIDI files "play" fine, they just lack dynamics

**Prevention:**
- Map velocity before passing to midi-writer-js: `Math.round((velocity / 127) * 100)`
- Alternatively, use raw tick-level MIDI byte writing instead of midi-writer-js's abstraction. The library's `Writer.buildFile()` returns a `Uint8Array` that can be inspected to verify velocity bytes.
- Write a unit test: create a NoteEvent with velocity 64 (MIDI mezzo-forte), export to bytes, verify the velocity byte in the MIDI data is 81 (64/127 * 100, then mapped back to 127 scale by the library internally). If the round-trip is not preserving dynamics, the mapping is wrong.
- Consider using `jsmidgen` instead, which works with raw MIDI 0-127 values and avoids this abstraction mismatch entirely.

**Detection:** Export a MIDI file with known velocity values. Open in a hex editor. Check the velocity bytes in note-on messages (status byte 0x9n, followed by note number, then velocity). If they do not match expected 0-127 values, the mapping is wrong.

**Phase:** MIDI export implementation. Must be caught during initial library integration, not after.

---

### Pitfall 4: Recording Notes That Were Never Heard (Lookahead Ghost Notes)

**What goes wrong:** The scheduler pre-schedules notes within a 100ms lookahead window. If the user stops playback, notes that were already scheduled to the audio thread will sound (they cannot be un-scheduled from AudioParam timelines), but the MIDI recorder may or may not have captured them depending on when "stop" was processed. This creates a mismatch: the last ~100ms of audio either appears or does not appear in the MIDI file, and the MIDI file may contain notes that the user did not perceive as "part of the performance."

**Why it happens:** The scheduler's `stop()` method (line 65, scheduler.ts) sets `_playing = false` and clears the setTimeout, but does not cancel already-scheduled audio events. The audio thread continues to play notes that were pushed into its queue. A MIDI recorder that logs events at scheduling time (in the `scheduleBeat` method) will have captured these ghost notes. A recorder that logs at "note actually sounded" time would need to wait for audio thread confirmation, which is architecturally complex.

**Consequences:**
- MIDI file has 1-3 extra notes at the end that were not part of the intended performance
- On a stop/start cycle, the MIDI file may have overlapping note data
- Edge case: if the user rapidly stops and re-starts, ghost notes from the previous session bleed into the new recording

**Prevention:**
- Record notes at scheduling time (in `scheduleBeat`), but tag each with a "session ID" or monotonic sequence number
- On stop, record the exact `audioContext.currentTime` of the stop command
- When finalizing the MIDI file, trim any notes whose scheduled `time` is after the stop time
- On reset, clear the recording buffer entirely
- Do NOT try to record from the audio thread -- the main-thread scheduler already has all the information needed

**Detection:** Start a performance, let it play for 10 seconds, hit stop. Check if the MIDI file duration matches the audio duration within 1 beat tolerance.

**Phase:** MIDI recording infrastructure. Design the "session" and "trim" logic before building the recorder.

---

### Pitfall 5: Multi-Track MIDI with Voice Stealing Creates Overlapping Notes

**What goes wrong:** The voice pool uses voice stealing (line 48, voice-pool.ts): when all voices are busy, the oldest voice is silenced and reused. The stolen voice's note is cut short. If the MIDI recorder tracks note-on events but relies on the voice pool's release callback for note-off, the stolen note's duration in the MIDI file will be wrong -- either too long (if the recorder never got a note-off) or creates an overlapping note-on on the same pitch (illegal in many MIDI playback engines).

**Why it happens:** Voice stealing is an audio-domain optimization. The MIDI recorder should not be coupled to the voice pool's internal state. But if the recorder uses the same "release timer" mechanism as the scheduler (lines 183-189, scheduler.ts) to determine note duration, voice stealing disrupts this: the `setTimeout`-based release timer for the stolen voice is cleared (line 173) but the MIDI recorder may not know about it.

**Consequences:**
- MIDI files with notes that overlap on the same channel + pitch, which some players handle poorly
- Note durations in MIDI that do not match what was actually heard
- With 4 default performers (2 synth voices), voice stealing will be common for synth performers, making this a frequent rather than edge-case bug

**Prevention:**
- The MIDI recorder should track its own note durations based on the `event.duration * secondsPerEighth` calculation, NOT based on voice pool release callbacks
- Each note event from `ensemble.tick()` already carries a `duration` field (in eighth notes). Convert this to MIDI ticks at recording time. This is the authoritative duration.
- Do not couple MIDI recording to the audio signal path at all. Record from the ensemble event stream, not from the audio output.
- For multi-track export: assign each performer to its own MIDI track (not channel -- tracks can share channels). This isolates overlapping issues.

**Detection:** Export MIDI, import into a DAW. Look for overlapping note regions on the same pitch within a single track. If found, the recorder is coupled to voice pool state.

**Phase:** MIDI recording architecture. The "record from events, not audio" principle must be established upfront.

---

## Moderate Pitfalls

---

### Pitfall 6: Velocity Humanization That Sounds Robotic

**What goes wrong:** Developers add random velocity variation (e.g., `baseVelocity + Math.random() * 20 - 10`) and call it "humanization." The result sounds like a machine with jitter, not a human performer. Real human velocity patterns have phrase-level contour (crescendo/diminuendo over 4-8 notes), beat-position correlation (downbeats louder), and performer-specific tendencies (some players are consistently louder).

**Why it happens:** True humanization requires modeling musical intent, not just adding noise. Random per-note variation lacks temporal correlation and musical structure.

**Prevention:**
- Layer three velocity components:
  1. **Base velocity per performer** (from AgentPersonality): some performers play louder (personality.velocityBias: 0.7-1.0 mapping to MIDI ~80-110)
  2. **Phrase contour**: use a slow sine or triangle wave over the pattern duration to create natural crescendo/diminuendo. Amplitude of ~15 MIDI velocity units.
  3. **Beat-position accent**: downbeats (first note of pattern) get +10-15 velocity; off-beats get -5-10
  4. **Micro-variation**: small random jitter of +/-5 MIDI velocity units on top of the above
- Clamp final velocity to 30-120 range (never silent, never max-harsh)
- The personality system (`AgentPersonality` in ensemble.ts) already has per-performer biases -- extend it with `velocityBias` and `dynamicRange`

**Detection:** Export MIDI, plot velocity values over time in a DAW piano roll. If velocities look like white noise, humanization is wrong. If they show gentle curves with occasional accents, it is working.

**Phase:** Velocity humanization. Implement after base velocity plumbing is working.

---

### Pitfall 7: Synth Processor Velocity Creates Clicks and Pops

**What goes wrong:** The synth processor (synth-processor.js) currently ramps to `this.maxGain = 0.3` on every noteOn. If velocity is added by changing `maxGain` per note (e.g., `this.maxGain = 0.3 * (velocity / 127)`), and a new note arrives while the envelope is still decaying from a previous note at a different velocity, the gain target jumps discontinuously. This creates audible clicks, especially on voice-stolen notes where the fast 2ms decay is followed by an immediate attack to a different gain level.

**Why it happens:** The processor's envelope model is simple: it ramps toward `targetEnvelope` (0 or 1) and multiplies by `maxGain`. If `maxGain` changes mid-envelope (during decay or during a voice steal's fast decay), the output jumps because `envelope * maxGain` changes discontinuously even if `envelope` itself is smooth.

**Consequences:**
- Clicks on voice-stolen notes (fast decay at old gain, immediate attack at new gain)
- Pops when consecutive notes have very different velocities
- The clicks are more noticeable at high volumes and on speakers (less so on headphones), making them easy to miss during development

**Prevention:**
- Do NOT change `maxGain` directly. Instead, add a separate `velocityGain` field that the envelope ramps toward during attack, similar to how `targetEnvelope` works.
- Better approach: make the noteOn message set `this.targetVelocityGain = velocity / 127`, and during the attack phase, ramp both `envelope` (0->1) and `velocityGain` (old->new) simultaneously. The attack ramp already provides the click-free transition.
- Ensure the voice steal path (`stop` message -> fast decay -> new noteOn) fully decays to near-zero before the new note's attack begins. The current 2ms fast decay should be sufficient if the new note's attack waits for the decay to complete.
- In the processor's process() loop, multiply: `sample * envelope * velocityGain * 0.3` (where 0.3 is the fixed max ceiling)

**Detection:** Set up a test that rapidly alternates between velocity=30 and velocity=120 on the same voice. Listen for clicks at the transitions. Inspect the waveform for discontinuities.

**Phase:** Velocity implementation in the synth processor. Must be done carefully alongside the base velocity plumbing.

---

### Pitfall 8: MIDI File Has No Tempo Event (Defaults to 120 BPM Everywhere)

**What goes wrong:** The developer records notes as MIDI ticks and creates the MIDI file, but forgets to insert a Set Tempo meta-event at tick 0 on track 0. MIDI players and DAWs default to 120 BPM when no tempo event is present. If InTempo's performance ran at 137 BPM but the MIDI file lacks a tempo event, the file plays back at 120 BPM -- all notes are proportionally slower and the total duration is wrong.

**Why it happens:** midi-writer-js (and jsmidgen) do not auto-insert tempo events. The developer must explicitly call `track.setTempo(bpm)`. It is easy to forget because the timing "looks right" in terms of relative note spacing (the ratios are correct, the absolute tempo is wrong). And if your test BPM happens to be 120, you will never notice.

**Consequences:**
- MIDI plays back at wrong tempo
- If BPM changes during performance (user adjusts the BPM slider), those changes are not reflected in the MIDI file
- DAW import shows correct note patterns but at wrong speed

**Prevention:**
- Insert `setTempo(bpm)` on track 0 at tick 0 before any note events
- If InTempo allows BPM changes during performance, insert additional Set Tempo events at the tick where BPM changed
- Currently `setBpm` is clamped to 100-180 (scheduler.ts line 95). The MIDI recorder must listen for BPM changes and record them as tempo events.
- Test with at least one non-120 BPM value. 120 is the MIDI default and will mask this bug.

**Detection:** Always test MIDI export at a BPM other than 120 (e.g., 140). Import into a DAW. Check that the tempo track shows the correct BPM.

**Phase:** MIDI export foundation. Part of the initial file setup.

---

### Pitfall 9: Performer-to-MIDI-Channel Mapping Exceeds 16 Channels

**What goes wrong:** MIDI supports 16 channels per port (0-15). If each of InTempo's performers gets its own MIDI channel, and the system allows up to 16 performers (engine.ts line 129: `Math.max(2, Math.min(16, count))`), channel 10 (drums in General MIDI) will be inadvertently used for a melodic performer. With the new default of 4 performers this is less likely, but the system supports dynamic add/remove, so it can grow.

**Why it happens:** Developers assign channel = performerId and forget that MIDI channel 10 (9 in 0-indexed) is reserved for drums in General MIDI. Also, channel numbers exceeding 15 are simply invalid.

**Prevention:**
- Use MIDI tracks (not channels) for performer separation. All performers can share channel 1 (or channels 1-3 for synth/piano/marimba instrument groups). MIDI Format 1 files support unlimited tracks.
- If per-performer channels are desired for DAW import convenience, skip channel 10 (0-indexed: 9).
- Map performers to channels by instrument type, not performer ID: all synth performers on channel 1, all piano on channel 2, all marimba on channel 3. This matches how a musician would set up a DAW project.

**Detection:** Add 10+ performers, export MIDI, import into a General MIDI player. If one performer sounds like drums, channel 10 was hit.

**Phase:** MIDI export multi-track setup.

---

### Pitfall 10: Silent/Dropout Performers Create Empty MIDI Tracks

**What goes wrong:** Performers go silent during dropout periods (ensemble.ts `status: 'silent'`). If the MIDI recorder creates a track per performer and the performer is silent for long stretches, the exported MIDI has tracks with long gaps of nothing. Some DAWs handle this fine; others display confusingly sparse tracks. More importantly, if a performer drops out permanently (endgame `status: 'complete'`), their track ends early, which some MIDI players interpret as end-of-file.

**Why it happens:** The ensemble AI's dropout/rejoin behavior is a musical feature that does not map cleanly to MIDI's track model. MIDI tracks typically represent continuous instrumental parts.

**Prevention:**
- Do not create separate tracks for silent performers. Only write note events when the performer is actually playing.
- Insert MIDI "All Notes Off" (CC 123) when a performer drops out, to ensure clean silence
- For endgame: when a performer completes, end their track with an End of Track meta-event at the correct tick position
- Consider merging performers by instrument type (one track per instrument) instead of one track per performer. This produces cleaner MIDI files and is how a human arranger would organize the parts.

**Detection:** Export a full performance that includes dropout/rejoin cycles. Import into a DAW. Check for tracks that appear to "end" prematurely or have orphaned note-on events without corresponding note-offs.

**Phase:** MIDI export, after basic recording works.

---

## Minor Pitfalls

---

### Pitfall 11: Blob Download Does Not Work in All Browsers

**What goes wrong:** The typical browser MIDI download pattern (`URL.createObjectURL(blob)` + click on anchor) works in Chrome and Firefox but may fail in Safari or WebView contexts. Safari has historically had issues with Blob URLs for binary file downloads, sometimes opening the raw binary in a tab instead of downloading.

**Prevention:**
- Use the `a.download = 'filename.mid'` attribute (supported in all modern browsers)
- Set the correct MIME type: `new Blob([uint8Array], { type: 'audio/midi' })`
- Revoke the object URL after download to prevent memory leaks: `URL.revokeObjectURL(url)` in a setTimeout after the click
- Test in Safari specifically

**Detection:** Test the download flow in Safari. If a page of garbled text appears instead of a file download, the Blob handling is wrong.

**Phase:** MIDI export UI integration.

---

### Pitfall 12: Velocity Changes Break Existing Gain Staging

**What goes wrong:** The voice pool's master gain (voice-pool.ts line 27) is set to `Math.min(1.0, 2.5 / size)` to prevent clipping. This was tuned assuming all voices output at `maxGain = 0.3`. If velocity is added and some notes are louder (velocity 120 = 0.28 gain) while others are quieter, the existing gain staging math no longer prevents clipping when multiple loud notes coincide. Conversely, quiet notes may become inaudible.

**Prevention:**
- After adding velocity, re-tune the master gain formula. With velocity, the worst case is `N` voices all at max velocity, so the formula should account for max possible per-voice output.
- Add a `DynamicsCompressorNode` on the master bus as a safety limiter (threshold: -6dB, ratio: 12:1). This is cheap and prevents clipping regardless of velocity combinations.
- The sampler's master gain (sampler.ts line 17, value 0.6) also needs review -- smplr's velocity support changes the output level range.

**Detection:** Play with 4 performers, all at high velocity, all playing simultaneously. Listen for distortion/clipping.

**Phase:** Velocity implementation. Must be addressed alongside the synth processor velocity changes.

---

### Pitfall 13: MIDI Export Captures Pulse Generator Notes

**What goes wrong:** The pulse generator (pulse.ts) plays a high C7 (MIDI 96) on every eighth note when enabled. If the MIDI recorder captures all scheduled audio events indiscriminately, the pulse appears in the MIDI file as a constant stream of C7 notes, which is musically incorrect for most use cases (the user may want the ensemble parts only).

**Prevention:**
- Filter pulse events out of the MIDI recording by default
- The pulse is scheduled in `scheduleBeat()` after the ensemble events (scheduler.ts lines 197-199), so it is easy to exclude -- only record events that come from `ensemble.tick()`, not from the pulse generator
- Optionally: offer a "include pulse track" toggle in the export UI for users who want it

**Detection:** Export MIDI with pulse enabled. Import into a DAW. Look for a constant C7 note on every eighth note. If present and unwanted, the recorder is too broad.

**Phase:** MIDI recording. Easy to avoid if the recorder only taps the ensemble event stream.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| MIDI recording infrastructure | Time conversion drift (Pitfall 1) | Integer tick counter parallel to AudioContext time from day one |
| MIDI recording infrastructure | Ghost notes on stop (Pitfall 4) | Session tracking with stop-time trimming |
| MIDI recording infrastructure | No tempo event (Pitfall 8) | Insert setTempo at tick 0; test at non-120 BPM |
| MIDI recording infrastructure | Pulse captured (Pitfall 13) | Record from ensemble events only, not audio output |
| Velocity plumbing | No velocity path exists (Pitfall 2) | Extend AgentNoteEvent, flow through all 5 layers simultaneously |
| Velocity plumbing | Gain staging breaks (Pitfall 12) | Re-tune master gains; add DynamicsCompressorNode |
| Synth processor velocity | Clicks from gain discontinuity (Pitfall 7) | Separate velocityGain field with ramped transitions |
| Velocity humanization | Random noise is not humanization (Pitfall 6) | Layered model: personality + phrase contour + beat accent + micro-jitter |
| MIDI file export | Velocity scale mismatch (Pitfall 3) | Map 0-127 to 0-100 for midi-writer-js, or use jsmidgen which uses raw MIDI values |
| MIDI multi-track | Voice stealing durations (Pitfall 5) | Record from event stream durations, not voice pool callbacks |
| MIDI multi-track | Channel 10 drums conflict (Pitfall 9) | Map by instrument type to channels 1-3, not performer ID |
| MIDI multi-track | Empty tracks from dropouts (Pitfall 10) | Merge by instrument type or handle silent periods explicitly |
| MIDI download UI | Safari Blob issues (Pitfall 11) | Use download attribute + correct MIME type + URL revocation |

## Summary of Risk by Severity

**The single most dangerous pitfall for this milestone** is Pitfall 2 (velocity has no path through the architecture). Velocity is a cross-cutting concern that touches every layer from AI decisions to audio output to MIDI export. Implementing it partially guarantees inconsistency between what users hear and what they export. All five layers must be updated in coordination.

**The second most dangerous** is Pitfall 1 (AudioContext time to MIDI tick drift). This is architecturally fundamental -- if the time conversion is wrong, every note in the MIDI file is wrong. The fix (parallel integer tick counter) must be designed before any recording code is written.

**The most insidious** is Pitfall 3 (midi-writer-js velocity scale). It produces MIDI files that "work" but have compressed dynamics. Because the notes play at the right pitches and times, the bug passes casual testing. Only careful A/B comparison reveals the dynamic range is wrong. This can be avoided entirely by choosing jsmidgen (which uses standard 0-127) or by writing a mapping function with a unit test.

## Sources

- InTempo codebase analysis: scheduler.ts, voice-pool.ts, engine.ts, sampler.ts, synth-processor.js, ensemble.ts (direct code review) -- HIGH confidence
- [smplr GitHub repository](https://github.com/danigb/smplr) -- start() accepts velocity 0-127, confirmed via README -- HIGH confidence
- [midi-writer-js GitHub repository](https://github.com/grimmdude/MidiWriterJS) -- velocity parameter uses 1-100 scale, confirmed via README and API docs -- HIGH confidence
- [MIDI file timing/PPQN reference](http://midi.teragonaudio.com/tech/midifile/ppqn.htm) -- integer tick rounding issues documented -- HIGH confidence
- [MDN AudioWorklet documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet) -- postMessage for parameter control -- HIGH confidence
- [jsmidgen npm package](https://www.npmjs.com/package/jsmidgen) -- alternative MIDI writer using raw 0-127 values -- MEDIUM confidence (less recent activity but stable API)
- MIDI specification knowledge (tempo meta-events, channel 10 drums, note-on/off semantics) -- HIGH confidence (well-established standard)
