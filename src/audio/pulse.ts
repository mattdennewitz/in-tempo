/**
 * PulseGenerator - Steady eighth-note high C reference pulse.
 *
 * Traditional "In C" performances feature a pianist playing repeated
 * high C notes as a rhythmic anchor. This generates a subtle sine-wave
 * pulse at C7 (MIDI 96, 2093.005 Hz) that performers can align to.
 *
 * Each pulse is a short staccato burst (50% of beat duration) using
 * a fresh OscillatorNode that auto-disconnects after stopping.
 */
export class PulseGenerator {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private _enabled: boolean = false;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = 0.08; // Subtle pulse, not overpowering
    this.gainNode.connect(audioContext.destination);
  }

  /**
   * Schedule one staccato pulse at the given time.
   * Creates a sine oscillator at C7 (2093.005 Hz), starts it, and
   * stops it after 50% of the provided duration for staccato effect.
   * The oscillator auto-disposes after the onended event.
   */
  schedulePulse(time: number, duration: number): void {
    if (!this._enabled) return;

    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 2093.005; // C7 (MIDI 96)
    osc.connect(this.gainNode);

    const stopTime = time + duration * 0.5;
    osc.start(time);
    osc.stop(stopTime);

    // Auto-cleanup: disconnect after oscillator ends
    osc.onended = () => {
      osc.disconnect();
    };
  }

  set enabled(value: boolean) {
    this._enabled = value;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  dispose(): void {
    this.gainNode.disconnect();
  }
}
