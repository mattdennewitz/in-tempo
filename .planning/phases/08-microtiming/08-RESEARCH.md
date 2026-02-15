# Phase 8: Microtiming - Research

**Researched:** 2026-02-15
**Domain:** Audio scheduling, rhythmic humanization, timing offsets in Web Audio
**Confidence:** HIGH

## Summary

Microtiming adds three layers of temporal humanization to InTempo performances: swing, per-performer timing personality (rush/drag), and rubato (tempo breathing). All three must be controlled through the existing humanization toggle and intensity system already in place from the velocity humanization work.

The core architectural challenge is that the Scheduler currently advances by exactly one eighth note per beat (`nextNoteTime += secondsPerEighth`), then passes that exact `time` value to `scheduleBeat()` which schedules all performer events at the same moment. Microtiming requires shifting individual note start times forward or backward relative to this grid time. The critical constraint is that all timing offsets must stay within the 100ms lookahead window (`SCHEDULE_AHEAD_TIME = 0.1`), otherwise notes will be missed by the scheduler loop.

The implementation follows the same layered architecture as velocity humanization: pure computation functions in `src/score/`, timing offset values carried alongside events, and the Scheduler applying offsets when scheduling Web Audio nodes. No external libraries are needed -- this is pure arithmetic on AudioContext time values, using the existing SeededRng for deterministic jitter.

**Primary recommendation:** Create a `src/score/timing.ts` module that mirrors `velocity.ts` -- pure functions computing a per-note timing offset (in seconds) from swing position, performer personality, rubato phase, and density. The Scheduler adds this offset to the `time` parameter when scheduling notes, clamped to the lookahead window.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API (AudioContext.currentTime) | Built-in | High-precision scheduling target | Already used; sub-ms accuracy |
| SeededRng (src/score/rng.ts) | Internal | Deterministic timing jitter | Already implemented in Phase 7 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | - |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled swing/rubato math | Tone.js Transport with swing | Tone.js is a massive dependency (200KB+) for something we can express in ~50 lines of arithmetic. The project already has its own scheduler. |
| Per-performer PRNG streams | Single shared RNG (current design) | Per-performer streams would give cleaner isolation but Phase 7 decision locked single-stream. Timing personality achieves the per-performer feel through bias parameters instead. |

**Installation:**
```bash
# No new dependencies required
```

## Architecture Patterns

### Recommended Project Structure
```
src/score/
  timing.ts          # NEW: Pure timing offset computation (mirrors velocity.ts)
  timing.test.ts     # NEW: Unit tests for timing functions
  velocity.ts        # Existing: velocity humanization (pattern to follow)
  ensemble.ts        # MODIFY: Add timing personality to AgentPersonality, return timing offset in AgentNoteEvent
  rng.ts             # Existing: SeededRng (no changes)
src/audio/
  scheduler.ts       # MODIFY: Apply timing offset when scheduling notes
  types.ts           # MODIFY: Add timing-related fields if needed
```

### Pattern 1: Layered Timing Offset (mirrors velocity.ts)
**What:** Compute a per-note timing offset in seconds from multiple independent layers, each scaled by intensity.
**When to use:** Every note event, when humanization is enabled.
**Example:**
```typescript
// Mirrors the velocity computation pattern exactly
export interface TimingContext {
  beatIndex: number;               // global beat counter (for swing)
  noteIndexInPattern: number;      // position within pattern
  personality: TimingPersonality;  // per-performer rush/drag bias
  density: number;                 // ensemble density (0-1)
  config: VelocityConfig;         // shared humanization toggle + intensity
  bpm: number;                    // current BPM (for rubato scaling)
  rubato: RubatoState;            // current rubato phase
}

export interface TimingPersonality {
  rushDragBias: number;    // -1.0 (rush) to +1.0 (drag), typically -0.3 to +0.3
  jitterAmount: number;    // 0.0-1.0 scale for random per-note variation
}

/**
 * Compute timing offset in seconds for a single note.
 * Positive = late (drag), negative = early (rush).
 * Returns 0 when humanization is disabled.
 */
export function computeTimingOffset(ctx: TimingContext, rng: SeededRng): number {
  if (!ctx.config.enabled) return 0;

  const scale = intensityScale(ctx.config.intensity);
  const maxOffset = 0.040; // 40ms max offset at full intensity

  // Layer 1: Swing (shifts alternate eighth notes forward)
  const swing = computeSwing(ctx.beatIndex, scale);

  // Layer 2: Performer personality (rush/drag bias)
  const personality = ctx.personality.rushDragBias * maxOffset * scale;

  // Layer 3: Random jitter
  const jitter = (rng.random() - 0.5) * 2 * ctx.personality.jitterAmount * maxOffset * scale;

  // Layer 4: Density-based looseness (more performers = slightly looser)
  const densityLooseness = ctx.density * 0.005 * scale;

  return swing + personality + jitter + densityLooseness;
}
```

### Pattern 2: Swing as Beat-Position Shift
**What:** Shift alternate eighth notes forward by a configurable amount (50% straight to ~67% triplet feel).
**When to use:** Applied to every note based on its beat index parity.
**Example:**
```typescript
/**
 * Swing: shifts alternate eighth notes forward.
 * swingAmount: 0.0 = straight, 0.33 = triplet swing (~67% ratio)
 * Only affects odd-numbered beats (the "and" of each beat).
 */
function computeSwing(beatIndex: number, scale: number): number {
  if (beatIndex % 2 === 0) return 0; // downbeats unchanged

  // Swing amount scales with intensity:
  // subtle=light swing, moderate=medium, expressive=full triplet
  const swingAmount = 0.15 * scale; // 0-0.15 of an eighth note duration
  // Caller converts to seconds using secondsPerEighth
  return swingAmount;
}
```
**Note:** Swing is expressed as a fraction of an eighth note, then converted to seconds in the Scheduler where BPM is known. At 120 BPM, one eighth note = 0.25s, so 0.15 * 0.25 = 37.5ms shift -- well within the 100ms lookahead.

### Pattern 3: Rubato as Slow Tempo Modulation
**What:** A low-frequency oscillation of the effective tempo, creating a "breathing" feel.
**When to use:** Continuously during playback, modulating `secondsPerEighth`.
**Example:**
```typescript
/**
 * Rubato: sinusoidal tempo modulation.
 * Returns a multiplier near 1.0 that scales secondsPerEighth.
 * Period: ~16-32 beats. Depth: +/- 2-5% of tempo.
 */
export interface RubatoState {
  phase: number;    // current phase in radians, advances each beat
  period: number;   // oscillation period in beats (16-32)
}

function computeRubatoMultiplier(rubato: RubatoState, scale: number): number {
  const maxDepth = 0.03 * scale; // 0-3% tempo variation
  return 1.0 + Math.sin(rubato.phase) * maxDepth;
}

function advanceRubato(rubato: RubatoState): void {
  rubato.phase += (2 * Math.PI) / rubato.period;
  if (rubato.phase > 2 * Math.PI) rubato.phase -= 2 * Math.PI;
}
```

### Pattern 4: AgentNoteEvent Extension
**What:** Add a `timingOffset` field to AgentNoteEvent so the Ensemble passes timing information to the Scheduler.
**When to use:** Every tick, alongside velocity.
**Example:**
```typescript
export interface AgentNoteEvent {
  performerId: number;
  midi: number;
  duration: number;
  velocity: number;
  timingOffset: number; // NEW: seconds, positive=late, negative=early
}
```

### Anti-Patterns to Avoid
- **Modifying nextNoteTime directly for swing:** This would shift ALL performers equally, defeating the purpose. Instead, apply per-event offsets when scheduling individual notes.
- **Using setTimeout for timing offsets:** Web Audio API time is far more precise. Always use `AudioContext.currentTime` plus offsets, never setTimeout delays.
- **Unbounded timing offsets:** Without clamping, large offsets could push notes outside the 100ms lookahead window. The scheduler would either miss them or schedule them too early.
- **Rubato via BPM changes:** Calling `setBpm()` would update UI, create feedback loops, and be coarse. Rubato should modulate `secondsPerEighth` locally in `advanceTime()` without touching the `_bpm` field.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| (none applicable) | - | - | All timing math is simple arithmetic; this is the correct domain for hand-rolled code |

**Key insight:** Unlike velocity humanization where we computed amplitude values, timing humanization is pure arithmetic on time values. There are no complex DSP algorithms or audio processing involved. The SeededRng + basic math is the right approach.

## Common Pitfalls

### Pitfall 1: Timing Offsets Outside Lookahead Window
**What goes wrong:** A timing offset pushes a note start time past `currentTime + SCHEDULE_AHEAD_TIME`, so the scheduler loop never reaches it. The note is silently dropped.
**Why it happens:** At slow BPM (100), one eighth note = 0.3s. A 50ms drag offset is fine. But if swing + personality + jitter stack up, total offset could exceed 100ms.
**How to avoid:** Clamp total offset to `[-SCHEDULE_AHEAD_TIME/2, +SCHEDULE_AHEAD_TIME/2]` (i.e., +/- 50ms). This guarantees the note stays within the window even with stacking.
**Warning signs:** Notes occasionally going silent, especially at lower BPMs with expressive intensity.

### Pitfall 2: Negative Time (Scheduling in the Past)
**What goes wrong:** A negative timing offset (rush) pushes a note start time before `AudioContext.currentTime`. The Web Audio API ignores notes scheduled in the past.
**Why it happens:** The scheduler processes notes at `nextNoteTime` which is close to `currentTime`. A rush offset could push it behind.
**How to avoid:** After applying the offset, clamp the final time to `Math.max(audioContext.currentTime, time + offset)`.
**Warning signs:** Notes at the start of playback being dropped, or rushed performers occasionally silent.

### Pitfall 3: Swing Affecting Note Duration
**What goes wrong:** Shifting an eighth note forward without compensating its duration creates overlap with the next note, or gaps.
**Why it happens:** Swing shifts the start time but the note duration stays the same.
**How to avoid:** For swing specifically, shorten the swung note's duration proportionally. An eighth note shifted forward by 20ms should have its duration reduced by 20ms. However, for the initial implementation, keeping durations unchanged is acceptable -- overlaps are masked by the voice pool's note-stealing behavior.
**Warning signs:** Audible overlap artifacts or cut-off notes.

### Pitfall 4: Rubato + MIDI Recording Drift
**What goes wrong:** MIDI recording uses integer beat indices. If rubato modulates timing, the recorded beat positions no longer align with a fixed grid.
**Why it happens:** The MidiRecorder records `beatCounter` which increments uniformly, but actual playback time varies.
**How to avoid:** Keep MidiRecorder using the quantized beat index (current behavior). Rubato is a playback-only effect. The MIDI export will produce a straight-time version, which is actually desirable.
**Warning signs:** None -- this is the correct behavior.

### Pitfall 5: RNG Call Order Changes Breaking Determinism
**What goes wrong:** Adding timing RNG calls changes the PRNG sequence for all subsequent operations (velocity, decisions, etc.), breaking reproducibility for existing seeds.
**Why it happens:** Single shared RNG stream (Phase 7 decision). Every new `rng.random()` call shifts the sequence.
**How to avoid:** Accept that adding microtiming will change the sequence for a given seed. This is expected when adding new features. Document that seeds from before Phase 8 will produce different performances. The key property -- same seed produces same performance after Phase 8 -- is maintained.
**Warning signs:** Comparison tests against pre-Phase-8 recordings will fail. This is expected.

### Pitfall 6: Density-Based Looseness Creating Feedback Loop
**What goes wrong:** Higher density causes looser timing, which sounds worse, which makes users add fewer performers, which reduces density, which tightens timing -- no feedback loop actually occurs. The real risk is the opposite: the effect is inaudible.
**Why it happens:** Density values (0.4-1.0 typically) multiplied by a small factor produce very subtle offsets.
**How to avoid:** Make the density multiplier audible but not extreme. 5-10ms additional spread at full density is noticeable but not sloppy.
**Warning signs:** A/B testing with density variation shows no audible difference.

## Code Examples

### Integration Point: Scheduler.scheduleBeat()
```typescript
// CURRENT (no timing offsets):
private scheduleBeat(time: number): void {
  const events = this.ensemble.tick();
  for (const event of events) {
    if (event.midi === 0) continue;
    // ... schedule at `time`
    voice.node.port.postMessage({ type: 'noteOn', frequency, time, gain: ... });
  }
}

// AFTER (with timing offsets):
private scheduleBeat(time: number): void {
  const events = this.ensemble.tick();
  for (const event of events) {
    if (event.midi === 0) continue;

    // Apply timing offset, clamped to safe range
    const offsetTime = Math.max(
      this.audioContext.currentTime,
      time + event.timingOffset
    );

    voice.node.port.postMessage({ type: 'noteOn', frequency, time: offsetTime, gain: ... });
    // Also use offsetTime for release scheduling
  }
}
```

### Integration Point: Ensemble.tick() with Rubato
```typescript
// Rubato modulates advanceTime(), not scheduleBeat()
// The Ensemble returns timing offsets per event; rubato modulates the grid itself

// Option A: Rubato in Scheduler.advanceTime()
private advanceTime(): void {
  const baseSecondsPerEighth = 60 / (this._bpm * 2);
  const rubatoMultiplier = this.rubatoEnabled
    ? computeRubatoMultiplier(this.rubatoState, this.intensityScale)
    : 1.0;
  this.nextNoteTime += baseSecondsPerEighth * rubatoMultiplier;
  advanceRubato(this.rubatoState);
}

// Option B: Rubato in Ensemble (preferred -- keeps Scheduler dumb)
// Ensemble owns RubatoState, returns a tempo multiplier per tick
// Scheduler reads it and applies to advanceTime()
```

### Integration Point: AgentPersonality Extension
```typescript
export interface AgentPersonality {
  // Existing fields...
  advanceBias: number;
  repeatBias: number;
  dropoutBias: number;
  minSilentBeats: number;
  maxSilentBeats: number;
  dropoutCooldown: number;
  baseLoudness: number;
  jitterAmount: number;

  // NEW timing personality
  rushDragBias: number;      // -0.3 to +0.3 (negative=rush, positive=drag)
  timingJitter: number;      // 0.0-1.0 scale for random per-note timing variation
}
```

### Generating Timing Personality
```typescript
export function generateTimingPersonality(rng: SeededRng): TimingPersonality {
  return {
    rushDragBias: (rng.random() - 0.5) * 0.6, // [-0.3, +0.3)
    timingJitter: 0.3 + rng.random() * 0.7,   // [0.3, 1.0) -- everyone has some jitter
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Quantized grid scheduling | Offset-based humanization | Standard practice | Notes scheduled at grid time + offset |
| Global swing parameter | Per-note swing based on beat position | N/A (both valid) | Beat-position approach is simpler for our architecture |
| Tempo modulation via BPM changes | Local secondsPerEighth modulation | N/A | Avoids UI feedback loops |

**Deprecated/outdated:**
- None applicable -- timing humanization is a well-understood domain with stable techniques.

## Open Questions

1. **Where should rubato state live?**
   - What we know: Rubato modulates the tempo grid, not individual notes. It affects `advanceTime()` in the Scheduler, or could be a multiplier returned from Ensemble.
   - What's unclear: Should the Scheduler own rubato state (simpler, but mixes concerns), or should the Ensemble own it and expose a per-tick tempo multiplier (cleaner separation)?
   - Recommendation: Ensemble owns rubato state. It already owns personality and velocity config. The Scheduler remains a dumb clock that applies whatever the Ensemble tells it. The Ensemble's `tick()` could return a `tempoMultiplier` field alongside events.

2. **Should swing be a fixed global parameter or scale with intensity?**
   - What we know: TIME-01 says "Global swing parameter shifts alternate eighth notes forward (50% straight to ~67% triplet)". This suggests a continuous parameter.
   - What's unclear: Whether swing should have its own slider or scale with the existing intensity control.
   - Recommendation: Scale with intensity (TIME-05 says "shares existing humanization toggle and intensity control"). Subtle = light swing, moderate = medium, expressive = near-triplet. No new UI control needed.

3. **How to handle swing with notes longer than one eighth note?**
   - What we know: Many patterns have half-note and whole-note durations. Swing only affects the start time, not duration.
   - What's unclear: Whether a note starting on beat 3 (odd) that sustains for 4 beats should be swung.
   - Recommendation: Apply swing based on the note's start beat index. Duration is unaffected. A long note starting on an odd beat gets shifted forward; its end time shifts accordingly.

4. **Maximum timing offset value**
   - What we know: Must stay within 100ms lookahead. At 120 BPM, one eighth = 250ms. At 180 BPM, one eighth = 167ms. At 100 BPM, one eighth = 300ms.
   - What's unclear: What maximum offset sounds good musically while staying safe technically.
   - Recommendation: Cap total offset at 40ms. This is musically perceptible (~15% of an eighth note at 120 BPM), well within the 100ms lookahead, and matches empirical data on human timing variation in ensemble performance (typically 10-50ms).

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/audio/scheduler.ts` -- scheduler architecture, lookahead window (100ms), timing model
- Codebase analysis: `src/score/velocity.ts` -- layered humanization pattern to mirror
- Codebase analysis: `src/score/ensemble.ts` -- AgentPersonality, AgentNoteEvent, single-RNG architecture
- Codebase analysis: `src/score/rng.ts` -- SeededRng API (random(), int(), weighted())
- Codebase analysis: `src/audio/engine.ts` -- humanization config threading, VelocityConfig pattern

### Secondary (MEDIUM confidence)
- Musical timing research: Human ensemble timing deviation is typically 10-50ms (empirical from music cognition studies). Swing ratios range from 50% (straight) to 75% (heavy shuffle), with 60-67% being common jazz triplet feel.
- Web Audio scheduling: AudioContext.currentTime has sub-millisecond precision. Notes scheduled in the past are silently dropped (spec behavior).

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No external dependencies needed; pure arithmetic on existing infrastructure
- Architecture: HIGH - Mirrors the proven velocity.ts pattern exactly; all integration points identified
- Pitfalls: HIGH - Timing offset clamping and lookahead constraints are deterministic/verifiable

**Research date:** 2026-02-15
**Valid until:** 2026-06-15 (stable domain, no moving targets)
