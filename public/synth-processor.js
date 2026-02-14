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

    // Envelope: attack ramp to avoid clicks, exponential decay on release
    this.attackRate = 1.0 / (0.005 * 44100); // ~5ms attack ramp
    this.decayRate = 0.9995; // ~200ms decay at 44.1kHz
    this.targetEnvelope = 0; // what envelope is ramping toward

    // Max output gain to avoid clipping
    this.maxGain = 0.3;

    this.port.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'noteOn') {
        this.frequency = data.frequency;
        this.targetEnvelope = 1.0;
        this.playing = true;
        // Reset phases to avoid discontinuity on frequency change
        this.phase1 = 0;
        this.phase2 = 0;
      } else if (data.type === 'noteOff') {
        this.playing = false;
        this.targetEnvelope = 0;
      } else if (data.type === 'stop') {
        this.playing = false;
        this.targetEnvelope = 0;
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
      // Ramp envelope toward target (attack ramp up, decay ramp down)
      if (this.envelope < this.targetEnvelope) {
        this.envelope = Math.min(this.envelope + this.attackRate, this.targetEnvelope);
      } else if (!this.playing && this.envelope > 0) {
        this.envelope *= this.decayRate;
      }

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
