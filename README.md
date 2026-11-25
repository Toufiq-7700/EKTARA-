# 🌳 Recursive Garden

**Recursive Garden** is an interactive audiovisual meditation where four classical recursive algorithms weave together melody, harmony, rhythm, and living fractal visuals from a single shared seed and clock. Adjust the signature **Depth Dial** (1–8) to hear and watch recursion deepen in real time: the L-system tree grows new generations whose branch angles are shaped by the Nørgård infinity melody, octave-up recursive canons shimmer over warm Tower of Hanoi bass pillars, and a rotating Euclidean ring of fireflies pulses with soft percussion.

> 📸 _Screenshot placeholder: add a screenshot or animated GIF of Recursive Garden (Dusk / X-Ray mode) here before publishing._

---

## How the Four Recursive Algorithms Work

Every parameter feeds into pure, deterministic recursive functions in `src/algorithms/` that emit a single timed event **score** (`buildScore`). Live playback, 60fps Canvas 2D visuals, and offline WAV export all consume that exact same score.

| Algorithm | Recursive Definition | Musical Role | Visual Role |
|---|---|---|---|
| **Nørgård Infinity Series** (`src/algorithms/norgard.js`) | `n(0) = 0`, `n(2k) = -n(k)`, `n(2k+1) = n(k) + 1` (memoized) | **Melody & Recursive Canons:** Values map to quantised scale degrees (`pentatonic`, `lydian`, `dorian`); deeper depth adds faster, quieter octave-up canons. | **Tree Geometry & Glow:** Sets each branch's turn angle so the tree's silhouette *is* the melody; active branches glow as notes sound. |
| **Tower of Hanoi** (`src/algorithms/hanoi.js`) | `hanoi(n, A, C, B)`: move `n-1` discs to auxiliary peg, move disc `n`, move `n-1` back | **Bass & Pulse:** Target peg selects harmonic interval (`A` root, `B` fifth, `C` octave); larger discs play longer, lower notes. | **Luminous Pillars:** Three glowing pillars at the base with discs arcing smoothly between pegs and ground ripples on impact. |
| **Euclidean Rhythm / Bjorklund** (`src/algorithms/bjorklund.js`) | Recursively pairs and distributes `k` hit groups across `n` steps (like Euclid's GCD) | **Soft Percussion:** Triggers chimes, brushed pink noise, and gentle wood-like taps distributed across stereo space. | **Firefly Ring:** Orbiting ring of fireflies around the tree connected by an active-hit polygon; each hit flashes its firefly. |
| **L-System** (`src/algorithms/lsystem.js`) | Recursive string rewriting (`axiom` + `rules` over `generations`, e.g. `F → FF+[+F-F-F]-[-F+F+F]`) | **Texture Density:** Generation depth scales overall harmonic and rhythmic richness via the Depth Dial. | **Hero Tree:** Turtle-graphics tree growing generation by generation, with tip leaves/blossoms, wind sway, and falling petals. |

Enable **X-Ray Mode** (`X` key or toggle in the panel) to inspect the live recursive call labels (`nørgård(i)`, `hanoi: disc d A→C`, `E(k,n)`) and call-stack depth bars directly on screen.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start the Vite development server
npm run dev

# Run the unit test suite (Vitest)
npm test

# Build for production
npm run build

# Preview the production build locally
npm run preview
```

---

## Exporting Audio (WAV) & Parameters

1. Click **Begin** to enter the garden and customize your seed, depth, scale, tempo, or preset.
2. In the **Export Composition** section of the control panel, choose a duration (**30 seconds**, **1 minute**, or **3 minutes**).
3. Click **⬇ Download WAV** to render the score offline via `Tone.Offline` using the identical synth voices, convolution reverb (plus a 6-second reverb tail), stereo delay, ambient layers, and `-3 dB` limiter — encoded as a deterministic 16-bit stereo PCM WAV (`recursive-garden-<seed>-<depth>.wav`).
4. Click **📄 JSON** next to it to save the exact composition parameters (`recursive-garden-<seed>-<depth>.json`), or click **🔗 Copy Share Link** to encode parameters into the URL hash.

---

## Project Structure

```text
EKTARA-/
├── prompt-log/
│   └── prompt-log.md          # Complete verbatim prompt & response history
├── src/
│   ├── algorithms/
│   │   ├── bjorklund.js       # Recursive Euclidean rhythm distribution + rotation
│   │   ├── hanoi.js           # Recursive Tower of Hanoi move generator
│   │   ├── lsystem.js         # Recursive L-system rewriting + presets + parser
│   │   ├── norgard.js         # Memoized Nørgård infinity series
│   │   ├── prng.js            # Mulberry32 deterministic seeded PRNG
│   │   ├── scales.js          # Scale degree → MIDI / frequency mapping
│   │   └── score.js           # Unified score builder combining all 4 algorithms
│   ├── audio/
│   │   ├── engine.js          # Live Tone.js playback, loops, Evolve, sleep timer
│   │   ├── export.js          # Offline Tone.Offline render + 16-bit stereo WAV encoder
│   │   └── graph.js           # Shared Tone.js synth/effects graph for live & export parity
│   ├── ui/
│   │   └── controls.js        # Collapsible translucent panel, presets, accessibility
│   ├── visuals/
│   │   ├── atmosphere.js      # Gradient sky, twinkling stars, mist, ground, vignette
│   │   ├── fireflies.js       # Euclidean firefly ring & polygon
│   │   ├── hanoi.js           # Pillars, disc arcs, landing ripples
│   │   ├── renderer.js        # 60fps Canvas 2D orchestrator synced to audio clock
│   │   ├── themes.js          # Dusk, Moss, Moonlight, and Ember palettes
│   │   ├── tree.js            # Normalized L-system tree, glow, wind sway, petals
│   │   └── xray.js            # Recursion X-Ray overlay
│   ├── main.js                # Entry point, welcome flow, URL hash state, wheel zoom
│   └── styles.css             # Responsive & accessible dark-mode UI styles
├── tests/
│   ├── algorithms.test.js     # 39 unit & depth 1–8 stress tests
│   └── export.test.js         # 5 WAV encoder & JSON export tests
├── index.html
├── package.json
├── vite.config.js
└── vitest.config.js
```

---

## Tech Stack

- **Build Tool:** Vite 5
- **Language:** Vanilla JavaScript (ES Modules)
- **Audio Synthesis & Offline Rendering:** Tone.js (`tone`)
- **Graphics:** HTML5 Canvas 2D (`requestAnimationFrame`, `devicePixelRatio` aware)
- **Testing:** Vitest

---

## Prompt Log

Every prompt sent and response produced while building Recursive Garden is recorded chronologically in [`prompt-log/prompt-log.md`](./prompt-log/prompt-log.md).

---

## Deployment (Vercel)

This project is a zero-backend static Vite app and deploys to Vercel with default settings (build command: `npm run build`, output directory: `dist`; no `vercel.json` needed).
