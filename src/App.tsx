import { useRef, useState, useEffect, useCallback } from 'react';
import { AudioEngine } from './audio/engine.ts';
import type { EnsembleEngineState, ScoreMode } from './audio/types.ts';
import { ScoreModeSelector } from './components/ScoreModeSelector.tsx';
import { Transport } from './components/Transport.tsx';
import { BpmSlider } from './components/BpmSlider.tsx';
import { PatternDisplay } from './components/PatternDisplay.tsx';
import { PerformerControls } from './components/PerformerControls.tsx';
import { HumanizationToggle } from './components/HumanizationToggle.tsx';
import { ExportButton } from './components/ExportButton.tsx';
import { SeedDisplay } from './components/SeedDisplay.tsx';
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
  hasRecording: false,
  seed: 0,
};

const VALID_MODES: ScoreMode[] = ['riley', 'generative', 'euclidean'];

function parsePerformanceHash(): { seed: number; mode: ScoreMode; bpm: number; count: number } | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const seed = params.get('seed');
  const mode = params.get('mode');
  const bpm = params.get('bpm');
  const count = params.get('count');
  if (!seed || !mode || !bpm || !count) return null;
  if (!VALID_MODES.includes(mode as ScoreMode)) return null;
  const parsedSeed = parseInt(seed, 10);
  const parsedBpm = parseInt(bpm, 10);
  const parsedCount = parseInt(count, 10);
  if (isNaN(parsedSeed) || isNaN(parsedBpm) || isNaN(parsedCount)) return null;
  return { seed: parsedSeed, mode: mode as ScoreMode, bpm: parsedBpm, count: parsedCount };
}

function App() {
  const engineRef = useRef<AudioEngine>(new AudioEngine());

  const [engineState, setEngineState] = useState<EnsembleEngineState>(INITIAL_STATE);

  useEffect(() => {
    const engine = engineRef.current;
    engine.onStateChange = setEngineState;

    // Parse URL hash on mount to pre-configure performance
    const config = parsePerformanceHash();
    if (config) {
      engine.setSeed(config.seed);
      engine.setScoreMode(config.mode);
      engine.setBpm(config.bpm);
      engine.setPerformerCount(config.count);
      setEngineState(prev => ({
        ...prev,
        seed: config.seed,
        scoreMode: config.mode,
        bpm: config.bpm,
        performerCount: config.count,
      }));
    }

    return () => {
      engine.onStateChange = null;
      engine.dispose();
    };
  }, []);

  const handleStart = useCallback(async () => {
    await engineRef.current.start();

    // Update URL hash with current performance config
    const state = engineRef.current.getState();
    const params = new URLSearchParams({
      seed: state.seed.toString(),
      mode: state.scoreMode,
      bpm: state.bpm.toString(),
      count: state.performerCount.toString(),
    });
    window.location.hash = params.toString();
  }, []);

  const handleStop = useCallback(() => {
    engineRef.current.stop();
  }, []);

  const handleReset = useCallback(() => {
    engineRef.current.reset();
    // Clear URL hash on reset
    window.location.hash = '';
    setEngineState(prev => ({ ...prev, seed: 0 }));
  }, []);

  const handleBpmChange = useCallback((newBpm: number) => {
    engineRef.current.setBpm(newBpm);
  }, []);

  const handleModeChange = useCallback((mode: ScoreMode) => {
    engineRef.current.setScoreMode(mode);
  }, []);

  const handleSeedChange = useCallback((seed: number) => {
    engineRef.current.setSeed(seed);
    setEngineState(prev => ({ ...prev, seed }));
  }, []);

  const handleHumanizationToggle = useCallback(() => {
    engineRef.current.setHumanization(!engineState.humanizationEnabled);
  }, [engineState.humanizationEnabled]);

  const handleIntensityChange = useCallback((intensity: 'subtle' | 'moderate' | 'expressive') => {
    engineRef.current.setHumanizationIntensity(intensity);
  }, []);

  const handleExport = useCallback(() => {
    engineRef.current.exportMidi();
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
      <SeedDisplay
        seed={engineState.seed}
        playing={engineState.playing}
        onSeedChange={handleSeedChange}
        mode={engineState.scoreMode}
        bpm={engineState.bpm}
        performerCount={engineState.performerCount}
      />
      <ExportButton
        onExport={handleExport}
        disabled={!engineState.hasRecording}
      />
      <PerformerControls
        onAdd={handleAddPerformer}
        onRemove={handleRemovePerformer}
        performers={engineState.performers}
        disabled={false}
        count={engineState.playing ? undefined : engineState.performerCount}
      />
      <HumanizationToggle
        enabled={engineState.humanizationEnabled}
        intensity={engineState.humanizationIntensity}
        onToggle={handleHumanizationToggle}
        onIntensityChange={handleIntensityChange}
      />
      <BpmSlider
        bpm={engineState.bpm}
        onChange={handleBpmChange}
      />
    </div>
  );
}

export default App;
