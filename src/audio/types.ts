export interface ScoreNote {
  midi: number;    // MIDI note number (0 for rest)
  duration: number; // duration in eighth notes
}

export interface Pattern {
  id: number;       // 1-based pattern ID
  notes: ScoreNote[];
}

export type ScoreMode = 'riley' | 'generative' | 'euclidean';

export interface EngineState {
  playing: boolean;
  currentPattern: number;
  bpm: number;
}

export type TransportCommand = 'start' | 'stop' | 'reset';

export type InstrumentType = 'synth' | 'piano' | 'marimba';

export interface PerformerState {
  id: number;
  patternIndex: number;    // 0-based
  currentPattern: number;  // 1-based (for display)
  status: 'playing' | 'silent' | 'complete';
  currentRep: number;      // 1-based current repetition (0 when silent/complete)
  totalReps: number;       // total repetitions for current pattern (0 when silent/complete)
  instrument: InstrumentType;
}

export type { VelocityConfig } from '../score/velocity.ts';

export interface EnsembleEngineState {
  playing: boolean;
  bpm: number;
  performers: PerformerState[];
  ensembleComplete: boolean;
  totalPatterns: number;
  scoreMode: ScoreMode;
  pulseEnabled: boolean;
  performerCount: number;
  humanizationEnabled: boolean;
  humanizationIntensity: 'subtle' | 'moderate' | 'expressive';
  hasRecording: boolean;
  seed: number;
}
