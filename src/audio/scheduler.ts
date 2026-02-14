/**
 * Scheduler - Lookahead scheduler using the Chris Wilson "Two Clocks" pattern.
 *
 * A setTimeout loop on the main thread checks AudioContext.currentTime and
 * schedules upcoming notes within a lookahead window. Audio events execute
 * with sample-accurate timing on the audio thread via AudioWorklet messages.
 *
 * Key parameters:
 * - SCHEDULE_AHEAD_TIME: 100ms lookahead window
 * - TIMER_INTERVAL: 25ms setTimeout interval (4 chances per window)
 */
import type { EngineState, ScoreNote } from './types.ts';
import type { VoicePool } from './voice-pool.ts';
import type { Performer } from '../score/performer.ts';
import { midiToFrequency } from '../score/patterns.ts';

const SCHEDULE_AHEAD_TIME = 0.1; // 100ms lookahead
const TIMER_INTERVAL = 25; // 25ms timer interval

export class Scheduler {
  private audioContext: AudioContext;
  private voicePool: VoicePool;
  private performer: Performer;

  private nextNoteTime: number = 0;
  private _bpm: number = 120;
  private _playing: boolean = false;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private lastScheduledNote: ScoreNote | null = null;
  private releaseTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();

  onStateChange: ((state: EngineState) => void) | null = null;

  constructor(audioContext: AudioContext, voicePool: VoicePool, performer: Performer) {
    this.audioContext = audioContext;
    this.voicePool = voicePool;
    this.performer = performer;
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

  /** Hard stop: silence everything and reset performer to pattern 1. */
  reset(): void {
    this.stop();
    // Clear all pending release timers
    for (const timer of this.releaseTimers.values()) {
      clearTimeout(timer);
    }
    this.releaseTimers.clear();
    this.voicePool.stopAll();
    this.performer.reset();
    this._bpm = 120;
    this.lastScheduledNote = null;
    this.fireStateChange();
  }

  /** Set BPM, clamped to 100-180 range. Takes effect on next note. */
  setBpm(bpm: number): void {
    this._bpm = Math.max(100, Math.min(180, bpm));
    this.fireStateChange();
  }

  /** Get current engine state. */
  getState(): EngineState {
    return {
      playing: this._playing,
      currentPattern: this.performer.currentPattern,
      bpm: this._bpm,
    };
  }

  private fireStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  /**
   * The lookahead tick loop. Runs via setTimeout at TIMER_INTERVAL.
   * Schedules all notes falling within the lookahead window.
   */
  private tick = (): void => {
    while (this.nextNoteTime < this.audioContext.currentTime + SCHEDULE_AHEAD_TIME) {
      this.scheduleNote(this.nextNoteTime);
      this.advanceTime();
    }
    if (this._playing) {
      this.timerId = setTimeout(this.tick, TIMER_INTERVAL);
    }
  };

  /**
   * Schedule a single note at the given AudioContext time.
   * Handles rests (midi=0), performance completion, and voice management.
   */
  private scheduleNote(time: number): void {
    const note = this.performer.nextNote();
    this.lastScheduledNote = note;

    if (note === null) {
      // Performance complete
      this.stop();
      return;
    }

    // Rest: do nothing (time still advances via advanceTime)
    if (note.midi === 0) {
      this.fireStateChange();
      return;
    }

    // Claim a voice and schedule the note
    const voice = this.voicePool.claim();
    const frequency = midiToFrequency(note.midi);

    // Cancel any pending release timer for this voice (prevents race condition
    // when voice is stolen: old timer would otherwise noteOff the new note)
    const existingTimer = this.releaseTimers.get(voice.index);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
      this.releaseTimers.delete(voice.index);
    }

    voice.node.port.postMessage({ type: 'noteOn', frequency });

    // Calculate note end time and schedule release
    const noteDurationSeconds = (note.duration * 60) / (this._bpm * 2);
    const noteEndTime = time + noteDurationSeconds;
    const delayMs = Math.max(0, (noteEndTime - this.audioContext.currentTime) * 1000);

    const releaseTimer = setTimeout(() => {
      voice.node.port.postMessage({ type: 'noteOff' });
      this.voicePool.release(voice.index);
      this.releaseTimers.delete(voice.index);
    }, delayMs);

    this.releaseTimers.set(voice.index, releaseTimer);
    this.fireStateChange();
  }

  /**
   * Advance nextNoteTime by the duration of the last scheduled note.
   * Duration is in eighth notes; BPM is in quarter notes per minute.
   */
  private advanceTime(): void {
    const note = this.lastScheduledNote;
    const duration = note ? note.duration : 1;
    // eighth-note duration: (duration * 60) / (bpm * 2)
    // because bpm = quarter notes/min, and eighth = half a quarter
    const secondsPerEighth = 60 / (this._bpm * 2);
    this.nextNoteTime += duration * secondsPerEighth;
  }
}
