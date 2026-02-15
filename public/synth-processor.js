/**
 * SynthProcessor - AudioWorkletProcessor for warm sine-based synthesis.
 *
 * Dual detuned sine oscillators with simple envelope for a warm, slightly
 * chorused tone suitable for Terry Riley's "In C" patterns.
 *
 * Messages:
 *   { type: 'noteOn', frequency: number, time?: number }  - Start playing at frequency (at scheduled AudioContext time)
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
    this.stopping = false;

    // Detune factor for second oscillator (~3 cents sharp)
    this.detuneFactor = 1.0017;

    // Envelope: attack ramp to avoid clicks, exponential decay on release
    this.attackRate = 1.0 / (0.005 * sampleRate); // ~5ms attack ramp
    this.decayRate = 0.9995; // ~315ms decay at 44.1kHz (ln(0.001)/ln(0.9995) ≈ 13815 samples)
    this.targetEnvelope = 0; // what envelope is ramping toward

    // Fast decay rate for voice steal (~2ms at 44.1kHz) to avoid click
    this.stopDecayRate = Math.pow(0.001, 1.0 / (0.002 * sampleRate));

    // Max output gain to avoid clipping
    this.maxGain = 0.3;

    // Per-note gain (defaults to maxGain, scaled by velocity)
    this.noteGain = this.maxGain;

    // Pending scheduled noteOn (deferred until currentTime >= startTime)
    this.pendingNoteOn = null; // { frequency, startTime, gain } or null

    this.port.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'noteOn') {
        if (data.time != null) {
          // Schedule for future: store pending, will activate in process()
          this.pendingNoteOn = { frequency: data.frequency, startTime: data.time, gain: data.gain ?? this.maxGain };
        } else {
          // Immediate (legacy / no time specified)
          this.frequency = data.frequency;
          this.noteGain = data.gain ?? this.maxGain;
          this.targetEnvelope = 1.0;
          this.playing = true;
          this.stopping = false;
          this.phase1 = 0;
          this.phase2 = 0;
        }
      } else if (data.type === 'noteOff') {
        this.playing = false;
        this.targetEnvelope = 0;
      } else if (data.type === 'stop') {
        this.playing = false;
        this.targetEnvelope = 0;
        this.stopping = true;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const channel0 = output[0];

    if (!channel0) {
      return true;
    }

    // Check if a scheduled noteOn should activate
    if (this.pendingNoteOn) {
      const blockEndTime = currentTime + channel0.length / sampleRate;
      if (blockEndTime >= this.pendingNoteOn.startTime) {
        this.frequency = this.pendingNoteOn.frequency;
        this.noteGain = this.pendingNoteOn.gain ?? this.maxGain;
        this.targetEnvelope = 1.0;
        this.playing = true;
        this.stopping = false;
        this.phase1 = 0;
        this.phase2 = 0;
        this.pendingNoteOn = null;
      }
    }

    const twoPi = 2 * Math.PI;
    const freq1 = this.frequency;
    const freq2 = this.frequency * this.detuneFactor;

    for (let i = 0; i < channel0.length; i++) {
      // Ramp envelope toward target (attack ramp up, decay ramp down)
      if (this.envelope < this.targetEnvelope) {
        this.envelope = Math.min(this.envelope + this.attackRate, this.targetEnvelope);
      } else if (this.stopping && this.envelope > 0) {
        this.envelope *= this.stopDecayRate; // fast ~2ms decay on voice steal
      } else if (!this.playing && this.envelope > 0) {
        this.envelope *= this.decayRate;
      }

      if (this.envelope > 0.001) {
        // Dual sine oscillators
        const osc1 = Math.sin(this.phase1 * twoPi);
        const osc2 = Math.sin(this.phase2 * twoPi);

        // Mix at equal level, scale to max gain
        channel0[i] = (osc1 + osc2) * 0.5 * this.envelope * this.noteGain;

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
