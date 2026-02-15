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
import { Ensemble } from '../score/ensemble.ts';
import { PATTERNS } from '../score/patterns.ts';
import { getPatternsForMode } from '../score/score-modes.ts';

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

  /**
   * Initialize the audio subsystem: create AudioContext, load worklet module,
   * create voice pool, ensemble, and scheduler.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.audioContext = new AudioContext();
    await this.audioContext.audioWorklet.addModule('/synth-processor.js');

    this.ensemble = new Ensemble(this.initialPerformerCount, this.currentPatterns, this.currentMode, this.velocityConfig);
    this.voicePool = new VoicePool(this.audioContext, this.initialPerformerCount * 2);

    // Initialize sampled instruments (loads from CDN)
    this.samplePlayer = new SamplePlayer(this.audioContext);
    await this.samplePlayer.initialize();

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

    // Apply any callback that was set before initialization
    if (this.pendingOnStateChange) {
      this.scheduler.onStateChange = this.pendingOnStateChange;
      this.pendingOnStateChange = null;
    }

    this.initialized = true;
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
    // Fire state change so UI updates
    this.scheduler?.fireStateChange();
    return id;
  }

  /** Remove a performer by id. Returns false if not initialized or performer not found. */
  removePerformer(id: number): boolean {
    if (!this.initialized || !this.ensemble) return false;
    const result = this.ensemble.removeAgent(id);
    if (result) {
      // Voice pool does NOT shrink (excess voices stay available -- avoids glitches)
      this.scheduler?.fireStateChange();
    }
    return result;
  }

  /** Get current performer count. */
  get performerCount(): number {
    return this.ensemble?.agentCount ?? this.initialPerformerCount;
  }

  /** Set initial performer count (before playback starts). No-op if already initialized. */
  setPerformerCount(count: number): void {
    if (this.initialized) return;
    this.initialPerformerCount = Math.max(2, Math.min(16, count));
  }

  /** Toggle the eighth-note high C pulse. Returns new enabled state. */
  togglePulse(): boolean {
    return this.scheduler?.togglePulse() ?? false;
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

  /** Get current ensemble engine state. */
  getState(): EnsembleEngineState {
    return this.scheduler?.getState() ?? {
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
    };
  }

  /**
   * Switch score mode. Generates new patterns, rebuilds Ensemble and Scheduler.
   * Does NOT auto-restart playback -- user must click Start.
   */
  setScoreMode(mode: ScoreMode): void {
    this.currentMode = mode;
    this.currentPatterns = getPatternsForMode(mode);

    if (this.initialized) {
      // Preserve callback before tearing down old scheduler
      const callback = this.scheduler?.onStateChange ?? this.pendingOnStateChange;

      // Fully dispose old scheduler (clears tick timer + release timers)
      this.scheduler?.reset();
      this.voicePool?.stopAll();

      // Rebuild ensemble and scheduler with new patterns
      this.ensemble = new Ensemble(this.performerCount, this.currentPatterns, mode, this.velocityConfig);
      this.scheduler = new Scheduler(
        this.audioContext!,
        this.voicePool!,
        this.ensemble,
        this.samplePlayer!,
        this.pulseGenerator!,
      );
      this.scheduler.velocityConfigRef = { current: this.velocityConfig };

      // Reconnect callback and fire state change
      if (callback) {
        this.scheduler.onStateChange = callback;
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

  /** Set state change callback. Passes through to scheduler, or stores for later. */
  set onStateChange(cb: ((state: EnsembleEngineState) => void) | null) {
    if (this.scheduler) {
      this.scheduler.onStateChange = cb;
    } else {
      this.pendingOnStateChange = cb;
    }
  }

  /** Clean up all resources: stop playback, dispose voices, close context. */
  dispose(): void {
    this.scheduler?.reset();
    this.voicePool?.dispose();
    this.samplePlayer?.dispose();
    this.pulseGenerator?.dispose();
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
