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
 * - Endgame: staggered dropouts when performers reach the final pattern
 */

import type { Pattern, ScoreMode } from '../audio/types.ts';
import { PATTERNS } from './patterns.ts';
import { assignInstrument } from '../audio/sampler.ts';
import { SeededRng } from './rng.ts';
import {
  computeVelocity,
  generateVelocityPersonality,
  intensityScale,
  type VelocityConfig,
  type VelocityContext,
} from './velocity.ts';
import {
  computeTimingOffset,
  computeRubatoMultiplier,
  advanceRubato,
  generateTimingPersonality,
  type TimingConfig,
  type TimingContext,
  type RubatoState,
} from './timing.ts';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface AgentNoteEvent {
  performerId: number;
  midi: number;
  duration: number;
  velocity: number;
  timingOffset: number;  // seconds, positive=late/drag, negative=early/rush
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
  baseLoudness: number;    // 0.7-1.0
  jitterAmount: number;    // 0.02-0.12
  rushDragBias: number;    // -0.3 to +0.3
  timingJitter: number;    // 0.3 to 1.0
}

export interface AgentState {
  id: number;
  patternIndex: number;
  noteIndex: number;
  repetitionsRemaining: number;
  totalRepetitions: number;
  status: 'playing' | 'silent' | 'complete';
  beatsSilent: number;
  beatsSinceLastDropout: number;
  beatsInCurrentNote: number;
  personality: AgentPersonality;
  entryDelay: number;
  tickCount: number;
}

type Decision = 'advance' | 'repeat' | 'dropout';

// ---------------------------------------------------------------------------
// Utility: Weighted random choice
// ---------------------------------------------------------------------------

export function weightedChoice<T>(
  options: Array<{ value: T; weight: number }>,
  rng?: SeededRng,
): T {
  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
  if (totalWeight <= 0) {
    return options[0].value;
  }

  const _rng = rng ?? new SeededRng(Date.now() & 0xffffffff);
  let r = _rng.random() * totalWeight;
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
  snapshot: EnsembleSnapshot,
  baseAdvance: number = 0.3,
): { advance: number; repeat: number; dropout: number } {
  // Base weights — advance is user-configurable, others scale to fill remainder
  const remainder = 1.0 - baseAdvance;
  let advance = baseAdvance;
  let repeat = remainder * (5 / 7);   // ~71% of remainder
  let dropout = remainder * (2 / 7);  // ~29% of remainder

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
  snapshot: EnsembleSnapshot,
  bandWidth: number = 3
): { decision: Decision; jumpTo?: number } {
  const playing = snapshot.performers.filter(p => p.status === 'playing');
  if (playing.length <= 1) {
    return { decision };
  }

  // If agent is bandWidth or more ahead and wants to advance: force repeat
  if (
    agent.patternIndex >= snapshot.minPatternIndex + bandWidth &&
    decision === 'advance'
  ) {
    return { decision: 'repeat' };
  }

  // If agent is bandWidth or more behind: force jump forward
  if (agent.patternIndex <= snapshot.maxPatternIndex - bandWidth) {
    const jumpTarget = snapshot.maxPatternIndex - 1;
    return { decision: 'advance', jumpTo: Math.max(jumpTarget, agent.patternIndex) };
  }

  return { decision };
}

// ---------------------------------------------------------------------------
// Personality generation
// ---------------------------------------------------------------------------

function randomInRange(min: number, max: number, rng: SeededRng): number {
  return min + rng.random() * (max - min);
}

export function generatePersonality(rng?: SeededRng): AgentPersonality {
  const _rng = rng ?? new SeededRng(Date.now() & 0xffffffff);
  const velocityTraits = generateVelocityPersonality(_rng);
  const timingTraits = generateTimingPersonality(_rng);
  return {
    advanceBias: randomInRange(0.8, 1.2, _rng),
    repeatBias: randomInRange(0.8, 1.2, _rng),
    dropoutBias: randomInRange(0.8, 1.2, _rng),
    minSilentBeats: Math.floor(randomInRange(4, 16, _rng)),
    maxSilentBeats: Math.floor(randomInRange(16, 64, _rng)),
    dropoutCooldown: Math.floor(randomInRange(16, 48, _rng)),
    baseLoudness: velocityTraits.baseLoudness,
    jitterAmount: velocityTraits.jitterAmount,
    rushDragBias: timingTraits.rushDragBias,
    timingJitter: timingTraits.timingJitter,
  };
}

// ---------------------------------------------------------------------------
// PerformerAgent
// ---------------------------------------------------------------------------

export class PerformerAgent {
  private _state: AgentState;
  private patterns: Pattern[];
  private finalPatternIndex: number;
  private bandWidth: number;
  private velocityConfig: VelocityConfig;
  private timingConfig: TimingConfig;
  private rng: SeededRng;
  private _advanceWeight: number = 0.3;

  constructor(
    id: number,
    patterns: Pattern[],
    personality?: AgentPersonality,
    finalPatternIndex?: number,
    bandWidth?: number,
    velocityConfig?: VelocityConfig,
    rng?: SeededRng,
    timingConfig?: TimingConfig,
  ) {
    this.patterns = patterns;
    this.finalPatternIndex = finalPatternIndex ?? patterns.length - 1;
    this.bandWidth = bandWidth ?? 3;
    this.velocityConfig = velocityConfig ?? { enabled: true, intensity: 'moderate' };
    this.timingConfig = timingConfig ?? { enabled: true, intensity: 'moderate' };
    this.rng = rng ?? new SeededRng(Date.now() & 0xffffffff);
    const reps = this.randomReps();
    this._state = {
      id,
      patternIndex: 0,
      noteIndex: 0,
      repetitionsRemaining: reps,
      totalRepetitions: reps,
      status: 'playing',
      beatsSilent: 0,
      beatsSinceLastDropout: 100, // start high so dropout is possible early
      beatsInCurrentNote: 0,
      personality: personality ?? generatePersonality(this.rng),
      entryDelay: 0,
      tickCount: 0,
    };
  }

  private randomReps(): number {
    return this.rng.int(2, 8);
  }

  private setNewReps(): void {
    const reps = this.randomReps();
    this._state.totalRepetitions = reps;
    this._state.repetitionsRemaining = reps;
  }

  tick(snapshot: EnsembleSnapshot, bpm: number = 120): AgentNoteEvent | null {
    const s = this._state;

    // Increment tick counter (before entry delay check for consistent counting)
    s.tickCount++;

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

    const velocityCtx: VelocityContext = {
      noteIndexInPattern: s.noteIndex - 1, // already incremented above
      totalNotesInPattern: pattern.notes.length,
      currentRep: s.totalRepetitions - s.repetitionsRemaining + 1,
      totalReps: s.totalRepetitions,
      personality: {
        baseLoudness: s.personality.baseLoudness,
        jitterAmount: s.personality.jitterAmount,
      },
      config: this.velocityConfig,
    };

    const secondsPerEighth = 60 / (bpm * 2);
    const timingCtx: TimingContext = {
      beatIndex: s.tickCount,
      noteIndexInPattern: s.noteIndex - 1,
      personality: {
        rushDragBias: s.personality.rushDragBias,
        timingJitter: s.personality.timingJitter,
      },
      density: snapshot.density,
      config: this.timingConfig,
      secondsPerEighth,
    };

    return {
      performerId: s.id,
      midi: note.midi,
      duration: note.duration,
      velocity: computeVelocity(velocityCtx, this.rng),
      timingOffset: computeTimingOffset(timingCtx, this.rng),
    };
  }

  private decisionLogic(snapshot: EnsembleSnapshot): void {
    const s = this._state;

    // Endgame: on final pattern, never advance
    if (s.patternIndex >= this.finalPatternIndex) {
      this.handleEndgame(snapshot);
      return;
    }

    // Compute weights and make choice
    const weights = computeWeights(s, snapshot, this._advanceWeight);
    let decision = weightedChoice<Decision>([
      { value: 'advance', weight: weights.advance },
      { value: 'repeat', weight: weights.repeat },
      { value: 'dropout', weight: weights.dropout },
    ], this.rng);

    // Band enforcement (hard override)
    const enforced = enforceBand(s, decision, snapshot, this.bandWidth);
    decision = enforced.decision;

    // Execute decision
    switch (decision) {
      case 'advance':
        if (enforced.jumpTo !== undefined) {
          s.patternIndex = enforced.jumpTo;
        } else {
          s.patternIndex++;
        }
        this.setNewReps();
        s.noteIndex = 0;
        break;
      case 'repeat':
        this.setNewReps();
        break;
      case 'dropout':
        // Suppress dropout if it would violate minimum active floor
        if (this.canDropout(snapshot)) {
          s.status = 'silent';
          s.beatsSilent = 0;
          s.beatsSinceLastDropout = 0;
        } else {
          // Fallback to repeat
          this.setNewReps();
        }
        break;
    }
  }

  private handleEndgame(snapshot: EnsembleSnapshot): void {
    const s = this._state;

    // Count performers at final pattern
    const atEnd = snapshot.performers.filter(
      p => p.patternIndex >= this.finalPatternIndex
    ).length;
    const fractionAtEnd = atEnd / snapshot.totalPerformers;

    // Once > 60% are at the end, scaled dropout chance
    if (fractionAtEnd > 0.6) {
      const dropoutChance = (fractionAtEnd - 0.6) * 2.5 * 0.1;
      if (this.rng.random() < dropoutChance) {
        s.status = 'complete'; // Permanent, no rejoin
        return;
      }
    }

    // Default: keep repeating final pattern
    this.setNewReps();
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

    if (this.rng.random() < rejoinProb) {
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
    if (s.patternIndex < this.finalPatternIndex) {
      s.patternIndex++;
    }

    this.setNewReps();

    // Jump forward if too far behind the band
    const playing = snapshot.performers.filter(p => p.status === 'playing');
    if (playing.length > 0) {
      const max = snapshot.maxPatternIndex;
      if (s.patternIndex < max - this.bandWidth) {
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

  setVelocityConfig(config: VelocityConfig): void {
    this.velocityConfig = config;
  }

  setTimingConfig(config: TimingConfig): void {
    this.timingConfig = config;
  }

  setAdvanceWeight(weight: number): void {
    this._advanceWeight = weight;
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
    this.setNewReps();
    this._state.status = 'playing';
    this._state.beatsSilent = 0;
    this._state.beatsSinceLastDropout = 100;
    this._state.beatsInCurrentNote = 0;
    this._state.entryDelay = 0;
    this._state.tickCount = 0;
  }
}

// ---------------------------------------------------------------------------
// Ensemble coordinator
// ---------------------------------------------------------------------------

export class Ensemble {
  private agents: PerformerAgent[];
  private _patterns: Pattern[];
  private finalPatternIndex: number;
  private bandWidth: number;
  private _scoreMode: ScoreMode;
  private nextId: number;
  private pendingRemovals: Set<number> = new Set();
  private velocityConfig: VelocityConfig;
  private timingConfig: TimingConfig;
  private rng: SeededRng;
  private rubatoState: RubatoState;
  private _lastRubatoMultiplier: number = 1.0;

  constructor(
    count: number,
    patterns: Pattern[] = PATTERNS,
    mode: ScoreMode = 'riley',
    velocityConfig: VelocityConfig = { enabled: true, intensity: 'moderate' },
    rng?: SeededRng,
    timingConfig: TimingConfig = { enabled: true, intensity: 'moderate' },
  ) {
    this._scoreMode = mode;
    this._patterns = patterns;
    this.finalPatternIndex = patterns.length - 1;
    this.bandWidth = Math.max(2, Math.min(5, Math.round(patterns.length * 0.06)));
    this.agents = [];
    this.nextId = count;
    this.velocityConfig = velocityConfig;
    this.timingConfig = timingConfig;
    this.rng = rng ?? new SeededRng(Date.now() & 0xffffffff);
    this.rubatoState = { phase: 0, period: this.rng.int(16, 32) };

    // INVARIANT: Agents are created and tick in array order. This guarantees
    // the PRNG call sequence is deterministic for a given seed + performer count.
    let cumulativeDelay = 0;
    for (let i = 0; i < count; i++) {
      const agent = new PerformerAgent(
        i, patterns, undefined, this.finalPatternIndex, this.bandWidth, this.velocityConfig, this.rng, this.timingConfig
      );
      agent._mutableState.entryDelay = cumulativeDelay;
      cumulativeDelay += this.rng.int(2, 4); // 2-4 beats
      this.agents.push(agent);
    }
  }

  tick(bpm: number = 120): AgentNoteEvent[] {
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
      const event = agent.tick(snapshot, bpm);
      if (event) {
        events.push(event);
      }
    }

    // Compute rubato multiplier for this tick, then advance phase
    this._lastRubatoMultiplier = computeRubatoMultiplier(
      this.rubatoState,
      intensityScale(this.timingConfig.intensity) * (this.timingConfig.enabled ? 1.0 : 0.0),
    );
    this.rubatoState = advanceRubato(this.rubatoState);

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
    const agent = new PerformerAgent(id, this._patterns, undefined, this.finalPatternIndex, this.bandWidth, this.velocityConfig, this.rng, this.timingConfig);

    // Start at current ensemble minimum pattern so the new performer blends in
    const snapshot = this.createSnapshot();
    agent._mutableState.patternIndex = snapshot.minPatternIndex;
    agent._mutableState.noteIndex = 0;
    agent._mutableState.entryDelay = this.rng.int(2, 4); // 2-4 beats stagger

    this.agents.push(agent);
    return id;
  }

  /** Update velocity config on ensemble and all agents. */
  setVelocityConfig(config: VelocityConfig): void {
    this.velocityConfig = config;
    for (const agent of this.agents) {
      agent.setVelocityConfig(config);
    }
  }

  /** Update timing config on ensemble and all agents. */
  setTimingConfig(config: TimingConfig): void {
    this.timingConfig = config;
    for (const agent of this.agents) {
      agent.setTimingConfig(config);
    }
  }

  /** Update advance weight on all agents. */
  setAdvanceWeight(weight: number): void {
    for (const agent of this.agents) {
      agent.setAdvanceWeight(weight);
    }
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

  get rubatoMultiplier(): number {
    return this._lastRubatoMultiplier;
  }

  get isComplete(): boolean {
    return this.agents.every(a => a.isComplete);
  }

  get totalPatterns(): number {
    return this._patterns.length;
  }

  get scoreMode(): ScoreMode {
    return this._scoreMode;
  }

  get performerStates() {
    return this.agents.map(a => {
      const s = a.state;
      const isActive = s.status === 'playing';
      return {
        id: s.id,
        patternIndex: s.patternIndex,
        currentPattern: Math.min(s.patternIndex + 1, this._patterns.length),
        status: s.status,
        currentRep: isActive ? s.totalRepetitions - s.repetitionsRemaining + 1 : 0,
        totalReps: isActive ? s.totalRepetitions : 0,
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
    this.rubatoState = { phase: 0, period: this.rubatoState.period };
    this._lastRubatoMultiplier = 1.0;
    for (const agent of this.agents) {
      agent.reset();
    }
  }
}
