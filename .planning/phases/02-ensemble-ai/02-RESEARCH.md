# Phase 2: Ensemble AI - Research

**Researched:** 2026-02-14
**Domain:** Multi-agent musical simulation, ensemble behavior modeling, Web Audio polyphony scaling
**Confidence:** HIGH

## Summary

Phase 2 transforms a single-performer playback engine into a multi-agent ensemble where each performer independently navigates Riley's 53 patterns, making believable musical decisions. The core technical challenge is not audio (Phase 1 solved scheduling and synthesis) but **behavioral modeling**: each performer agent must decide when to repeat, advance, drop out, rejoin, and seek unison based on awareness of the ensemble's collective state. The secondary challenge is **scaling the audio system** -- going from 1 performer with 4 voice pool slots to N performers (likely 5-12) each needing their own voice(s), all sharing a single AudioContext and audio thread.

Riley's actual performance instructions (verified from multiple published sources) provide the behavioral rules: stay within 2-3 patterns of the group, play sequentially, repeat freely, drop out to listen then rejoin, imitate others' phrasing. These translate directly into algorithmic rules for autonomous agents. The existing `Performer` class already handles sequential traversal with random repetitions -- Phase 2 wraps it in an ensemble-aware agent that reads a shared snapshot of all performers' positions to make density-aware, proximity-constrained decisions.

The architecture pattern is well-established in game/simulation design: an **immutable ensemble snapshot** is computed each tick, all agents evaluate against the same snapshot, then all state changes are applied simultaneously. This prevents order-of-evaluation bugs and makes the system deterministic given the same random seed. No new libraries are needed -- this is pure TypeScript logic layered on top of Phase 1's audio engine.

**Primary recommendation:** Build a `PerformerAgent` class that wraps the existing `Performer` with ensemble-aware decision logic, an `Ensemble` coordinator that manages multiple agents and provides the shared state snapshot, and scale the `VoicePool` + `Scheduler` to handle multiple concurrent performers through a single AudioContext.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none new) | -- | -- | Phase 2 requires no new dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | -- | -- | All ensemble AI is pure TypeScript logic |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled agent logic | Behavior tree library (e.g. behaviortree.js) | Overkill. In C performer decisions are a small decision space (~5 choices per tick). A weighted-random decision function is simpler and sufficient. Behavior trees add abstraction without value here. |
| Per-performer Scheduler | Single shared Scheduler polling all agents | Per-performer schedulers would each run their own setTimeout loops, creating unnecessary timer overhead. A single scheduler that queries all agents per tick is cleaner. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── audio/
│   ├── engine.ts           # MODIFY: manage ensemble, scale voice pool
│   ├── scheduler.ts        # MODIFY: schedule notes from multiple performers
│   ├── voice-pool.ts       # MODIFY: scale pool size for ensemble
│   └── types.ts            # MODIFY: add ensemble state types
├── score/
│   ├── patterns.ts         # NO CHANGE
│   ├── performer.ts        # NO CHANGE (still handles note-level traversal)
│   └── ensemble.ts         # NEW: ensemble coordinator + agent logic
├── components/
│   ├── Transport.tsx        # MINOR: may need ensemble state
│   ├── BpmSlider.tsx        # NO CHANGE
│   └── PatternDisplay.tsx   # MODIFY: show per-performer patterns
├── App.tsx                  # MODIFY: wire ensemble state to UI
└── main.tsx                 # NO CHANGE
```

### Pattern 1: Ensemble Snapshot (Immutable Shared State)

**What:** Each tick, the ensemble coordinator creates a frozen snapshot of all performers' positions, statuses, and density metrics. Every agent reads from this same snapshot when making decisions. State changes are collected and applied after all agents have decided.

**When to use:** Every scheduling tick where agents need to make ensemble-aware decisions.

**Why:** Prevents order-of-evaluation bugs. If performer A advances and performer B reads A's new position in the same tick, behavior depends on iteration order. The snapshot ensures all agents see the same world state regardless of evaluation order.

**Example:**
```typescript
interface EnsembleSnapshot {
  performers: ReadonlyArray<{
    id: number;
    patternIndex: number;       // 0-based index into PATTERNS
    status: 'playing' | 'silent';
  }>;
  minPatternIndex: number;      // lowest active performer position
  maxPatternIndex: number;      // highest active performer position
  averagePatternIndex: number;  // mean position of active performers
  density: number;              // fraction currently playing (0-1)
  totalPerformers: number;
}

// In the scheduling loop:
const snapshot = ensemble.createSnapshot();
for (const agent of agents) {
  agent.tick(snapshot);  // all read SAME snapshot
}
// Apply all decisions after loop completes
```

**Confidence:** HIGH -- Standard simulation pattern (double-buffering equivalent from game engines).

### Pattern 2: Weighted Decision Function

**What:** Each performer agent makes decisions using weighted random choices. Weights are dynamically adjusted based on ensemble state (density, proximity to band edges, time since last dropout, etc.).

**When to use:** At pattern boundaries (when a performer finishes all repetitions of the current pattern and must decide what to do next).

**Why:** Produces emergent behavior that feels musical rather than random. Pure uniform randomness sounds mechanical. Weighted decisions create performers that "listen" to the ensemble.

**Example:**
```typescript
interface DecisionWeights {
  advance: number;     // move to next pattern
  repeat: number;      // stay on current pattern
  dropout: number;     // go silent
}

function computeWeights(
  agent: AgentState,
  snapshot: EnsembleSnapshot
): DecisionWeights {
  let advance = 0.3;   // base probability
  let repeat = 0.5;    // base: prefer repeating
  let dropout = 0.2;   // base dropout chance

  // Near top of band: strongly prefer repeating/waiting
  if (agent.patternIndex >= snapshot.maxPatternIndex - 1) {
    advance *= 0.2;
    repeat *= 2.0;
  }

  // Near bottom of band: strongly prefer advancing
  if (agent.patternIndex <= snapshot.minPatternIndex + 1) {
    advance *= 3.0;
    repeat *= 0.3;
  }

  // High density: more likely to drop out
  if (snapshot.density > 0.8) {
    dropout *= 2.0;
  }

  // Low density: less likely to drop out
  if (snapshot.density < 0.4) {
    dropout *= 0.3;
  }

  // Normalize to sum to 1
  const total = advance + repeat + dropout;
  return {
    advance: advance / total,
    repeat: repeat / total,
    dropout: dropout / total,
  };
}
```

**Confidence:** HIGH -- Standard probabilistic agent pattern. The specific weight values will need tuning by ear, but the structure is well-established.

### Pattern 3: Band Enforcement (Hard Constraints)

**What:** Regardless of weighted decisions, hard rules enforce Riley's 2-3 pattern band constraint. A performer too far ahead is forced to wait (repeat). A performer too far behind is forced to jump forward.

**When to use:** After the weighted decision but before applying it. The hard constraint overrides the probabilistic decision when needed.

**Why:** Soft weights usually keep performers close, but random streaks can push them apart. The hard constraint is Riley's most important rule -- without it, the ensemble fragments.

**Example:**
```typescript
const BAND_WIDTH = 3; // max patterns ahead of the lowest performer

function enforceBand(
  decision: 'advance' | 'repeat' | 'dropout',
  agent: AgentState,
  snapshot: EnsembleSnapshot
): 'advance' | 'repeat' | 'dropout' | 'jump' {
  const distanceFromMin = agent.patternIndex - snapshot.minPatternIndex;
  const distanceFromMax = snapshot.maxPatternIndex - agent.patternIndex;

  // Too far ahead: force wait (repeat current pattern)
  if (distanceFromMin >= BAND_WIDTH && decision === 'advance') {
    return 'repeat';
  }

  // Too far behind: force jump forward
  if (distanceFromMax >= BAND_WIDTH) {
    return 'jump'; // jump to (maxPatternIndex - 1)
  }

  return decision;
}
```

**Confidence:** HIGH -- Directly implements Riley's documented rule: "never be more than 2-3 patterns ahead or behind."

### Pattern 4: Dropout/Rejoin Cycle

**What:** Performers periodically go silent to "listen," then rejoin after a variable number of beats. While silent, they still track the ensemble's progression so they rejoin at an appropriate position.

**When to use:** At pattern boundaries, with probability influenced by density and how long since the performer last dropped out.

**Why:** Riley's instruction: "It is very important that performers listen very carefully to one another and this means occasionally to drop out and listen." Creates breathing in the texture.

**Example:**
```typescript
interface AgentState {
  // ... other fields
  status: 'playing' | 'silent';
  beatsSilent: number;          // how many beats spent silent
  beatsSinceLastDropout: number; // cooldown tracker
  minSilentBeats: number;       // minimum silence duration
  maxSilentBeats: number;       // maximum silence duration
}

function handleDropoutRejoin(agent: AgentState, snapshot: EnsembleSnapshot): AgentState {
  if (agent.status === 'silent') {
    agent.beatsSilent++;
    // Rejoin decision: more likely as silence lengthens
    const rejoinChance = agent.beatsSilent > agent.minSilentBeats
      ? Math.min(0.8, (agent.beatsSilent - agent.minSilentBeats) / 16)
      : 0;
    // Also more likely to rejoin when density is low
    const densityBoost = snapshot.density < 0.5 ? 0.3 : 0;
    if (Math.random() < rejoinChance + densityBoost || agent.beatsSilent >= agent.maxSilentBeats) {
      return { ...agent, status: 'playing', beatsSilent: 0, beatsSinceLastDropout: 0 };
    }
  }
  return agent;
}
```

**Confidence:** HIGH for structure, MEDIUM for specific timing values (will need tuning).

### Pattern 5: Unison Seeking

**What:** Performers periodically align on the same pattern as their neighbors. When multiple performers play the same pattern simultaneously, it creates a powerful musical moment (unison). After aligning, they naturally drift apart through different repetition counts.

**When to use:** When a performer notices many others are on a nearby or identical pattern. Implemented as a weight modifier that increases the chance of repeating when the performer's current pattern matches a cluster.

**Why:** Unison moments are a defining feature of In C performances. Pure random repetition counts create accidental unisons, but deliberate seeking makes them more frequent and satisfying.

**Example:**
```typescript
function unisonWeight(agent: AgentState, snapshot: EnsembleSnapshot): number {
  // Count how many other performers are on the same pattern
  const samePatternCount = snapshot.performers.filter(
    p => p.patternIndex === agent.patternIndex && p.status === 'playing'
  ).length;

  // Count how many are one pattern ahead (could catch up to them)
  const oneAheadCount = snapshot.performers.filter(
    p => p.patternIndex === agent.patternIndex + 1 && p.status === 'playing'
  ).length;

  // If many are on same pattern: strong repeat preference (sustain unison)
  if (samePatternCount >= 2) return 2.0;

  // If many are one ahead: prefer advancing to join them
  if (oneAheadCount >= 2) return 0.3; // low = prefer advance over repeat

  return 1.0; // neutral
}
```

**Confidence:** MEDIUM -- The unison-seeking concept is musically sound and based on Riley's instructions to "listen" and "interlock." Specific thresholds will need tuning.

### Pattern 6: Scaling the Audio System for Ensemble

**What:** The current system has 1 Performer, 1 Scheduler, 1 VoicePool(4). For N performers, we need either N voice pools or a single larger shared voice pool, and the scheduler must query all agents per tick rather than a single performer.

**When to use:** Core architectural change for Phase 2.

**Design decision -- Shared Voice Pool vs. Per-Performer Pools:**

| Approach | Pros | Cons |
|----------|------|------|
| Single shared pool (size = N * 2) | Simpler, fewer AudioWorkletNodes, voice stealing works across ensemble | Performers compete for voices; loud passages may steal from quiet ones |
| Per-performer pool (size = 2 each) | Each performer guaranteed voices, isolation | More nodes total (N*2 vs pooled), more setup complexity |

**Recommendation:** Per-performer dedicated voice slot(s). Each performer gets 1-2 AudioWorkletNodes in the pool. Since In C patterns are largely monophonic (one note at a time per performer), 1 voice per performer plus a small overflow is sufficient. For 8 performers: 8-12 voices total.

**Example:**
```typescript
// Each agent gets a fixed voice assignment
interface PerformerVoice {
  performerId: number;
  voiceIndices: number[];  // indices into the shared VoicePool
}

// Voice pool scaled: 2 voices per performer (overlap during decay)
const poolSize = performerCount * 2;
const voicePool = new VoicePool(audioContext, poolSize);
```

**Confidence:** HIGH for the approach. The current VoicePool already supports claiming/releasing and voice stealing. Scaling it is straightforward.

### Pattern 7: Single Scheduler, Multiple Agents

**What:** The existing Scheduler runs a single tick loop. Rather than creating N schedulers (N setTimeout loops), modify the single scheduler to poll all performer agents each tick.

**Why:** Multiple setTimeout loops create unnecessary timer overhead and potential interference. A single loop is cleaner and ensures all notes for a given time window are scheduled in one pass.

**Example:**
```typescript
// Modified scheduler tick:
private tick = (): void => {
  while (this.nextNoteTime < this.audioContext.currentTime + SCHEDULE_AHEAD_TIME) {
    for (const agent of this.agents) {
      if (agent.status === 'playing') {
        this.scheduleNoteForAgent(agent, this.nextNoteTime);
      }
    }
    this.advanceTime();
  }
  if (this._playing) {
    this.timerId = setTimeout(this.tick, TIMER_INTERVAL);
  }
};
```

**Important subtlety:** All performers share the same global beat clock (the eighth-note pulse). Each performer plays their current note at each beat. Some patterns have notes longer than one eighth note -- the agent must track its position within its current pattern note. When a note spans multiple beats, the agent does not emit a new noteOn; it simply lets the existing note continue sounding.

**Confidence:** HIGH -- Direct extension of the existing scheduler pattern.

### Anti-Patterns to Avoid

- **Per-performer setTimeout loops:** Creates N timer loops all fighting for main-thread time. Use a single scheduler that iterates over all agents per tick.
- **Mutable ensemble state during agent evaluation:** If agent A advances and agent B reads A's new position in the same tick, behavior depends on iteration order. Always use an immutable snapshot.
- **AI logic in the AudioWorklet:** The AudioWorklet thread has strict real-time constraints. Keep all decision logic on the main thread. The audio thread only receives pre-scheduled noteOn/noteOff messages.
- **Creating new AudioWorkletNodes per performer per note:** Defeats the voice pool pattern from Phase 1. Scale the existing pool, don't abandon it.
- **Synchronizing performers by time rather than beat:** Performers must share a beat grid (eighth-note pulse), not just a time reference. At any given beat, each performer plays the current note of their current pattern at their current position. Time-only sync leads to drift when performers have different note durations.
- **Over-engineering the AI:** In C's beauty is in its simplicity. A handful of weighted probabilities with hard band constraints is sufficient. Neural networks, genetic algorithms, or complex behavior trees are unnecessary and harder to tune.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weighted random selection | Manual if/else chains | Normalize weights, generate random float, walk cumulative distribution | Standard algorithm, avoids bugs in probability math |
| Performer identity/numbering | Global counters | Auto-incrementing ID in agent factory | Avoids ID collision when adding/removing performers |
| Ensemble statistics (mean, min, max) | Recalculate in every agent | Compute once in snapshot creation | O(N) once vs O(N*N) if every agent scans all others |

**Key insight:** Phase 2 is pure application logic -- no new libraries, no new browser APIs, no new build configuration. The complexity is in **behavioral tuning** (getting weights that produce musically satisfying results), not in technology.

## Common Pitfalls

### Pitfall 1: Order-of-Evaluation Bugs
**What goes wrong:** Performer A advances to pattern 10. Performer B (evaluated next) sees A at pattern 10 and decides it's too far behind, so it jumps forward. But if B were evaluated first, it would have seen A at pattern 9 and not jumped.
**Why it happens:** Agents mutate shared state during the evaluation loop.
**How to avoid:** Immutable ensemble snapshot. All agents read from the snapshot, all state changes collected and applied after loop completes.
**Warning signs:** Ensemble behavior changes when you reorder the performer array. Non-deterministic results with the same random seed.

### Pitfall 2: Voice Pool Exhaustion at Scale
**What goes wrong:** With 8 performers, if the pool is too small, voice stealing causes audible note cutoffs.
**Why it happens:** Phase 1 used 4 voices for 1 monophonic performer. 8 performers need more.
**How to avoid:** Scale voice pool to 2 voices per performer (1 active + 1 in decay). For 8 performers: 16 voices. AudioWorkletNodes are lightweight -- 16 is fine.
**Warning signs:** Notes cutting off abruptly, especially during dense passages where many performers play simultaneously.

### Pitfall 3: All Performers Making Identical Decisions
**What goes wrong:** All performers advance, repeat, or drop out at the same time, creating mechanical-sounding lockstep behavior.
**Why it happens:** All agents use the same weights and see the same snapshot. If random seeds are too similar or weights are too deterministic, decisions cluster.
**How to avoid:** Add per-agent variation: different base weight biases (some performers are "bold" advancers, others are "cautious" repeaters), different dropout cooldown periods. Decisions are made at pattern boundaries which naturally occur at different times for different performers (since they have different repetition counts).
**Warning signs:** All performers drop out simultaneously, or the ensemble moves through patterns in lockstep without spread.

### Pitfall 4: Dropout Cascades
**What goes wrong:** One performer drops out, reducing density. Lower density increases dropout probability for others. They drop out too. Silence spiral.
**Why it happens:** Positive feedback loop in the density-aware dropout logic.
**How to avoid:** Two safeguards: (1) minimum active performers floor -- at least 2-3 performers must stay playing regardless of dropout probability. (2) Low-density strongly inhibits further dropouts (when density < 0.3, dropout probability approaches 0).
**Warning signs:** Performance goes silent for long stretches, or drops to a single performer frequently.

### Pitfall 5: The Band Constraint Causing Gridlock
**What goes wrong:** The most advanced performer can't advance (at band edge), and the most behind performer is repeating. Nobody moves. The ensemble gets stuck.
**Why it happens:** Band enforcement is too strict or the behind performer has no incentive to advance.
**How to avoid:** The band constraint should also force lagging performers forward. If a performer is at the minimum and the band is full width, they should have high advance probability. Also: the band is relative to min/max of *playing* performers -- silent performers don't count for band calculation.
**Warning signs:** Ensemble stays on the same 3 patterns for an unusually long time. Forward progress stalls.

### Pitfall 6: Performance Ending Is Abrupt
**What goes wrong:** All performers reach pattern 53 at roughly the same time and stop. The ending feels sudden rather than natural.
**Why it happens:** Band constraint keeps performers within 2-3 patterns, so they cluster near the end.
**How to avoid:** Near the end (patterns 48+), widen the band slightly and increase dropout probability. Performers reaching 53 should repeat it for a while (Riley's instruction: "stay on 53 until the entire ensemble has arrived"), then drop out one by one. Use a staggered final dropout: each performer on pattern 53 has an increasing chance of final silence per beat.
**Warning signs:** Performance ends with all performers stopping within seconds of each other.

### Pitfall 7: Scheduler Time Advance With Multiple Performers
**What goes wrong:** Different performers have notes of different durations. If the scheduler advances time by the duration of one performer's note, other performers' notes are misaligned.
**Why it happens:** Phase 1 advances time by the last scheduled note's duration. With multiple performers on different patterns, there is no single "last note duration."
**How to avoid:** The global time advance should be by the **smallest beat unit** -- one eighth note. Every tick = one eighth note of time. Each performer agent tracks where it is within its current note. If a note spans 4 eighth notes, the agent emits noteOn on the first beat and does nothing for the next 3 beats. This is the rhythmic grid approach that matches Riley's pulse concept.
**Warning signs:** Notes of different performers drifting out of alignment, or shorter notes being stretched to match longer ones.

## Code Examples

### Ensemble Coordinator
```typescript
// src/score/ensemble.ts
interface AgentState {
  id: number;
  patternIndex: number;        // 0-based
  noteIndex: number;           // within current pattern
  repetitionsRemaining: number;
  status: 'playing' | 'silent';
  beatsSilent: number;
  beatsSinceLastDropout: number;
  personality: AgentPersonality;
}

interface AgentPersonality {
  advanceBias: number;    // 0.8-1.2 multiplier on advance weight
  repeatBias: number;     // 0.8-1.2 multiplier on repeat weight
  dropoutBias: number;    // 0.8-1.2 multiplier on dropout weight
  minSilentBeats: number; // 4-16 eighth notes
  maxSilentBeats: number; // 16-64 eighth notes
  dropoutCooldown: number; // minimum beats between dropouts
}

class Ensemble {
  private agents: PerformerAgent[];
  private snapshot: EnsembleSnapshot;

  constructor(count: number, patterns: Pattern[]) {
    this.agents = Array.from({ length: count }, (_, i) =>
      new PerformerAgent(i, patterns, randomPersonality())
    );
    this.snapshot = this.createSnapshot();
  }

  /** Called once per eighth-note beat by the scheduler. */
  tick(): AgentNoteEvent[] {
    this.snapshot = this.createSnapshot();
    const events: AgentNoteEvent[] = [];
    for (const agent of this.agents) {
      const event = agent.tick(this.snapshot);
      if (event) events.push(event);
    }
    return events;
  }

  private createSnapshot(): EnsembleSnapshot {
    const playing = this.agents.filter(a => a.state.status === 'playing');
    const indices = playing.map(a => a.state.patternIndex);
    return Object.freeze({
      performers: this.agents.map(a => ({
        id: a.state.id,
        patternIndex: a.state.patternIndex,
        status: a.state.status,
      })),
      minPatternIndex: indices.length > 0 ? Math.min(...indices) : 0,
      maxPatternIndex: indices.length > 0 ? Math.max(...indices) : 0,
      averagePatternIndex: indices.length > 0
        ? indices.reduce((a, b) => a + b, 0) / indices.length
        : 0,
      density: playing.length / this.agents.length,
      totalPerformers: this.agents.length,
    });
  }

  get isComplete(): boolean {
    return this.agents.every(a => a.isComplete);
  }
}
```

### Weighted Random Selection Utility
```typescript
/** Pick from weighted options. Weights need not sum to 1. */
function weightedChoice<T>(options: Array<{ value: T; weight: number }>): T {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let r = Math.random() * total;
  for (const option of options) {
    r -= option.weight;
    if (r <= 0) return option.value;
  }
  return options[options.length - 1].value; // fallback
}
```

### Natural Ending Logic
```typescript
function handleEndgame(agent: AgentState, snapshot: EnsembleSnapshot, patterns: Pattern[]): boolean {
  const lastPatternIndex = patterns.length - 1;

  // Not at the end yet -- normal behavior
  if (agent.patternIndex < lastPatternIndex) return false;

  // On final pattern: stay here (Riley's rule: stay on 53 until all arrive)
  // Gradually increase dropout chance as more performers arrive at 53
  const performersAtEnd = snapshot.performers.filter(
    p => p.patternIndex >= lastPatternIndex
  ).length;
  const fractionAtEnd = performersAtEnd / snapshot.totalPerformers;

  // Once > 60% of performers are at the end, start dropping out
  if (fractionAtEnd > 0.6) {
    const dropoutChance = (fractionAtEnd - 0.6) * 2.5; // 0 at 60%, 1.0 at 100%
    if (Math.random() < dropoutChance * 0.1) {  // per-beat chance
      return true; // signal: this performer is done
    }
  }

  return false;
}
```

### EngineState Extension for Ensemble
```typescript
// Extended types for Phase 2
interface PerformerState {
  id: number;
  patternIndex: number;    // 0-based
  currentPattern: number;  // 1-based (for display)
  status: 'playing' | 'silent' | 'complete';
}

interface EnsembleEngineState {
  playing: boolean;
  bpm: number;
  performers: PerformerState[];
  ensembleComplete: boolean;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple random repeat count (In C++ approach) | Weighted probabilistic decisions with ensemble awareness | Ongoing improvement in generative music | Produces more musical, less mechanical behavior |
| Per-performer oscillator creation/destruction | Shared voice pool with claim/release (Phase 1) | Phase 1 decision | Scales cleanly to multiple performers |
| Single performer nextNote() API | Ensemble coordinator with snapshot-based tick | Phase 2 (new) | Enables all ensemble behaviors |

**Existing implementations reviewed:**
- **teropa/in-c:** Angular + RxJS + @ngrx implementation. User-directed performer navigation rather than autonomous AI. Good reference for UI patterns but not for autonomous behavior.
- **gregwht/InCplusplus:** C++ implementation with autonomous performers. Uses simple 3-bar distance constraint (force lagging performers forward). No density awareness, no dropout logic, no unison seeking. Serves as a minimal baseline.
- **Third Coast Percussion guidelines:** Performance instructions for human ensembles. Best source for the behavioral rules that the AI should model.

## Open Questions

1. **Optimal performer count for default experience**
   - What we know: Riley suggests "about 35" but smaller groups work. Browser performance is a factor -- more performers means more AudioWorkletNodes and more AI computation per tick.
   - What's unclear: What count sounds best through a synth-only browser ensemble? Too few (3) may lack texture; too many (20) may be muddy.
   - Recommendation: Default to 6-8 performers. This creates meaningful density variation while keeping voice pool manageable (12-16 AudioWorkletNodes). Make count configurable for Phase 3.

2. **Decision timing: per-beat vs. per-pattern-boundary**
   - What we know: Some decisions (advance/repeat) naturally happen at pattern boundaries. Others (dropout/rejoin) could happen at any beat.
   - What's unclear: Should dropout decisions be made every beat or only at pattern boundaries? Per-beat dropout creates more organic timing. Per-boundary is simpler.
   - Recommendation: Dropout decisions per-beat (any eighth note). Advance/repeat decisions at pattern boundaries only. Rejoin decisions per-beat while silent.

3. **Weight tuning methodology**
   - What we know: The weight values in the decision function (0.3 advance, 0.5 repeat, 0.2 dropout) are starting guesses. Musical quality depends on getting these right.
   - What's unclear: No systematic way to evaluate "musicality" -- it requires human listening.
   - Recommendation: Start with the example weights, implement basic behavior, then tune by ear. Expose weights as constants (not magic numbers) so they can be adjusted easily during development.

4. **Staggered entry at performance start**
   - What we know: Riley's instructions say performers enter over the first 20 seconds, not all at once. Third Coast Percussion specifies glockenspiel establishes pulse for 5-10 seconds, then performers enter over 20 seconds.
   - What's unclear: How to stagger -- fixed delay per performer, or random entry over a window?
   - Recommendation: Stagger entry: performer 0 starts immediately, each subsequent performer waits 2-4 beats (randomized) after the previous one enters. This creates a natural "filling in" effect over the first 20-30 seconds.

5. **Scheduler refactoring scope**
   - What we know: The current Scheduler is tightly coupled to a single Performer. It calls `performer.nextNote()` and advances time by that note's duration.
   - What's unclear: How much of the Scheduler needs rewriting vs. wrapping.
   - Recommendation: The Scheduler's tick loop needs refactoring. Instead of advancing by note duration, advance by fixed eighth-note increments. Each tick, query all agents for their current note event. The Scheduler becomes a beat clock that polls agents rather than a single-performer note sequencer. This is a significant but well-contained refactoring of `scheduler.ts`.

## Sources

### Primary (HIGH confidence)
- [Third Coast Percussion - In C Performance Guide](https://thirdcoastpercussion.com/terry-rileys-in-c/) - Detailed performance instructions, timing guidelines, ensemble coordination rules
- [Teropa - Terry Riley's In C](https://teropa.info/blog/2017/01/23/terry-rileys-in-c.html) - Comprehensive analysis of the piece, performance rules, and browser implementation approaches
- [Music Institute - In C Instructions for Beginners](https://www.musicinst.org/sites/default/files/attachments/In%20C%20Instructions%20for%20Beginners.pdf) - Simplified performance rules confirming 2-3 pattern band

### Secondary (MEDIUM confidence)
- [gregwht/InCplusplus](https://github.com/gregwht/InCplusplus) - Reference C++ implementation with autonomous performers and 3-bar distance constraint
- [teropa/in-c](https://github.com/teropa/in-c) - Reference browser implementation (Angular/RxJS), user-directed rather than autonomous
- [Goldsmiths - In C++ Article](https://www.gold.ac.uk/news/in-c/) - Description of autonomous performer AI approach for In C
- [Coordination dynamics of multi-agent interaction in a musical ensemble (Scientific Reports)](https://www.nature.com/articles/s41598-021-04463-6) - Research on coordination dynamics in ensemble performance

### Tertiary (LOW confidence)
- [A Framework for Musical Multiagent Systems](https://www.academia.edu/275542/A_Framework_for_Musical_Multiagent_Systems) - Academic framework for multi-agent music systems (theoretical, not browser-specific)

### Codebase (HIGH confidence)
- Phase 1 implementation: `src/audio/scheduler.ts`, `src/audio/engine.ts`, `src/audio/voice-pool.ts`, `src/score/performer.ts` -- the code being extended
- Phase 1 research: `.planning/phases/01-audio-engine-score-foundation/01-RESEARCH.md`
- Architecture research: `.planning/research/ARCHITECTURE.md` -- contains the Ensemble Snapshot and Performer State Machine patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, pure TypeScript logic
- Architecture: HIGH -- snapshot-based agent evaluation is a well-established simulation pattern. Codebase analysis confirms what needs to change and what can stay.
- Ensemble rules: HIGH -- Riley's performance instructions are well-documented across multiple authoritative sources
- Weight tuning: MEDIUM -- the structure is solid but specific probability values will need iteration by ear
- Audio scaling: HIGH -- VoicePool and Scheduler are well-understood from Phase 1 implementation; scaling approach is straightforward

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable domain -- no external dependencies to go stale)
