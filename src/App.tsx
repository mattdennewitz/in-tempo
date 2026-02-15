import { useRef, useState, useEffect, useCallback } from 'react';
import { AudioEngine } from './audio/engine.ts';
import type { PerformerState, ScoreMode } from './audio/types.ts';
import { ScoreModeSelector } from './components/ScoreModeSelector.tsx';
import { Transport } from './components/Transport.tsx';
import { BpmSlider } from './components/BpmSlider.tsx';
import { PatternDisplay } from './components/PatternDisplay.tsx';
import './App.css';

function App() {
  const engineRef = useRef<AudioEngine>(new AudioEngine());

  const [playing, setPlaying] = useState(false);
  const [performers, setPerformers] = useState<PerformerState[]>([]);
  const [ensembleComplete, setEnsembleComplete] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [scoreMode, setScoreMode] = useState<ScoreMode>('riley');
  const [totalPatterns, setTotalPatterns] = useState(53);

  useEffect(() => {
    const engine = engineRef.current;
    engine.onStateChange = (state) => {
      setPlaying(state.playing);
      setPerformers(state.performers);
      setEnsembleComplete(state.ensembleComplete);
      setBpm(state.bpm);
      setScoreMode(state.scoreMode);
      setTotalPatterns(state.totalPatterns);
    };
    return () => {
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
        currentMode={scoreMode}
        onChange={handleModeChange}
      />
      <PatternDisplay
        performers={performers}
        playing={playing}
        ensembleComplete={ensembleComplete}
        totalPatterns={totalPatterns}
        scoreMode={scoreMode}
      />
      <Transport
        playing={playing}
        onStart={handleStart}
        onStop={handleStop}
        onReset={handleReset}
      />
      <BpmSlider
        bpm={bpm}
        onChange={handleBpmChange}
      />
    </div>
  );
}

export default App;
