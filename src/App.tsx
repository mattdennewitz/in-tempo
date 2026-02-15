import { useRef, useState, useEffect, useCallback } from 'react';
import { AudioEngine } from './audio/engine.ts';
import type { PerformerState } from './audio/types.ts';
import { Transport } from './components/Transport.tsx';
import { BpmSlider } from './components/BpmSlider.tsx';
import { ScoreModeSelector } from './components/ScoreModeSelector.tsx';
import { PerformerControls } from './components/PerformerControls.tsx';
import { PerformerCanvas } from './canvas/PerformerCanvas.tsx';
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

  const handleAddPerformer = useCallback(() => {
    engineRef.current.addPerformer();
  }, []);

  const handleRemovePerformer = useCallback((id: number) => {
    engineRef.current.removePerformer(id);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">InTempo</h1>
      </header>

      <PerformerCanvas performers={performers} />

      {ensembleComplete && (
        <p style={{ color: '#E8735A', fontWeight: 500 }}>Performance Complete</p>
      )}

      <div className="controls-row">
        <Transport
          playing={playing}
          onStart={handleStart}
          onStop={handleStop}
          onReset={handleReset}
        />
        <PerformerControls
          onAdd={handleAddPerformer}
          onRemove={handleRemovePerformer}
          performers={performers}
          disabled={!playing}
        />
        <BpmSlider
          bpm={bpm}
          onChange={handleBpmChange}
        />
        <ScoreModeSelector disabled={playing} />
      </div>
    </div>
  );
}

export default App;
