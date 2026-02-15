# Phase 4: Composition Modes - Research

**Researched:** 2026-02-15
**Domain:** Algorithmic music generation, Euclidean rhythms, score mode architecture
**Confidence:** HIGH

## Summary

Phase 4 adds two alternative composition modes (Generative and Euclidean) alongside Riley's original 53-pattern score. The core challenge is building pattern generators that produce `Pattern[]` conforming to the existing type system, then wiring a mode selector through `AudioEngine` to `Ensemble` so that different pattern sets can be swapped in before (or during, with reset) performance.

The existing architecture is well-suited for this: `Ensemble` already accepts `Pattern[]` in its constructor, `PerformerAgent` navigates patterns by index, and `FINAL_PATTERN_INDEX` just needs to become dynamic (derived from `patterns.length - 1` rather than hardcoded to 52). The Bjorklund algorithm for Euclidean rhythms is well-documented and simple to implement in ~20 lines of TypeScript -- no library needed. Generative melodic cell creation is a custom algorithm guided by the detailed CONTEXT.md constraints.

**Primary recommendation:** Build two pure functions (`generateGenerativePatterns()` and `generateEuclideanPatterns()`) that return `Pattern[]`, make `FINAL_PATTERN_INDEX` dynamic in `Ensemble` and `PerformerAgent`, add a `setPatterns()` method to `AudioEngine`, and expose repetition state through `PerformerState`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Generative Pattern Character:**
- Cell lengths: Mirror Riley's range (1-32 eighth notes, similar distribution)
- Pitch palette: Strict C major only (white keys: C D E F G A B)
- Rests: Include rests within patterns for rhythmic variety and breathing room
- Pitch range: Wider than Riley -- C3-C6 (three octaves), MIDI 48-84
- Melodic contour: Mixed freely -- leaps and steps in equal measure, angular melodies welcome
- Pulse patterns: Include some single-note repeated-pitch patterns (rhythmic pulses)
- Progressive arc: Early patterns simpler/shorter, middle gets complex, end winds down
- Freshness: New patterns generated each performance -- no seeds
- Note durations: Variable (eighth, quarter, half notes within cells)
- Shared motifs: Some patterns reuse/transform melodic fragments from earlier patterns
- Tonal center: Subtle drift allowed -- later patterns may lean toward G or F as secondary centers before returning to C
- Rhythmic character: Varied and surprising -- syncopation, straight rhythm, unexpected accents
- Density variation: Some patterns sparse, others dense
- Endgame: Last ~5 patterns simplify, gravitate back to C, shorter cells
- Identity: Recognizably different from Riley -- clearly algorithmic, inspired by but not imitating In C
- Influences: Draw from broader minimalism -- Reich phasing, Glass arpeggios, Eno ambient

**Euclidean Pattern Design:**
- Pitch assignment: Mix -- some single-pitch rhythmic pulses, others assign C-major pitches to each pulse
- Step counts: Short (4-16 steps) -- tight, hypnotic cycling
- Character: Tonal/melodic overall -- Euclidean rhythms as framework but pitched content makes it melodic
- Freshness: Fresh each time (matching generative mode)
- Rotation: Yes, use rotation offsets -- some patterns share K/N but different starting positions
- Progressive arc: Early patterns sparser (fewer pulses), later patterns denser
- Scale: Claude decides -- may use pentatonic or other scale to distinguish from generative mode
- Non-pulse steps: Rests (silence)
- Interlocking pairs: Yes -- some adjacent patterns are complementary
- Pitch range: Same as generative (C3-C6)
- Endgame: Last patterns simplify (fewer pulses per step count)

**Pattern Set Shape:**
- Pattern count: Generative 30-80 patterns, Euclidean 20-40 patterns
- Endgame trigger: Last pattern triggers endgame -- ensemble adapts dynamically
- Band width: Scale with pattern count -- proportional spread

**Mode Switching UX:**
- When: Anytime -- switching mid-performance triggers full reset (stop, generate new patterns, reset performers, user clicks start)
- Descriptions: Text description under each mode option
- Mode indicator: Subtle badge visible during performance
- Selector redesign: Restyle ScoreModeSelector to match InTempo visual identity
- Per-performer display: CSS grid cards showing `Player N - pattern - rep/total` format
- Remove canvas visualization: Replace canvas with enhanced performer cards

### Claude's Discretion
- Harmony awareness: Whether to consider vertical harmony between adjacent patterns (generative)
- Scale choice for Euclidean mode: May use pentatonic or other scale to distinguish from generative

### Deferred Ideas (OUT OF SCOPE)
None explicitly listed.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.9.3 | Already in project | Existing |
| React | ^19.2.0 | Already in project | Existing |
| Vite | ^7.3.1 | Already in project | Existing |

### Supporting
No new dependencies required. Bjorklund's algorithm is ~20 lines of TypeScript; a library adds unnecessary weight for a single function.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled Bjorklund | `euclidean-rhythms` npm (v3.1.1) | Library is 3+ years old, API is just `getPattern(pulses, steps) => number[]`. Algorithm is trivial -- 20 lines. No dependency preferred. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── score/
│   ├── patterns.ts              # Riley's 53 patterns (unchanged)
│   ├── generative.ts            # generateGenerativePatterns(): Pattern[]
│   ├── euclidean.ts             # generateEuclideanPatterns(): Pattern[]
│   ├── bjorklund.ts             # bjorklund(k, n): number[] -- pure algorithm
│   ├── ensemble.ts              # Modified: dynamic FINAL_PATTERN_INDEX
│   └── performer.ts             # Unchanged (uses Pattern[] already)
├── audio/
│   ├── types.ts                 # Extended: ScoreMode type, updated PerformerState
│   ├── engine.ts                # Extended: setScoreMode() method
│   ├── scheduler.ts             # Unchanged
│   └── voice-pool.ts            # Unchanged
├── components/
│   ├── ScoreModeSelector.tsx     # New component (was missing, create fresh)
│   ├── PatternDisplay.tsx        # Enhanced: rep/total display, card grid
│   ├── Transport.tsx             # Unchanged
│   └── BpmSlider.tsx             # Unchanged
└── App.tsx                       # Wires ScoreModeSelector + mode state
```

### Pattern 1: Score Mode as Pattern[] Factory

**What:** Each score mode is a function that returns `Pattern[]`. The `Ensemble` doesn't know or care which mode generated the patterns.

**When to use:** Always -- this is the core architecture.

**Example:**
```typescript
// src/audio/types.ts
export type ScoreMode = 'riley' | 'generative' | 'euclidean';

// Score mode to pattern factory
function getPatternsForMode(mode: ScoreMode): Pattern[] {
  switch (mode) {
    case 'riley':
      return PATTERNS; // Static, always the same 53
    case 'generative':
      return generateGenerativePatterns(); // Fresh each call
    case 'euclidean':
      return generateEuclideanPatterns(); // Fresh each call
  }
}
```

### Pattern 2: Dynamic FINAL_PATTERN_INDEX

**What:** Replace hardcoded `FINAL_PATTERN_INDEX = 52` with `this.patterns.length - 1` derived from the patterns array passed to `Ensemble`.

**When to use:** Required for variable-length scores.

**Example:**
```typescript
// In Ensemble constructor
class Ensemble {
  private finalPatternIndex: number;

  constructor(count: number, patterns: Pattern[]) {
    this._patterns = patterns;
    this.finalPatternIndex = patterns.length - 1;
    // ... create agents
  }
}

// In PerformerAgent -- pass finalPatternIndex or patterns.length
class PerformerAgent {
  private finalPatternIndex: number;

  constructor(id: number, patterns: Pattern[]) {
    this.patterns = patterns;
    this.finalPatternIndex = patterns.length - 1;
    // ...
  }
}
```

### Pattern 3: Dynamic Band Width

**What:** Scale `BAND_WIDTH` proportionally with pattern count.

**When to use:** When pattern count varies from Riley's 53.

**Example:**
```typescript
// Proportional band width: ~6% of total patterns, minimum 2, maximum 5
const bandWidth = Math.max(2, Math.min(5, Math.round(patterns.length * 0.06)));
```

### Pattern 4: Exposing Repetition State

**What:** Extend `PerformerState` and `AgentState` to expose current repetition / total repetitions for UI display.

**When to use:** For the `Player N - pattern - rep/total` card display.

**Example:**
```typescript
// Extended PerformerState
export interface PerformerState {
  id: number;
  patternIndex: number;
  currentPattern: number;
  status: 'playing' | 'silent' | 'complete';
  currentRep: number;      // NEW: which rep they're on (1-based)
  totalReps: number;       // NEW: total reps assigned for current pattern
}

// In AgentState, we already have repetitionsRemaining.
// To derive currentRep/totalReps:
// - Store totalReps when assigned: totalReps = randomReps()
// - currentRep = totalReps - repetitionsRemaining
// Need to add a `totalRepetitions` field to AgentState
```

### Pattern 5: Mode Switch with Full Reset

**What:** Changing score mode stops playback, generates new patterns, creates new Ensemble, resets UI.

**Example:**
```typescript
// In AudioEngine
async setScoreMode(mode: ScoreMode): Promise<void> {
  const wasPlaying = this.scheduler?.isPlaying ?? false;
  if (wasPlaying) {
    this.scheduler?.reset();
  }

  const patterns = getPatternsForMode(mode);
  this.ensemble = new Ensemble(this.performerCount, patterns);
  this.scheduler = new Scheduler(this.audioContext!, this.voicePool!, this.ensemble);
  // Reconnect state change callback
  // Do NOT auto-restart -- user must click start again
}
```

### Anti-Patterns to Avoid
- **Modifying PATTERNS array in place:** Riley's patterns are the canonical reference. Never mutate them. Generative/Euclidean modes return fresh arrays.
- **Making Ensemble mode-aware:** The Ensemble should not know about score modes. It receives `Pattern[]` and navigates them. Mode selection is a concern of AudioEngine/App.
- **Sharing state between generator calls:** Each call to `generateGenerativePatterns()` or `generateEuclideanPatterns()` must be self-contained. No module-level mutable state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Euclidean rhythm algorithm | Custom from scratch without understanding | Bjorklund's algorithm (well-documented) | The algorithm is specific and well-defined; ad-hoc distribution won't produce correct Euclidean rhythms |

**Key insight:** In this phase, most things ARE hand-rolled by design -- the generative and Euclidean pattern generators are custom algorithms. The only "don't hand-roll" is: don't invent your own rhythm distribution algorithm when Bjorklund's is the established solution.

## Common Pitfalls

### Pitfall 1: Hardcoded Pattern Count Assumptions
**What goes wrong:** `FINAL_PATTERN_INDEX = 52` is hardcoded in `ensemble.ts`. Variable-length scores will break endgame logic, band enforcement, and completion detection.
**Why it happens:** Riley's score is always 53 patterns, so the constant was fine until now.
**How to avoid:** Derive from `patterns.length - 1` at construction time. Pass to PerformerAgent. Search for all uses of `FINAL_PATTERN_INDEX` (found in: `decisionLogic`, `handleEndgame`, `doRejoin`, plus the constant declaration).
**Warning signs:** Performers never completing, or completing immediately, on non-53 pattern scores.

### Pitfall 2: Generative Patterns That Sound Like Random Noise
**What goes wrong:** Pure random note selection produces atonal chaos that doesn't sound musical.
**Why it happens:** Musical coherence requires constraints: interval limits, scale adherence, contour shaping, rest placement.
**How to avoid:** Implement specific constraints from CONTEXT.md: C major only, varied durations, progressive arc, motif reuse, density variation. Test by listening.
**Warning signs:** Every pattern sounds the same; no sense of progression; no rhythmic variety.

### Pitfall 3: Euclidean Patterns All Sounding Identical
**What goes wrong:** Using the same K/N values for all patterns produces monotonous rhythmic sameness.
**Why it happens:** Not varying step counts, pulse counts, rotation offsets, or pitch assignments.
**How to avoid:** Vary K (pulses) and N (steps) across the set. Use rotation offsets. Mix single-pitch rhythmic pulses with melodic pitched patterns. Create interlocking complementary pairs.
**Warning signs:** All patterns have same rhythmic feel despite different pitches.

### Pitfall 4: Band Width Not Scaling
**What goes wrong:** With 20 Euclidean patterns, a band width of 3 means performers cover 15% of the score. With 80 generative patterns, band width 3 means only 3.75%.
**Why it happens:** BAND_WIDTH is currently a constant (3).
**How to avoid:** Scale band width proportionally: `Math.max(2, Math.min(5, Math.round(patternCount * 0.06)))`.
**Warning signs:** Performers too clustered (short scores) or too spread (long scores).

### Pitfall 5: Missing Repetition Tracking State
**What goes wrong:** UI wants to show "rep 2/5" but `PerformerState` only has `patternIndex` and `status`. The internal `repetitionsRemaining` field exists in `AgentState` but not exposed, and we don't track total reps assigned.
**Why it happens:** Original design didn't need UI display of repetition progress.
**How to avoid:** Add `totalRepetitions` field to `AgentState` (set alongside `repetitionsRemaining`). Expose `currentRep` and `totalReps` in `PerformerState`. Calculate: `currentRep = totalReps - repetitionsRemaining + 1` (if currently playing notes of that rep).
**Warning signs:** Rep counter always showing 0/0 or wrong values.

### Pitfall 6: Re-initialization Race Conditions
**What goes wrong:** Switching modes while audio is playing causes the old Scheduler to fire events on a stale Ensemble, or the new Ensemble gets ticked before Scheduler is reconnected.
**Why it happens:** Async initialization + mode switch = potential for split-second state inconsistency.
**How to avoid:** Always `stop()` first, then replace Ensemble, then create new Scheduler. Never auto-restart. User must explicitly click start.
**Warning signs:** Audio glitches, console errors about null references on mode switch.

## Code Examples

### Bjorklund's Algorithm (Euclidean Rhythm Generator)

```typescript
// Source: Toussaint (2005) "The Euclidean Algorithm Generates Traditional Musical Rhythms"
// Verified against multiple implementations

/**
 * Bjorklund's algorithm: distribute k pulses as evenly as possible across n steps.
 * Returns binary array of length n (1 = pulse, 0 = rest).
 */
export function bjorklund(k: number, n: number): number[] {
  if (k >= n) return Array(n).fill(1);
  if (k === 0) return Array(n).fill(0);

  let pattern: number[][] = [];
  for (let i = 0; i < n; i++) {
    pattern.push(i < k ? [1] : [0]);
  }

  let level = 0;
  let counts: number[] = [];
  let remainders: number[] = [];

  // Compute remainders (like Euclidean GCD)
  let divisor = n - k;
  remainders.push(k);

  while (remainders[remainders.length - 1] > 1) {
    counts.push(Math.floor(divisor / remainders[remainders.length - 1]));
    const newRemainder = divisor % remainders[remainders.length - 1];
    divisor = remainders[remainders.length - 1];
    remainders.push(newRemainder);
    level++;
    if (newRemainder <= 1) break;
  }
  counts.push(divisor);

  // Build pattern via the Bjorklund construction
  function build(level: number): number[] {
    if (level === -1) return [0];
    if (level === -2) return [1];

    const result: number[] = [];
    for (let i = 0; i < counts[level]; i++) {
      result.push(...build(level - 1));
    }
    if (remainders[level] > 0) {
      result.push(...build(level - 2));
    }
    return result;
  }

  return build(level);
}

/**
 * Rotate a pattern by offset positions.
 * E.g., rotate([1,0,1,0,0], 2) => [1,0,0,1,0]
 */
export function rotatePattern(pattern: number[], offset: number): number[] {
  const len = pattern.length;
  const normalized = ((offset % len) + len) % len;
  return [...pattern.slice(normalized), ...pattern.slice(0, normalized)];
}
```

### Generative Pattern Factory (Skeleton)

```typescript
// Structure for the generative pattern generator

interface GenerativeConfig {
  patternCount: number;        // 30-80
  pitchRange: [number, number]; // [48, 84] = C3-C6
  scale: number[];             // C major: [0, 2, 4, 5, 7, 9, 11]
}

export function generateGenerativePatterns(): Pattern[] {
  const count = Math.floor(Math.random() * 51) + 30; // 30-80
  const patterns: Pattern[] = [];
  const motifBank: ScoreNote[][] = []; // For motif reuse

  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1); // 0.0 to 1.0
    const phase = getPhase(progress);  // 'intro' | 'development' | 'climax' | 'winddown'

    const notes = generateCell(phase, progress, motifBank);
    patterns.push({ id: i + 1, notes });

    // Occasionally store motif for later reuse/transformation
    if (Math.random() < 0.3 && notes.length >= 2) {
      motifBank.push(notes.slice(0, Math.min(4, notes.length)));
    }
  }

  return patterns;
}

function getPhase(progress: number): 'intro' | 'development' | 'climax' | 'winddown' {
  if (progress < 0.2) return 'intro';
  if (progress < 0.6) return 'development';
  if (progress < 0.85) return 'climax';
  return 'winddown';
}
```

### Euclidean Pattern Factory (Skeleton)

```typescript
export function generateEuclideanPatterns(): Pattern[] {
  const count = Math.floor(Math.random() * 21) + 20; // 20-40
  const patterns: Pattern[] = [];

  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1);

    // Progressive density: early = sparser, later = denser
    const steps = Math.floor(Math.random() * 13) + 4; // 4-16
    const maxPulses = Math.max(1, Math.floor(steps * (0.3 + progress * 0.4)));
    const pulses = Math.max(1, Math.floor(Math.random() * maxPulses) + 1);

    const rotation = Math.floor(Math.random() * steps);
    const rhythm = rotatePattern(bjorklund(pulses, steps), rotation);

    // Decide: single-pitch pulse or melodic
    const isMelodic = Math.random() < 0.6;
    const notes = rhythmToNotes(rhythm, isMelodic, progress);

    patterns.push({ id: i + 1, notes });

    // Create interlocking partner for some patterns
    if (i < count - 1 && Math.random() < 0.3) {
      const complement = rhythm.map(v => 1 - v); // Complementary rhythm
      const partnerNotes = rhythmToNotes(complement, isMelodic, progress);
      patterns.push({ id: i + 2, notes: partnerNotes });
      i++; // Skip next iteration
    }
  }

  return patterns;
}
```

### AudioEngine Mode Integration

```typescript
// In AudioEngine
export class AudioEngine {
  private currentMode: ScoreMode = 'riley';
  private currentPatterns: Pattern[] = PATTERNS;

  setScoreMode(mode: ScoreMode): void {
    this.currentMode = mode;
    this.currentPatterns = getPatternsForMode(mode);

    // Full reset: stop, rebuild ensemble with new patterns
    this.scheduler?.reset();
    this.voicePool?.stopAll();

    this.ensemble = new Ensemble(this.performerCount, this.currentPatterns);
    if (this.audioContext && this.voicePool) {
      this.scheduler = new Scheduler(this.audioContext, this.voicePool, this.ensemble);
      if (this.pendingOnStateChange) {
        this.scheduler.onStateChange = this.pendingOnStateChange;
      }
    }

    // Fire state change to update UI (not playing, fresh performers)
    this.fireStateChange();
  }

  get patternCount(): number {
    return this.currentPatterns.length;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded 53-pattern score | Variable-length Pattern[] | This phase | Ensemble must derive limits from array length |
| No score mode concept | ScoreMode type union | This phase | New type, new UI component, new engine method |
| PerformerState without rep info | PerformerState with currentRep/totalReps | This phase | New fields surfaced from AgentState |
| Fixed BAND_WIDTH = 3 | Dynamic band width | This phase | Proportional to pattern count |

## Key Technical Details

### Existing Type Structure (Unchanged)
```typescript
interface ScoreNote {
  midi: number;    // MIDI note number (0 for rest)
  duration: number; // duration in eighth notes
}

interface Pattern {
  id: number;       // 1-based sequential
  notes: ScoreNote[];
}
```

### MIDI Reference for C Major (C3-C6)
```
C3=48, D3=50, E3=52, F3=53, G3=55, A3=57, B3=59
C4=60, D4=62, E4=64, F4=65, G4=67, A4=69, B4=71
C5=72, D5=74, E5=76, F5=77, G5=79, A5=81, B5=83
C6=84
```
Scale intervals (semitones from C): `[0, 2, 4, 5, 7, 9, 11]`

### Hardcoded References to Find and Update
1. `ensemble.ts` line 70: `const FINAL_PATTERN_INDEX = 52;` -- must become dynamic
2. `ensemble.ts` line 69: `const BAND_WIDTH = 3;` -- must scale with pattern count
3. `ensemble.ts` line 312: `if (s.patternIndex >= FINAL_PATTERN_INDEX)` -- endgame check
4. `ensemble.ts` line 362: `p.patternIndex >= FINAL_PATTERN_INDEX` -- endgame fraction
5. `ensemble.ts` line 419: `if (s.patternIndex < FINAL_PATTERN_INDEX)` -- rejoin advance
6. `patterns.ts` line 26: `export const TOTAL_PATTERNS = 53;` -- used by App.tsx for display
7. `App.tsx` line 4: `import { TOTAL_PATTERNS } from './score/patterns.ts';` -- must come from engine state
8. `engine.ts` line 34: `new Ensemble(this.performerCount, PATTERNS)` -- must use mode-selected patterns

### Changes Needed Per File

| File | Change Type | Description |
|------|-------------|-------------|
| `src/audio/types.ts` | Extend | Add `ScoreMode` type, add `currentRep`/`totalReps` to `PerformerState`, add `scoreMode`/`totalPatterns` to `EnsembleEngineState` |
| `src/score/bjorklund.ts` | New file | Pure Bjorklund algorithm + rotation utility |
| `src/score/generative.ts` | New file | `generateGenerativePatterns(): Pattern[]` |
| `src/score/euclidean.ts` | New file | `generateEuclideanPatterns(): Pattern[]` |
| `src/score/ensemble.ts` | Modify | Dynamic `finalPatternIndex`, dynamic `bandWidth`, expose rep state |
| `src/audio/engine.ts` | Modify | Add `setScoreMode()`, track current mode/patterns, expose `patternCount` |
| `src/components/ScoreModeSelector.tsx` | New file | Mode selector with descriptions, badge |
| `src/components/PatternDisplay.tsx` | Modify | Enhanced cards with rep/total, CSS grid |
| `src/App.tsx` | Modify | Wire mode selector, pass mode to engine, receive totalPatterns from state |

## Open Questions

1. **Generative algorithm quality tuning**
   - What we know: CONTEXT.md defines desired character extensively (contour, density, motifs, arc)
   - What's unclear: The exact balance of randomness vs. constraint that produces "good" results requires iterative listening
   - Recommendation: Implement a solid initial algorithm with the constraints, then tune parameters based on auditory review during UAT

2. **Pentatonic vs. full major scale for Euclidean mode**
   - What we know: CONTEXT.md says "Claude decides" -- may use pentatonic to distinguish from generative
   - What's unclear: Best tonal palette for Euclidean mode
   - Recommendation: Use C major pentatonic (C D E G A, no F or B) for Euclidean mode. This creates a warmer, more consonant sound that pairs well with rhythmic patterns and clearly distinguishes from the generative mode's full diatonic palette.

3. **Whether PerformerAgent should receive finalPatternIndex or derive it**
   - What we know: PerformerAgent already receives `patterns: Pattern[]` in constructor
   - What's unclear: Pass explicit finalPatternIndex or let agent derive from `patterns.length - 1`?
   - Recommendation: Derive from `this.patterns.length - 1` inside PerformerAgent. Simpler, no sync risk.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/score/ensemble.ts`, `src/score/patterns.ts`, `src/audio/types.ts`, `src/audio/engine.ts` -- direct code reading
- CONTEXT.md -- user decisions for this phase
- Toussaint, G.T. (2005) "The Euclidean Algorithm Generates Traditional Musical Rhythms" -- foundational paper for Bjorklund's algorithm

### Secondary (MEDIUM confidence)
- [euclidean-rhythms npm](https://github.com/mkontogiannis/euclidean-rhythms) -- v3.1.1, API: `getPattern(pulses, steps) => number[]`. Confirmed API matches Bjorklund's algorithm output. Not recommended as dependency (trivial to implement).
- [Euclidean Rhythms explanation](https://medium.com/code-music-noise/euclidean-rhythms-391d879494df) -- Background on the algorithm and musical applications

### Tertiary (LOW confidence)
- [Algorithmic composition tutorial](https://junshern.github.io/algorithmic-music-tutorial/part1.html) -- General approaches to algorithmic music in JS. Not directly applicable but useful background.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing tech
- Architecture: HIGH -- existing Ensemble/Pattern architecture supports this cleanly
- Bjorklund algorithm: HIGH -- well-documented, deterministic algorithm
- Generative algorithm: MEDIUM -- constraints are clear from CONTEXT.md but musical quality requires iterative tuning
- Pitfalls: HIGH -- identified from direct code analysis of hardcoded values

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable domain, no moving targets)
