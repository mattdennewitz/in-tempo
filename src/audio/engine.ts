/**
 * AudioEngine - Facade class exposing a clean API for React.
 *
 * Owns the AudioContext, loads the AudioWorklet module, creates the voice pool,
 * ensemble, and scheduler, and provides start/stop/reset/setBpm controls.
 *
 * Completely framework-agnostic: no React imports, no DOM access.
 */
import type { EnsembleEngineState, ScoreMode, Pattern, VelocityConfig } from './types.ts';
import { VoicePool } from './voice-pool.ts';
import { Scheduler } from './scheduler.ts';
import { SamplePlayer } from './sampler.ts';
import { PulseGenerator } from './pulse.ts';
import { MidiRecorder } from './midi-recorder.ts';
import { exportToMidi, downloadMidi } from './midi-exporter.ts';
import { Ensemble } from '../score/ensemble.ts';
import { PATTERNS } from '../score/patterns.ts';
import { getPatternsForMode } from '../score/score-modes.ts';
import { SeededRng } from '../score/rng.ts';
import { computePanPositions, createPerformerPanNode } from './panner.ts';

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private voicePool: VoicePool | null = null;
  private scheduler: Scheduler | null = null;
  private ensemble: Ensemble | null = null;
  private samplePlayer: SamplePlayer | null = null;
  private pulseGenerator: PulseGenerator | null = null;
  private initialized: boolean = false;
  private pendingOnStateChange: ((state: EnsembleEngineState) => void) | null = null;
  private initialPerformerCount = 4;
  private currentMode: ScoreMode = 'riley';
  private currentPatterns: Pattern[] = PATTERNS;
  private velocityConfig: VelocityConfig = { enabled: true, intensity: 'moderate' };
  private midiRecorder: MidiRecorder = new MidiRecorder();
  private currentSeed: number = 0;
  private _advanceWeight: number = 0.3;

  // Stereo spread infrastructure
  private performerPanNodes: Map<number, StereoPannerNode> = new Map();
  private performerPanValues: Map<number, number> = new Map();
  private samplePanNodes: StereoPannerNode[] = []; // [left, center, right] for disposal

  /** Set seed for next performance start. 0 means auto-generate. */
  setSeed(seed: number): void {
    this.currentSeed = seed;
  }

  /** Get current seed value. */
  get seed(): number {
    return this.currentSeed;
  }

  /**
   * Initialize the audio subsystem: create AudioContext, load worklet module,
   * create voice pool, ensemble, and scheduler.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.audioContext = new AudioContext();
    await this.audioContext.audioWorklet.addModule('/synth-processor.js');

    // Generate seed if not set, create RNG for deterministic performance
    if (this.currentSeed === 0) {
      this.currentSeed = Date.now() & 0xFFFFFFFF;
    }
    const rng = new SeededRng(this.currentSeed);
    this.currentPatterns = getPatternsForMode(this.currentMode, rng);

    this.ensemble = new Ensemble(this.initialPerformerCount, this.currentPatterns, this.currentMode, this.velocityConfig, rng);
    this.voicePool = new VoicePool(this.audioContext, this.initialPerformerCount * 2);

    // Compute pan positions AFTER Ensemble (preserves existing RNG sequence)
    this.setupPanNodes(this.initialPerformerCount, rng);

    // Initialize sampled instruments with per-group pan routing
    this.samplePlayer = new SamplePlayer(this.audioContext);
    await this.samplePlayer.initialize({
      left: this.samplePanNodes[0],
      center: this.samplePanNodes[1],
      right: this.samplePanNodes[2],
    });

    // Initialize pulse generator
    this.pulseGenerator = new PulseGenerator(this.audioContext);

    this.scheduler = new Scheduler(
      this.audioContext,
      this.voicePool,
      this.ensemble,
      this.samplePlayer,
      this.pulseGenerator,
    );
    this.scheduler.velocityConfigRef = { current: this.velocityConfig };
    this.scheduler.midiRecorder = this.midiRecorder;
    this.scheduler.performerPanNodes = this.performerPanNodes;
    this.scheduler.performerPanValues = this.performerPanValues;

    // Apply any callback that was set before initialization (wrap to overlay seed)
    if (this.pendingOnStateChange) {
      const cb = this.pendingOnStateChange;
      this.scheduler.onStateChange = (state) => {
        state.seed = this.currentSeed;
        cb(state);
      };
    }

    this.initialized = true;
  }

  /**
   * Set up per-performer StereoPannerNodes and per-group sample pan nodes.
   * Must be called AFTER Ensemble creation to preserve RNG sequence.
   */
  private setupPanNodes(count: number, rng: SeededRng): void {
    const ctx = this.audioContext!;

    // Dispose old pan nodes
    this.disposePanNodes();

    // Compute deterministic pan positions
    const panPositions = computePanPositions(count, rng);

    // Create per-performer pan nodes
    for (let i = 0; i < count; i++) {
      const panNode = createPerformerPanNode(ctx, panPositions[i], ctx.destination);
      this.performerPanNodes.set(i, panNode);
      this.performerPanValues.set(i, panPositions[i]);
    }

    // Create 3 pan nodes for per-group sampled instrument routing (left/center/right)
    const sampleGain = ctx.createGain();
    sampleGain.gain.value = 0.6;
    sampleGain.connect(ctx.destination);

    const leftPan = createPerformerPanNode(ctx, -0.67, sampleGain);
    const centerPan = createPerformerPanNode(ctx, 0, sampleGain);
    const rightPan = createPerformerPanNode(ctx, 0.67, sampleGain);
    this.samplePanNodes = [leftPan, centerPan, rightPan];
  }

  /**
   * Disconnect and clear all pan nodes.
   */
  private disposePanNodes(): void {
    for (const node of this.performerPanNodes.values()) {
      node.disconnect();
    }
    this.performerPanNodes.clear();
    this.performerPanValues.clear();

    for (const node of this.samplePanNodes) {
      node.disconnect();
    }
    this.samplePanNodes = [];
  }

  /**
   * Start playback. Initializes audio on first call.
   * Handles browser autoplay policy by resuming suspended AudioContext.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Handle autoplay policy: resume if suspended (must be from user gesture)
    if (this.audioContext!.state === 'suspended') {
      await this.audioContext!.resume();
    }

    this.scheduler!.start();
  }

  /** Stop playback. Lets current notes ring out. */
  stop(): void {
    this.scheduler?.stop();
  }

  /** Stop playback, silence all voices, and reset ensemble to initial state. */
  reset(): void {
    this.scheduler?.reset();
    this.midiRecorder.clear();
    this.currentSeed = 0;
  }

  /** Set BPM (clamped to 100-180). Takes effect on next beat. */
  setBpm(bpm: number): void {
    this.scheduler?.setBpm(bpm);
  }

  /** Add a new performer during playback. Returns the new performer's id, or null if not initialized. */
  addPerformer(): number | null {
    if (!this.initialized || !this.ensemble || !this.voicePool) return null;
    const id = this.ensemble.addAgent();
    this.voicePool.resize(this.ensemble.agentCount * 2);

    // Assign pan position filling the largest gap among existing positions
    const existingPans = Array.from(this.performerPanValues.values()).sort((a, b) => a - b);
    const newPan = this.findLargestGapMidpoint(existingPans);
    const panNode = createPerformerPanNode(this.audioContext!, newPan, this.audioContext!.destination);
    this.performerPanNodes.set(id, panNode);
    this.performerPanValues.set(id, newPan);

    // Update scheduler references
    if (this.scheduler) {
      this.scheduler.performerPanNodes = this.performerPanNodes;
      this.scheduler.performerPanValues = this.performerPanValues;
    }

    // Fire state change so UI updates
    this.scheduler?.fireStateChange();
    return id;
  }

  /**
   * Find the midpoint of the largest gap in the stereo field.
   * Includes implicit boundaries at -1 and +1.
   */
  private findLargestGapMidpoint(sortedPans: number[]): number {
    if (sortedPans.length === 0) return 0;

    let maxGap = 0;
    let gapMid = 0;

    // Check gap from -1 to first position
    const leftGap = (sortedPans[0] - (-1));
    if (leftGap > maxGap) {
      maxGap = leftGap;
      gapMid = -1 + leftGap / 2;
    }

    // Check gaps between adjacent positions
    for (let i = 0; i < sortedPans.length - 1; i++) {
      const gap = sortedPans[i + 1] - sortedPans[i];
      if (gap > maxGap) {
        maxGap = gap;
        gapMid = sortedPans[i] + gap / 2;
      }
    }

    // Check gap from last position to +1
    const rightGap = 1 - sortedPans[sortedPans.length - 1];
    if (rightGap > maxGap) {
      maxGap = rightGap;
      gapMid = sortedPans[sortedPans.length - 1] + rightGap / 2;
    }

    return parseFloat(gapMid.toFixed(4));
  }

  /** Remove a performer by id. Returns false if not initialized or performer not found. */
  removePerformer(id: number): boolean {
    if (!this.initialized || !this.ensemble) return false;
    const result = this.ensemble.removeAgent(id);
    if (result) {
      // Disconnect and remove the performer's pan node
      const panNode = this.performerPanNodes.get(id);
      if (panNode) {
        panNode.disconnect();
        this.performerPanNodes.delete(id);
        this.performerPanValues.delete(id);
      }

      // Update scheduler references
      if (this.scheduler) {
        this.scheduler.performerPanNodes = this.performerPanNodes;
        this.scheduler.performerPanValues = this.performerPanValues;
      }

      // Voice pool does NOT shrink (excess voices stay available -- avoids glitches)
      this.scheduler?.fireStateChange();
    }
    return result;
  }

  /** Get current performer count. */
  get performerCount(): number {
    return this.ensemble?.agentCount ?? this.initialPerformerCount;
  }

  /** Set performer count. Before first start, sets initial count. After init, rebuilds ensemble on next start. */
  setPerformerCount(count: number): void {
    this.initialPerformerCount = Math.max(2, Math.min(16, count));
    if (this.initialized && !this.getState().playing) {
      // Rebuild ensemble with new count so next start() uses it
      const callback = this.pendingOnStateChange;
      this.scheduler?.reset();
      this.voicePool?.stopAll();
      this.voicePool?.resize(this.initialPerformerCount * 2);

      // Create seeded RNG for deterministic rebuild
      if (this.currentSeed === 0) {
        this.currentSeed = Date.now() & 0xFFFFFFFF;
      }
      const rng = new SeededRng(this.currentSeed);
      this.currentPatterns = getPatternsForMode(this.currentMode, rng);
      this.ensemble = new Ensemble(this.initialPerformerCount, this.currentPatterns, this.currentMode, this.velocityConfig, rng);

      // Recompute pan positions AFTER Ensemble
      this.setupPanNodes(this.initialPerformerCount, rng);

      // Reinitialize sampled instruments with new pan groups
      this.samplePlayer?.dispose();
      this.samplePlayer = new SamplePlayer(this.audioContext!);
      this.samplePlayer.initialize({
        left: this.samplePanNodes[0],
        center: this.samplePanNodes[1],
        right: this.samplePanNodes[2],
      });

      this.scheduler = new Scheduler(
        this.audioContext!,
        this.voicePool!,
        this.ensemble,
        this.samplePlayer!,
        this.pulseGenerator!,
      );
      this.scheduler.velocityConfigRef = { current: this.velocityConfig };
      this.scheduler.midiRecorder = this.midiRecorder;
      this.scheduler.performerPanNodes = this.performerPanNodes;
      this.scheduler.performerPanValues = this.performerPanValues;
      if (callback) {
        this.scheduler.onStateChange = (state) => {
          state.seed = this.currentSeed;
          callback(state);
        };
      }
      this.scheduler.fireStateChange();
    }
  }

  /** Toggle the eighth-note high C pulse. Returns new enabled state. */
  togglePulse(): boolean {
    return this.scheduler?.togglePulse() ?? false;
  }

  /** Export recorded events as a MIDI file and trigger browser download. */
  exportMidi(): void {
    const events = this.midiRecorder.getEvents();
    if (events.length === 0) return;

    const bpm = this.scheduler?.getState().bpm ?? 120;
    const data = exportToMidi(events, bpm);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const filename = `intempo-${this.currentMode}-${bpm}bpm-${timestamp}.mid`;
    downloadMidi(data, filename);
  }

  /** Whether any note events have been recorded (for UI enable/disable). */
  get hasRecording(): boolean {
    return this.midiRecorder.eventCount > 0;
  }

  /** Enable or disable velocity humanization. */
  setHumanization(enabled: boolean): void {
    this.velocityConfig = { ...this.velocityConfig, enabled };
    this.ensemble?.setVelocityConfig(this.velocityConfig);
    if (this.scheduler) {
      this.scheduler.velocityConfigRef = { current: this.velocityConfig };
      this.scheduler.fireStateChange();
    }
  }

  /** Set humanization intensity level. */
  setHumanizationIntensity(intensity: 'subtle' | 'moderate' | 'expressive'): void {
    this.velocityConfig = { ...this.velocityConfig, intensity };
    this.ensemble?.setVelocityConfig(this.velocityConfig);
    if (this.scheduler) {
      this.scheduler.velocityConfigRef = { current: this.velocityConfig };
      this.scheduler.fireStateChange();
    }
  }

  /** Set the base advance weight (probability of changing patterns). */
  setAdvanceWeight(weight: number): void {
    this._advanceWeight = weight;
    this.ensemble?.setAdvanceWeight(weight);
    if (this.scheduler) {
      this.scheduler.fireStateChange();
    } else if (this.pendingOnStateChange) {
      this.pendingOnStateChange(this.getState());
    }
  }

  /** Get current ensemble engine state. */
  getState(): EnsembleEngineState {
    const base = this.scheduler?.getState() ?? {
      playing: false,
      bpm: 120,
      performers: [],
      ensembleComplete: false,
      totalPatterns: this.currentPatterns.length,
      scoreMode: this.currentMode,
      pulseEnabled: false,
      performerCount: this.initialPerformerCount,
      humanizationEnabled: this.velocityConfig.enabled,
      humanizationIntensity: this.velocityConfig.intensity,
      hasRecording: false,
      seed: 0,
      advanceWeight: this._advanceWeight,
    };
    // Engine owns the seed and advanceWeight -- overlay on scheduler state
    base.seed = this.currentSeed;
    base.advanceWeight = this._advanceWeight;
    return base;
  }

  /**
   * Switch score mode. Generates new patterns, rebuilds Ensemble and Scheduler.
   * Does NOT auto-restart playback -- user must click Start.
   */
  setScoreMode(mode: ScoreMode): void {
    this.currentMode = mode;

    // Create seeded RNG for deterministic pattern generation
    if (this.currentSeed === 0) {
      this.currentSeed = Date.now() & 0xFFFFFFFF;
    }
    const rng = new SeededRng(this.currentSeed);
    this.currentPatterns = getPatternsForMode(mode, rng);

    if (this.initialized) {
      // Use raw callback (pendingOnStateChange), not the wrapped scheduler version
      const callback = this.pendingOnStateChange;

      // Fully dispose old scheduler (clears tick timer + release timers)
      this.scheduler?.reset();
      this.voicePool?.stopAll();

      // Rebuild ensemble and scheduler with new patterns
      this.ensemble = new Ensemble(this.performerCount, this.currentPatterns, mode, this.velocityConfig, rng);

      // Recompute pan positions AFTER Ensemble
      this.setupPanNodes(this.performerCount, rng);

      // Reinitialize sampled instruments with new pan groups
      this.samplePlayer?.dispose();
      this.samplePlayer = new SamplePlayer(this.audioContext!);
      this.samplePlayer.initialize({
        left: this.samplePanNodes[0],
        center: this.samplePanNodes[1],
        right: this.samplePanNodes[2],
      });

      this.scheduler = new Scheduler(
        this.audioContext!,
        this.voicePool!,
        this.ensemble,
        this.samplePlayer,
        this.pulseGenerator!,
      );
      this.scheduler.velocityConfigRef = { current: this.velocityConfig };
      this.scheduler.midiRecorder = this.midiRecorder;
      this.scheduler.performerPanNodes = this.performerPanNodes;
      this.scheduler.performerPanValues = this.performerPanValues;

      // Reconnect callback (wrapped to overlay seed) and fire state change
      if (callback) {
        this.scheduler.onStateChange = (state) => {
          state.seed = this.currentSeed;
          callback(state);
        };
        callback(this.getState());
      }
    } else if (this.pendingOnStateChange) {
      // Not yet initialized — fire fallback state so UI reflects new mode/pattern count
      this.pendingOnStateChange(this.getState());
    }
  }

  /** Get current score mode. */
  get scoreMode(): ScoreMode {
    return this.currentMode;
  }

  /** Get current pattern count. */
  get patternCount(): number {
    return this.currentPatterns.length;
  }

  /** Set state change callback. Wraps callback to overlay Engine-owned seed before reaching React. */
  set onStateChange(cb: ((state: EnsembleEngineState) => void) | null) {
    this.pendingOnStateChange = cb;
    if (this.scheduler) {
      this.scheduler.onStateChange = cb ? (state) => {
        state.seed = this.currentSeed;
        cb(state);
      } : null;
    }
  }

  /** Clean up all resources: stop playback, dispose voices, close context. */
  dispose(): void {
    this.scheduler?.reset();
    this.midiRecorder.clear();
    this.voicePool?.dispose();
    this.samplePlayer?.dispose();
    this.pulseGenerator?.dispose();
    this.disposePanNodes();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.voicePool = null;
    this.scheduler = null;
    this.ensemble = null;
    this.samplePlayer = null;
    this.pulseGenerator = null;
    this.pendingOnStateChange = null;
    this.initialized = false;
  }
}
