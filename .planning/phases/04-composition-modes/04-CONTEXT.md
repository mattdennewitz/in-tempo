# Phase 4 Context: Composition Modes

## Generative Pattern Character

- **Cell lengths**: Mirror Riley's range (1-32 eighth notes, similar distribution)
- **Pitch palette**: Strict C major only (white keys: C D E F G A B)
- **Rests**: Include rests within patterns for rhythmic variety and breathing room
- **Pitch range**: Wider than Riley — C3-C6 (three octaves)
- **Melodic contour**: Mixed freely — leaps and steps in equal measure, angular melodies welcome
- **Pulse patterns**: Include some single-note repeated-pitch patterns (rhythmic pulses) mixed in with melodic cells
- **Progressive arc**: Early patterns simpler/shorter, middle gets complex, end winds down — natural performance shape
- **Freshness**: New patterns generated each performance — maximum replayability, no seeds
- **Note durations**: Variable (eighth, quarter, half notes within cells) — not all eighth notes
- **Shared motifs**: Some patterns reuse/transform melodic fragments from earlier patterns — compositionally cohesive
- **Tonal center**: Subtle drift allowed — later patterns may lean toward G or F as secondary centers before returning to C
- **Rhythmic character**: Varied and surprising — syncopation, straight rhythm, unexpected accents
- **Harmony awareness**: Claude decides whether to consider vertical harmony between adjacent patterns
- **Density variation**: Yes — some patterns sparse (few notes, more rests), others dense (many notes, few rests)
- **Endgame**: Last ~5 patterns simplify, gravitate back to C, shorter cells — natural winding down
- **Energy arc**: The progressive simple→complex→wind-down arc is sufficient — no additional energy mapping needed
- **Identity**: Recognizably different from Riley — clearly algorithmic and distinct, inspired by but not imitating In C
- **Influences**: Draw from broader minimalism — Reich phasing, Glass arpeggios, Eno ambient alongside Riley

## Euclidean Pattern Design

- **Pitch assignment**: Mix of both — some patterns are single-pitch rhythmic pulses, others assign C-major pitches to each pulse
- **Step counts**: Short (4-16 steps) — tight, hypnotic cycling patterns
- **Character**: Tonal/melodic overall — Euclidean rhythms as framework but pitched content makes it melodic (Reichian phasing feel)
- **Freshness**: Fresh each time (matching generative mode)
- **Rotation**: Yes, use rotation offsets — some patterns share K/N but different starting positions for phase relationships
- **Progressive arc**: Early patterns sparser (fewer pulses), later patterns denser — builds tension
- **Scale**: Claude decides — may use pentatonic or other scale to distinguish from generative mode
- **Non-pulse steps**: Rests (silence) — clean gaps between pulses, rhythmically defined
- **Interlocking pairs**: Yes — some adjacent patterns are complementary, together filling the rhythmic space
- **Pitch range**: Same as generative (C3-C6)
- **Endgame**: Last patterns simplify (fewer pulses per step count) to support natural ending

## Pattern Set Shape

- **Pattern count**: Variable — generative mode 30-80 patterns, Euclidean mode shorter 20-40 patterns
- **Endgame trigger**: Last pattern (whatever the final index is) triggers endgame — ensemble adapts dynamically to variable-length scores
- **Band width**: Scale with pattern count — wider band for more patterns, tighter for fewer (proportional spread)

## Mode Switching UX

- **When**: Anytime — switching mid-performance triggers a full reset (stop, generate new patterns, reset all performers to pattern 1, user clicks start again)
- **Descriptions**: Text description under each mode option (e.g., "Riley's 53 original patterns", "Algorithmically generated cells", "Euclidean rhythm patterns")
- **Mode indicator**: Subtle badge visible during performance showing current mode
- **Selector redesign**: Restyle ScoreModeSelector to match InTempo visual identity with descriptions
- **Per-performer display**: CSS grid cards showing `Player N - pattern - rep/total` format (e.g., "Player 1 - 8 - 1/4" = first player, pattern 8, repetition 1 of 4). No canvas — keep the card-based grid, enhanced with pattern + repetition info
- **Remove canvas visualization**: Replace canvas with enhanced performer cards

## UI Changes (Cross-cutting)

- Remove PerformerCanvas / canvas visualization entirely — cards are the only performer visualization
- Performer grid cards become the primary visualization showing: player ID, current pattern, repetition progress (e.g., "1/4"), playing/silent/complete status, and assigned instrument
- Keep sampled instruments (piano, marimba) and pulse generator toggle — Phase 4 only adds composition modes + UI enhancements
