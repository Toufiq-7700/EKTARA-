<div align="center">
  <h1>🪕 EKTARA · একতারা</h1>
  <p><strong>One string, one rule, infinite music.</strong><br/>
  <em>Where algorithms meet sound · একটি সূত্র, অসীম সুর</em></p>
  <p><a href="https://your-ektara-demo.vercel.app"><strong>🌐 Live Demo (Placeholder)</strong></a></p>
</div>

**EKTARA (`একতারা`)** is an interactive audiovisual meditation where four recursive algorithms weave together melody, bass lines, rhythm, an interactive Ektara drone string, and living fractal visuals — all from a single seed and shared clock. Everything is deterministic: the same seed always reproduces the same composition, playable live in the browser and exportable to 16-bit stereo WAV with no audio files required.

---

## Story Behind the Name

The **Ektara** (`একতারা`, literally *"one string"*) is Bengal's iconic one-stringed folk instrument played by Baul mystic minstrels. From one resonator, a split bamboo neck, and a single plucked string bent subtly by hand pressure, players conjure shifting harmonies and timeless melodies. EKTARA applies that philosophy to recursive computing: *one string, one rule, infinite music* — and places a playable virtual ektara directly inside the Garden alongside an evolving soft drone layer.

---

## Languages (`EN` & `বাংলা`)

EKTARA supports live **English (`EN`)** and **Bengali (`বাংলা`)** switching (`src/i18n/`) across the landing screen, workspace controls, role cards, descriptions, and explainer using self-hosted `@fontsource/noto-sans-bengali` and `@fontsource/hind-siliguri` fonts (offline & Vercel ready). Technical algorithm terms (`Nørgård`, `Tower of Hanoi`, `Euclidean (Bjorklund)`, `L-System`, `Thue-Morse`, `Fibonacci Word`, `Gray Code`, `Cantor Set`) stay readable in Latin script alongside plain Bengali explanations.

---

## Screenshots

| Landing Hero (`100vh` + Algorithm Backdrop) | Split View (Garden + Algorithm Lab) | Mobile & Bengali (`বাংলা`) Mode |
|---|---|---|
| 📸 _Placeholder: Landing hero screenshot showing floating algorithm names & Ektara emblem_ | 📸 _Placeholder: Desktop Split View showing Garden canvas + Lab simulation_ | 📸 _Placeholder: 360px mobile view in বাংলা_ |

---

## Table of Contents

- [Key Features](#key-features)
- [The Four Recursive Algorithms](#the-four-recursive-algorithms)
  - [🎵 Melody — Nørgård Infinity Series](#-melody--nørgård-infinity-series)
  - [🗼 Bass — Tower of Hanoi](#-bass--tower-of-hanoi)
  - [⭕ Rhythm — Euclidean / Bjorklund](#-rhythm--euclidean--bjorklund)
  - [🌿 Visual Tree — L-System](#-visual-tree--l-system)
- [Alternative Algorithm Plugins](#alternative-algorithm-plugins)
- [Algorithm Lab](#algorithm-lab)
- [Sound Design](#sound-design)
- [Views & Interface](#views--interface)
- [User-Defined Recursion Parameters](#user-defined-recursion-parameters)
- [Exporting & Sharing](#exporting--sharing)
- [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Deployment](#deployment)

---

## Key Features

- **Four recursive algorithms** drive melody, bass, rhythm, and visuals simultaneously from one seed
- **Pluggable algorithm registry** — 12 algorithm plugins across 4 roles, swappable via dropdowns
- **Algorithm Lab** — step-by-step recursive call visualization synced with audio playback
- **Split View** — Garden (canvas visuals) on the left, Lab (algorithm inspector) on the right
- **X-Ray Mode** — recursion overlay directly on the Garden canvas
- **Warm procedural sound** — FM synthesis, plucked strings, singing bowls, brushed noise percussion (no audio files)
- **4 selectable melody timbres** — Glass Bell, Music Box, Kalimba, Singing Bowl
- **Humanised playback** — seeded random timing/velocity/pitch drift so nothing sounds mechanical
- **Full parameter control** — sliders and inputs for every recursion parameter, updating sound and visuals live
- **Deterministic export** — offline WAV rendering via `Tone.Offline` (30s / 1m / 3m with 6s reverb tail)
- **Presets** — Quiet Forest, Moonlit Pond, Deep Dream, Morning Light
- **Ambient atmosphere** — procedural wind, layered rain with canopy splashes, distant thunder
- **Themes** — Dusk, Moss, Moonlight, Ember color palettes
- **URL sharing** — full parameter state encoded in the URL hash
- **Safety-capped & Auto Quality** — score builder limits output to 4,000 events and adaptive Auto Quality scales glow/rain automatically to sustain 60fps at depth 7
- **70 unit tests** covering algorithms, registry combos, exports, sound, rain, and i18n

---

## The Four Recursive Algorithms

Every parameter feeds into pure, deterministic recursive functions in `src/algorithms/` that produce a single timed event **score** (`buildScore`). Live playback, 60fps Canvas 2D visuals, Lab simulations, and offline WAV export all consume that exact same score.

| Role | Default Algorithm | Musical / Visual Output | Key Parameters |
|---|---|---|---|
| **◆ Melody** | **Nørgård Infinity Series** | Self-similar scale melody + octave canon | Length, offset, interval step `d`, canon layers & speed |
| **▬ Bass** | **Tower of Hanoi** | Disc-size pitch/duration bass + luminous pillars | Discs (2–8), start/target pegs, peg intervals, move limit |
| **● Rhythm** | **Euclidean (Bjorklund)** | Evenly spaced percussion + orbiting firefly ring | Rings (1–3), pulses `k`, steps `n`, rotation, accent |
| **▲ Visual Tree** | **L-System** | Fractal tree whose branch angles track melody | Axiom, rules, generations (1–8), turn angle, leaf density |

### 🎵 Melody — Nørgård Infinity Series

**Role badge:** ◆ (diamond) &nbsp;|&nbsp; **Color:** cyan/teal

The melody is generated by Per Nørgård's infinity series, a self-similar integer sequence where every note contains smaller copies of the whole sequence inside itself.

**Recursive definition:**
- `n(0) = 0`
- `n(2k) = -n(k)`
- `n(2k+1) = n(k) + d` (where `d` is the interval step, default 1)

**How it becomes music:**
- Each integer in the sequence is mapped to a scale degree (pentatonic, lydian, or dorian)
- Values are quantised to the chosen scale and clamped to configurable octave limits
- Large melodic leaps are limited to keep the result relaxing
- The sequence shapes tree branch angles and glow intensity in the Garden visual

**User-controllable parameters:**
- Sequence length (8–256 notes)
- Start index offset (0–512, pick any point in the infinite series)
- Interval step `d` (1–3, generalises the recursive rule)
- Canon layers (0–3) with speed ratio (2× or 3×)
- Register range (low/high octave limits)

### 🗼 Bass — Tower of Hanoi

**Role badge:** ▬ (bar) &nbsp;|&nbsp; **Color:** amber/orange

The bass line comes from the classic Tower of Hanoi puzzle. Each recursive move of a disc between pegs becomes a bass note.

**Recursive definition:**
```
hanoi(n, source, target, auxiliary):
  hanoi(n-1, source, auxiliary, target)
  move disc n from source → target
  hanoi(n-1, auxiliary, target, source)
```

**How it becomes music:**
- Each peg (A, B, C) maps to a pitch interval (root, fifth, octave, third — configurable)
- Larger discs produce longer, lower notes; smaller discs produce shorter, higher notes
- The result is a naturally recursive bass pattern where `2^n - 1` moves create a full cycle
- Visually, luminous pillars and disc arcs animate each move in the Garden

**User-controllable parameters:**
- Number of discs (2–8), with live display of total moves (`2^n - 1`)
- Start peg and target peg
- Peg-to-note mapping (choose intervals for pegs A, B, C)
- Move limit per loop (keeps large disc counts relaxing)

### ⭕ Rhythm — Euclidean / Bjorklund

**Role badge:** ● (circle) &nbsp;|&nbsp; **Color:** green

The rhythm uses the Bjorklund algorithm (Euclidean rhythm), which distributes a given number of hits as evenly as possible across a cycle of steps — the same mathematical principle found in traditional rhythms worldwide.

**Recursive definition:**
- Start with two groups: `k` hits and `n-k` rests
- Recursively merge the smaller group into the larger, distributing evenly
- Example: `E(3,8)` → `[x][x][x][.][.][.][.][.]` → `[x.][x.][x.][.][.]` → `[x..][x..][x.]`

**How it becomes music:**
- Each hit triggers soft brushed noise, a muted wooden tap, or a filtered chime
- Supports 1–3 polyrhythmic rings, each with independent pulses/steps/rotation
- An accent pattern highlights every Nth hit
- Visually, an orbiting firefly ring and polygon pulse with each beat

**User-controllable parameters:**
- Pulses `k` (1–16) and steps `n` (2–32), with validation `k ≤ n`
- Rotation (0 to n-1)
- Accent every Nth hit
- Number of rings (1–3) for polyrhythm, each with its own `k`, `n`, rotation

### 🌿 Visual Tree — L-System

**Role badge:** ▲ (triangle) &nbsp;|&nbsp; **Color:** green/emerald

The fractal tree in the Garden is grown using an L-system (Lindenmayer system), where simple string-rewriting rules produce complex branching structures.

**Recursive definition:**
- Start with an axiom string (e.g., `X`)
- Apply production rules each generation (e.g., `F → FF+[+F-F-F]-[-F+F+F]`)
- Interpret the resulting string as turtle graphics commands (`F` = draw, `+/-` = turn, `[/]` = push/pop)

**How it becomes visuals:**
- Branch angles are modulated by the melody values, so the tree shape IS the music
- Wind sway, tip leaves, rain-hit branch dips, and falling petals add organic movement
- 4 built-in presets: Fern, Binary Tree, Wispy Bush, Canopy — or create Custom rules

**User-controllable parameters:**
- Axiom (text input)
- Production rules editor (add/edit/delete, with symbol validation: `F, +, -, [, ], X, Y`)
- Generations (1–8) with live command count estimate and automatic safety cap
- Turn angle, length ratio, line thickness, leaf density

---

## Alternative Algorithm Plugins

Each role supports multiple algorithm plugins that can be swapped via a dropdown in the Algorithm Lab or the control drawer. The plugin registry (`src/algorithms/registry.js`) ensures all algorithms share a uniform interface.

### Melody Alternatives

| Algorithm | Recursive Rule | Character |
|---|---|---|
| **Thue-Morse** | `t(2n) = t(n)`, `t(2n+1) = 1-t(n)` | Aperiodic binary walk that avoids mechanical repeats |
| **Fibonacci Word** | `S_n = S_(n-1) + S_(n-2)` | Concatenating generations shapes golden-ratio phrase lengths |

### Bass Alternatives

| Algorithm | Recursive Rule | Character |
|---|---|---|
| **Recursive Gray Code** | Reflect-and-prefix `n`-bit codes | Only one bit flips per step — smooth, minimal bass movement |
| **Cantor Set Bass** | Recursively remove the middle third | Warm bass anchors interspersed with deep, fractal rest patterns |

### Rhythm Alternatives

| Algorithm | Recursive Rule | Character |
|---|---|---|
| **Cantor Set Pattern** | Middle-third removal on a beat grid | Spacious, meditative rhythmic breathing with fractal gaps |
| **Thue-Morse Pattern** | Alternating self-similar 0/1 stream | Soft brushes and chimes driven by aperiodic binary parity |

### Visual Tree Alternatives

| Algorithm | Recursive Rule | Character |
|---|---|---|
| **Koch Curve** | `F → F+F--F+F` at 60° | Each edge splits into four segments forming a crystalline snowflake crest |
| **Sierpinski Triangle** | `X → YF+XF+Y`, `Y → XF-YF-X` at 60° | Mutually recursive arrowhead rules fold into a self-similar triangle |

---

## Algorithm Lab

The Algorithm Lab provides a dedicated space to inspect how each recursive algorithm works in real time:

- **Role cards** — four large cards (Melody, Bass, Rhythm, Visual Tree) each showing the active algorithm, a plain-English description, and an on/off switch
- **Solo mode** — isolate any single layer in both audio and visuals
- **Algorithm dropdown** — swap the algorithm for each role; the parameter controls, Lab simulation, and sound update with a smooth crossfade
- **Live simulation canvas** — shows the active algorithm's recursion visually:
  - **Nørgård:** binary derivation tree, sequence tiles, pitch-contour graph, self-similarity overlay
  - **Hanoi:** 3-peg disc animation with recursive call tree and move counter
  - **Euclidean:** Bjorklund merge steps and sweeping rhythm wheel
  - **L-System:** generation scrubber, colored symbol string, and turtle cursor
  - Each alternative plugin has its own dedicated simulation
- **Step mode** — pause playback and step through events one by one (`⏮ / ⏭`), with each step highlighted in both the Lab simulation and the Garden
- **What You Hear timeline** — a 4-lane piano roll showing all roles, with hover-to-highlight linking between Lab and Garden
- **Playback speed** — 0.25×, 0.5×, 1×, 1.5×, 2×

---

## Sound Design

All sound is procedurally synthesized using Tone.js — no audio files are loaded.

### Instrument Timbres

| Layer | Synthesis | Character |
|---|---|---|
| **Melody** (4 choices) | **Glass Bell:** FM synthesis, low mod index, long decay · **Music Box:** sine + octave partial, short attack · **Kalimba:** plucked string with filter envelope · **Singing Bowl:** detuned sine partials (1×, 2.76×, 5.4×), slow decay | Warm, organic, with subtle vibrato and pitch drift |
| **Bass** | Sine + triangle blend, gentle low-pass, soft attack (30–80ms), light saturation | Audible on small speakers without being boomy |
| **Ambient Pad** | 3–4 detuned oscillators, slow LFO filter, chorus, long release | Chords bloom slowly under the other layers |
| **Percussion** | Band-passed noise (brush), short filtered click (wooden tap), filtered chime | Soft at low velocity with humanised timing |

### Humanisation

Every note has seeded random variations in:
- Timing: ±10–25ms
- Velocity: ±10%
- Note length: slight variation
- Pitch: tiny random drift (a few cents)

---

## Views & Interface

| View | Description |
|---|---|
| **🌳 Garden** | Full-screen canvas with the fractal tree, Hanoi pillars, Euclidean firefly ring, atmospheric effects (rain, wind, stars, mist), and optional X-Ray recursion overlay |
| **◫ Split** | Garden on the left, Algorithm Lab on the right (desktop only, auto-switches to Garden on mobile) |
| **🔬 Lab** | Full-screen Algorithm Lab |
| **☰ Controls** | Collapsible side drawer with all global parameters, recursion parameters, sound timbres, layer volumes, presets, export, and share |

### Themes & Atmosphere

- **4 color themes:** Dusk, Moss, Moonlight, Ember
- **Ambient sound:** Wind (default), Rain, or None
- **Rain system:** 3-layer pooled rainfall (up to 1,500 particles), canopy splashes, ground mist, with intensity slider
- **Thunder:** Soft distant rumbles during heavy rain
- **Sleep timer:** 5, 15, or 30 minutes auto-stop

---

## User-Defined Recursion Parameters

Every algorithm exposes its recursion parameters as sliders and inputs — both in the Algorithm Lab cards and mirrored in the control drawer under "Recursion Parameters." All changes update the sound and visuals live.

Each parameter includes a plain-English tooltip, a live value readout, and a reset-to-default button. A seeded "Randomise" button generates deterministic variations.

---

## Exporting & Sharing

| Action | What It Does |
|---|---|
| **⬇ Download WAV** | Offline render via `Tone.Offline` with all current parameters, saved as `ektara-<seed>-<depth>.wav` (16-bit stereo, 44.1kHz) |
| **📄 JSON** | Export all parameters as `ektara-<seed>-<depth>.json` |
| **📂 Load** | Import a previously saved JSON parameter file |
| **🔗 Copy Share Link** | Encode the full parameter state in the URL hash — anyone with the link hears the same composition |

Export durations: 30 seconds, 1 minute, or 3 minutes (each with a 6-second reverb tail).

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

## Project Structure

```text
EKTARA-/
├── prompt-log/
│   └── prompt-log.md          # Complete verbatim prompt & response history
├── src/
│   ├── algorithms/
│   │   ├── bjorklund.js       # Recursive Euclidean rhythm, merge steps, validation
│   │   ├── cantor.js          # Recursive middle-third Cantor set (bass & rhythm)
│   │   ├── fibonacciWord.js   # Recursive Fibonacci word substitution (melody)
│   │   ├── grayCode.js        # Recursive reflect-and-prefix Gray code (bass)
│   │   ├── hanoi.js           # Recursive Tower of Hanoi move generator
│   │   ├── lsystem.js         # Rewriting, symbol validation, Koch & Sierpinski presets
│   │   ├── meta.js            # Canonical role colors, shapes & step captions
│   │   ├── norgard.js         # Memoized generalised Nørgård series (d = 1..3)
│   │   ├── params.js          # Parameter schema, normalizer, presets & randomiser
│   │   ├── prng.js            # Mulberry32 deterministic seeded PRNG
│   │   ├── registry.js        # Uniform plugin registry for all 4 roles
│   │   ├── scales.js          # Scale degree → MIDI, octave clamping, frequencies
│   │   ├── score.js           # Registry-driven score builder with 4,000-event cap
│   │   └── thueMorse.js       # Recursive Thue-Morse parity sequence (melody & rhythm)
│   ├── audio/
│   │   ├── engine.js          # Live Tone.js playback, smooth crossfade, step preview
│   │   ├── export.js          # Offline Tone.Offline render + 16-bit stereo WAV encoder
│   │   ├── graph.js           # Shared synth/effects chain for live & export parity
│   │   ├── instruments.js     # Glass Bell, Music Box, Kalimba, Singing Bowl, Bass, Pad, Perc
│   │   └── rain.js            # Layered procedural stereo rain + droplets + thunder
│   ├── i18n/
│   │   ├── bn.js              # Bengali (বাংলা) dictionary with Latin technical names
│   │   ├── en.js              # English (EN) dictionary
│   │   └── index.js           # i18n runtime, localStorage persistence & t() helper
│   ├── lab/
│   │   ├── labController.js   # Role cards, algorithm switcher, On/Off, Solo & step mode
│   │   ├── simEuclidean.js    # Bjorklund step-by-step merge & sweeping rhythm wheel
│   │   ├── simHanoi.js        # 3-peg animation & recursive call tree
│   │   ├── simLSystem.js      # Generation scrubber, colored symbols & turtle cursor
│   │   ├── simNorgard.js      # Binary derivation tree, tiles & self-similarity contour
│   │   ├── simPlugins.js      # Dedicated Lab sims for Thue-Morse, Fibonacci, Gray & Cantor
│   │   └── timelineStrip.js   # "What You Hear" 4-lane role piano roll
│   ├── ui/
│   │   ├── controls.js        # Collapsible control drawer, presets, JSON import/export
│   │   ├── landing.js         # Immersive landing backdrop & How It Works mini-canvases
│   │   ├── paramEditors.js    # Shared per-algorithm parameter editors & rule validator
│   │   └── tour.js            # Dismissible first-visit tooltip tour
│   ├── visuals/
│   │   ├── atmosphere.js      # Sky darkening, stars, rain ground mist, vignette
│   │   ├── ektaraString.js    # Playable virtual Ektara string & light ripples
│   │   ├── fireflies.js       # Euclidean firefly ring & polygon
│   │   ├── hanoi.js           # Luminous pillars, disc arcs & landing ripples
│   │   ├── rain.js            # 3-layer pooled rainfall (1500 max), splashes & canopy glints
│   │   ├── renderer.js        # 60fps Canvas 2D orchestrator, Auto Quality & hover hit-test
│   │   ├── themes.js          # Dusk, Moss, Moonlight, and Ember palettes
│   │   ├── tree.js            # Normalized L-system tree, glow, wind sway & petals
│   │   └── xray.js            # Recursion X-Ray overlay
│   ├── main.js                # Entry point, i18n, Bengali fonts, lazy load, view switcher
│   └── styles.css             # Responsive Split/Lab/Garden & accessible UI styles
├── public/
│   ├── favicon.svg            # Self-hosted Ektara vector favicon
│   └── og-image.png           # Self-hosted 1200x630 Open Graph preview image
├── tests/
│   ├── algorithms.test.js     # Core math, validation, safety cap & depth 1–8 tests
│   ├── export.test.js         # WAV encoder, filenames & JSON export tests
│   ├── i18n.test.js           # EN/BN key parity & i18n helper tests
│   ├── rain.test.js           # Rain particle pool & audio parameter tests
│   ├── registry.test.js       # New algorithm sequences & all 81 role combos tests
│   └── sound.test.js          # Timbre & seeded humanisation tests
├── LICENSE
├── index.html
├── package.json
├── vite.config.js
└── vitest.config.js
```

---

## Tech Stack

- **Build Tool:** Vite 5
- **Language:** Vanilla JavaScript (ES Modules)
- **Audio Synthesis & Offline Rendering:** Tone.js
- **Graphics:** HTML5 Canvas 2D (60fps, `devicePixelRatio` aware)
- **Typography:** Self-hosted `@fontsource/noto-sans-bengali` & `@fontsource/hind-siliguri`
- **Testing:** Vitest (70 tests across 6 test files)

---

## Deployment

This project is a zero-backend static Vite app and deploys to Vercel with default settings (build command: `npm run build`, output directory: `dist`; no `vercel.json` needed).

---

## Prompt Log

Every prompt sent and response produced while building EKTARA is recorded chronologically in [`prompt-log/prompt-log.md`](./prompt-log/prompt-log.md).
