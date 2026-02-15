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
import type { EnsembleEngineState, VelocityConfig } from './types.ts';
import type { VoicePool } from './voice-pool.ts';
import type { Ensemble } from '../score/ensemble.ts';
import type { SamplePlayer } from './sampler.ts';
import type { PulseGenerator } from './pulse.ts';
import type { MidiRecorder } from './midi-recorder.ts';
import { assignInstrument } from './sampler.ts';
import { midiToFrequency } from '../score/patterns.ts';

const SCHEDULE_AHEAD_TIME = 0.1; // 100ms lookahead
const TIMER_INTERVAL = 25; // 25ms timer interval

export class Scheduler {
  private audioContext: AudioContext;
  private voicePool: VoicePool;
  private ensemble: Ensemble;
  private samplePlayer: SamplePlayer;
  private pulseGenerator: PulseGenerator;

  private nextNoteTime: number = 0;
  private _bpm: number = 120;
  private _playing: boolean = false;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private releaseTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private beatCounter: number = 0;

  onStateChange: ((state: EnsembleEngineState) => void) | null = null;
  velocityConfigRef: { current: VelocityConfig } = { current: { enabled: true, intensity: 'moderate' } };
  midiRecorder: MidiRecorder | null = null;

  constructor(
    audioContext: AudioContext,
    voicePool: VoicePool,
    ensemble: Ensemble,
    samplePlayer: SamplePlayer,
    pulseGenerator: PulseGenerator,
  ) {
    this.audioContext = audioContext;
    this.voicePool = voicePool;
    this.ensemble = ensemble;
    this.samplePlayer = samplePlayer;
    this.pulseGenerator = pulseGenerator;
  }

  /** Start the scheduling loop. */
  start(): void {
    this.nextNoteTime = this.audioContext.currentTime;
    this.beatCounter = 0;
    this.midiRecorder?.start();
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
    this.midiRecorder?.stop(this.beatCounter);
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
    this.midiRecorder?.clear();
    this.beatCounter = 0;
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
    const vc = this.velocityConfigRef.current;
    return {
      playing: this._playing,
      bpm: this._bpm,
      performers: this.ensemble.performerStates,
      ensembleComplete: this.ensemble.isComplete,
      totalPatterns: this.ensemble.totalPatterns,
      scoreMode: this.ensemble.scoreMode,
      pulseEnabled: this.pulseGenerator.enabled,
      performerCount: this.ensemble.agentCount,
      humanizationEnabled: vc.enabled,
      humanizationIntensity: vc.intensity,
      hasRecording: (this.midiRecorder?.eventCount ?? 0) > 0,
      seed: 0, // Engine overlays actual seed value
    };
  }

  /** Fire state change callback. Public so Engine can trigger after add/remove performer. */
  fireStateChange(): void {
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
   * Toggle the pulse generator on/off. Returns the new enabled state.
   */
  togglePulse(): boolean {
    this.pulseGenerator.enabled = !this.pulseGenerator.enabled;
    this.fireStateChange();
    return this.pulseGenerator.enabled;
  }

  /**
   * Schedule one beat (eighth note). Polls the Ensemble for all performer
   * events and routes them to the appropriate instrument (synth voice pool
   * or sampled instrument).
   */
  private scheduleBeat(time: number): void {
    const events = this.ensemble.tick(this._bpm);

    // Check for ensemble completion
    if (this.ensemble.isComplete) {
      this.stop();
      return;
    }

    const secondsPerEighth = 60 / (this._bpm * 2);

    for (const event of events) {
      if (event.midi === 0) continue;

      // Apply per-note timing offset, clamped to prevent scheduling in the past
      const offsetTime = Math.max(
        this.audioContext.currentTime,
        time + event.timingOffset,
      );

      const instrument = assignInstrument(event.performerId);
      const noteDurationSeconds = event.duration * secondsPerEighth;

      if (instrument === 'synth') {
        // Route through VoicePool (AudioWorklet synth voices)
        const voice = this.voicePool.claim();
        const frequency = midiToFrequency(event.midi);

        // Cancel any pending release timer for this voice
        const existingTimer = this.releaseTimers.get(voice.index);
        if (existingTimer !== undefined) {
          clearTimeout(existingTimer);
          this.releaseTimers.delete(voice.index);
        }

        voice.node.port.postMessage({ type: 'noteOn', frequency, time: offsetTime, gain: event.velocity * 0.3 });

        // Schedule release after event.duration eighth notes (relative to offset start)
        const noteEndTime = offsetTime + noteDurationSeconds;
        const delayMs = Math.max(0, (noteEndTime - this.audioContext.currentTime) * 1000);

        const releaseTimer = setTimeout(() => {
          voice.node.port.postMessage({ type: 'noteOff' });
          this.voicePool.release(voice.index);
          this.releaseTimers.delete(voice.index);
        }, delayMs);

        this.releaseTimers.set(voice.index, releaseTimer);
      } else {
        // Route through SamplePlayer (smplr piano/marimba)
        const smplrVelocity = Math.round(event.velocity * 127);
        this.samplePlayer.play(instrument, event.midi, offsetTime, noteDurationSeconds, smplrVelocity);
      }

      // Record event for MIDI export
      if (this.midiRecorder?.isRecording) {
        this.midiRecorder.record(
          this.beatCounter,
          event.performerId,
          event.midi,
          event.duration,
          event.velocity,
        );
      }
    }

    // Schedule pulse if enabled
    if (this.pulseGenerator.enabled) {
      this.pulseGenerator.schedulePulse(time, secondsPerEighth);
    }

    this.beatCounter++;
    this.fireStateChange();
  }

  /**
   * Advance nextNoteTime by exactly one eighth note.
   */
  private advanceTime(): void {
    const secondsPerEighth = 60 / (this._bpm * 2);
    const rubatoMultiplier = this.ensemble.rubatoMultiplier;
    this.nextNoteTime += secondsPerEighth * rubatoMultiplier;
  }
}
