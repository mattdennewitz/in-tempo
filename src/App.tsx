import { useRef, useState, useEffect, useCallback } from 'react';
import { AudioEngine } from './audio/engine.ts';
import type { PerformerState } from './audio/types.ts';
import { TOTAL_PATTERNS } from './score/patterns.ts';
import { Transport } from './components/Transport.tsx';
import { BpmSlider } from './components/BpmSlider.tsx';
import { PatternDisplay } from './components/PatternDisplay.tsx';
import { ScoreModeSelector } from './components/ScoreModeSelector.tsx';
import { PerformerControls } from './components/PerformerControls.tsx';
import './App.css';

function App() {
  const engineRef = useRef<AudioEngine>(new AudioEngine());

  const [playing, setPlaying] = useState(false);
  const [performers, setPerformers] = useState<PerformerState[]>([]);
  const [ensembleComplete, setEnsembleComplete] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [performerCount, setPerformerCount] = useState(8);

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
    if (playing) {
      engineRef.current.addPerformer();
    } else {
      setPerformerCount(prev => {
        const next = Math.min(16, prev + 1);
        engineRef.current.setPerformerCount(next);
        return next;
      });
    }
  }, [playing]);

  const handleRemovePerformer = useCallback((id: number) => {
    if (playing) {
      engineRef.current.removePerformer(id);
    } else {
      setPerformerCount(prev => {
        const next = Math.max(2, prev - 1);
        engineRef.current.setPerformerCount(next);
        return next;
      });
    }
  }, [playing]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
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
      <PerformerControls
        onAdd={handleAddPerformer}
        onRemove={handleRemovePerformer}
        performers={performers}
        disabled={false}
        count={playing ? undefined : performerCount}
      />
      <BpmSlider
        bpm={bpm}
        onChange={handleBpmChange}
      />
      <ScoreModeSelector disabled={playing} />
    </div>
  );
}

export default App;
