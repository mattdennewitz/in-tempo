import { useRef, useState, useEffect, useCallback } from 'react';
import { AudioEngine } from './audio/engine.ts';
import type { PerformerState } from './audio/types.ts';
import { TOTAL_PATTERNS } from './score/patterns.ts';
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

  useEffect(() => {
    const engine = engineRef.current;
    engine.onStateChange = (state) => {
      setPlaying(state.playing);
      setPerformers(state.performers);
      setEnsembleComplete(state.ensembleComplete);
      setBpm(state.bpm);
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

  return (
    <div className="app">
      <PatternDisplay
        performers={performers}
        playing={playing}
        ensembleComplete={ensembleComplete}
        totalPatterns={TOTAL_PATTERNS}
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
