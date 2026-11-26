# 🌳 Recursive Garden

**Recursive Garden** is an interactive audiovisual meditation where four classical recursive algorithms weave together melody, harmony, rhythm, and living fractal visuals from a single shared seed and clock. Open directly in **Split View** (Garden on the left, **Algorithm Lab** on the right) to inspect every recursive call live, customize parameters for each algorithm individually, toggle or solo layers across sound and visuals, and export deterministic 16-bit stereo WAV audio.

> 📸 _Screenshot placeholder: add a screenshot or animated GIF of Recursive Garden (Split View / X-Ray mode) here before publishing._

---

## How the Four Recursive Algorithms Work

Every parameter feeds into pure, deterministic recursive functions in `src/algorithms/` that emit a single timed event **score** (`buildScore`, safety-capped at `4,000` events). Live playback, 60fps Canvas 2D visuals, Algorithm Lab simulations, and offline WAV export all consume that exact same score.

| Algorithm | Recursive Definition | User-Defined Parameters | Musical & Visual Mapping |
|---|---|---|---|
| **Nørgård Infinity Series** (`src/algorithms/norgard.js`) | `n(0) = 0`, `n(2k) = -n(k)`, `n(2k+1) = n(k) + d` | Length (`8–256`), start offset (`0–512`), interval step `d` (`1–3`), canon layers (`0–3`), speed ratio (`2×`/`3×`), low/high octave range | **Melody & Tree Angles:** Quantised to `pentatonic`/`lydian`/`dorian`; shapes tree branch angles and glows active branches. |
| **Tower of Hanoi** (`src/algorithms/hanoi.js`) | `hanoi(n, src, dst, aux)`: move `n-1` to `aux`, move disc `n`, move `n-1` to `dst` (`2^n - 1` moves) | Discs (`2–8`), start & target pegs (`A`/`B`/`C`), custom peg-to-interval mapping, move limit per loop (`3–255`) | **Bass & Pillars:** Disc size controls note length/register; destination peg chooses harmonic interval while discs arc between luminous pillars. |
| **Euclidean Rhythm / Bjorklund** (`src/algorithms/bjorklund.js`) | Recursively distributes `k` hits evenly across `n` steps (Euclid's GCD) | Polyrhythm rings (`1–3`), per-ring pulses `k` (`1–16`), steps `n` (`2–32`, `k <= n`), rotation (`0..n-1`), accent every `N`th hit | **Soft Percussion & Fireflies:** Brushed noise, wooden taps, and soft chimes synced to an orbiting ring of fireflies and polygon. |
| **L-System** (`src/algorithms/lsystem.js`) | Recursive string rewriting (`axiom` + validated `rules` over `generations`, safety-capped) | Axiom, editable/addable/deletable production rules (`F, +, -, [, ], X, Y`), generations (`1–8`), turn angle, length ratio, line thickness, leaf density, plus presets | **Hero Tree & Texture Density:** Turtle-graphics tree with wind sway, tip leaves, rain-hit branch dips, and falling petals. |

Use **Algorithm Lab** (or press `X` for **X-Ray Mode**) to view binary derivation trees, Hanoi call stacks, Bjorklund step-by-step merges, turtle cursor rewriting, step-by-step audio playback (`⏮`/`⏭ Step`), and linked Garden ↔ Lab hover highlighting.

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

## Exporting Audio (WAV) & Sharing Parameters

1. Click **Begin** to enter **Split View** (Garden + Algorithm Lab) and customize global or per-algorithm recursion parameters, instrument timbres, and rain intensity.
2. In the **Export Composition** section of the control drawer (`☰ Controls`), choose **30 seconds**, **1 minute**, or **3 minutes**.
3. Click **⬇ Download WAV** to render the exact score and all active parameters offline via `Tone.Offline` with a 6-second reverb tail — saved as `recursive-garden-<seed>-<depth>.wav`.
4. Click **📄 JSON** to export all parameters (`recursive-garden-<seed>-<depth>.json`), **📂 Load** to restore any saved JSON configuration, or **🔗 Copy Share Link** to encode every parameter in the URL hash.

---

## Project Structure

```text
EKTARA-/
├── prompt-log/
│   └── prompt-log.md          # Complete verbatim prompt & response history
├── src/
│   ├── algorithms/
│   │   ├── bjorklund.js       # Recursive Euclidean rhythm, merge steps, validation
│   │   ├── hanoi.js           # Recursive Tower of Hanoi move generator
│   │   ├── lsystem.js         # Recursive rewriting, symbol validation & safety cap
│   │   ├── meta.js            # Canonical algorithm colors, shapes & step captions
│   │   ├── norgard.js         # Memoized generalised Nørgård series (d = 1..3)
│   │   ├── params.js          # Parameter schema, normalizer, presets & randomiser
│   │   ├── prng.js            # Mulberry32 deterministic seeded PRNG
│   │   ├── scales.js          # Scale degree → MIDI, octave clamping, frequencies
│   │   └── score.js           # Unified score builder with 4,000-event safety cap
│   ├── audio/
│   │   ├── engine.js          # Live Tone.js playback, smooth crossfade, step preview
│   │   ├── export.js          # Offline Tone.Offline render + 16-bit stereo WAV encoder
│   │   ├── graph.js           # Shared synth/effects chain for live & export parity
│   │   ├── instruments.js     # Glass Bell, Music Box, Kalimba, Singing Bowl, Bass, Pad, Perc
│   │   └── rain.js            # Layered procedural stereo rain + droplets + thunder
│   ├── lab/
│   │   ├── labController.js   # Selector cards, On/Off, Solo, embedded editors & step mode
│   │   ├── simEuclidean.js    # Bjorklund step-by-step merge & sweeping rhythm wheel
│   │   ├── simHanoi.js        # 3-peg animation & recursive call tree
│   │   ├── simLSystem.js      # Generation scrubber, colored symbols & turtle cursor
│   │   ├── simNorgard.js      # Binary derivation tree, tiles & self-similarity contour
│   │   └── timelineStrip.js   # "What You Hear" 4-lane scrolling piano roll
│   ├── ui/
│   │   ├── controls.js        # Collapsible control drawer, presets, JSON import/export
│   │   └── paramEditors.js    # Shared per-algorithm parameter editors & rule validator
│   ├── visuals/
│   │   ├── atmosphere.js      # Sky darkening, stars, rain ground mist, vignette
│   │   ├── fireflies.js       # Euclidean firefly ring & polygon
│   │   ├── hanoi.js           # Luminous pillars, disc arcs & landing ripples
│   │   ├── rain.js            # 3-layer pooled rainfall (1500 max), splashes & canopy glints
│   │   ├── renderer.js        # 60fps Canvas 2D orchestrator & linked hover hit-testing
│   │   ├── themes.js          # Dusk, Moss, Moonlight, and Ember palettes
│   │   ├── tree.js            # Normalized L-system tree, glow, wind sway & petals
│   │   └── xray.js            # Recursion X-Ray overlay
│   ├── main.js                # Entry point, 150ms debounced updates, view switcher
│   └── styles.css             # Responsive Split/Lab/Garden & accessible UI styles
├── tests/
│   ├── algorithms.test.js     # Core math, validation, safety cap & depth 1–8 tests
│   ├── export.test.js         # WAV encoder, filenames & JSON export tests
│   ├── rain.test.js           # Rain particle pool & audio parameter tests
│   └── sound.test.js          # Timbre & seeded humanisation tests
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
