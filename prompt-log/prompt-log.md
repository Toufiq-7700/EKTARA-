# Recursive Garden — Prompt Log

> This file contains every prompt sent and the agent's response, in order.
> It serves as the complete build history for the hackathon submission.

---

## Prompt 0: Project Setup and Scaffold

### Prompt

You are helping me build a hackathon project called "Recursive Garden".

CHALLENGE: Turn a recursive function into a relaxing musical experience. Build an interactive web app that takes user-defined recursion parameters, simulates a recursive process, and transforms it into an original musical composition using tones, rhythm, harmony, timbre, sound effects, and ambient audio. It must have: (1) functional recursive algorithms with configurable parameters, (2) an interactive visualization, (3) a procedural music generator driven by the recursion, (4) a UI with parameter controls and audio playback, (5) a working audio export (WAV), (6) a polished, accessible, relaxing experience. Judging: relaxation/UX 35%, musical quality 25%, creative use of recursion 15%, visual design 10%, interaction/usability 10%, technical execution 5%.

CONCEPT: Four recursive algorithms working together, driven by one seed:
- Norgard infinity series (n(0)=0, n(2k)=-n(k), n(2k+1)=n(k)+1) -> melody
- Tower of Hanoi (recursive move generation) -> bass and pulse
- Euclidean rhythm via the recursive Bjorklund algorithm -> soft percussion
- L-system (recursive rewriting) -> the main visual, a growing tree whose branch angles come from the Norgard values

Signature feature: a "Depth Dial" that raises or lowers the recursion depth of all four at once, so the user can hear and see recursion deepen.

TECH: Vite + vanilla JavaScript (ES modules), Tone.js via npm, Canvas 2D. Static site, deployable to Vercel with no backend.

HARD RULES:
1. Create a /prompt-log folder. After EVERY prompt I send, save a file prompt-log/NN-short-title.md containing my exact prompt and your full response, verbatim. This is mandatory for the hackathon.
2. Architecture: recursion code generates a pure "score" (array of timed events) with no audio or drawing inside the algorithm files. Playback, visuals, and WAV export all consume that same score.
3. Everything must be deterministic from a seed (use a seeded PRNG, never Math.random).
4. Keep the algorithm modules small, readable, and commented, since judges will read them.

For this first step, only set up the project: Vite scaffold, folder structure (src/algorithms, src/audio, src/visuals, src/ui), prompt-log folder, a .gitignore, a README stub, and a blank page with a "Begin" button. Do not write the algorithms yet. Save the log file for this prompt.

### Response

**Completed.** Set up the full project scaffold:

**Folder structure:**
```
recursive-garden/
├── prompt-log/
│   └── prompt-log.md          ← this consolidated log
├── src/
│   ├── algorithms/            ← pure recursive functions (Prompt 1)
│   ├── audio/                 ← Tone.js engine (Prompt 2)
│   ├── visuals/               ← Canvas 2D renderer (Prompt 3)
│   ├── ui/                    ← Controls and panel (Prompt 4)
│   ├── main.js                ← entry point with Begin button handler
│   └── styles.css             ← base styles
├── public/
├── tests/
├── index.html                 ← welcome screen + canvas
├── package.json               ← vite, vitest, tone.js
├── vite.config.js
├── .gitignore
└── README.md
```

**What was created:**
- `package.json` with Vite 5, Vitest, and Tone.js dependencies
- `vite.config.js` configured for root build
- `index.html` with a welcome screen featuring "Begin" button and headphone hint
- `src/main.js` — handles Begin click, fades welcome, shows fullscreen canvas, handles resize with devicePixelRatio
- `src/styles.css` — dark theme, smooth welcome transition, reduced-motion support
- `.gitignore` — node_modules, dist, IDE files
- `README.md` — project stub with quick start

**Architecture note:** The Begin button is intentional — it satisfies browser autoplay policies by requiring a user gesture before initializing AudioContext (Prompt 2).

---

