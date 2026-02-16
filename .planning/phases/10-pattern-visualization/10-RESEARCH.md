# Phase 10: Pattern Visualization - Research

**Researched:** 2026-02-15
**Domain:** React UI visualization with real-time audio state feedback
**Confidence:** HIGH

## Summary

Phase 10 adds three layers of visual feedback to the existing performer card system: note-hit dot indicators, pattern position counters, and a full-ensemble score overview grid. The core challenge is efficiently rendering real-time visual feedback driven by the audio scheduler's state change callbacks, which fire on every eighth-note beat (up to ~4.8 Hz at 144 BPM with 16 performers).

The existing architecture already provides all necessary state data through `EnsembleEngineState.performers`, which includes `patternIndex`, `currentPattern`, `currentRep`, `totalReps`, and `status` for each performer. The `scheduleBeat` method in `Scheduler` fires `fireStateChange()` on every beat, providing a natural tick for updating visualizations. The primary new data needed is per-performer note-hit events (which performer played a note this beat, and at what velocity), which is available from the `AgentNoteEvent[]` returned by `ensemble.tick()` but not currently exposed in the state callback.

**Primary recommendation:** Extend `PerformerState` (or add a parallel field to `EnsembleEngineState`) to include a per-performer "last hit" signal (velocity + timestamp/beat), then build all three visualization layers as pure React components consuming this existing state flow. The score overview grid is a new component placed below the performer cards in `App.tsx`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Note-hit feedback
- Minimal left-edge dot on the performer card, single color for all performers
- Dot intensity maps to velocity (louder notes = stronger signal)
- Quick snap animation (~100ms) -- appears and disappears crisply
- No card-level flash/pulse/glow -- keep cards visually calm

#### Pattern progress display
- Keep existing rep counter (e.g. 2/5) as-is -- no beat-level granularity
- Add pattern position out of total (e.g. pattern 12/53) to the card
- Rest state keeps current "..." indicator unchanged

#### Score overview design
- Grid/matrix layout: rows = performers, columns = patterns
- Filled cell marks each performer's current pattern position
- Placed below the performer card grid, always visible (not collapsible)
- Canon mode: full 53-column width shown upfront
- Euclidean/Generative modes: grid grows progressively as performers discover new patterns
- Fixed cell size -- grid becomes horizontally scrollable when it exceeds viewport
- Auto-scroll keeps the leading performer(s) visible
- Monochrome color scheme (single color for all performers)

#### Animation feel
- Responsive energy level -- visuals clearly react to the music but don't dominate
- Grid cells use brief transition (~150ms) when state changes
- Note-hit dots use quick snap (~100ms)
- Overall: informative, not theatrical

### Claude's Discretion
- Exact dot size and color
- Cell dimensions and grid spacing
- Scroll behavior details (smooth vs snap)
- How to label rows/columns in the grid
- Responsive layout adjustments for different screen sizes

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.0 | Component rendering | Already in project |
| Tailwind CSS | ^4.1.18 | Styling, transitions, layout | Already in project; utility-first fits small component changes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx + tailwind-merge | ^2.1.1 / ^3.4.0 | Conditional class composition | Already in project via `cn()` utility |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS transitions | framer-motion | Overkill for simple opacity/scale dot animations; adds bundle weight |
| Tailwind classes | CSS keyframes | Keyframes needed for the snap animation; Tailwind `animate-` utilities can wrap them |
| Native scroll API | react-virtualized | Grid is max ~53 columns x 16 rows = 848 cells; no virtualization needed |

**Installation:**
No new dependencies required. All visualization uses existing React + Tailwind stack.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── PatternDisplay.tsx    # MODIFY: add note-hit dot, pattern position
│   └── ScoreOverview.tsx     # NEW: grid/matrix visualization
├── audio/
│   ├── types.ts              # MODIFY: extend PerformerState with hit data
│   └── scheduler.ts          # MODIFY: expose note-hit events in state
└── App.tsx                   # MODIFY: add ScoreOverview below PatternDisplay
```

### Pattern 1: Extending PerformerState with Note-Hit Data
**What:** Add a `lastHitVelocity` field (0.0-1.0, 0 = no hit this beat) to `PerformerState` so the UI knows which performers played a note on the most recent beat.
**When to use:** Every beat tick in the scheduler.
**Why this approach:** The scheduler already computes `AgentNoteEvent[]` from `ensemble.tick()` and already calls `fireStateChange()` on every beat. We just need to bridge the note events into the state snapshot. This avoids a separate event bus or callback system.

```typescript
// In audio/types.ts - extend PerformerState
export interface PerformerState {
  id: number;
  patternIndex: number;
  currentPattern: number;
  status: 'playing' | 'silent' | 'complete';
  currentRep: number;
  totalReps: number;
  instrument: InstrumentType;
  lastHitVelocity: number;  // 0.0 = no hit, 0.0-1.0 = velocity of last note
}
```

```typescript
// In scheduler.ts - scheduleBeat(), after collecting events
// Build a map of performer -> max velocity for this beat
const hitMap = new Map<number, number>();
for (const event of events) {
  if (event.midi !== 0) {
    const current = hitMap.get(event.performerId) ?? 0;
    hitMap.set(event.performerId, Math.max(current, event.velocity));
  }
}
// Store for inclusion in next getState() call
this.lastHitMap = hitMap;
```

### Pattern 2: CSS Snap Animation for Note-Hit Dot
**What:** A small dot element on the left edge of each performer card that snaps to visible when a note fires and disappears after ~100ms.
**When to use:** On every performer card when playing.
**Key design:** Use CSS `opacity` transition with a fast duration. The dot's opacity maps to the velocity value. When `lastHitVelocity > 0`, set opacity to velocity; when it resets to 0 on the next beat, the dot disappears. The beat interval at 120 BPM is 250ms (eighth notes), so the 100ms appearance + fade fits naturally within one beat cycle.

```css
/* Snap animation approach using Tailwind */
/* The dot gets opacity from velocity, transitions out */
.note-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  transition: opacity 100ms ease-out;
}
```

### Pattern 3: Score Overview Grid with Progressive Growth
**What:** A grid where rows = performers, columns = pattern positions. Each cell is either empty or filled based on whether the performer is at or has passed that pattern.
**When to use:** Always visible below performer cards.
**Key design:** For Canon mode (riley), show all 53 columns upfront. For Euclidean/Generative, track the maximum pattern index any performer has reached and only render columns up to that point + 1. The filled cell marks the performer's CURRENT position only (not history). Auto-scroll uses `scrollIntoView` or `scrollLeft` manipulation on the container to keep the rightmost active column visible.

```typescript
// Determine visible column count based on mode
function getVisibleColumns(
  scoreMode: ScoreMode,
  totalPatterns: number,
  performers: PerformerState[]
): number {
  if (scoreMode === 'riley') return totalPatterns; // Always 53
  // For dynamic modes, show up to the max discovered pattern + some lookahead
  const maxReached = Math.max(...performers.map(p => p.currentPattern), 1);
  return Math.min(maxReached + 1, totalPatterns);
}
```

### Anti-Patterns to Avoid
- **Separate animation timer:** Don't use `requestAnimationFrame` or `setInterval` for dot animation. The scheduler's beat-driven state updates already provide the timing. CSS transitions handle the visual interpolation.
- **State in the grid component:** Don't track "visited patterns" in React state. The grid only shows CURRENT positions; the phasing effect is visible from the staggered positions of different performers at the same moment.
- **Heavy re-render from beat updates:** The state fires on every beat. Ensure the ScoreOverview component uses `React.memo` or similar to avoid unnecessary re-renders when only unrelated state fields change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Horizontal scroll auto-follow | Custom scroll tracking | `Element.scrollIntoView({ behavior: 'smooth', inline: 'end' })` on the leading cell | Browser handles smooth scrolling natively |
| Conditional class strings | String concatenation | `cn()` utility (already in project) | Handles merge conflicts between Tailwind classes |
| CSS transitions | JavaScript-driven animation loops | Tailwind `transition-opacity duration-100` | Browser GPU-accelerated, no JS overhead |

**Key insight:** The visualization layer is pure CSS + React rendering driven by existing state updates. No animation libraries, no canvas, no custom scheduling needed.

## Common Pitfalls

### Pitfall 1: Beat-Rate State Updates Causing Jank
**What goes wrong:** `fireStateChange()` is called on every eighth-note beat in `scheduleBeat()`. At 180 BPM, that is 6 Hz. With 16 performers, each state update produces a new array of 16 `PerformerState` objects plus the grid needs to re-render.
**Why it happens:** React re-renders the entire component tree from the state change root.
**How to avoid:** (1) The PatternDisplay and ScoreOverview should compare only the fields they care about. React 19 is already good at batching. (2) Keep the grid as a separate component that receives only `performers`, `totalPatterns`, and `scoreMode` as props. (3) Use `React.memo` on the ScoreOverview since most beats don't change pattern positions (only rep counters and hit velocity change). Pattern position changes are infrequent relative to beat ticks.
**Warning signs:** Visual lag between audio events and dot/grid updates. Profile with React DevTools "Highlight updates."

### Pitfall 2: Note-Hit Dot Staying Visible Too Long
**What goes wrong:** The dot appears when `lastHitVelocity > 0` but the next beat may also have a note, so the dot never disappears -- it just stays lit continuously for playing performers.
**Why it happens:** Many patterns have notes on consecutive beats.
**How to avoid:** The dot should flash per-beat regardless. Two approaches: (1) Use a CSS animation (`@keyframes`) that runs once on each state change (key the animation with beat count or a toggle flag), or (2) clear `lastHitVelocity` to 0 between beats by default and only set it when a note actually fires. Approach (2) is simpler: the scheduler already rebuilds the hit map from scratch each beat, so if a performer is sustaining (no new note event), their velocity will naturally be 0.
**Warning signs:** The dot appears to be always on for active performers.

### Pitfall 3: Grid Auto-Scroll Fighting User Scroll
**What goes wrong:** Auto-scroll to the leading performer's position keeps snapping the view away when the user is trying to look at earlier patterns.
**Why it happens:** Auto-scroll fires on every state change.
**How to avoid:** Only auto-scroll when pattern positions actually change (not on every beat). Detect if the user has manually scrolled away from the auto-scroll position and pause auto-scroll until they scroll back near the leading edge. A simple approach: only auto-scroll if the leading column is within 2-3 columns of the right edge of the viewport.
**Warning signs:** The grid jumps unpredictably while the user tries to inspect earlier patterns.

### Pitfall 4: Dynamic Column Count Causing Layout Thrash
**What goes wrong:** In Euclidean/Generative modes, adding a new column shifts the entire grid width, causing scroll position jumps.
**Why it happens:** New columns are appended as performers advance.
**How to avoid:** Add columns one at a time. Use a `min-width` on the grid container to prevent shrinking. When a new column appears, auto-scroll to it smoothly rather than snapping.
**Warning signs:** Grid "jumps" or flickers when a performer advances to a new pattern.

### Pitfall 5: PerformerState Shape Change Breaking Existing Code
**What goes wrong:** Adding `lastHitVelocity` to `PerformerState` breaks code that constructs PerformerState objects without the new field.
**Why it happens:** TypeScript strict mode requires all interface fields.
**How to avoid:** Make `lastHitVelocity` optional (`lastHitVelocity?: number`) or provide a default of 0 in all construction sites. Check: `ensemble.ts` `performerStates` getter, `scheduler.ts` `getState()`, and `App.tsx` `INITIAL_STATE`.
**Warning signs:** TypeScript compilation errors after adding the field.

## Code Examples

### Note-Hit Dot on Performer Card
```tsx
// Inside PatternDisplay.tsx, within the performer card render
<div className={cn(CARD, /* existing classes */)}>
  {/* Note-hit indicator dot */}
  <span
    className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0 transition-opacity duration-100"
    style={{ opacity: performer?.lastHitVelocity ?? 0 }}
  />
  <span className="text-muted-foreground font-medium w-[1.8em] shrink-0">
    P{index + 1}
  </span>
  {/* Pattern position: e.g. "12/53" */}
  <span className="truncate">
    {status === 'complete' ? 'Done' : status === 'silent' ? '...' : `${performer!.currentPattern}/${totalPatterns}`}
  </span>
  <span className="text-muted-foreground text-xs ml-auto shrink-0">
    {status === 'complete' || status === 'silent' ? '' : `${performer!.currentRep}/${performer!.totalReps}`}
  </span>
</div>
```

### Score Overview Grid Component
```tsx
// ScoreOverview.tsx
interface ScoreOverviewProps {
  performers: PerformerState[];
  totalPatterns: number;
  scoreMode: ScoreMode;
  maxPerformers: number;
  activeCount: number;
  playing: boolean;
}

function ScoreOverview({ performers, totalPatterns, scoreMode, playing }: ScoreOverviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine visible columns
  const visibleCols = scoreMode === 'riley'
    ? totalPatterns
    : Math.min(
        Math.max(...performers.map(p => p.currentPattern), 1) + 1,
        totalPatterns
      );

  // Auto-scroll to leading performer
  const leadingCol = Math.max(...performers.map(p => p.currentPattern), 1);
  useEffect(() => {
    if (!playing) return;
    const container = containerRef.current;
    if (!container) return;
    // Find the cell for the leading column and scroll to it
    const leadingCell = container.querySelector(`[data-col="${leadingCol}"]`);
    leadingCell?.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });
  }, [leadingCol, playing]);

  return (
    <div ref={containerRef} className="overflow-x-auto">
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: `auto repeat(${visibleCols}, 1rem)`,
          gridTemplateRows: `repeat(${performers.length}, 1rem)`,
        }}
      >
        {performers.map((p) => (
          <Fragment key={p.id}>
            {/* Row label */}
            <span className="text-[10px] text-muted-foreground pr-1 flex items-center">
              P{p.id + 1}
            </span>
            {/* Pattern cells */}
            {Array.from({ length: visibleCols }, (_, col) => (
              <div
                key={col}
                data-col={col + 1}
                className={cn(
                  'w-4 h-4 rounded-sm transition-colors duration-150',
                  p.currentPattern === col + 1
                    ? 'bg-foreground'
                    : 'bg-muted',
                )}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
```

### Scheduler Integration for Hit Data
```typescript
// In scheduler.ts
private lastHitMap: Map<number, number> = new Map();

// Inside scheduleBeat(), after the events loop:
this.lastHitMap.clear();
for (const event of events) {
  if (event.midi !== 0) {
    const current = this.lastHitMap.get(event.performerId) ?? 0;
    this.lastHitMap.set(event.performerId, Math.max(current, event.velocity));
  }
}

// In getState(), modify performers array:
performers: this.ensemble.performerStates.map(p => ({
  ...p,
  lastHitVelocity: this.lastHitMap.get(p.id) ?? 0,
})),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canvas/WebGL for music visualization | CSS Grid + transitions for structural data | Always applicable for grid data | Simpler, accessible, no canvas overhead |
| requestAnimationFrame polling | State-driven React rendering | React 18+ concurrent features | Fewer bugs, natural batching |
| Manual DOM manipulation for scroll | scrollIntoView API | Widely supported since ~2020 | Cleaner, browser-optimized scrolling |

**Deprecated/outdated:**
- None relevant; the tech used (React 19, Tailwind 4, CSS Grid) is current.

## Open Questions

1. **Column labeling density in the grid**
   - What we know: 53 columns at 1rem each = ~53rem (~848px). With row labels, this will exceed mobile viewports.
   - What's unclear: Should column headers show pattern numbers? Every 5th? Every 10th? Or no headers at all?
   - Recommendation: Show a thin header row with numbers every 10th column (10, 20, 30, 40, 50). This provides orientation without clutter. Falls under Claude's discretion.

2. **Grid behavior when ensemble is not playing**
   - What we know: The grid should be "always visible" per decision.
   - What's unclear: What does the grid show before playback starts? All empty cells? Hidden entirely?
   - Recommendation: Show the grid frame (row labels + empty cells) matching the configured performer count. This previews the performance scope. During reset, clear all cells back to empty.

3. **Performer reordering after add/remove**
   - What we know: Performers can be added/removed during playback. IDs are not contiguous after removal.
   - What's unclear: Should the grid always show rows for max performers, or only active ones?
   - Recommendation: Show rows only for currently active performers (matching the performer card grid behavior). When a performer is removed, its row disappears. This keeps the grid compact and informative.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `src/audio/scheduler.ts`, `src/audio/engine.ts`, `src/audio/types.ts`, `src/score/ensemble.ts`, `src/components/PatternDisplay.tsx`, `src/App.tsx`
- `EnsembleEngineState` interface and `fireStateChange()` call sites verified in codebase
- `PerformerState` fields verified: `id`, `patternIndex`, `currentPattern`, `status`, `currentRep`, `totalReps`, `instrument`
- Beat timing: `scheduleBeat` fires once per eighth note, confirmed in `scheduler.ts` tick loop
- Pattern counts: Canon = 53 (PATTERNS array in patterns.ts), Generative = 30-80 (generative.ts), Euclidean = 20-40 (euclidean.ts)

### Secondary (MEDIUM confidence)
- `scrollIntoView` smooth behavior support across browsers -- widely supported but `smooth` behavior may not work in all contexts within overflow containers. May need `scrollLeft` manipulation as fallback.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, uses existing React + Tailwind
- Architecture: HIGH -- extends existing state flow pattern, all data sources identified in codebase
- Pitfalls: HIGH -- identified from direct analysis of scheduler timing, state update frequency, and grid rendering characteristics

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable -- no external dependencies or APIs involved)
