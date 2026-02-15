/**
 * SamplePlayer - Wraps smplr library for piano and marimba sample playback.
 *
 * Loads SplendidGrandPiano and Soundfont (marimba) during initialization,
 * routing both through a shared GainNode for level control.
 *
 * Sampled instruments provide timbral variety in the ensemble --
 * roughly 1/3 of performers play each instrument type.
 */
import { SplendidGrandPiano, Soundfont } from 'smplr';
import type { InstrumentType } from './types.ts';

export class SamplePlayer {
  private audioContext: AudioContext;
  private piano: SplendidGrandPiano | null = null;
  private marimba: Soundfont | null = null;
  private masterGain: GainNode;
  private _isReady: boolean = false;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = 0.6;
    this.masterGain.connect(audioContext.destination);
  }

  /**
   * Load piano and marimba samples from CDN.
   * Must be called before play(). Awaits both instruments fully loaded.
   */
  async initialize(): Promise<void> {
    this.piano = new SplendidGrandPiano(this.audioContext, {
      destination: this.masterGain,
    });

    this.marimba = new Soundfont(this.audioContext, {
      instrument: 'marimba',
      destination: this.masterGain,
    });

    // Wait for both instruments to finish loading samples
    await Promise.all([
      this.piano.load,
      this.marimba.load,
    ]);

    this._isReady = true;
  }

  /**
   * Schedule a sampled note.
   * @param instrument - 'piano' or 'marimba'
   * @param midi - MIDI note number
   * @param time - AudioContext time to start
   * @param duration - Duration in seconds
   * @param velocity - MIDI velocity 0-127 (default 100)
   */
  play(
    instrument: 'piano' | 'marimba',
    midi: number,
    time: number,
    duration: number,
    velocity?: number,
  ): void {
    if (!this._isReady) return;

    const target = instrument === 'piano' ? this.piano! : this.marimba!;
    target.start({ note: midi, time, duration, velocity: velocity ?? 100 });
  }

  get isReady(): boolean {
    return this._isReady;
  }

  dispose(): void {
    this.piano?.stop();
    this.marimba?.stop();
    this.masterGain.disconnect();
    this._isReady = false;
  }
}

/**
 * Deterministic instrument assignment by performer ID.
 * Distributes ~33% each: synth, piano, marimba.
 * Stable across reset (no randomness).
 */
export function assignInstrument(performerId: number): InstrumentType {
  const instruments: InstrumentType[] = ['synth', 'piano', 'marimba'];
  return instruments[performerId % 3];
}
