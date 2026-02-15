/**
 * Scheduler - Fixed eighth-note beat clock polling the Ensemble.
 *
 * A setTimeout loop on the main thread checks AudioContext.currentTime and
 * schedules upcoming notes within a lookahead window. Each tick advances by
 * exactly one eighth note and polls the Ensemble for note events from all
 * performers.
 *
 * Key parameters:
 * - SCHEDULE_AHEAD_TIME: 100ms lookahead window
 * - TIMER_INTERVAL: 25ms setTimeout interval (4 chances per window)
 */
import type { EnsembleEngineState } from './types.ts';
import type { VoicePool } from './voice-pool.ts';
import type { Ensemble } from '../score/ensemble.ts';
import { midiToFrequency } from '../score/patterns.ts';

const SCHEDULE_AHEAD_TIME = 0.1; // 100ms lookahead
const TIMER_INTERVAL = 25; // 25ms timer interval

export class Scheduler {
  private audioContext: AudioContext;
  private voicePool: VoicePool;
  private ensemble: Ensemble;

  private nextNoteTime: number = 0;
  private _bpm: number = 120;
  private _playing: boolean = false;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private releaseTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();

  onStateChange: ((state: EnsembleEngineState) => void) | null = null;

  constructor(audioContext: AudioContext, voicePool: VoicePool, ensemble: Ensemble) {
    this.audioContext = audioContext;
    this.voicePool = voicePool;
    this.ensemble = ensemble;
  }

  /** Start the scheduling loop. */
  start(): void {
    this.nextNoteTime = this.audioContext.currentTime;
    this._playing = true;
    this.tick();
    this.fireStateChange();
  }

  /**
   * Stop playback. Lets currently sounding notes ring out via their
   * previously-scheduled release timers.
   */
  stop(): void {
    this._playing = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.fireStateChange();
  }

  /** Hard stop: silence everything and reset ensemble to initial state. */
  reset(): void {
    // Stop tick loop (suppresses its own state change since we fire below)
    this._playing = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    // Clear all pending release timers
    for (const timer of this.releaseTimers.values()) {
      clearTimeout(timer);
    }
    this.releaseTimers.clear();
    this.voicePool.stopAll();
    this.ensemble.reset();
    this._bpm = 120;
    this.fireStateChange();
  }

  /** Set BPM, clamped to 100-180 range. Takes effect on next beat. */
  setBpm(bpm: number): void {
    this._bpm = Math.max(100, Math.min(180, bpm));
    this.fireStateChange();
  }

  /** Get current ensemble engine state. */
  getState(): EnsembleEngineState {
    return {
      playing: this._playing,
      bpm: this._bpm,
      performers: this.ensemble.performerStates,
      ensembleComplete: this.ensemble.isComplete,
      totalPatterns: this.ensemble.totalPatterns,
      scoreMode: this.ensemble.scoreMode,
    };
  }

  private fireStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  /**
   * The lookahead tick loop. Runs via setTimeout at TIMER_INTERVAL.
   * Each tick advances by exactly one eighth note and polls the Ensemble.
   */
  private tick = (): void => {
    while (this.nextNoteTime < this.audioContext.currentTime + SCHEDULE_AHEAD_TIME) {
      this.scheduleBeat(this.nextNoteTime);
      this.advanceTime();
    }
    if (this._playing) {
      this.timerId = setTimeout(this.tick, TIMER_INTERVAL);
    }
  };

  /**
   * Schedule one beat (eighth note). Polls the Ensemble for all performer
   * events and schedules them via the voice pool.
   */
  private scheduleBeat(time: number): void {
    const events = this.ensemble.tick();

    // Check for ensemble completion
    if (this.ensemble.isComplete) {
      this.stop();
      return;
    }

    const secondsPerEighth = 60 / (this._bpm * 2);

    for (const event of events) {
      if (event.midi === 0) continue;

      // Claim a voice and schedule the note
      const voice = this.voicePool.claim();
      const frequency = midiToFrequency(event.midi);

      // Cancel any pending release timer for this voice
      const existingTimer = this.releaseTimers.get(voice.index);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
        this.releaseTimers.delete(voice.index);
      }

      voice.node.port.postMessage({ type: 'noteOn', frequency });

      // Schedule release after event.duration eighth notes
      const noteDurationSeconds = event.duration * secondsPerEighth;
      const noteEndTime = time + noteDurationSeconds;
      const delayMs = Math.max(0, (noteEndTime - this.audioContext.currentTime) * 1000);

      const releaseTimer = setTimeout(() => {
        voice.node.port.postMessage({ type: 'noteOff' });
        this.voicePool.release(voice.index);
        this.releaseTimers.delete(voice.index);
      }, delayMs);

      this.releaseTimers.set(voice.index, releaseTimer);
    }

    this.fireStateChange();
  }

  /**
   * Advance nextNoteTime by exactly one eighth note.
   */
  private advanceTime(): void {
    const secondsPerEighth = 60 / (this._bpm * 2);
    this.nextNoteTime += secondsPerEighth;
  }
}
