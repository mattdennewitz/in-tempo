/**
 * MidiRecorder - Passive event recorder that captures note events during playback.
 *
 * Records every note event with an integer beat index (eighth-note count from
 * playback start). The Scheduler calls record() on every note event and the
 * Engine reads back events for MIDI export.
 *
 * Ghost-note trimming: the lookahead scheduler may schedule notes slightly
 * ahead of the actual stop point. stop(currentBeat) filters these out.
 */

export interface RecordedEvent {
  /** Integer eighth-note count from playback start */
  beatIndex: number;
  /** Performer ID (0-based) */
  performerId: number;
  /** MIDI note number */
  midi: number;
  /** Duration in eighth notes */
  duration: number;
  /** Velocity in InTempo range (0.3-1.0) */
  velocity: number;
}

export class MidiRecorder {
  private events: RecordedEvent[] = [];
  private _isRecording: boolean = false;
  private _stopBeat: number | null = null;

  /** Start recording. Clears any previous events. */
  start(): void {
    this.events = [];
    this._isRecording = true;
    this._stopBeat = null;
  }

  /** Record a note event. Only records if currently recording. */
  record(
    beatIndex: number,
    performerId: number,
    midi: number,
    duration: number,
    velocity: number,
  ): void {
    if (!this._isRecording) return;
    this.events.push({ beatIndex, performerId, midi, duration, velocity });
  }

  /**
   * Stop recording. Trims ghost notes from lookahead by filtering
   * events to those with beatIndex < currentBeat.
   * Returns the trimmed events array.
   */
  stop(currentBeat: number): RecordedEvent[] {
    this._isRecording = false;
    this._stopBeat = currentBeat;
    return this.events.filter(e => e.beatIndex < currentBeat);
  }

  /** Get current events, filtered to stop beat if set. */
  getEvents(): RecordedEvent[] {
    if (this._stopBeat !== null) {
      return this.events.filter(e => e.beatIndex < this._stopBeat!);
    }
    return [...this.events];
  }

  /** Clear all state. */
  clear(): void {
    this.events = [];
    this._isRecording = false;
    this._stopBeat = null;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  get eventCount(): number {
    return this._stopBeat !== null
      ? this.events.filter(e => e.beatIndex < this._stopBeat!).length
      : this.events.length;
  }
}
