# Phase 3: Visualization + Instruments + Polish - Research

**Researched:** 2026-02-14
**Domain:** Canvas 2D rendering, Web Audio sample playback, CSS visual identity, dynamic ensemble management
**Confidence:** MEDIUM-HIGH

## Summary

Phase 3 covers four distinct technical domains: (1) Canvas 2D performer visualization decoupled from React, (2) sampled instrument integration via AudioBufferSourceNode, (3) visual identity with GT Canon font and a warm editorial color palette, and (4) runtime addition/removal of performers. The existing codebase has clean separation of concerns (AudioEngine facade, Ensemble coordinator, React UI) that makes each domain tractable. The main risks are: font files and sample files are external dependencies the user must provide, the Ensemble/VoicePool classes need new public methods for dynamic performer management, and the Canvas rendering layer must bridge the gap between React state and imperative draw calls without causing performance issues.

The architecture is well-positioned. The scheduler already fires `onStateChange` after every beat, providing the data feed Canvas needs. The VoicePool already handles voice stealing, so adding performers just means growing the pool. The Ensemble already uses frozen snapshots, so adding/removing agents mid-tick is safe as long as mutations happen between ticks.

**Primary recommendation:** Split into 3 plans: (1) Canvas visualization + visual identity (VIZ-01 through VIZ-05, VIZ-07), (2) sampled instruments + pulse (INS-02, INS-03, INS-04), (3) dynamic performer management (ENS-08, ENS-09, VIZ-09). This ordering lets each plan be independently testable.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Browser native | Performer visualization | Already required by VIZ-03; no library overhead, full control over draw calls |
| Web Audio API (AudioBufferSourceNode) | Browser native | Sample playback | Native API for playing decoded audio buffers with pitch control via playbackRate |
| CSS @font-face | Browser native | GT Canon font loading | Standard mechanism for self-hosted web fonts; WOFF2 format for best compression |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| smplr | 0.15+ | Soundfont-based sampled instruments | If user cannot provide raw sample files -- loads piano/marimba from online soundfont banks with zero setup. Provides `Soundfont` and `SplendidGrandPiano` classes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw AudioBufferSourceNode | smplr library | smplr adds ~30KB but handles sample loading, multi-velocity layers, and instrument switching automatically. Hand-rolling is simpler if only a few samples are needed but lacks velocity layering |
| Canvas 2D | HTML/CSS DOM elements | DOM elements are simpler but VIZ-03 explicitly requires Canvas 2D decoupled from React's render cycle |
| Canvas 2D | Konva.js / react-konva | Adds abstraction layer; overkill for box/card rendering with text. Canvas 2D is sufficient for the visualization requirements |

**Installation:**
```bash
# If using smplr for sampled instruments:
npm install smplr

# Everything else is browser-native (Canvas 2D, Web Audio, CSS @font-face)
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── audio/
│   ├── engine.ts           # Extended: addPerformer(), removePerformer(), togglePulse()
│   ├── scheduler.ts        # Extended: pulse scheduling logic
│   ├── voice-pool.ts       # Extended: resize() method for dynamic pool growth/shrink
│   ├── sampler.ts          # NEW: AudioBuffer-based sample player
│   ├── types.ts            # Extended: instrument type on PerformerState
│   └── pulse.ts            # NEW: High-C eighth-note pulse generator
├── canvas/
│   ├── PerformerCanvas.tsx  # React wrapper: useRef + useEffect for canvas lifecycle
│   ├── renderer.ts         # Pure draw functions: renderPerformer(), renderGrid()
│   └── theme.ts            # Color constants, font metrics, layout calculations
├── components/
│   ├── Transport.tsx        # Existing
│   ├── BpmSlider.tsx        # Existing
│   ├── PatternDisplay.tsx   # Deprecated in favor of PerformerCanvas
│   ├── ScoreModeSelector.tsx # NEW: dropdown for Riley/Generative/Euclidean
│   └── PerformerControls.tsx # NEW: add/remove performer buttons
├── score/
│   ├── ensemble.ts          # Extended: addAgent(), removeAgent() methods
│   ├── performer.ts         # Existing (Phase 1 legacy, unused by ensemble)
│   └── patterns.ts          # Existing
└── App.tsx                  # Orchestrates all components
public/
├── synth-processor.js       # Existing
├── fonts/
│   ├── GTCanon-Regular.woff2    # User-provided
│   ├── GTCanon-Medium.woff2     # User-provided
│   └── GTCanon-Bold.woff2       # User-provided
└── samples/                     # User-provided or loaded via smplr
    ├── piano/
    └── marimba/
```

### Pattern 1: Decoupled Canvas Rendering via useRef + requestAnimationFrame

**What:** A React component owns a `<canvas>` element via `useRef`. A `useEffect` starts a `requestAnimationFrame` loop that reads the latest performer state from a ref (not React state) and draws to the canvas. The rAF loop runs independently of React re-renders.

**When to use:** VIZ-03 requires Canvas 2D decoupled from React's render cycle. This pattern achieves that by storing the performer state snapshot in a mutable ref that the rAF loop reads without triggering re-renders.

**Example:**
```typescript
// Source: Established React + Canvas pattern
// https://css-tricks.com/using-requestanimationframe-with-react-hooks/

function PerformerCanvas({ performers }: { performers: PerformerState[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const performersRef = useRef<PerformerState[]>(performers);
  const rafIdRef = useRef<number>(0);

  // Update the ref on every React render (cheap, no re-draw)
  performersRef.current = performers;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    function draw() {
      const current = performersRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // ... draw performer boxes using current state
      rafIdRef.current = requestAnimationFrame(draw);
    }

    rafIdRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  return <canvas ref={canvasRef} width={800} height={600} />;
}
```

### Pattern 2: Sample Player with AudioBufferSourceNode

**What:** Load audio files into AudioBuffers at init time. For each note, create a new AudioBufferSourceNode, set `playbackRate` to pitch-shift from the sample's base note, connect to the audio graph, and call `start()`. The node auto-disposes after playback completes.

**When to use:** INS-02 requires sampled instrument voices. AudioBufferSourceNode is one-shot by design (cannot restart), so a new node is created per note -- this is lightweight and the intended Web Audio pattern.

**Example:**
```typescript
// Source: MDN Web Docs - AudioBufferSourceNode
// https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode

class SamplePlayer {
  private buffers: Map<string, AudioBuffer> = new Map();
  private ctx: AudioContext;

  async loadSample(name: string, url: string): Promise<void> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.buffers.set(name, audioBuffer);
  }

  play(sampleName: string, targetMidi: number, baseMidi: number,
       destination: AudioNode, time: number, duration: number): void {
    const buffer = this.buffers.get(sampleName);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    // Pitch shift: playbackRate = 2^((target - base) / 12)
    source.playbackRate.value = Math.pow(2, (targetMidi - baseMidi) / 12);
    source.connect(destination);
    source.start(time);
    source.stop(time + duration);
  }
}
```

### Pattern 3: Dynamic Ensemble Resizing

**What:** Add `addAgent()` and `removeAgent()` methods to the Ensemble class. New agents enter with a staggered delay and start at the current ensemble minimum pattern (so they blend in). Removed agents are simply spliced out; their voices auto-release on next scheduler tick. VoicePool must also support `resize()` to grow/shrink.

**When to use:** ENS-08 and ENS-09 require runtime performer management.

**Example:**
```typescript
// Ensemble.addAgent() sketch
addAgent(): number {
  const snapshot = this.createSnapshot();
  const startPattern = snapshot.minPatternIndex;
  const id = this.nextId++;
  const agent = new PerformerAgent(id, this._patterns);
  agent._mutableState.patternIndex = startPattern;
  agent._mutableState.entryDelay = Math.floor(Math.random() * 3) + 2;
  this.agents.push(agent);
  return id;
}

removeAgent(id: number): boolean {
  const idx = this.agents.findIndex(a => a.state.id === id);
  if (idx === -1) return false;
  this.agents.splice(idx, 1);
  return true;
}
```

### Pattern 4: Pulse as Dedicated Oscillator

**What:** The "In C" pulse is a steady eighth-note on high C (C6, MIDI 84 or C7 MIDI 96). Implement as a simple oscillator or AudioBufferSourceNode scheduled in the same lookahead loop as performer notes, but controlled by a boolean toggle. It does NOT use the voice pool -- it has its own dedicated gain node that can be muted/unmuted.

**When to use:** INS-04 requires a toggleable pulse.

**Example:**
```typescript
// Pulse scheduling in Scheduler.scheduleBeat()
if (this.pulseEnabled) {
  const pulseNode = this.audioContext.createOscillator();
  pulseNode.frequency.value = midiToFrequency(96); // High C
  pulseNode.type = 'sine';
  const pulseGain = this.audioContext.createGain();
  pulseGain.gain.value = 0.08; // Subtle
  pulseNode.connect(pulseGain).connect(this.pulseDestination);
  pulseNode.start(time);
  pulseNode.stop(time + secondsPerEighth * 0.5); // Short pulse
}
```

### Anti-Patterns to Avoid

- **Triggering React re-renders from rAF loop:** Never call setState inside the animation loop. The rAF reads from refs, React state updates come from the scheduler's onStateChange callback which naturally batches.
- **Creating AudioWorkletNode per sampled note:** AudioBufferSourceNode is the correct primitive for sample playback. AudioWorkletNode is for custom DSP (synth voices). Do not mix them up.
- **Resizing VoicePool by destroying and recreating all nodes:** Instead, append new nodes or mark excess nodes for decommission. Destroying active nodes causes audio glitches.
- **Loading font files synchronously:** Use `document.fonts.ready` or CSS `font-display: swap` to avoid blocking rendering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-velocity piano samples with proper key mapping | Custom sample loader with velocity layers | `smplr` SplendidGrandPiano | Velocity curves, sample mapping, and decay modeling are complex; smplr provides Steinway samples with 4 velocity groups out of the box |
| Soundfont parsing and instrument loading | Custom SF2/SFZ parser | `smplr` Soundfont class | Soundfont format is complex; smplr handles loading from CDN-hosted pre-rendered banks |
| Font loading state detection | Custom font load polling | CSS `font-display: swap` + `document.fonts.ready` Promise | Browser-native API handles FOUT/FOIT correctly |
| Canvas DPI scaling for retina displays | Manual pixel ratio calculations | `devicePixelRatio`-aware canvas setup pattern | Well-known pattern: set canvas width/height to `clientWidth * dpr`, scale context by dpr |

**Key insight:** The sampled instrument domain is the only area where a library meaningfully reduces complexity. Canvas 2D and font loading are straightforward with native APIs.

## Common Pitfalls

### Pitfall 1: Canvas Text Rendering Before Font Load
**What goes wrong:** Canvas `fillText()` uses the font immediately. If GT Canon hasn't loaded yet, the browser silently falls back to a default font. Canvas does not participate in CSS font-display behavior.
**Why it happens:** Canvas text rendering is immediate and imperative, unlike DOM text which re-renders when fonts load.
**How to avoid:** Wait for `document.fonts.ready` before starting the rAF loop, OR check `document.fonts.check('16px "GT Canon"')` each frame and skip text rendering until true.
**Warning signs:** Text appears in a system font on first load, then never corrects (because Canvas doesn't re-render on font load).

### Pitfall 2: Canvas Blurry on Retina Displays
**What goes wrong:** Canvas renders at 1x resolution on 2x screens, producing blurry text and lines.
**Why it happens:** Canvas `width` and `height` attributes set the drawing buffer size, which defaults to CSS pixel dimensions. On retina, CSS pixels are 2x physical pixels.
**How to avoid:** Set `canvas.width = canvas.clientWidth * devicePixelRatio` and `ctx.scale(devicePixelRatio, devicePixelRatio)`. Style the canvas with CSS dimensions, use attributes for buffer size.
**Warning signs:** Text and lines look blurry, especially on macOS.

### Pitfall 3: VoicePool Resize Causing Audio Glitches
**What goes wrong:** Growing the voice pool mid-performance requires creating new AudioWorkletNodes that connect to the audio graph. If done synchronously during a scheduler tick, this can cause a brief audio hiccup.
**Why it happens:** AudioWorkletNode construction involves cross-thread communication with the audio thread.
**How to avoid:** Pre-create new voice nodes before they are needed (e.g., create them immediately when addPerformer is called, but only include them in the available pool on the next tick). Never disconnect or destroy nodes that are currently sounding.
**Warning signs:** Click or dropout when adding a performer during playback.

### Pitfall 4: Sampled Instrument Latency on First Note
**What goes wrong:** If samples are loaded lazily (on first use), the first note of a sampled instrument is delayed or silent while the fetch + decode completes.
**Why it happens:** `fetch()` + `decodeAudioData()` are async and take 50-500ms depending on sample size.
**How to avoid:** Load all samples during `AudioEngine.initialize()`, before playback starts. Show a loading state if needed.
**Warning signs:** First few notes of a sampled performer are silent or late.

### Pitfall 5: Race Condition When Removing Performer Mid-Beat
**What goes wrong:** If a performer is removed while the scheduler is iterating over the Ensemble's agents in `tick()`, the agent array is mutated during iteration.
**Why it happens:** `tick()` iterates over `this.agents` with a for-of loop; `removeAgent()` splices from the same array.
**How to avoid:** Queue removals and apply them between ticks. OR: mark agents as "removing" and filter them out at the start of the next tick rather than splicing mid-iteration.
**Warning signs:** Skipped notes, duplicate events, or array-out-of-bounds errors.

### Pitfall 6: Sample Pitch Shifting Artifacts Beyond +/- 1 Octave
**What goes wrong:** `AudioBufferSourceNode.playbackRate` changes both pitch and tempo. Shifting more than ~12 semitones makes samples sound unnatural (chipmunk effect or too slow).
**Why it happens:** playbackRate is a simple time-stretch, not a formant-preserving pitch shift.
**How to avoid:** Provide samples at multiple octave points (e.g., C3, C4, C5) and always shift from the nearest sample. For piano/marimba, the score uses roughly MIDI 60-84, so 3 base samples per instrument covers the range with max +/- 6 semitone shifts.
**Warning signs:** High notes sound tinny/fast, low notes sound muddy/slow.

## Code Examples

### Canvas Retina Setup
```typescript
// Verified pattern for HiDPI canvas rendering
function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return ctx;
}
```

### @font-face Declaration for GT Canon
```css
/* GT Canon is a commercial font from Grilli Type
   User must provide WOFF2 files in public/fonts/ */
@font-face {
  font-family: 'GT Canon';
  src: url('/fonts/GTCanon-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'GT Canon';
  src: url('/fonts/GTCanon-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'GT Canon';
  src: url('/fonts/GTCanon-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

### Color Palette Constants
```typescript
// Semafor / Financial Times inspired editorial palette
// Warm salmon, cream, dark navy, muted tones
export const PALETTE = {
  // Primary
  salmon: '#E8735A',        // Warm salmon -- performer playing state, accents
  cream: '#FDF6EE',         // Cream -- background
  navy: '#1B2838',          // Dark navy -- text, headers

  // Supporting
  salmonLight: '#F2A995',   // Light salmon -- hover states
  salmonMuted: '#D4907E',   // Muted salmon -- secondary elements
  warmGray: '#B8AFA6',      // Warm gray -- borders, dividers
  coolGray: '#8C9196',      // Cool gray -- silent state, secondary text
  paleGold: '#E8D5B5',      // Pale gold -- subtle highlights
  offWhite: '#FAF8F5',      // Off-white -- card backgrounds

  // State colors
  playing: '#E8735A',       // Salmon for active/playing
  silent: '#B8AFA6',        // Warm gray for silent/dropped out
  complete: '#D4D0CB',      // Light warm gray for complete
} as const;
```

### Instrument Assignment Logic
```typescript
// Assign instruments to performers with variety
type InstrumentType = 'synth' | 'piano' | 'marimba';

function assignInstrument(performerId: number, totalPerformers: number): InstrumentType {
  // Ensure a mix: ~40% synth, ~30% piano, ~30% marimba
  // Deterministic based on ID for consistency across add/remove
  const instruments: InstrumentType[] = ['synth', 'piano', 'marimba'];
  return instruments[performerId % instruments.length];
}
```

### Loading Samples with Fetch + DecodeAudioData
```typescript
// Source: MDN Web Docs - decodeAudioData
// https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData

async function loadSample(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load sample: ${url}`);
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

// Pre-load all samples at init
async function loadAllSamples(ctx: AudioContext): Promise<Map<string, AudioBuffer>> {
  const samples = new Map<string, AudioBuffer>();
  const manifest = [
    { name: 'piano-c4', url: '/samples/piano/c4.wav', baseMidi: 60 },
    { name: 'piano-c5', url: '/samples/piano/c5.wav', baseMidi: 72 },
    { name: 'marimba-c4', url: '/samples/marimba/c4.wav', baseMidi: 60 },
    { name: 'marimba-c5', url: '/samples/marimba/c5.wav', baseMidi: 72 },
  ];
  await Promise.all(manifest.map(async (s) => {
    samples.set(s.name, await loadSample(ctx, s.url));
  }));
  return samples;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ScriptProcessorNode for custom audio | AudioWorkletProcessor | Chrome 64+ (2018) | Already using AudioWorklet -- no change needed |
| WOFF + TTF font formats | WOFF2 only | ~2020 (universal support) | Use WOFF2 exclusively for GT Canon -- 30%+ smaller files |
| Multiple font format declarations | Single WOFF2 src | ~2022 | Simplifies @font-face -- no fallback formats needed |
| soundfont-player library | smplr library | 2023 | smplr is the maintained successor with better TypeScript support |
| Canvas without DPR awareness | devicePixelRatio-aware setup | Always relevant | Must handle for macOS/retina -- already standard practice |

**Deprecated/outdated:**
- `soundfont-player`: Unmaintained; replaced by `smplr` from the same author
- `ScriptProcessorNode`: Deprecated in favor of `AudioWorkletProcessor` (already using correct approach)

## Open Questions

1. **GT Canon Font Files -- Blocker**
   - What we know: GT Canon is a commercial typeface from Grilli Type. User must provide WOFF2 files.
   - What's unclear: Whether the user has the files ready, which weights are available (Regular, Medium, Bold?)
   - Recommendation: Implement with a fallback font stack (`'GT Canon', Georgia, 'Times New Roman', serif`) so the app works without the font. Add font files when available. The Canvas renderer should check `document.fonts.check()` before using GT Canon in `fillText()`.

2. **Sampled Instrument Audio Files -- Blocker**
   - What we know: Piano and marimba samples are needed. Multiple approaches exist: (a) user provides WAV/MP3 files, (b) use smplr library to load from online soundfont banks.
   - What's unclear: Whether user wants self-hosted samples or is OK with smplr loading from CDN.
   - Recommendation: Use `smplr` library as the primary approach. It loads instruments from CDN-hosted soundfont banks with zero user-provided files. Provides piano via `SplendidGrandPiano` and marimba via `new Soundfont(ctx, { instrument: 'marimba' })`. This eliminates the blocker entirely. If the user later wants self-hosted samples, the architecture supports swapping in raw AudioBuffer playback.

3. **Score Mode Selector Scope**
   - What we know: VIZ-07 requires a score mode selector "available before performance start." Phase 4 implements the actual generative/Euclidean modes.
   - What's unclear: Should Phase 3 build the selector UI with only "Riley" available (disabled options for future modes), or just a placeholder?
   - Recommendation: Build the selector component with "Riley's In C" as the only enabled option. Other modes appear greyed out with "Coming soon" state. This satisfies VIZ-07 without Phase 4 implementation.

4. **Performer ID Stability Across Add/Remove**
   - What we know: Current Ensemble assigns sequential IDs (0-7) at construction. Adding/removing changes the array.
   - What's unclear: Whether Canvas visualization needs stable IDs to maintain visual position of existing performers.
   - Recommendation: Use monotonically increasing IDs (never reuse). Track a `nextId` counter in Ensemble. This ensures Canvas can use performer ID as a stable key for visual positioning.

5. **Sampled Instrument Integration with Scheduler**
   - What we know: The scheduler currently sends `noteOn`/`noteOff` messages to AudioWorkletNodes (synth voices) via the voice pool. Sampled instruments use AudioBufferSourceNode which is a different playback mechanism.
   - What's unclear: Whether to route sampled notes through the voice pool or use a parallel path.
   - Recommendation: Create a parallel `SamplePlayer` that is used alongside the VoicePool. The scheduler checks each performer's assigned instrument type: synth performers use VoicePool (existing path), sampled performers use SamplePlayer (new path). Both connect to the same master gain for unified volume. This avoids complicating the voice pool with two fundamentally different node types.

## Sources

### Primary (HIGH confidence)
- MDN Web Docs: AudioBufferSourceNode -- https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode
- MDN Web Docs: Canvas API Optimizing -- https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- MDN Web Docs: @font-face -- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face
- MDN Web Docs: AudioWorkletNode -- https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode
- web.dev: Font Best Practices -- https://web.dev/articles/font-best-practices

### Secondary (MEDIUM confidence)
- smplr GitHub repository -- https://github.com/danigb/smplr -- Verified API via README and npm page
- CSS-Tricks: requestAnimationFrame with React Hooks -- https://css-tricks.com/using-requestanimationframe-with-react-hooks/
- Greg Jopa: Piano Sounds with Web Audio API -- https://www.gregjopa.com/2023/03/piano-sounds-with-web-audio-api/
- Grilli Type: GT Canon specimen -- https://www.grillitype.com/typeface/gt-canon
- Wikipedia: In C -- https://en.wikipedia.org/wiki/In_C -- Pulse description and performance practice

### Tertiary (LOW confidence)
- Color palette hex values are approximations of the Semafor/FT aesthetic, not sourced from official brand guidelines. These should be tuned visually during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core technologies are browser-native APIs with excellent documentation. smplr is the only external dependency, verified on npm/GitHub.
- Architecture: HIGH - Patterns are well-established (Canvas+React via refs, AudioBufferSourceNode for samples, @font-face for fonts). The existing codebase architecture supports clean extension points.
- Pitfalls: HIGH - All listed pitfalls are verified from MDN docs, established web audio/canvas development experience, and the specific codebase structure.
- Color palette: MEDIUM - Hex values are approximations of the desired aesthetic, not from official Semafor brand docs.
- Dynamic performer management: MEDIUM - The pattern is straightforward but requires careful handling of race conditions between scheduler ticks and ensemble mutations.

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable domain, browser APIs do not change frequently)
