# Phase 7: Seeded PRNG - Research

**Researched:** 2026-02-15
**Domain:** Deterministic pseudorandom number generation, URL state encoding, clipboard API
**Confidence:** HIGH

## Summary

Phase 7 replaces all 32 `Math.random()` call sites across 5 source files with a seeded PRNG (Mulberry32, per prior decision), enabling deterministic performance replay. The seed plus performance config (mode, BPM, performer count) is encoded in the URL hash for sharing.

The core challenge is **completeness**: every single `Math.random()` call must be replaced or the performance diverges silently. The codebase is well-structured for this -- all randomness lives in `src/score/` (ensemble.ts, generative.ts, euclidean.ts, performer.ts, velocity.ts) with no randomness in audio, UI, or rendering code. The pattern of centralized utility functions (`randInt`, `pick`, `weightedPick`, `randomInRange`, `weightedChoice`) means most call sites funnel through a handful of helpers that can be converted once.

**Primary recommendation:** Create a single `src/score/rng.ts` module exporting a `SeededRng` class (Mulberry32) with convenience methods (`random()`, `int()`, `pick()`, `weighted()`). Use a single PRNG stream seeded once per performance start. Pass the RNG instance through constructors and function parameters. Encode config in URL hash fragment (`#seed=X&mode=Y&bpm=Z&count=N`).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Mulberry32 (hand-rolled) | N/A | Seeded PRNG | 15 lines, period 2^32, no dependency needed (prior decision) |
| URL / URLSearchParams | Built-in | URL hash encoding/decoding | Native browser API, no library needed |
| navigator.clipboard | Built-in | Copy seed/URL to clipboard | Native browser API, wide support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | - | No additional libraries needed for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mulberry32 | seedrandom npm package | More algorithms, but adds dependency for trivial need (locked decision: no npm dep) |
| Mulberry32 | xoshiro128** | Better statistical quality, but more code; Mulberry32 is sufficient for musical randomness |
| URL hash | URL search params (`?seed=X`) | Search params trigger server requests on some hosts; hash fragment is client-only |

**Installation:**
```bash
# No packages to install -- all hand-rolled or built-in
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── score/
│   ├── rng.ts              # NEW: SeededRng class (Mulberry32 + convenience methods)
│   ├── rng.test.ts          # NEW: Determinism + distribution tests
│   ├── ensemble.ts          # MODIFIED: Accept RNG in constructor, pass to agents
│   ├── generative.ts        # MODIFIED: Accept RNG parameter in generate function
│   ├── euclidean.ts         # MODIFIED: Accept RNG parameter in generate function
│   ├── velocity.ts          # MODIFIED: Accept RNG for jitter + personality
│   ├── performer.ts         # MODIFIED: Accept RNG for repetition counts
│   └── score-modes.ts       # MODIFIED: Accept RNG parameter, pass to generators
├── audio/
│   └── engine.ts            # MODIFIED: Create/store seed, create RNG, pass to Ensemble
├── components/
│   └── SeedDisplay.tsx      # NEW: Show seed, copy button, seed input
└── App.tsx                  # MODIFIED: URL hash parsing, seed state, SeedDisplay
```

### Pattern 1: Single PRNG Stream with Constructor Injection
**What:** One `SeededRng` instance created at performance start, passed through the object graph via constructors and function parameters.
**When to use:** Always -- this is the core pattern for the entire phase.
**Example:**
```typescript
// src/score/rng.ts
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns float in [0, 1) -- drop-in replacement for Math.random() */
  random(): number {
    this.state |= 0;
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** Pick random element from array */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }

  /** Weighted random selection */
  weighted<T>(options: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.random() * total;
    for (let i = 0; i < options.length; i++) {
      r -= weights[i];
      if (r <= 0) return options[i];
    }
    return options[options.length - 1];
  }
}
```

### Pattern 2: URL Hash Fragment for State Encoding
**What:** Performance config encoded as URL hash fragment, parsed on app mount.
**When to use:** For shareable URLs that auto-configure and start a performance.
**Example:**
```typescript
// Encoding
function encodePerformanceUrl(seed: number, mode: string, bpm: number, count: number): string {
  const params = new URLSearchParams({
    seed: seed.toString(),
    mode,
    bpm: bpm.toString(),
    count: count.toString(),
  });
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

// Decoding (on app mount)
function decodePerformanceUrl(): PerformanceConfig | null {
  const hash = window.location.hash.slice(1); // remove '#'
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const seed = params.get('seed');
  const mode = params.get('mode');
  const bpm = params.get('bpm');
  const count = params.get('count');
  if (!seed || !mode || !bpm || !count) return null;
  return {
    seed: parseInt(seed, 10),
    mode: mode as ScoreMode,
    bpm: parseInt(bpm, 10),
    count: parseInt(count, 10),
  };
}
```

### Pattern 3: Seed Generation from Timestamp
**What:** When no seed is provided, generate one from `Date.now()` truncated to 32 bits.
**When to use:** Every fresh performance (no URL hash, no manual seed entry).
**Example:**
```typescript
function generateSeed(): number {
  return Date.now() & 0xFFFFFFFF;  // Truncate to 32-bit unsigned
}
```

### Anti-Patterns to Avoid
- **Global mutable RNG singleton:** Don't create a global `rng` variable that anyone imports. Pass the instance explicitly -- this makes testing trivial and prevents accidental cross-contamination between tests.
- **Replacing Math.random globally:** Don't monkey-patch `Math.random = rng.random.bind(rng)`. This is fragile, breaks third-party code, and makes the dependency invisible.
- **Per-agent PRNG streams:** Prior decision notes this is TBD, but a single stream is simpler and sufficient. Per-agent streams would require storing/restoring N seeds in the URL, which adds complexity for no user-facing benefit. The single stream produces deterministic results as long as the call order is deterministic (which it is -- agents tick in array order).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PRNG algorithm | Novel algorithm | Mulberry32 (well-known, tested) | Statistical quality matters; known algorithm has known properties |
| URL encoding | Custom string format | URLSearchParams | Handles escaping, edge cases, already standardized |
| Clipboard access | Custom clipboard shim | navigator.clipboard.writeText() | Supported in all modern browsers, handles permissions |

**Key insight:** The PRNG itself IS hand-rolled (per prior decision), but it must be the well-known Mulberry32 implementation, not a novel invention. The rest (URL encoding, clipboard) should use platform APIs.

## Common Pitfalls

### Pitfall 1: Missed Math.random() Call Sites
**What goes wrong:** A single remaining `Math.random()` call causes the PRNG stream to diverge, producing different performances from the same seed. The divergence is silent -- no error, just wrong notes.
**Why it happens:** 32 call sites across 5 files. Easy to miss one, especially in utility functions called indirectly.
**How to avoid:** After conversion, add a lint rule or test that greps for `Math.random` in `src/score/`. The test should fail if any `Math.random` call exists in score files. Additionally, run two performances with the same seed and compare note-for-note output.
**Warning signs:** Performances with the same seed sound "similar but not identical."

### Pitfall 2: Call Order Sensitivity
**What goes wrong:** If agents are ticked in non-deterministic order (e.g., based on a Set or Map iteration), the PRNG stream produces different values even with the same seed.
**Why it happens:** The single PRNG stream means the Nth call always returns the same value -- but "N" must be the same across runs.
**How to avoid:** Agents already tick in array order in `Ensemble.tick()`. The `Ensemble` constructor creates agents in a deterministic `for` loop. This is already correct. Document this invariant with a comment.
**Warning signs:** Non-determinism that appears only with certain performer counts.

### Pitfall 3: Generative/Euclidean Pattern Generation Non-Determinism
**What goes wrong:** The `generative` and `euclidean` modes generate fresh patterns on each `getPatternsForMode()` call. If this call happens before the RNG is seeded, or uses a different RNG instance, the patterns differ even with the same seed.
**Why it happens:** Pattern generation currently happens in `AudioEngine.setScoreMode()` and `AudioEngine.initialize()`, which are called before `start()`.
**How to avoid:** The RNG must be created and seeded BEFORE `getPatternsForMode()` is called. The seed must be determined first (from URL, user input, or `Date.now()`), then the RNG created, then patterns generated, then the Ensemble constructed with the same RNG.
**Warning signs:** Riley mode is deterministic but generative/euclidean modes are not.

### Pitfall 4: URL Hash Encoding Edge Cases
**What goes wrong:** Special characters in mode names, or very large seed numbers, break the URL or get truncated.
**Why it happens:** Naive string concatenation without proper encoding.
**How to avoid:** Use `URLSearchParams` which handles encoding automatically. Seeds are 32-bit integers (max ~4 billion), which fit easily in a URL.
**Warning signs:** Shared URLs don't reproduce the expected performance.

### Pitfall 5: Seed Zero Produces Zero Sequence
**What goes wrong:** Mulberry32 with seed 0 can produce degenerate output if the implementation doesn't handle it.
**Why it happens:** The Mulberry32 state update relies on the seed being non-zero for the first iteration.
**How to avoid:** If seed is 0, use a non-zero default (e.g., `seed || 1`). Or offset the initial state: `this.state = (seed + 0x6D2B79F5) | 0` on construction.
**Warning signs:** Seed "0" produces silence or a degenerate pattern.

### Pitfall 6: Velocity Jitter During Performance
**What goes wrong:** `computeVelocity()` calls `Math.random()` for jitter on every note event during live playback. This is in the hot path and must use the seeded RNG for determinism.
**Why it happens:** Velocity jitter is easy to overlook because it's not in the "score generation" path -- it runs during the live `tick()` loop.
**How to avoid:** Pass the RNG to `computeVelocity()` or to the `VelocityContext`. Since velocity is computed inside `PerformerAgent.tick()`, the agent needs access to the RNG.
**Warning signs:** Note sequences match but velocity curves differ between same-seed runs.

## Code Examples

### Complete Mulberry32 Implementation
```typescript
// Source: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
// Well-known PRNG with period 2^32, passes gjrand testing
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    // Ensure non-zero initial state
    this.state = (seed | 0) || 1;
  }

  random(): number {
    this.state |= 0;
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
```

### Determinism Test Pattern
```typescript
// Verifies two runs with the same seed produce identical note sequences
it('same seed produces identical ensemble output', () => {
  const seed = 42;

  function runPerformance(seed: number): AgentNoteEvent[][] {
    const rng = new SeededRng(seed);
    const patterns = getPatternsForMode('generative', rng);
    const ensemble = new Ensemble(4, patterns, 'generative', undefined, rng);
    const results: AgentNoteEvent[][] = [];
    for (let i = 0; i < 500; i++) {
      results.push(ensemble.tick());
    }
    return results;
  }

  const run1 = runPerformance(seed);
  const run2 = runPerformance(seed);
  expect(run1).toEqual(run2);
});
```

### Grep Guard Against Stray Math.random
```typescript
// In a test file or CI script
it('no Math.random() calls remain in score modules', () => {
  const scoreFiles = ['ensemble.ts', 'generative.ts', 'euclidean.ts',
                      'performer.ts', 'velocity.ts', 'score-modes.ts'];
  for (const file of scoreFiles) {
    const content = fs.readFileSync(`src/score/${file}`, 'utf-8');
    expect(content).not.toContain('Math.random');
  }
});
```

### Clipboard Copy with Fallback
```typescript
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers or non-HTTPS
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Math.random() everywhere | Seeded PRNG with dependency injection | Industry standard | Reproducible generative art/music |
| Custom URL param parsing | URLSearchParams API | ES2017+ | No polyfill needed for modern browsers |
| document.execCommand('copy') | navigator.clipboard.writeText() | ~2019+ | Async, permission-aware, all modern browsers |

**Deprecated/outdated:**
- `document.execCommand('copy')`: Still works but deprecated; use as fallback only

## Open Questions

1. **Per-agent vs single PRNG stream**
   - What we know: Prior decision says "TBD during Phase 7 planning." Single stream is simpler and works because tick order is deterministic (array iteration in `Ensemble.tick()`).
   - What's unclear: Whether future features (hot-adding performers mid-performance) could break single-stream determinism.
   - Recommendation: Use single stream. Hot-add already exists (`Ensemble.addAgent()`) but is a user action, not part of the deterministic seed replay. When replaying from a seed, performer count is fixed. Document the invariant.

2. **Auto-start on shared URL**
   - What we know: SEED-06 requires "opening a shared URL auto-configures and starts the same performance." Browser autoplay policy blocks audio without user gesture.
   - What's unclear: Whether we can auto-start or must show a "play" prompt.
   - Recommendation: Auto-configure the UI (mode, BPM, count, seed) from URL params. Show a prominent "Play this performance" button rather than auto-starting, to comply with autoplay policy. This satisfies the spirit of SEED-06 while respecting browser constraints.

3. **Seed display format**
   - What we know: SEED-02 requires the seed is "displayed in the UI." Seeds are 32-bit integers (up to 10 digits).
   - What's unclear: Whether to show raw number or a human-friendly encoding.
   - Recommendation: Show the raw integer for v1.2. Human-readable names (SHARE-P01: "Coral Meadow #7392") are listed as a future requirement, not v1.2 scope.

## Call Site Inventory

Complete inventory of all 32 `Math.random()` call sites that must be replaced:

| File | Line(s) | Usage | Replacement Strategy |
|------|---------|-------|---------------------|
| `ensemble.ts:88` | `weightedChoice()` | Weighted random selection | `rng.random()` in method |
| `ensemble.ts:200` | `randomInRange()` | Personality generation | `rng.random()` in utility |
| `ensemble.ts:257` | `randomReps()` (via PerformerAgent) | Random repetition count | `rng.int()` |
| `ensemble.ts:411` | `handleEndgame()` | Endgame dropout chance | `rng.random()` |
| `ensemble.ts:448` | `rejoinLogic()` | Rejoin probability | `rng.random()` |
| `ensemble.ts:559` | `Ensemble constructor` | Staggered entry delays | `rng.int()` |
| `ensemble.ts:634` | `addAgent()` | New agent entry delay | `rng.int()` |
| `generative.ts:52` | `randInt()` | Random integer utility | `rng.int()` |
| `generative.ts:56` | `pick()` | Random array pick | `rng.pick()` |
| `generative.ts:61` | `weightedPick()` | Weighted selection | `rng.weighted()` |
| `generative.ts:236` | motif reuse check | 20% chance | `rng.random()` |
| `generative.ts:238` | motif transform choice | Random transform | `rng.random()` |
| `generative.ts:257` | rest insertion | Rest probability | `rng.random()` |
| `generative.ts:263` | leap allowance | Leap probability | `rng.random()` |
| `generative.ts:328` | pulse pattern chance | 15% chance | `rng.random()` |
| `generative.ts:343` | motif bank storage | 30% chance | `rng.random()` |
| `euclidean.ts:44` | `rhythmToNotes()` single pitch | Random pitch selection | `rng.int()` |
| `euclidean.ts:54` | `rhythmToNotes()` melodic pitch | Random pitch per step | `rng.int()` |
| `euclidean.ts:68` | target count | 20-40 patterns | `rng.int()` |
| `euclidean.ts:77` | step count | 4-16 steps | `rng.int()` |
| `euclidean.ts:87` | rotation | Random rotation | `rng.int()` |
| `euclidean.ts:91` | melodic flag | 60% chance | `rng.random()` |
| `euclidean.ts:101` | interlock pair | 30% chance | `rng.random()` |
| `euclidean.ts:118` | fill pattern steps | 4-16 steps | `rng.int()` |
| `euclidean.ts:120` | fill pattern rotation | Random rotation | `rng.int()` |
| `euclidean.ts:122` | fill pattern melodic | 60% chance | `rng.random()` |
| `velocity.ts:86` | `computeVelocity()` jitter | Per-note random jitter | `rng.random()` |
| `velocity.ts:106` | `generateVelocityPersonality()` | Base loudness | `rng.random()` |
| `velocity.ts:107` | `generateVelocityPersonality()` | Jitter amount | `rng.random()` |
| `performer.ts:25` | `randomRepetitions()` | 2-8 reps | `rng.int()` |
| `performer.ts:62` | rest between patterns | 30% chance | `rng.random()` |

**Note:** `performer.ts` contains the legacy single-performer `Performer` class. Check whether it's still used in any code path. If it's dead code, it can be ignored. If still referenced, it needs conversion too.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: Direct grep of all `Math.random()` call sites in `src/score/` (32 occurrences, 5 files)
- Mulberry32 algorithm: Tommy Ettinger's reference implementation (well-known, widely used in game dev and generative art)
- MDN Web Docs: URLSearchParams, navigator.clipboard API documentation

### Secondary (MEDIUM confidence)
- Browser autoplay policy: Chrome/Safari require user gesture for AudioContext.resume() -- verified against current codebase which already handles this in `AudioEngine.start()`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No external libraries needed; Mulberry32 is trivial and well-understood
- Architecture: HIGH - Codebase already has clean separation; RNG injection follows existing patterns
- Pitfalls: HIGH - All 32 call sites inventoried from direct code analysis; call order determinism verified from `Ensemble.tick()` implementation

**Research date:** 2026-02-15
**Valid until:** 2026-04-15 (stable domain, no fast-moving dependencies)
