/**
 * SamplePlayer - Wraps smplr library for piano and marimba sample playback.
 *
 * Loads SplendidGrandPiano and Soundfont (marimba) during initialization,
 * routing both through a shared GainNode for level control.
 *
 * When panGroups are provided, creates 3 instances per instrument type
 * (left/center/right) for stereo spread. Uses CacheStorage to avoid
 * redundant CDN fetches across instances.
 *
 * Sampled instruments provide timbral variety in the ensemble --
 * roughly 1/3 of performers play each instrument type.
 */
import { SplendidGrandPiano, Soundfont, CacheStorage } from 'smplr';
import type { InstrumentType } from './types.ts';

export interface PanGroups {
  left: StereoPannerNode;
  center: StereoPannerNode;
  right: StereoPannerNode;
}

export class SamplePlayer {
  private audioContext: AudioContext;
  private piano: SplendidGrandPiano | null = null;
  private marimba: Soundfont | null = null;
  private masterGain: GainNode;
  private _isReady: boolean = false;

  // Per-group instances for stereo spread (3 per instrument type)
  private pianoLeft: SplendidGrandPiano | null = null;
  private pianoCenter: SplendidGrandPiano | null = null;
  private pianoRight: SplendidGrandPiano | null = null;
  private marimbaLeft: Soundfont | null = null;
  private marimbaCenter: Soundfont | null = null;
  private marimbaRight: Soundfont | null = null;
  private hasPanGroups: boolean = false;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = 0.6;
    this.masterGain.connect(audioContext.destination);
  }

  /**
   * Load piano and marimba samples from CDN.
   * Must be called before play(). Awaits all instruments fully loaded.
   *
   * @param panGroups - Optional pan nodes for stereo spread (left/center/right).
   *   If provided, creates 3 instances per instrument type routed through pan nodes.
   */
  async initialize(panGroups?: PanGroups): Promise<void> {
    if (panGroups) {
      // Per-group stereo spread: 3 instances per instrument, shared cache
      const storage = new CacheStorage();
      this.hasPanGroups = true;

      this.pianoLeft = new SplendidGrandPiano(this.audioContext, {
        destination: panGroups.left,
        storage,
      });
      this.pianoCenter = new SplendidGrandPiano(this.audioContext, {
        destination: panGroups.center,
        storage,
      });
      this.pianoRight = new SplendidGrandPiano(this.audioContext, {
        destination: panGroups.right,
        storage,
      });

      this.marimbaLeft = new Soundfont(this.audioContext, {
        instrument: 'marimba',
        destination: panGroups.left,
        storage,
      });
      this.marimbaCenter = new Soundfont(this.audioContext, {
        instrument: 'marimba',
        destination: panGroups.center,
        storage,
      });
      this.marimbaRight = new Soundfont(this.audioContext, {
        instrument: 'marimba',
        destination: panGroups.right,
        storage,
      });

      await Promise.all([
        this.pianoLeft.load,
        this.pianoCenter.load,
        this.pianoRight.load,
        this.marimbaLeft.load,
        this.marimbaCenter.load,
        this.marimbaRight.load,
      ]);
    } else {
      // Backward compatible: single instance per instrument
      this.hasPanGroups = false;
      this.piano = new SplendidGrandPiano(this.audioContext, {
        destination: this.masterGain,
      });

      this.marimba = new Soundfont(this.audioContext, {
        instrument: 'marimba',
        destination: this.masterGain,
      });

      await Promise.all([
        this.piano.load,
        this.marimba.load,
      ]);
    }

    this._isReady = true;
  }

  /**
   * Schedule a sampled note (backward compatible, no panning).
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

    if (this.hasPanGroups) {
      // When pan groups are active, use center instance as default
      this.playPanned(instrument, midi, time, duration, velocity ?? 100, 0);
    } else {
      const target = instrument === 'piano' ? this.piano! : this.marimba!;
      target.start({ note: midi, time, duration, velocity: velocity ?? 100 });
    }
  }

  /**
   * Schedule a sampled note routed through the nearest pan group.
   * Selects left (<-0.33), center (-0.33 to 0.33), or right (>0.33).
   *
   * @param instrument - 'piano' or 'marimba'
   * @param midi - MIDI note number
   * @param time - AudioContext time to start
   * @param duration - Duration in seconds
   * @param velocity - MIDI velocity 0-127
   * @param panValue - Pan position from -1 to +1
   */
  playPanned(
    instrument: 'piano' | 'marimba',
    midi: number,
    time: number,
    duration: number,
    velocity: number,
    panValue: number,
  ): void {
    if (!this._isReady || !this.hasPanGroups) return;

    let target: SplendidGrandPiano | Soundfont;

    if (instrument === 'piano') {
      if (panValue < -0.33) {
        target = this.pianoLeft!;
      } else if (panValue > 0.33) {
        target = this.pianoRight!;
      } else {
        target = this.pianoCenter!;
      }
    } else {
      if (panValue < -0.33) {
        target = this.marimbaLeft!;
      } else if (panValue > 0.33) {
        target = this.marimbaRight!;
      } else {
        target = this.marimbaCenter!;
      }
    }

    target.start({ note: midi, time, duration, velocity });
  }

  get isReady(): boolean {
    return this._isReady;
  }

  dispose(): void {
    // Dispose single instances
    this.piano?.stop();
    this.marimba?.stop();

    // Dispose per-group instances
    this.pianoLeft?.stop();
    this.pianoCenter?.stop();
    this.pianoRight?.stop();
    this.marimbaLeft?.stop();
    this.marimbaCenter?.stop();
    this.marimbaRight?.stop();

    this.masterGain.disconnect();
    this._isReady = false;
    this.hasPanGroups = false;

    // Clear references
    this.piano = null;
    this.marimba = null;
    this.pianoLeft = null;
    this.pianoCenter = null;
    this.pianoRight = null;
    this.marimbaLeft = null;
    this.marimbaCenter = null;
    this.marimbaRight = null;
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
