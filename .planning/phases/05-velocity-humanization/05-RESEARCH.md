# Phase 5: Velocity Humanization - Research

**Researched:** 2026-02-15
**Domain:** Audio velocity modeling, MIDI humanization, per-note dynamic variation
**Confidence:** HIGH

## Summary

Phase 5 adds velocity (dynamic loudness) to every note in the ensemble so that playback sounds musically alive rather than mechanically uniform. The codebase currently emits `AgentNoteEvent` with `{ performerId, midi, duration }` but no velocity field -- every note plays at the same loudness. This phase adds a `velocity` field (0.0-1.0 normalized) computed from four layered sources: per-note random jitter, per-performer personality (base loudness), metric accent (downbeat emphasis), and phrase contour (crescendo/decrescendo across pattern repetitions). The velocity value must flow through to both the AudioWorklet synth (gain scaling) and smplr sampled instruments (velocity parameter 0-127). A UI toggle lets users control humanization on/off and intensity.

The implementation is pure computation -- no new libraries needed. The velocity model lives in the score layer (ensemble/agent), the audio layer reads the value and applies it, and the UI layer adds a simple toggle control. CFG-01 (default 4 performers) is a one-line constant change.

**Primary recommendation:** Build a `VelocityModel` that computes velocity from four stacked layers (jitter + personality + metric accent + phrase contour), add `velocity: number` to `AgentNoteEvent`, and pipe it through `Scheduler` to both synth gain and smplr velocity parameter.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none new) | - | All velocity logic is pure math | No external dependencies needed for humanization |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| smplr | ^0.16.4 | Already in project -- `start({ velocity })` accepts 0-127 | Sampled instrument velocity |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom velocity model | Tone.js Humanize | Tone.js is a massive dependency for one feature; custom is simpler and tailored |
| Linear velocity scaling | Exponential/logarithmic curves | Linear is perceptually wrong (loudness is logarithmic), but for subtle variation the difference is minimal at the ranges we use |

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Recommended Changes
```
src/
├── score/
│   ├── ensemble.ts          # AgentNoteEvent gets `velocity` field
│   ├── velocity.ts          # NEW: VelocityModel — pure functions, all velocity math
│   └── ensemble.test.ts     # Velocity tests
├── audio/
│   ├── types.ts             # AgentNoteEvent type updated, HumanizationConfig type
│   ├── scheduler.ts         # Reads event.velocity, routes to synth gain / smplr velocity
│   ├── engine.ts            # Exposes humanization toggle, default performer count → 4
│   └── voice-pool.ts        # (unchanged)
├── components/
│   └── HumanizationToggle.tsx  # NEW: on/off + intensity selector
└── public/
    └── synth-processor.js   # Accept gain parameter in noteOn message
```

### Pattern 1: Layered Velocity Computation
**What:** Velocity is the product of four independent layers, each contributing a multiplicative factor around 1.0. The base velocity is multiplied by each layer's factor, then clamped to [0.0, 1.0].
**When to use:** Any time a note event is created in `PerformerAgent.tick()`.
**Example:**
```typescript
// velocity.ts — pure functions, no side effects

export interface VelocityPersonality {
  baseLoudness: number;   // 0.7-1.0 — performer's average dynamic level
  jitterAmount: number;   // 0.0-0.15 — how much random variation per note
}

export interface VelocityConfig {
  enabled: boolean;
  intensity: 'subtle' | 'moderate' | 'expressive';
}

export interface VelocityContext {
  noteIndexInPattern: number;  // which note within the pattern (0-based)
  totalNotesInPattern: number; // how many notes in the current pattern
  currentRep: number;          // which repetition (1-based)
  totalReps: number;           // total planned repetitions
  isDownbeat: boolean;         // true if this note starts on a pattern-boundary beat
  personality: VelocityPersonality;
  config: VelocityConfig;
}

/**
 * Compute velocity for a single note.
 * Returns 0.0-1.0 (normalized). Caller scales to target range.
 */
export function computeVelocity(ctx: VelocityContext): number {
  if (!ctx.config.enabled) return 1.0; // bypass: full velocity

  const scale = intensityScale(ctx.config.intensity);

  // Layer 1: Per-note random jitter (Gaussian-ish via Box-Muller or simple uniform)
  const jitter = 1.0 + (Math.random() - 0.5) * 2 * ctx.personality.jitterAmount * scale;

  // Layer 2: Performer personality (base loudness)
  const personality = ctx.personality.baseLoudness;

  // Layer 3: Metric accent (downbeat boost)
  const accent = ctx.isDownbeat ? 1.0 + 0.08 * scale : 1.0;

  // Layer 4: Phrase contour (arc across repetitions)
  const contour = phraseContour(ctx.currentRep, ctx.totalReps, scale);

  return Math.max(0.05, Math.min(1.0, personality * jitter * accent * contour));
}

function intensityScale(intensity: 'subtle' | 'moderate' | 'expressive'): number {
  switch (intensity) {
    case 'subtle': return 0.4;
    case 'moderate': return 0.7;
    case 'expressive': return 1.0;
  }
}

/**
 * Phrase contour: bell curve across repetitions.
 * Crescendo to peak around 60% through, then decrescendo.
 */
function phraseContour(currentRep: number, totalReps: number, scale: number): number {
  if (totalReps <= 1) return 1.0;
  const progress = (currentRep - 1) / (totalReps - 1); // 0.0 to 1.0
  // Bell curve: peaks at 0.6, gentle falloff
  const peak = 0.6;
  const curve = 1.0 - Math.pow((progress - peak) / 0.6, 2);
  const maxDeviation = 0.15 * scale;
  return 1.0 + curve * maxDeviation;
}
```

### Pattern 2: Velocity Personality as Part of AgentPersonality
**What:** Extend the existing `AgentPersonality` interface to include velocity traits. Generated once per performer at creation time.
**When to use:** When constructing a `PerformerAgent`.
**Example:**
```typescript
// In ensemble.ts, extend AgentPersonality:
export interface AgentPersonality {
  // ... existing fields ...
  advanceBias: number;
  repeatBias: number;
  dropoutBias: number;
  minSilentBeats: number;
  maxSilentBeats: number;
  dropoutCooldown: number;
  // NEW: velocity traits
  baseLoudness: number;   // 0.7-1.0
  jitterAmount: number;   // 0.02-0.12
}
```

### Pattern 3: Velocity Flow Through Scheduler
**What:** `AgentNoteEvent` carries velocity; `Scheduler.scheduleBeat()` uses it when triggering synth and sampler.
**When to use:** Every note scheduling call.
**Example:**
```typescript
// In scheduler.ts, inside scheduleBeat():
if (instrument === 'synth') {
  const voice = this.voicePool.claim();
  const frequency = midiToFrequency(event.midi);
  // Pass velocity as gain to synth processor
  voice.node.port.postMessage({
    type: 'noteOn',
    frequency,
    time,
    gain: event.velocity * 0.3  // scale to max synth gain
  });
} else {
  // smplr accepts velocity 0-127
  const smplrVelocity = Math.round(event.velocity * 127);
  this.samplePlayer.play(instrument, event.midi, time, noteDurationSeconds, smplrVelocity);
}
```

### Pattern 4: Synth Processor Gain Parameter
**What:** The AudioWorklet `synth-processor.js` currently has a hardcoded `maxGain = 0.3`. Extend the `noteOn` message to accept an optional `gain` parameter.
**When to use:** When the synth processor receives a noteOn message.
**Example:**
```javascript
// In synth-processor.js, noteOn handler:
if (data.type === 'noteOn') {
  if (data.time != null) {
    this.pendingNoteOn = {
      frequency: data.frequency,
      startTime: data.time,
      gain: data.gain ?? this.maxGain  // NEW: per-note gain
    };
  } else {
    this.frequency = data.frequency;
    this.noteGain = data.gain ?? this.maxGain;  // NEW
    this.targetEnvelope = 1.0;
    // ...
  }
}
// In render loop, use this.noteGain instead of this.maxGain:
channel0[i] = (osc1 + osc2) * 0.5 * this.envelope * this.noteGain;
```

### Anti-Patterns to Avoid
- **Randomizing velocity without structure:** Pure random jitter sounds mechanical and jarring. Always layer structured components (accent, contour) with small random jitter.
- **Applying velocity post-hoc in the scheduler:** Velocity should be computed where musical context exists (the agent), not in the audio scheduler which lacks pattern/repetition awareness.
- **Using 0-127 internally:** Normalize to 0.0-1.0 inside the engine; convert to 0-127 only at the smplr API boundary. This avoids integer rounding artifacts in the math.
- **Coupling velocity to the agent decision logic:** Velocity computation should be a separate pure function, not tangled into the advance/repeat/dropout decision tree.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sampled instrument velocity | Custom gain scaling for samples | smplr `start({ velocity: N })` parameter (0-127) | smplr already has multi-velocity sample layers (SplendidGrandPiano has 4 velocity groups); manual gain scaling would bypass the timbral variation that real velocity layers provide |
| Gaussian random distribution | Full Box-Muller transform | Simple `(Math.random() - 0.5) * 2 * range` (uniform) or paired `Math.random()` approximation | For subtle jitter (0.02-0.12 range), uniform distribution is indistinguishable from Gaussian and much simpler |

**Key insight:** The smplr library already handles velocity-dependent sample selection internally. Passing `velocity: 40` vs `velocity: 100` doesn't just change volume -- it selects different sample layers with different timbral characteristics. This is free expressiveness we get by using the API correctly.

## Common Pitfalls

### Pitfall 1: Velocity Bypass Breaks MIDI Export (Phase 6)
**What goes wrong:** If humanization is toggled off, `velocity` field is omitted or set to undefined, and Phase 6 MIDI export crashes or writes 0 velocity (silent notes).
**Why it happens:** Treating "disabled" as "no velocity" instead of "default velocity."
**How to avoid:** When humanization is off, `computeVelocity()` returns `1.0` (full velocity), not undefined. The velocity field ALWAYS exists on `AgentNoteEvent`.
**Warning signs:** Notes going silent when toggling humanization off.

### Pitfall 2: Inaudible Velocity Variation
**What goes wrong:** Velocity differences are mathematically present but not perceptible in audio output.
**Why it happens:** The variation range is too small, or the synth's gain curve compresses differences.
**How to avoid:** Test with "expressive" intensity first to confirm the full range is audible, then scale down for subtle/moderate. The velocity range should span at least 0.4-1.0 on expressive for clear audibility.
**Warning signs:** A/B comparison of humanized vs uniform sounds identical.

### Pitfall 3: Velocity Personality Creating "Dead" Performers
**What goes wrong:** A performer with `baseLoudness: 0.7` combined with phrase contour dip and subtle intensity produces notes at velocity ~0.25, which are inaudibly quiet.
**Why it happens:** Multiplicative stacking of factors that all pull velocity down simultaneously.
**How to avoid:** Floor the final velocity at 0.3 (not 0.0) so even the quietest performer on the quietest beat is audible. Alternatively, use additive blending for the contour layer rather than multiplicative.
**Warning signs:** Some performers occasionally seem to "disappear" during playback.

### Pitfall 4: No Global Beat Counter for Metric Accents
**What goes wrong:** Metric accents (VEL-03) require knowing "is this beat a downbeat?" but the current `PerformerAgent` only tracks `noteIndex` within a pattern, not global beat position.
**Why it happens:** Patterns have variable lengths and note durations (1, 2, 4, 8 eighth notes). A note at `noteIndex: 0` is always a pattern start but not necessarily a metric downbeat in the global time.
**How to avoid:** Two approaches: (a) treat `noteIndex === 0` (first note of each pattern iteration) as an "accent point" -- this is musically meaningful even if not a strict metric downbeat, or (b) add a global beat counter to the Ensemble that increments each tick, and pass it to agents so they can compute metric position (beat % 4 === 0 for quarter-note downbeats, beat % 8 === 0 for bar downbeats).
**Warning signs:** Accents feel randomly placed rather than rhythmically grounded.

### Pitfall 5: SamplePlayer API Mismatch
**What goes wrong:** Passing velocity to `SamplePlayer.play()` but the current signature doesn't accept it.
**Why it happens:** The current `play()` method has 4 parameters: `(instrument, midi, time, duration)`. Velocity must be added.
**How to avoid:** Update `SamplePlayer.play()` to accept an optional 5th parameter `velocity?: number` (0-127) and pass it through to `target.start({ note, time, duration, velocity })`.
**Warning signs:** TypeScript compilation errors when adding velocity to the scheduler.

## Code Examples

### Extending AgentNoteEvent with Velocity
```typescript
// audio/types.ts (or ensemble.ts where AgentNoteEvent is defined)
export interface AgentNoteEvent {
  performerId: number;
  midi: number;
  duration: number;
  velocity: number;  // NEW: 0.0-1.0 normalized
}
```

### Computing Velocity in PerformerAgent.tick()
```typescript
// In ensemble.ts, PerformerAgent.tick():
// After getting the note but before returning:
if (note.midi === 0) {
  return null;
}

const velocityCtx: VelocityContext = {
  noteIndexInPattern: s.noteIndex - 1,  // noteIndex already incremented
  totalNotesInPattern: pattern.notes.length,
  currentRep: s.totalRepetitions - s.repetitionsRemaining + 1,
  totalReps: s.totalRepetitions,
  isDownbeat: (s.noteIndex - 1) === 0,  // first note of pattern iteration
  personality: {
    baseLoudness: s.personality.baseLoudness,
    jitterAmount: s.personality.jitterAmount,
  },
  config: this.velocityConfig,  // passed from Ensemble
};

return {
  performerId: s.id,
  midi: note.midi,
  duration: note.duration,
  velocity: computeVelocity(velocityCtx),
};
```

### Updating SamplePlayer.play() for Velocity
```typescript
// audio/sampler.ts
play(
  instrument: 'piano' | 'marimba',
  midi: number,
  time: number,
  duration: number,
  velocity?: number,  // NEW: 0-127, defaults to 100
): void {
  if (!this._isReady) return;
  const target = instrument === 'piano' ? this.piano! : this.marimba!;
  target.start({ note: midi, time, duration, velocity: velocity ?? 100 });
}
```

### Humanization Toggle UI
```typescript
// components/HumanizationToggle.tsx
interface HumanizationToggleProps {
  enabled: boolean;
  intensity: 'subtle' | 'moderate' | 'expressive';
  onToggle: () => void;
  onIntensityChange: (intensity: 'subtle' | 'moderate' | 'expressive') => void;
}

export function HumanizationToggle({
  enabled, intensity, onToggle, onIntensityChange
}: HumanizationToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onToggle}>
        {enabled ? 'Humanize: On' : 'Humanize: Off'}
      </button>
      {enabled && (
        <select
          value={intensity}
          onChange={e => onIntensityChange(e.target.value as any)}
        >
          <option value="subtle">Subtle</option>
          <option value="moderate">Moderate</option>
          <option value="expressive">Expressive</option>
        </select>
      )}
    </div>
  );
}
```

### Default Performer Count Change (CFG-01)
```typescript
// audio/engine.ts — one-line change
private initialPerformerCount = 4;  // was 8

// App.tsx — update INITIAL_STATE
const INITIAL_STATE: EnsembleEngineState = {
  // ...
  performerCount: 4,  // was 8
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Random velocity jitter only | Layered: jitter + personality + accent + contour | Standard in DAWs since ~2015 | Structured variation sounds human; pure random sounds glitchy |
| Uniform gain scaling for velocity | Multi-layer sample selection (velocity groups) | Built into smplr/sfz format | Passing velocity to smplr gives timbral variety, not just volume changes |
| Global humanization amount | Per-performer personality traits | Common in ensemble simulation | Each performer sounds distinct, fulfilling VEL-02 |

**Deprecated/outdated:**
- Pure random velocity humanization (sounds unmusical, modern tools use structured layers)

## Open Questions

1. **Global beat counter vs pattern-relative accent**
   - What we know: The current agent tracks `noteIndex` within a pattern but has no global beat counter. The Ensemble `tick()` is called once per eighth note.
   - What's unclear: Should metric accents be based on a global time grid (every 4th eighth note = quarter note downbeat) or pattern-relative (first note of each pattern iteration)?
   - Recommendation: Use pattern-relative (`noteIndex === 0`) as the primary accent point. This is musically meaningful for "In C" where patterns are the rhythmic unit, not bar lines. Optionally add a global beat counter to the Ensemble for future use (Phase 6 MIDI will want it for tick counting anyway). **Confidence: MEDIUM** -- both approaches are valid; pattern-relative is simpler and arguably more musical for this piece.

2. **Velocity config persistence across reset**
   - What we know: `engine.reset()` rebuilds the ensemble. The humanization toggle and intensity are UI state.
   - What's unclear: Should velocity config live on the Engine (persists across reset) or the Ensemble (resets)?
   - Recommendation: Store on `AudioEngine` and pass to `Ensemble` on construction. This way reset preserves the user's humanization preference. **Confidence: HIGH** -- matches how BPM and score mode are handled.

3. **Intensity scaling coefficients**
   - What we know: Three levels needed (subtle/moderate/expressive).
   - What's unclear: Exact numeric values that sound good require ear-testing.
   - Recommendation: Start with scale factors [0.4, 0.7, 1.0] as multipliers on all variation ranges. Tune by ear during implementation. **Confidence: MEDIUM** -- will need empirical tuning.

## Sources

### Primary (HIGH confidence)
- Codebase analysis of `src/score/ensemble.ts`, `src/audio/scheduler.ts`, `src/audio/sampler.ts`, `src/audio/engine.ts`, `public/synth-processor.js` -- direct reading of current architecture
- [smplr GitHub](https://github.com/danigb/smplr) -- confirmed `start({ velocity: 0-127 })` parameter supported on SplendidGrandPiano and Soundfont instruments
- [smplr npm](https://www.npmjs.com/package/smplr) -- version ^0.16.4 confirmed in project package.json
- [smplr documentation](https://danigb.github.io/smplr/) -- velocity parameter range 0-127, UI default shown as 100

### Secondary (MEDIUM confidence)
- [Music Sequencing - Humanize MIDI](https://www.musicsequencing.com/article/humanize-midi/) -- standard patterns for MIDI humanization (accent, contour, jitter)
- [Slam Tracks - Humanizing MIDI](https://www.slamtracks.com/2025/12/20/5-secrets-to-humanizing-midi-drums/) -- velocity ranges and accent patterns used in production
- [Unison - How to Humanize MIDI](https://unison.audio/how-to-humanize-midi/) -- layered approach to humanization (velocity + timing + accent)

### Tertiary (LOW confidence)
- (none)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, smplr velocity API verified
- Architecture: HIGH -- clear insertion points in existing code, pure functions, minimal coupling
- Pitfalls: HIGH -- identified from direct codebase analysis (missing velocity field, beat counter gap, gain curve)
- Velocity model design: MEDIUM -- specific numeric coefficients need empirical tuning

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable domain, no fast-moving dependencies)
