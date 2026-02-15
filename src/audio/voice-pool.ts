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

  constructor(audioContext: AudioContext, size: number = 4) {
    this.voices = [];
    this.available = new Set();

    for (let i = 0; i < size; i++) {
      const node = new AudioWorkletNode(audioContext, 'synth-processor');
      node.connect(audioContext.destination);
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
    this.voices = [];
    this.available.clear();
    this.claimOrder = [];
  }
}
