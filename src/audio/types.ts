export interface ScoreNote {
  midi: number;    // MIDI note number (0 for rest)
  duration: number; // duration in eighth notes
}

export interface Pattern {
  id: number;       // 1-53
  notes: ScoreNote[];
}

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
  instrument: InstrumentType;
}

export interface EnsembleEngineState {
  playing: boolean;
  bpm: number;
  performers: PerformerState[];
  ensembleComplete: boolean;
  pulseEnabled: boolean;
  performerCount: number;
}
