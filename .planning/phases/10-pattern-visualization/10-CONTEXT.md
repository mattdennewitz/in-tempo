# Phase 10: Pattern Visualization - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual feedback showing ensemble activity and structure. Three layers: minimal note-hit indicators on performer cards, enhanced pattern progress display, and a full-ensemble score overview grid revealing canonic phasing and convergence. Must work across all composition modes (Canon with fixed 53 patterns, Euclidean and Generative with dynamic/unknown pattern counts).

</domain>

<decisions>
## Implementation Decisions

### Note-hit feedback
- Minimal left-edge dot on the performer card, single color for all performers
- Dot intensity maps to velocity (louder notes = stronger signal)
- Quick snap animation (~100ms) — appears and disappears crisply
- No card-level flash/pulse/glow — keep cards visually calm

### Pattern progress display
- Keep existing rep counter (e.g. 2/5) as-is — no beat-level granularity
- Add pattern position out of total (e.g. pattern 12/53) to the card
- Rest state keeps current "..." indicator unchanged

### Score overview design
- Grid/matrix layout: rows = performers, columns = patterns
- Filled cell marks each performer's current pattern position
- Placed below the performer card grid, always visible (not collapsible)
- Canon mode: full 53-column width shown upfront
- Euclidean/Generative modes: grid grows progressively as performers discover new patterns
- Fixed cell size — grid becomes horizontally scrollable when it exceeds viewport
- Auto-scroll keeps the leading performer(s) visible
- Monochrome color scheme (single color for all performers)

### Animation feel
- Responsive energy level — visuals clearly react to the music but don't dominate
- Grid cells use brief transition (~150ms) when state changes
- Note-hit dots use quick snap (~100ms)
- Overall: informative, not theatrical

### Claude's Discretion
- Exact dot size and color
- Cell dimensions and grid spacing
- Scroll behavior details (smooth vs snap)
- How to label rows/columns in the grid
- Responsive layout adjustments for different screen sizes

</decisions>

<specifics>
## Specific Ideas

- The score overview must handle dynamic pattern counts for Euclidean and Generative modes — grid grows as patterns are discovered rather than assuming a fixed width
- The visualization should make canonic phasing visible — when multiple performers are at different points in the sequence, the staggered filled cells should reveal the phase relationship

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-pattern-visualization*
*Context gathered: 2026-02-15*
