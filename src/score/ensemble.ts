/**
 * Ensemble AI - Multiple simulated performers navigating Terry Riley's "In C".
 *
 * Each PerformerAgent makes weighted decisions (advance/repeat/dropout) at pattern
 * boundaries. The Ensemble coordinator creates immutable snapshots each tick so all
 * agents evaluate against the same state (no order-of-evaluation bugs).
 *
 * Key behaviors:
 * - Band enforcement: no performer more than 3 patterns ahead of lowest active
 * - Dropout/rejoin: agents go silent then return, creating natural breathing
 * - Unison seeking: agents cluster on the same pattern periodically
 * - Endgame: staggered dropouts when performers reach pattern 53
 */

import type { Pattern } from '../audio/types.ts';
import { PATTERNS } from './patterns.ts';
import { assignInstrument } from '../audio/sampler.ts';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface AgentNoteEvent {
  performerId: number;
  midi: number;
  duration: number;
}

export interface EnsembleSnapshot {
  readonly performers: ReadonlyArray<{
    readonly id: number;
    readonly patternIndex: number;
    readonly status: 'playing' | 'silent' | 'complete';
  }>;
  readonly minPatternIndex: number;
  readonly maxPatternIndex: number;
  readonly averagePatternIndex: number;
  readonly density: number;
  readonly totalPerformers: number;
}

export interface AgentPersonality {
  advanceBias: number;   // 0.8-1.2
  repeatBias: number;    // 0.8-1.2
  dropoutBias: number;   // 0.8-1.2
  minSilentBeats: number;  // 4-16
  maxSilentBeats: number;  // 16-64
  dropoutCooldown: number; // 16-48
}

export interface AgentState {
  id: number;
  patternIndex: number;
  noteIndex: number;
  repetitionsRemaining: number;
  status: 'playing' | 'silent' | 'complete';
  beatsSilent: number;
  beatsSinceLastDropout: number;
  beatsInCurrentNote: number;
  personality: AgentPersonality;
  entryDelay: number;
}

type Decision = 'advance' | 'repeat' | 'dropout';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAND_WIDTH = 3;
const FINAL_PATTERN_INDEX = 52; // 0-based index of pattern 53

// ---------------------------------------------------------------------------
// Utility: Weighted random choice
// ---------------------------------------------------------------------------

export function weightedChoice<T>(
  options: Array<{ value: T; weight: number }>
): T {
  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
  if (totalWeight <= 0) {
    return options[0].value;
  }

  let r = Math.random() * totalWeight;
  for (const option of options) {
    r -= option.weight;
    if (r <= 0) {
      return option.value;
    }
  }
  // Fallback (floating point edge case)
  return options[options.length - 1].value;
}

// ---------------------------------------------------------------------------
// Weight computation
// ---------------------------------------------------------------------------

export function computeWeights(
  agent: AgentState,
  snapshot: EnsembleSnapshot
): { advance: number; repeat: number; dropout: number } {
  // Base weights
  let advance = 0.3;
  let repeat = 0.5;
  let dropout = 0.2;

  const playing = snapshot.performers.filter(p => p.status === 'playing');

  // Near top of band (within 1 of max among playing)
  if (playing.length > 1 && agent.patternIndex >= snapshot.maxPatternIndex - 1) {
    advance *= 0.2;
    repeat *= 2.0;
  }

  // Near bottom of band (within 1 of min among playing)
  if (playing.length > 1 && agent.patternIndex <= snapshot.minPatternIndex + 1) {
    advance *= 3.0;
    repeat *= 0.3;
  }

  // Density effects
  if (snapshot.density > 0.8) {
    dropout *= 2.0;
  }
  if (snapshot.density < 0.4) {
    dropout *= 0.3;
  }

  // Unison seeking
  const samePattern = playing.filter(
    p => p.id !== agent.id && p.patternIndex === agent.patternIndex
  ).length;
  if (samePattern >= 2) {
    repeat *= 2.0;
  }

  const oneAhead = playing.filter(
    p => p.id !== agent.id && p.patternIndex === agent.patternIndex + 1
  ).length;
  if (oneAhead >= 2) {
    advance *= 2.0;
  }

  // Apply personality biases
  advance *= agent.personality.advanceBias;
  repeat *= agent.personality.repeatBias;
  dropout *= agent.personality.dropoutBias;

  // Normalize
  const total = advance + repeat + dropout;
  return {
    advance: advance / total,
    repeat: repeat / total,
    dropout: dropout / total,
  };
}

// ---------------------------------------------------------------------------
// Band enforcement (hard override after weighted choice)
// ---------------------------------------------------------------------------

export function enforceBand(
  agent: AgentState,
  decision: Decision,
  snapshot: EnsembleSnapshot
): { decision: Decision; jumpTo?: number } {
  const playing = snapshot.performers.filter(p => p.status === 'playing');
  if (playing.length <= 1) {
    return { decision };
  }

  // If agent is BAND_WIDTH or more ahead and wants to advance: force repeat
  if (
    agent.patternIndex >= snapshot.minPatternIndex + BAND_WIDTH &&
    decision === 'advance'
  ) {
    return { decision: 'repeat' };
  }

  // If agent is BAND_WIDTH or more behind: force jump forward
  if (agent.patternIndex <= snapshot.maxPatternIndex - BAND_WIDTH) {
    const jumpTarget = snapshot.maxPatternIndex - 1;
    return { decision: 'advance', jumpTo: Math.max(jumpTarget, agent.patternIndex) };
  }

  return { decision };
}

// ---------------------------------------------------------------------------
// Personality generation
// ---------------------------------------------------------------------------

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function generatePersonality(): AgentPersonality {
  return {
    advanceBias: randomInRange(0.8, 1.2),
    repeatBias: randomInRange(0.8, 1.2),
    dropoutBias: randomInRange(0.8, 1.2),
    minSilentBeats: Math.floor(randomInRange(4, 16)),
    maxSilentBeats: Math.floor(randomInRange(16, 64)),
    dropoutCooldown: Math.floor(randomInRange(16, 48)),
  };
}

// ---------------------------------------------------------------------------
// PerformerAgent
// ---------------------------------------------------------------------------

export class PerformerAgent {
  private _state: AgentState;
  private patterns: Pattern[];

  constructor(id: number, patterns: Pattern[], personality?: AgentPersonality) {
    this.patterns = patterns;
    this._state = {
      id,
      patternIndex: 0,
      noteIndex: 0,
      repetitionsRemaining: this.randomReps(),
      status: 'playing',
      beatsSilent: 0,
      beatsSinceLastDropout: 100, // start high so dropout is possible early
      beatsInCurrentNote: 0,
      personality: personality ?? generatePersonality(),
      entryDelay: 0,
    };
  }

  private randomReps(): number {
    return Math.floor(Math.random() * 7) + 2; // 2-8
  }

  tick(snapshot: EnsembleSnapshot): AgentNoteEvent | null {
    const s = this._state;

    // Staggered entry
    if (s.entryDelay > 0) {
      s.entryDelay--;
      return null;
    }

    // Complete performers do nothing
    if (s.status === 'complete') {
      return null;
    }

    // Silent performers check rejoin
    if (s.status === 'silent') {
      this.rejoinLogic(snapshot);
      return null;
    }

    // Increment dropout cooldown tracker
    s.beatsSinceLastDropout++;

    // Sustaining a multi-beat note
    if (s.beatsInCurrentNote > 0) {
      s.beatsInCurrentNote--;
      return null;
    }

    // Get current note
    const pattern = this.patterns[s.patternIndex];
    if (!pattern) {
      s.status = 'complete';
      return null;
    }

    const note = pattern.notes[s.noteIndex];
    if (!note) {
      // Safety: shouldn't happen, but handle gracefully
      s.noteIndex = 0;
      return null;
    }

    // Set sustain for remaining beats of this note
    s.beatsInCurrentNote = note.duration - 1;

    // Advance note index
    s.noteIndex++;

    // End of pattern notes
    if (s.noteIndex >= pattern.notes.length) {
      s.noteIndex = 0;
      s.repetitionsRemaining--;

      if (s.repetitionsRemaining <= 0) {
        this.decisionLogic(snapshot);
      }
    }

    // Return event (null for rests)
    if (note.midi === 0) {
      return null;
    }

    return {
      performerId: s.id,
      midi: note.midi,
      duration: note.duration,
    };
  }

  private decisionLogic(snapshot: EnsembleSnapshot): void {
    const s = this._state;

    // Endgame: on final pattern, never advance
    if (s.patternIndex >= FINAL_PATTERN_INDEX) {
      this.handleEndgame(snapshot);
      return;
    }

    // Compute weights and make choice
    const weights = computeWeights(s, snapshot);
    let decision = weightedChoice<Decision>([
      { value: 'advance', weight: weights.advance },
      { value: 'repeat', weight: weights.repeat },
      { value: 'dropout', weight: weights.dropout },
    ]);

    // Band enforcement (hard override)
    const enforced = enforceBand(s, decision, snapshot);
    decision = enforced.decision;

    // Execute decision
    switch (decision) {
      case 'advance':
        if (enforced.jumpTo !== undefined) {
          s.patternIndex = enforced.jumpTo;
        } else {
          s.patternIndex++;
        }
        s.repetitionsRemaining = this.randomReps();
        s.noteIndex = 0;
        break;
      case 'repeat':
        s.repetitionsRemaining = this.randomReps();
        break;
      case 'dropout':
        // Suppress dropout if it would violate minimum active floor
        if (this.canDropout(snapshot)) {
          s.status = 'silent';
          s.beatsSilent = 0;
          s.beatsSinceLastDropout = 0;
        } else {
          // Fallback to repeat
          s.repetitionsRemaining = this.randomReps();
        }
        break;
    }
  }

  private handleEndgame(snapshot: EnsembleSnapshot): void {
    const s = this._state;

    // Count performers at final pattern
    const atEnd = snapshot.performers.filter(
      p => p.patternIndex >= FINAL_PATTERN_INDEX
    ).length;
    const fractionAtEnd = atEnd / snapshot.totalPerformers;

    // Once > 60% are at the end, scaled dropout chance
    if (fractionAtEnd > 0.6) {
      const dropoutChance = (fractionAtEnd - 0.6) * 2.5 * 0.1;
      if (Math.random() < dropoutChance) {
        s.status = 'complete'; // Permanent, no rejoin
        return;
      }
    }

    // Default: keep repeating final pattern
    s.repetitionsRemaining = this.randomReps();
  }

  private rejoinLogic(snapshot: EnsembleSnapshot): void {
    const s = this._state;
    s.beatsSilent++;

    // Force rejoin at maxSilentBeats
    if (s.beatsSilent >= s.personality.maxSilentBeats) {
      this.doRejoin(snapshot);
      return;
    }

    // No rejoin before minSilentBeats
    if (s.beatsSilent < s.personality.minSilentBeats) {
      return;
    }

    // Probability increases as silence lengthens past minSilentBeats
    const silenceFraction =
      (s.beatsSilent - s.personality.minSilentBeats) /
      (s.personality.maxSilentBeats - s.personality.minSilentBeats);

    let rejoinProb = silenceFraction * 0.3; // Base rejoin probability

    // Density boost: more likely to rejoin when density < 0.5
    if (snapshot.density < 0.5) {
      rejoinProb += (0.5 - snapshot.density) * 0.4;
    }

    if (Math.random() < rejoinProb) {
      this.doRejoin(snapshot);
    }
  }

  private doRejoin(snapshot: EnsembleSnapshot): void {
    const s = this._state;
    s.status = 'playing';
    s.beatsSilent = 0;
    s.beatsInCurrentNote = 0;
    s.noteIndex = 0;

    // Advance to the next pattern on rejoin
    if (s.patternIndex < FINAL_PATTERN_INDEX) {
      s.patternIndex++;
    }

    s.repetitionsRemaining = this.randomReps();

    // Jump forward if too far behind the band
    const playing = snapshot.performers.filter(p => p.status === 'playing');
    if (playing.length > 0) {
      const max = snapshot.maxPatternIndex;
      if (s.patternIndex < max - BAND_WIDTH) {
        s.patternIndex = max - 1;
      }
    }
  }

  private canDropout(snapshot: EnsembleSnapshot): boolean {
    const s = this._state;

    // Don't dropout if cooldown hasn't elapsed
    if (s.beatsSinceLastDropout < s.personality.dropoutCooldown) {
      return false;
    }

    // Minimum active performers floor: at least 2 must remain playing
    const currentlyPlaying = snapshot.performers.filter(
      p => p.status === 'playing'
    ).length;
    if (currentlyPlaying <= 2) {
      return false;
    }

    return true;
  }

  get state(): AgentState {
    return { ...this._state, personality: { ...this._state.personality } };
  }

  get isComplete(): boolean {
    return this._state.status === 'complete';
  }

  /** Direct access to mutable state -- for testing only. */
  get _mutableState(): AgentState {
    return this._state;
  }

  reset(): void {
    this._state.patternIndex = 0;
    this._state.noteIndex = 0;
    this._state.repetitionsRemaining = this.randomReps();
    this._state.status = 'playing';
    this._state.beatsSilent = 0;
    this._state.beatsSinceLastDropout = 100;
    this._state.beatsInCurrentNote = 0;
    this._state.entryDelay = 0;
  }
}

// ---------------------------------------------------------------------------
// Ensemble coordinator
// ---------------------------------------------------------------------------

export class Ensemble {
  private agents: PerformerAgent[];
  private _patterns: Pattern[];
  private nextId: number;
  private pendingRemovals: Set<number> = new Set();

  constructor(count: number, patterns: Pattern[] = PATTERNS) {
    this._patterns = patterns;
    this.agents = [];
    this.nextId = count;

    for (let i = 0; i < count; i++) {
      const agent = new PerformerAgent(i, patterns);
      this.agents.push(agent);
    }
  }

  tick(): AgentNoteEvent[] {
    // Process queued removals before snapshot (safe -- no iteration in progress)
    if (this.pendingRemovals.size > 0) {
      this.agents = this.agents.filter(a => !this.pendingRemovals.has(a.state.id));
      this.pendingRemovals.clear();
    }

    // Create frozen snapshot BEFORE any agent ticks
    const snapshot = this.createSnapshot();

    // Minimum active floor: suppress dropout if density would drop too low
    // (handled inside PerformerAgent.canDropout via snapshot)

    const events: AgentNoteEvent[] = [];
    for (const agent of this.agents) {
      const event = agent.tick(snapshot);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }

  createSnapshot(): EnsembleSnapshot {
    const performers = this.agents.map(a => {
      const s = a.state;
      return {
        id: s.id,
        patternIndex: s.patternIndex,
        status: s.status,
      };
    });

    const playing = performers.filter(p => p.status === 'playing');
    const playingIndices = playing.map(p => p.patternIndex);

    const minPatternIndex =
      playingIndices.length > 0 ? Math.min(...playingIndices) : 0;
    const maxPatternIndex =
      playingIndices.length > 0 ? Math.max(...playingIndices) : 0;
    const averagePatternIndex =
      playingIndices.length > 0
        ? playingIndices.reduce((a, b) => a + b, 0) / playingIndices.length
        : 0;
    const density =
      performers.length > 0 ? playing.length / performers.length : 0;

    const snapshot: EnsembleSnapshot = {
      performers: Object.freeze(
        performers.map(p => Object.freeze(p))
      ),
      minPatternIndex,
      maxPatternIndex,
      averagePatternIndex,
      density,
      totalPerformers: performers.length,
    };

    return Object.freeze(snapshot);
  }

  /** Add a new agent that blends into the current musical position. Returns the new agent's id. */
  addAgent(): number {
    const id = this.nextId++;
    const agent = new PerformerAgent(id, this._patterns);

    // Start at current ensemble minimum pattern so the new performer blends in
    const snapshot = this.createSnapshot();
    agent._mutableState.patternIndex = snapshot.minPatternIndex;
    agent._mutableState.noteIndex = 0;
    agent._mutableState.entryDelay = Math.floor(Math.random() * 3) + 2; // 2-4 beats stagger

    this.agents.push(agent);
    return id;
  }

  /** Queue an agent for removal on the next tick. Returns false if agent not found. */
  removeAgent(id: number): boolean {
    const agent = this.agents.find(a => a.state.id === id);
    if (!agent) return false;

    // Mark as complete so its voice releases naturally on next tick
    agent._mutableState.status = 'complete';
    // Queue actual removal for next tick() (safe -- no mid-iteration mutation)
    this.pendingRemovals.add(id);
    return true;
  }

  get agentCount(): number {
    return this.agents.length;
  }

  get isComplete(): boolean {
    return this.agents.every(a => a.isComplete);
  }

  get performerStates() {
    return this.agents.map(a => {
      const s = a.state;
      return {
        id: s.id,
        patternIndex: s.patternIndex,
        currentPattern: Math.min(s.patternIndex + 1, this._patterns.length),
        status: s.status,
        instrument: assignInstrument(s.id),
      };
    });
  }

  /** Access agents for testing. */
  get _agents(): PerformerAgent[] {
    return this.agents;
  }

  reset(): void {
    this.pendingRemovals.clear();
    this.nextId = this.agents.length;
    for (const agent of this.agents) {
      agent.reset();
    }
  }
}
