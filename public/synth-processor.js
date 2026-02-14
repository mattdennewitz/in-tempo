/**
 * SynthProcessor - AudioWorkletProcessor for warm sine-based synthesis.
 *
 * Dual detuned sine oscillators with simple envelope for a warm, slightly
 * chorused tone suitable for Terry Riley's "In C" patterns.
 *
 * Messages:
 *   { type: 'noteOn', frequency: number }  - Start playing at frequency
 *   { type: 'noteOff' }                    - Release (envelope decays)
 *   { type: 'stop' }                       - Immediate silence
 */
class SynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Oscillator state
    this.phase1 = 0;
    this.phase2 = 0;
    this.frequency = 0;
    this.envelope = 0;
    this.playing = false;

    // Detune factor for second oscillator (~3 cents sharp)
    this.detuneFactor = 1.0017;

    // Envelope decay rate per sample (~200ms decay at 44.1kHz)
    this.decayRate = 0.9995;

    // Max output gain to avoid clipping
    this.maxGain = 0.3;

    this.port.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'noteOn') {
        this.frequency = data.frequency;
        this.envelope = 1.0;
        this.playing = true;
      } else if (data.type === 'noteOff') {
        this.playing = false;
      } else if (data.type === 'stop') {
        this.playing = false;
        this.envelope = 0;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const channel0 = output[0];

    if (!channel0) {
      return true;
    }

    const twoPi = 2 * Math.PI;
    const freq1 = this.frequency;
    const freq2 = this.frequency * this.detuneFactor;

    for (let i = 0; i < channel0.length; i++) {
      if (this.envelope > 0.001) {
        // Dual sine oscillators
        const osc1 = Math.sin(this.phase1 * twoPi);
        const osc2 = Math.sin(this.phase2 * twoPi);

        // Mix at equal level, scale to max gain
        channel0[i] = (osc1 + osc2) * 0.5 * this.envelope * this.maxGain;

        // Advance phases
        this.phase1 += freq1 / sampleRate;
        this.phase2 += freq2 / sampleRate;

        // Wrap phases to avoid floating point precision loss
        if (this.phase1 >= 1.0) this.phase1 -= 1.0;
        if (this.phase2 >= 1.0) this.phase2 -= 1.0;

        // Apply decay when not playing (noteOff received)
        if (!this.playing) {
          this.envelope *= this.decayRate;
        }
      } else {
        channel0[i] = 0;
        this.envelope = 0;
      }
    }

    // Copy to other channels if stereo
    for (let ch = 1; ch < output.length; ch++) {
      if (output[ch]) {
        output[ch].set(channel0);
      }
    }

    // Always return true to keep processor alive for voice pool reuse
    return true;
  }
}

registerProcessor('synth-processor', SynthProcessor);
