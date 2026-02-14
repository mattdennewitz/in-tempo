/**
 * AudioEngine - Facade class exposing a clean API for React.
 *
 * Owns the AudioContext, loads the AudioWorklet module, creates the voice pool
 * and scheduler, and provides start/stop/reset/setBpm controls.
 *
 * Completely framework-agnostic: no React imports, no DOM access.
 */
import type { EngineState } from './types.ts';
import { VoicePool } from './voice-pool.ts';
import { Scheduler } from './scheduler.ts';
import { Performer } from '../score/performer.ts';
import { PATTERNS } from '../score/patterns.ts';

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private voicePool: VoicePool | null = null;
  private scheduler: Scheduler | null = null;
  private performer: Performer | null = null;
  private initialized: boolean = false;
  private pendingOnStateChange: ((state: EngineState) => void) | null = null;

  /**
   * Initialize the audio subsystem: create AudioContext, load worklet module,
   * create voice pool, performer, and scheduler.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.audioContext = new AudioContext();
    await this.audioContext.audioWorklet.addModule('/synth-processor.js');

    this.voicePool = new VoicePool(this.audioContext, 4);
    this.performer = new Performer(PATTERNS);
    this.scheduler = new Scheduler(this.audioContext, this.voicePool, this.performer);

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

  /** Stop playback. Lets current note ring out. */
  stop(): void {
    this.scheduler?.stop();
  }

  /** Stop playback, silence all voices, and reset performer to pattern 1. */
  reset(): void {
    this.scheduler?.reset();
  }

  /** Set BPM (clamped to 100-180). Takes effect on next note. */
  setBpm(bpm: number): void {
    this.scheduler?.setBpm(bpm);
  }

  /** Get current engine state (playing, currentPattern, bpm). */
  getState(): EngineState {
    return this.scheduler?.getState() ?? { playing: false, currentPattern: 1, bpm: 120 };
  }

  /** Set state change callback. Passes through to scheduler, or stores for later. */
  set onStateChange(cb: ((state: EngineState) => void) | null) {
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
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.voicePool = null;
    this.scheduler = null;
    this.performer = null;
    this.initialized = false;
  }
}
