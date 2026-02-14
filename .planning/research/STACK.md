# Technology Stack

**Project:** InTempo -- Browser-Based Generative Performance Engine
**Researched:** 2026-02-14
**Note:** Web search and npm registry access were unavailable during research. Versions are based on training data (cutoff May 2025). All version numbers should be verified with `npm view <pkg> version` before scaffolding.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | ^19.0 | UI framework | Project constraint. React 19 is stable, concurrent features help keep UI responsive during heavy audio scheduling. | MEDIUM -- v19 was stable by early 2025, likely current |
| Vite | ^6.x | Build tool / dev server | Project constraint. Fast HMR, native ESM, excellent TypeScript support. Vite 6 shipped late 2024. | MEDIUM -- v6 likely current, verify |
| TypeScript | ^5.7 | Type safety | Non-negotiable for a project with complex audio scheduling, pattern state machines, and performer AI. Catches timing bugs at compile time. | MEDIUM -- 5.7 likely current |

### UI Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| shadcn/ui | latest CLI | Component library | Project constraint. Copy-paste components mean zero runtime overhead -- critical when every JS cycle matters for audio. Not a dependency, it generates source files. | HIGH -- architecture is stable |
| Tailwind CSS | ^4.0 | Utility CSS | shadcn/ui dependency. Tailwind v4 shipped early 2025 with CSS-first config and significant performance improvements. | MEDIUM -- v4 likely current, verify |
| Radix UI Primitives | (via shadcn) | Accessible primitives | Comes with shadcn/ui. Handles focus management, keyboard nav for transport controls, performer grid. | HIGH |
| lucide-react | ^0.460+ | Icons | Default shadcn icon set. Play/pause/stop transport icons, performer status indicators. | LOW -- verify version |
| clsx + tailwind-merge | latest | Class merging | Standard shadcn utility pattern via `cn()` helper. | HIGH |

### Audio Engine

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Web Audio API (native) | N/A | Core audio engine | **Use the raw API, not Tone.js.** See rationale below. AudioContext scheduling with lookahead gives sample-accurate timing. This is the project's most critical technical choice. | HIGH |
| AudioWorklet (native) | N/A | Custom synthesis | Runs synthesis on the audio thread, preventing main-thread jank from blocking audio. Required for smooth multi-performer playback. | HIGH |

#### Why NOT Tone.js

This is the single most important stack decision for InTempo. Tone.js (v15.x, last major update mid-2024) is the go-to Web Audio abstraction, but it is wrong for this project:

1. **Abstraction fights the architecture.** Tone.js manages its own Transport clock, scheduling queue, and audio graph lifecycle. InTempo needs direct control over AudioContext.currentTime lookahead scheduling for 10-30+ simultaneous performers. Tone's Transport adds a layer that makes custom scheduling harder, not easier.

2. **Bundle size.** Tone.js is ~150KB minified. InTempo only needs OscillatorNode, GainNode, StereoPannerNode, AudioBufferSourceNode, and a scheduling loop. That is perhaps 200 lines of custom code vs. a large dependency.

3. **AudioWorklet friction.** Tone.js has limited AudioWorklet integration. InTempo's synth voices benefit from AudioWorklet processors for wavetable/FM synthesis without main-thread overhead.

4. **Debugging.** When timing goes wrong (and it will), debugging your own 200-line scheduler is trivial. Debugging Tone.js internals is not.

**What to build instead:**
- A `SchedulerService` using the classic "lookahead + setTimeout" pattern (Chris Wilson's "A Tale of Two Clocks" -- the canonical approach)
- A thin `AudioEngine` class wrapping AudioContext creation, node factory methods, and master gain/compressor
- Per-performer `Voice` classes that create/connect/disconnect audio nodes

This is more code upfront but dramatically simpler to debug and optimize.

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zustand | ^5.0 | Application state | Lightweight (1KB), no boilerplate, excellent React 19 compatibility. Perfect for performer states, performance config, UI state. Does not try to manage audio state -- keeps the boundary clean. | MEDIUM -- v5 likely current |

#### Why NOT Redux, Jotai, or React Context

- **Redux:** Massive overkill. InTempo's state is straightforward -- performance config, array of performer states, UI toggles. Redux's ceremony adds nothing.
- **Jotai:** Good library, but atom-based state is awkward for the "array of performers with shared config" pattern. Zustand's single-store model maps naturally to this domain.
- **React Context:** Fine for static config (theme, color palette), but causes unnecessary re-renders for frequently-changing performer states (current pattern, playing/silent). Zustand's selector pattern avoids this.

**Zustand store structure:**
```typescript
interface PerformanceStore {
  // Config (changes before/between performances)
  bpm: number;
  performerCount: number;
  scoreMode: 'riley' | 'generated' | 'euclidean';

  // Runtime state (changes during performance)
  isPlaying: boolean;
  performers: PerformerState[];
  currentBeat: number;

  // Actions
  start: () => void;
  stop: () => void;
  reset: () => void;
  setBpm: (bpm: number) => void;
}
```

### Visualization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Canvas API (native) | N/A | Per-performer geometry | Abstract geometry visualizations. Canvas 2D is sufficient for geometric shapes, lighter than WebGL, and the rendering can be throttled independently of audio. | HIGH |

#### Why NOT Three.js, Pixi.js, or SVG

- **Three.js / Pixi.js:** InTempo's visualizations are abstract 2D geometry, not 3D scenes or sprite-heavy games. These libraries add 100KB+ for capabilities not needed. The project description calls for "abstract geometry" -- circles, polygons, lines -- which Canvas 2D handles natively.
- **SVG:** DOM-based rendering for 10-30 simultaneous animated elements creates GC pressure and layout thrashing. Canvas is a single bitmap, no DOM nodes per shape.
- **React-Canvas libs (react-konva, etc.):** Add abstraction without benefit. A custom `useCanvas` hook with requestAnimationFrame is ~50 lines and gives full control.

### Fonts and Styling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| GT Canon | user-provided | Primary typeface | Project constraint. Load via @font-face in CSS, preload in HTML head to prevent FOIT. | HIGH |
| CSS custom properties | N/A | Color palette | Define Semafor/FT-inspired palette as CSS variables. Tailwind v4's CSS-first config integrates natively with custom properties. | HIGH |

### Dev Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ESLint | ^9.x | Linting | Flat config format (eslint.config.js). Use typescript-eslint for type-aware rules. | MEDIUM |
| Prettier | ^3.x | Formatting | End formatting debates. Integrates with ESLint via eslint-config-prettier. | HIGH |
| Vitest | ^2.x | Unit testing | Native Vite integration, same config, fast. Test the scheduler math, Euclidean algorithm, performer AI decision logic. | MEDIUM -- v2 likely current |

### Utilities

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| @tonaljs/tonal | ^6.x | Music theory | Note/interval/scale calculations for pattern generation. Lightweight, tree-shakeable. Use for algorithmic score generation mode, NOT for audio playback. | MEDIUM |

#### Why NOT other music theory libs

- **teoria:** Unmaintained since 2020.
- **tonal (older API):** The `@tonaljs` scoped packages are the maintained successor. Import only what you need: `@tonaljs/note`, `@tonaljs/interval`, `@tonaljs/scale`.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Audio | Raw Web Audio API | Tone.js | Abstraction fights custom scheduling; see detailed rationale above |
| Audio | Raw Web Audio API | Howler.js | Howler is for sound effects/playback, not synthesis or precise scheduling |
| State | Zustand | Redux Toolkit | Overkill for this domain's state shape |
| State | Zustand | Jotai | Atom model awkward for array-of-performers pattern |
| Viz | Canvas 2D | Three.js | 3D engine for 2D geometry is wasteful |
| Viz | Canvas 2D | SVG | DOM overhead with 10-30 animated elements |
| Viz | Canvas 2D | Pixi.js | WebGL renderer for simple geometry is overkill |
| Music theory | @tonaljs/tonal | Tone.js (theory parts) | Brings entire audio lib as dependency for note math |
| Build | Vite | Next.js | No SSR needed; SPA is the correct architecture for a real-time audio app |
| Build | Vite | Webpack | Slower, more config, no advantage here |

## Architecture Notes for Stack Integration

### Audio-UI Boundary (Critical)

The audio engine and React UI must be decoupled:

```
React UI (main thread)
  |
  v
Zustand Store (shared state)
  |
  v
AudioEngine (main thread, owns AudioContext)
  |
  v
AudioWorklet (audio thread, runs synthesis)
```

- React never touches AudioNodes directly
- AudioEngine reads from Zustand store for config (BPM, performer count)
- AudioEngine writes to Zustand store for display state (current pattern, beat position)
- The scheduler loop runs via `setTimeout` on the main thread but schedules notes using `AudioContext.currentTime` (the "two clocks" pattern)

### Sample Loading Strategy

For sampled instruments:
- Decode audio files with `AudioContext.decodeAudioData()`
- Store decoded `AudioBuffer` objects in a cache (plain Map, not React state)
- Create new `AudioBufferSourceNode` per note (they are one-shot by design)
- Preload all samples before performance starts -- do NOT lazy-load during playback

### Euclidean Rhythm Generation

Bjorklund's algorithm is ~30 lines of TypeScript. Do NOT add a dependency for this. Implement it directly:

```typescript
function euclidean(onsets: number, steps: number): boolean[] {
  // Bjorklund's algorithm
  // Returns array of length `steps` with `onsets` evenly distributed
}
```

## Installation

```bash
# Scaffold
npm create vite@latest intempo -- --template react-ts

# Core UI
npx shadcn@latest init
npm install zustand

# Music theory (tree-shakeable, import only needed modules)
npm install @tonaljs/tonal

# Dev tooling
npm install -D eslint @eslint/js typescript-eslint eslint-config-prettier prettier vitest @testing-library/react
```

Note: No audio libraries to install. Web Audio API is a browser native. That is the point.

## Version Verification Checklist

All versions below should be verified with `npm view <pkg> version` before project scaffolding, as they are based on May 2025 training data:

- [ ] `react` -- expected ^19.0
- [ ] `vite` -- expected ^6.x
- [ ] `typescript` -- expected ^5.7
- [ ] `tailwindcss` -- expected ^4.x
- [ ] `zustand` -- expected ^5.x
- [ ] `@tonaljs/tonal` -- expected ^6.x
- [ ] `vitest` -- expected ^2.x
- [ ] `eslint` -- expected ^9.x

## Sources

- Training data (cutoff May 2025) -- all version numbers are MEDIUM confidence
- Chris Wilson, "A Tale of Two Clocks" (web.dev) -- canonical Web Audio scheduling pattern
- Web Audio API specification (W3C) -- AudioWorklet, AudioContext.currentTime
- Bjorklund, "The Theory of Rep-Rate Pattern Generation in the SNS Timing System" (2003) -- Euclidean rhythm algorithm
- Project constraints from `.planning/PROJECT.md`
