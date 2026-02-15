import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  weightedChoice,
  computeWeights,
  enforceBand,
  PerformerAgent,
  Ensemble,
  generatePersonality,
  type EnsembleSnapshot,
  type AgentState,
  type AgentPersonality,
} from './ensemble.ts';
import { PATTERNS } from './patterns.ts';
import { SeededRng } from './rng.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePersonality(overrides: Partial<AgentPersonality> = {}): AgentPersonality {
  return {
    advanceBias: 1.0,
    repeatBias: 1.0,
    dropoutBias: 1.0,
    minSilentBeats: 8,
    maxSilentBeats: 32,
    dropoutCooldown: 16,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<EnsembleSnapshot> = {}): EnsembleSnapshot {
  return Object.freeze({
    performers: Object.freeze([]),
    minPatternIndex: 0,
    maxPatternIndex: 0,
    averagePatternIndex: 0,
    density: 1.0,
    totalPerformers: 4,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// weightedChoice
// ---------------------------------------------------------------------------

describe('weightedChoice', () => {
  it('returns valid values and respects weights', () => {
    const rng = new SeededRng(42);
    const counts = { a: 0, b: 0, c: 0 };
    const options = [
      { value: 'a' as const, weight: 0.7 },
      { value: 'b' as const, weight: 0.2 },
      { value: 'c' as const, weight: 0.1 },
    ];

    for (let i = 0; i < 1000; i++) {
      const result = weightedChoice(options, rng);
      counts[result]++;
    }

    // 'a' should appear most often (weight 0.7)
    expect(counts.a).toBeGreaterThan(counts.b);
    expect(counts.a).toBeGreaterThan(counts.c);
    // Distribution should not be uniform (with 1000 trials 'a' should be >400)
    expect(counts.a).toBeGreaterThan(400);
    // All values should appear at least once
    expect(counts.a).toBeGreaterThan(0);
    expect(counts.b).toBeGreaterThan(0);
    expect(counts.c).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Ensemble creation
// ---------------------------------------------------------------------------

describe('Ensemble', () => {
  it('creates N agents with distinct personalities', () => {
    const ensemble = new Ensemble(6, PATTERNS);
    const states = ensemble.performerStates;
    expect(states).toHaveLength(6);

    // Extract advance biases from agents to check they differ
    const biases = ensemble._agents.map(a => a.state.personality.advanceBias);
    const uniqueBiases = new Set(biases);
    // With random generation, extremely unlikely all 6 are identical
    expect(uniqueBiases.size).toBeGreaterThan(1);
  });

  it('tick() returns note events only from playing agents', () => {
    const ensemble = new Ensemble(4, PATTERNS);

    // Force all agents to have 0 entry delay so they all start immediately
    for (const agent of ensemble._agents) {
      agent._mutableState.entryDelay = 0;
    }

    // Force one agent to be silent
    ensemble._agents[2]._mutableState.status = 'silent';

    const events = ensemble.tick();
    const performerIds = events.map(e => e.performerId);
    // Agent 2 should not appear in events
    expect(performerIds).not.toContain(2);
  });
});

// ---------------------------------------------------------------------------
// Band enforcement
// ---------------------------------------------------------------------------

describe('Band enforcement', () => {
  it('prevents agent far ahead from advancing', () => {
    const agentState: AgentState = {
      id: 0,
      patternIndex: 10,
      noteIndex: 0,
      repetitionsRemaining: 0,
      totalRepetitions: 2,
      status: 'playing',
      beatsSilent: 0,
      beatsSinceLastDropout: 100,
      beatsInCurrentNote: 0,
      personality: makePersonality(),
      entryDelay: 0,
    };

    const snapshot = makeSnapshot({
      performers: Object.freeze([
        Object.freeze({ id: 0, patternIndex: 10, status: 'playing' as const }),
        Object.freeze({ id: 1, patternIndex: 7, status: 'playing' as const }),
        Object.freeze({ id: 2, patternIndex: 7, status: 'playing' as const }),
      ]),
      minPatternIndex: 7,
      maxPatternIndex: 10,
      density: 1.0,
      totalPerformers: 3,
    });

    const result = enforceBand(agentState, 'advance', snapshot);
    expect(result.decision).toBe('repeat');
  });

  it('forces agent far behind to jump forward', () => {
    const agentState: AgentState = {
      id: 0,
      patternIndex: 3,
      noteIndex: 0,
      repetitionsRemaining: 0,
      totalRepetitions: 2,
      status: 'playing',
      beatsSilent: 0,
      beatsSinceLastDropout: 100,
      beatsInCurrentNote: 0,
      personality: makePersonality(),
      entryDelay: 0,
    };

    const snapshot = makeSnapshot({
      performers: Object.freeze([
        Object.freeze({ id: 0, patternIndex: 3, status: 'playing' as const }),
        Object.freeze({ id: 1, patternIndex: 10, status: 'playing' as const }),
        Object.freeze({ id: 2, patternIndex: 10, status: 'playing' as const }),
      ]),
      minPatternIndex: 3,
      maxPatternIndex: 10,
      density: 1.0,
      totalPerformers: 3,
    });

    const result = enforceBand(agentState, 'repeat', snapshot);
    expect(result.decision).toBe('advance');
    expect(result.jumpTo).toBeGreaterThanOrEqual(agentState.patternIndex);
  });
});

// ---------------------------------------------------------------------------
// Dropout and rejoin
// ---------------------------------------------------------------------------

describe('Dropout', () => {
  it('agent returns no events after dropping out', () => {
    const agent = new PerformerAgent(0, PATTERNS, makePersonality());
    agent._mutableState.entryDelay = 0;
    agent._mutableState.status = 'silent';

    const snapshot = makeSnapshot({
      performers: Object.freeze([
        Object.freeze({ id: 0, patternIndex: 5, status: 'silent' as const }),
        Object.freeze({ id: 1, patternIndex: 5, status: 'playing' as const }),
        Object.freeze({ id: 2, patternIndex: 5, status: 'playing' as const }),
      ]),
      minPatternIndex: 5,
      maxPatternIndex: 5,
      density: 0.67,
      totalPerformers: 3,
    });

    // Force high minSilentBeats so it doesn't rejoin
    agent._mutableState.personality.minSilentBeats = 1000;
    agent._mutableState.personality.maxSilentBeats = 2000;

    const event = agent.tick(snapshot);
    expect(event).toBeNull();
    expect(agent.state.status).toBe('silent');
  });
});

describe('Rejoin', () => {
  it('agent rejoins after maxSilentBeats', () => {
    const agent = new PerformerAgent(0, PATTERNS, makePersonality({
      minSilentBeats: 4,
      maxSilentBeats: 8,
    }));
    agent._mutableState.entryDelay = 0;
    agent._mutableState.patternIndex = 5;
    agent._mutableState.status = 'silent';
    agent._mutableState.beatsSilent = 7; // One tick away from maxSilentBeats

    const snapshot = makeSnapshot({
      performers: Object.freeze([
        Object.freeze({ id: 0, patternIndex: 5, status: 'silent' as const }),
        Object.freeze({ id: 1, patternIndex: 5, status: 'playing' as const }),
      ]),
      minPatternIndex: 5,
      maxPatternIndex: 5,
      density: 0.5,
      totalPerformers: 2,
    });

    // Tick should trigger rejoin (beatsSilent becomes 8 = maxSilentBeats)
    agent.tick(snapshot);
    expect(agent.state.status).toBe('playing');
    // Should advance to next pattern on rejoin
    expect(agent.state.patternIndex).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Endgame
// ---------------------------------------------------------------------------

describe('Endgame', () => {
  it('all agents eventually become complete when at pattern 52', () => {
    const ensemble = new Ensemble(4, PATTERNS);

    // Set all agents to the final pattern with no entry delay
    for (const agent of ensemble._agents) {
      agent._mutableState.patternIndex = 52;
      agent._mutableState.entryDelay = 0;
      agent._mutableState.status = 'playing';
      agent._mutableState.repetitionsRemaining = 1;
      agent._mutableState.noteIndex = 0;
      agent._mutableState.beatsInCurrentNote = 0;
    }

    // Tick enough times -- they should all eventually complete
    for (let i = 0; i < 5000; i++) {
      ensemble.tick();
      if (ensemble.isComplete) break;
    }

    expect(ensemble.isComplete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Snapshot immutability
// ---------------------------------------------------------------------------

describe('Snapshot immutability', () => {
  it('snapshot.performers is frozen', () => {
    const ensemble = new Ensemble(4, PATTERNS);
    const snapshot = ensemble.createSnapshot();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.performers)).toBe(true);

    // Individual performer objects should also be frozen
    if (snapshot.performers.length > 0) {
      expect(Object.isFrozen(snapshot.performers[0])).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Staggered entry
// ---------------------------------------------------------------------------

describe('Staggered entry', () => {
  it('not all agents emit notes on tick 1', () => {
    const ensemble = new Ensemble(6, PATTERNS);
    // Don't reset delays -- they should be staggered from constructor

    const events = ensemble.tick();
    // With 6 agents and staggered delays (0, 2-4, 4-8, ...),
    // only the first agent (delay 0) should emit on tick 1
    const emittingPerformers = new Set(events.map(e => e.performerId));
    expect(emittingPerformers.size).toBeLessThan(6);
  });
});

// ---------------------------------------------------------------------------
// Minimum active floor
// ---------------------------------------------------------------------------

describe('Minimum active floor', () => {
  it('with 4 agents, if 2 are silent, the remaining playing agents should not all drop out', () => {
    const ensemble = new Ensemble(4, PATTERNS);

    // Set 2 agents as silent, 2 as playing
    for (const agent of ensemble._agents) {
      agent._mutableState.entryDelay = 0;
      agent._mutableState.beatsInCurrentNote = 0;
    }
    ensemble._agents[0]._mutableState.status = 'silent';
    ensemble._agents[0]._mutableState.personality.minSilentBeats = 1000;
    ensemble._agents[0]._mutableState.personality.maxSilentBeats = 2000;
    ensemble._agents[1]._mutableState.status = 'silent';
    ensemble._agents[1]._mutableState.personality.minSilentBeats = 1000;
    ensemble._agents[1]._mutableState.personality.maxSilentBeats = 2000;

    // The 2 playing agents should not both dropout
    // Run many ticks, check that at least 1 is always playing
    for (let i = 0; i < 200; i++) {
      ensemble.tick();
      const playingCount = ensemble.performerStates.filter(
        s => s.status === 'playing'
      ).length;
      // At least 1 should remain playing (minimum active floor prevents going below 2,
      // and if there are only 2 playing, neither can dropout)
      // Note: agents 0,1 are silent with very high maxSilentBeats so they won't rejoin
      expect(playingCount).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: full run
// ---------------------------------------------------------------------------

describe('Integration', () => {
  it('ensemble can be ticked 1000 times without errors', () => {
    const ensemble = new Ensemble(6, PATTERNS);

    for (let i = 0; i < 1000; i++) {
      const events = ensemble.tick();
      // events should always be an array
      expect(Array.isArray(events)).toBe(true);
    }
  });

  it('band enforcement prevents any agent from being > 3 patterns ahead of minimum', () => {
    const ensemble = new Ensemble(6, PATTERNS);

    for (let i = 0; i < 2000; i++) {
      ensemble.tick();

      const states = ensemble.performerStates;
      const playing = states.filter(s => s.status === 'playing');
      if (playing.length > 1) {
        const indices = playing.map(s => s.patternIndex);
        const min = Math.min(...indices);
        const max = Math.max(...indices);
        // Band width is 3, so max - min should be < BAND_WIDTH + 1
        // Note: due to jump mechanics, the spread should generally be within band
        // We allow +1 tolerance for the tick where enforcement happens
        expect(max - min).toBeLessThanOrEqual(4);
      }
    }
  });
});
