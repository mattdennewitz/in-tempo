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
