/**
 * VoicePool - Manages a fixed set of AudioWorkletNode instances.
 *
 * Instead of creating/destroying nodes per note, the pool maintains a fixed
 * number of voice processors that are claimed and released by the scheduler.
 * This prevents memory growth during long performances.
 *
 * Voice stealing: If all voices are busy when claim() is called, the oldest
 * claimed voice is stolen (sent a 'stop' message) and reclaimed.
 */
export class VoicePool {
  private voices: AudioWorkletNode[];
  private available: Set<number>;
  private claimOrder: number[] = [];
  private masterGain: GainNode;
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext, size: number = 4) {
    this.audioContext = audioContext;
    this.voices = [];
    this.available = new Set();

    // Master gain node to prevent clipping when many voices sound simultaneously.
    // Each voice outputs up to ~0.3, so scale down by voice count to keep sum ≤ 1.0.
    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = Math.min(1.0, 2.5 / size);
    this.masterGain.connect(audioContext.destination);

    for (let i = 0; i < size; i++) {
      const node = new AudioWorkletNode(audioContext, 'synth-processor');
      node.connect(this.masterGain);
      this.voices.push(node);
      this.available.add(i);
    }
  }

  /**
   * Claim the next available voice. If all voices are busy, steals the
   * oldest claimed voice (sends it a 'stop' message to silence immediately).
   */
  claim(): { node: AudioWorkletNode; index: number } {
    let index: number;

    if (this.available.size > 0) {
      index = this.available.values().next().value as number;
      this.available.delete(index);
    } else {
      // Voice stealing: take the oldest claimed voice
      index = this.claimOrder.shift()!;
      this.voices[index].port.postMessage({ type: 'stop' });
    }

    this.claimOrder.push(index);
    return { node: this.voices[index], index };
  }

  /** Release a voice back to the available pool. */
  release(index: number): void {
    this.available.add(index);
    const orderIdx = this.claimOrder.indexOf(index);
    if (orderIdx !== -1) {
      this.claimOrder.splice(orderIdx, 1);
    }
  }

  /** Immediately silence all voices and mark all as available. */
  stopAll(): void {
    for (const voice of this.voices) {
      voice.port.postMessage({ type: 'stop' });
    }
    this.available.clear();
    for (let i = 0; i < this.voices.length; i++) {
      this.available.add(i);
    }
    this.claimOrder = [];
  }

  /**
   * Resize the voice pool. Growing creates new AudioWorkletNodes.
   * Shrinking only removes unclaimed voices from the available set;
   * currently claimed voices are left alone until released.
   */
  resize(newSize: number): void {
    const currentSize = this.voices.length;

    if (newSize > currentSize) {
      // Grow: create additional AudioWorkletNode instances
      for (let i = currentSize; i < newSize; i++) {
        const node = new AudioWorkletNode(this.audioContext, 'synth-processor');
        node.connect(this.masterGain);
        this.voices.push(node);
        this.available.add(i);
      }
    } else if (newSize < currentSize) {
      // Shrink: remove excess voices from available pool only
      // Claimed voices stay until released; actual node cleanup deferred
      for (let i = newSize; i < currentSize; i++) {
        this.available.delete(i);
      }
    }

    // Update master gain for new voice count
    this.masterGain.gain.value = Math.min(1.0, 2.5 / newSize);
  }

  /** Number of voices in the pool. */
  get size(): number {
    return this.voices.length;
  }

  /** Disconnect all nodes for cleanup on reset/destroy. */
  dispose(): void {
    for (const voice of this.voices) {
      voice.port.postMessage({ type: 'stop' });
      voice.disconnect();
    }
    this.masterGain.disconnect();
    this.voices = [];
    this.available.clear();
    this.claimOrder = [];
  }
}
