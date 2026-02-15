/**
 * MidiExporter - Converts recorded note events to multi-track MIDI files.
 *
 * Uses midi-writer-js to generate standard MIDI format 1 files with one track
 * per performer. Each track includes a GM program change matching the
 * performer's instrument assignment (synth->pad, piano->acoustic, marimba).
 *
 * Velocity is scaled from InTempo's 0.3-1.0 range to midi-writer-js's 1-100
 * range. Timing uses absolute tick positioning via startTick.
 */
import MidiWriter from 'midi-writer-js';
import type { RecordedEvent } from './midi-recorder.ts';
import { assignInstrument } from './sampler.ts';
import type { InstrumentType } from './types.ts';

/**
 * midi-writer-js default PPQ = 128.
 * One eighth note = PPQ / 2 = 64 ticks.
 */
const TICKS_PER_EIGHTH = 64;

/**
 * General MIDI program numbers (0-indexed) for each instrument type.
 * - piano: 0 (Acoustic Grand Piano)
 * - marimba: 12 (Marimba)
 * - synth: 88 (Pad 1 - new age / fantasia)
 */
const GM_PROGRAMS: Record<InstrumentType, number> = {
  piano: 0,
  marimba: 12,
  synth: 88,
};

/**
 * Convert recorded events to a multi-track MIDI file.
 * One track per performer, with tempo, GM program, and proper velocity scaling.
 */
export function exportToMidi(events: RecordedEvent[], bpm: number): Uint8Array {
  // Group events by performerId
  const byPerformer = new Map<number, RecordedEvent[]>();
  for (const evt of events) {
    const arr = byPerformer.get(evt.performerId);
    if (arr) {
      arr.push(evt);
    } else {
      byPerformer.set(evt.performerId, [evt]);
    }
  }

  // Sort performer IDs for deterministic output
  const performerIds = [...byPerformer.keys()].sort((a, b) => a - b);
  const tracks: MidiWriter.Track[] = [];

  for (let i = 0; i < performerIds.length; i++) {
    const pid = performerIds[i];
    const track = new MidiWriter.Track();

    // Set tempo on first track only
    if (i === 0) {
      track.setTempo(bpm);
    }

    // Instrument assignment and track name
    const instrument = assignInstrument(pid);
    track.addTrackName(`Performer ${pid + 1} (${instrument})`);

    // GM program change
    track.addEvent(
      new MidiWriter.ProgramChangeEvent({ instrument: GM_PROGRAMS[instrument] }),
    );

    // Sort events by beat index
    const performerEvents = byPerformer.get(pid)!;
    performerEvents.sort((a, b) => a.beatIndex - b.beatIndex);

    // Add note events
    for (const evt of performerEvents) {
      // midi-writer-js velocity is 1-100, InTempo velocity is 0.3-1.0
      const mwjVelocity = Math.max(1, Math.round(evt.velocity * 100));

      const noteEvent = new MidiWriter.NoteEvent({
        pitch: [evt.midi],
        duration: `T${evt.duration * TICKS_PER_EIGHTH}`,
        velocity: mwjVelocity,
        startTick: evt.beatIndex * TICKS_PER_EIGHTH,
      });

      track.addEvent(noteEvent);
    }

    tracks.push(track);
  }

  const writer = new MidiWriter.Writer(tracks);
  return writer.buildFile();
}

/**
 * Trigger a browser download of the MIDI data as a .mid file.
 */
export function downloadMidi(data: Uint8Array, filename: string): void {
  const blob = new Blob([data], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
