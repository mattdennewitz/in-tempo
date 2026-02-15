import { useRef, useState, useEffect, useCallback } from 'react';
import { AudioEngine } from './audio/engine.ts';
import type { EnsembleEngineState, ScoreMode } from './audio/types.ts';
import { ScoreModeSelector } from './components/ScoreModeSelector.tsx';
import { Transport } from './components/Transport.tsx';
import { BpmSlider } from './components/BpmSlider.tsx';
import { PatternDisplay } from './components/PatternDisplay.tsx';
import './App.css';

const INITIAL_STATE: EnsembleEngineState = {
  playing: false,
  bpm: 120,
  performers: [],
  ensembleComplete: false,
  totalPatterns: 53,
  scoreMode: 'riley',
};

function App() {
  const engineRef = useRef<AudioEngine>(new AudioEngine());

  const [engineState, setEngineState] = useState<EnsembleEngineState>(INITIAL_STATE);

  useEffect(() => {
    const engine = engineRef.current;
    engine.onStateChange = setEngineState;
    return () => {
      engine.onStateChange = null;
      engine.dispose();
    };
  }, []);

  const handleStart = useCallback(async () => {
    await engineRef.current.start();
  }, []);

  const handleStop = useCallback(() => {
    engineRef.current.stop();
  }, []);

  const handleReset = useCallback(() => {
    engineRef.current.reset();
  }, []);

  const handleBpmChange = useCallback((newBpm: number) => {
    engineRef.current.setBpm(newBpm);
  }, []);

  const handleModeChange = useCallback((mode: ScoreMode) => {
    engineRef.current.setScoreMode(mode);
  }, []);

  return (
    <div className="app">
      <ScoreModeSelector
        currentMode={engineState.scoreMode}
        onChange={handleModeChange}
      />
      <PatternDisplay
        performers={engineState.performers}
        playing={engineState.playing}
        ensembleComplete={engineState.ensembleComplete}
        totalPatterns={engineState.totalPatterns}
        scoreMode={engineState.scoreMode}
      />
      <Transport
        playing={engineState.playing}
        onStart={handleStart}
        onStop={handleStop}
        onReset={handleReset}
      />
      <BpmSlider
        bpm={engineState.bpm}
        onChange={handleBpmChange}
      />
    </div>
  );
}

export default App;
