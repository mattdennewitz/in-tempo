import { useRef, useState, useEffect, useCallback } from 'react';
import { Settings2 } from 'lucide-react';
import { AudioEngine } from './audio/engine.ts';
import type { EnsembleEngineState, ScoreMode } from './audio/types.ts';
import { ScoreModeSelector } from './components/ScoreModeSelector.tsx';
import { Transport } from './components/Transport.tsx';
import { BpmSlider } from './components/BpmSlider.tsx';
import { PatternDisplay } from './components/PatternDisplay.tsx';
import { ScoreOverview } from './components/ScoreOverview.tsx';
import { PerformerControls } from './components/PerformerControls.tsx';
import { HumanizationToggle } from './components/HumanizationToggle.tsx';
import { ExportButton } from './components/ExportButton.tsx';
import { SeedDisplay } from './components/SeedDisplay.tsx';
import { Button } from './components/ui/button.tsx';
import { Separator } from './components/ui/separator.tsx';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './components/ui/sheet.tsx';
import './App.css';

const INITIAL_STATE: EnsembleEngineState = {
  playing: false,
  bpm: 140,
  performers: [],
  ensembleComplete: false,
  totalPatterns: 53,
  scoreMode: 'riley',
  pulseEnabled: false,
  performerCount: 4,
  humanizationEnabled: false,
  humanizationIntensity: 'moderate',
  hasRecording: false,
  seed: 0,
  advanceWeight: 0.3,
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

  // Guard against overlapping start() calls from rapid key presses
  const startingRef = useRef(false);

  // Keyboard shortcuts for transport
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        const state = engineRef.current.getState();
        if (state.playing) {
          engineRef.current.stop();
        } else if (!startingRef.current) {
          startingRef.current = true;
          engineRef.current.start().finally(() => { startingRef.current = false; });
        }
      } else if (e.key === 'Escape') {
        const state = engineRef.current.getState();
        if (!state.playing) {
          engineRef.current.reset();
          window.location.hash = '';
          setEngineState(prev => ({ ...prev, seed: 0 }));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleStart = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
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
    } finally {
      startingRef.current = false;
    }
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

  const handleAdvanceWeightChange = useCallback((weight: number) => {
    engineRef.current.setAdvanceWeight(weight);
  }, []);

  const handleSetPerformerCount = useCallback((count: number) => {
    const clamped = Math.max(2, Math.min(16, count));
    if (engineState.playing) {
      const current = engineState.performers.filter(p => p.status !== 'complete').length;
      if (clamped > current) {
        for (let i = 0; i < clamped - current; i++) engineRef.current.addPerformer();
      } else if (clamped < current) {
        // Remove highest-id active performers first
        const active = engineState.performers
          .filter(p => p.status !== 'complete')
          .sort((a, b) => b.id - a.id);
        for (let i = 0; i < current - clamped && i < active.length; i++) {
          engineRef.current.removePerformer(active[i].id);
        }
      }
    } else {
      engineRef.current.setPerformerCount(clamped);
      setEngineState(prev => ({ ...prev, performerCount: clamped }));
    }
  }, [engineState.playing, engineState.performers]);

  const activeCount = engineState.playing
    ? engineState.performers.filter(p => p.status !== 'complete').length
    : engineState.performerCount;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b px-4 py-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Open controls" className="justify-self-start">
              <Settings2 />
              Controls
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Controls</SheetTitle>
              <SheetDescription>Configure the performance</SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4 pb-6">
              {/* Score mode */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Score Mode</label>
                <p className="text-[11px] text-muted-foreground/70 mb-1.5">Choose the composition algorithm</p>
                <ScoreModeSelector
                  currentMode={engineState.scoreMode}
                  onChange={handleModeChange}
                  disabled={engineState.playing}
                />
              </div>

              <Separator />

              {/* Tempo */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tempo</label>
                <p className="text-[11px] text-muted-foreground/70 mb-1.5">Set the performance tempo</p>
                <BpmSlider
                  bpm={engineState.bpm}
                  onChange={handleBpmChange}
                />
              </div>

              <Separator />

              {/* Performers */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Performers</label>
                <p className="text-[11px] text-muted-foreground/70 mb-1.5">Set ensemble size (2–16)</p>
                <PerformerControls
                  onCountChange={handleSetPerformerCount}
                  performers={engineState.performers}
                  disabled={false}
                  count={engineState.playing ? undefined : engineState.performerCount}
                />
              </div>

              <Separator />

              {/* Pattern advance */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Pattern Advance</label>
                <p className="text-[11px] text-muted-foreground/70 mb-1.5">Likelihood of moving to the next pattern</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={1}
                    value={Math.round(engineState.advanceWeight * 100)}
                    onChange={(e) => handleAdvanceWeightChange(Number(e.target.value) / 100)}
                    className="w-full accent-foreground"
                    aria-label="Pattern advance probability"
                  />
                  <span className="text-sm tabular-nums shrink-0 whitespace-nowrap">
                    {Math.round(engineState.advanceWeight * 100)}%
                  </span>
                </div>
              </div>

              <Separator />

              {/* Humanization */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Humanization</label>
                <p className="text-[11px] text-muted-foreground/70 mb-1.5">Add natural timing variation</p>
                <HumanizationToggle
                  enabled={engineState.humanizationEnabled}
                  intensity={engineState.humanizationIntensity}
                  onToggle={handleHumanizationToggle}
                  onIntensityChange={handleIntensityChange}
                />
              </div>

              <Separator />

              {/* Seed */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Seed</label>
                <p className="text-[11px] text-muted-foreground/70 mb-1.5">Share or replay a specific performance</p>
                <SeedDisplay
                  seed={engineState.seed}
                  playing={engineState.playing}
                  onSeedChange={handleSeedChange}
                  mode={engineState.scoreMode}
                  bpm={engineState.bpm}
                  performerCount={engineState.performerCount}
                />
              </div>

              <Separator />

              {/* Export */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Export</label>
                {engineState.hasRecording ? (
                  <>
                    <p className="text-[11px] text-muted-foreground/70 mb-1.5">Download as MIDI file</p>
                    <ExportButton onExport={handleExport} disabled={false} />
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground/70">Start a performance to record a MIDI file</p>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <Transport
          playing={engineState.playing}
          onStart={handleStart}
          onStop={handleStop}
          onReset={handleReset}
        />
        <div />
      </header>

      {/* Performer visualization */}
      <main
        aria-label="Performer visualization"
        className="flex-1 flex flex-col items-center justify-center gap-6 p-4 lg:p-8"
      >
        <PatternDisplay
          performers={engineState.performers}
          playing={engineState.playing}
          ensembleComplete={engineState.ensembleComplete}
          totalPatterns={engineState.totalPatterns}
          maxPerformers={16}
          activeCount={activeCount}
        />
        <ScoreOverview
          performers={engineState.performers}
          totalPatterns={engineState.totalPatterns}
          scoreMode={engineState.scoreMode}
          playing={engineState.playing}
        />
      </main>
    </div>
  );
}

export default App;
