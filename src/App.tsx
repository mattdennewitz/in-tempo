import { useRef, useState, useEffect, useCallback } from 'react';
import { AudioEngine } from './audio/engine.ts';
import type { EnsembleEngineState, ScoreMode } from './audio/types.ts';
import { ScoreModeSelector } from './components/ScoreModeSelector.tsx';
import { Transport } from './components/Transport.tsx';
import { BpmSlider } from './components/BpmSlider.tsx';
import { PatternDisplay } from './components/PatternDisplay.tsx';
import { PerformerControls } from './components/PerformerControls.tsx';
import './App.css';

const INITIAL_STATE: EnsembleEngineState = {
  playing: false,
  bpm: 120,
  performers: [],
  ensembleComplete: false,
  totalPatterns: 53,
  scoreMode: 'riley',
  pulseEnabled: false,
  performerCount: 4,
  humanizationEnabled: true,
  humanizationIntensity: 'moderate',
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

  const handleAddPerformer = useCallback(() => {
    if (engineState.playing) {
      engineRef.current.addPerformer();
    } else {
      engineRef.current.setPerformerCount((engineState.performerCount ?? 8) + 1);
      setEngineState(prev => ({ ...prev, performerCount: Math.min(16, (prev.performerCount ?? 8) + 1) }));
    }
  }, [engineState.playing, engineState.performerCount]);

  const handleRemovePerformer = useCallback((id: number) => {
    if (engineState.playing) {
      engineRef.current.removePerformer(id);
    } else {
      engineRef.current.setPerformerCount((engineState.performerCount ?? 8) - 1);
      setEngineState(prev => ({ ...prev, performerCount: Math.max(2, (prev.performerCount ?? 8) - 1) }));
    }
  }, [engineState.playing, engineState.performerCount]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <ScoreModeSelector
        currentMode={engineState.scoreMode}
        onChange={handleModeChange}
        disabled={engineState.playing}
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
      <PerformerControls
        onAdd={handleAddPerformer}
        onRemove={handleRemovePerformer}
        performers={engineState.performers}
        disabled={false}
        count={engineState.playing ? undefined : engineState.performerCount}
      />
      <BpmSlider
        bpm={engineState.bpm}
        onChange={handleBpmChange}
      />
    </div>
  );
}

export default App;
