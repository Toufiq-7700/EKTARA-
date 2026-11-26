/**
 * English (EN) translation dictionary for EKTARA (একতারা).
 * Keep keys 100% identical with src/i18n/bn.js (enforced by tests/i18n.test.js).
 */
export default {
  app: {
    name: 'EKTARA',
    nativeName: 'একতারা',
    concept: 'One string, one rule, infinite music.',
    tagline: 'Where algorithms meet sound',
    taglineSecondary: 'একটি সূত্র, অসীম সুর'
  },
  welcome: {
    subtitle: 'One string, one rule, infinite music. Four recursive algorithms weave melody, bass, rhythm, and living visuals from a single seed.',
    begin: 'Begin',
    preparing: 'Preparing...',
    headphones: '🎧 Headphones recommended'
  },
  views: {
    garden: '🌳 Garden',
    split: '◫ Split',
    lab: '🔬 Lab',
    controlsOpen: '☰ Controls'
  },
  status: {
    audioBlocked: 'Audio was blocked by your browser. Visuals are running.',
    audioRetryFailed: 'Audio is still blocked by your browser — check site sound permissions.',
    retryAudio: 'Retry Audio'
  },
  controls: {
    panelTitle: 'EKTARA',
    closePanel: 'Close controls',
    depthLabel: 'Recursion Depth',
    depthHint: 'How many layers of recursion — deeper = richer and more complex',
    seedLabel: 'Seed',
    seedHint: 'The starting number that makes each composition unique',
    randomSeedTitle: 'Surprise me!',
    scaleLabel: 'Scale / Mood',
    scaleHint: 'The set of notes — pentatonic is peaceful, lydian is dreamy',
    rootNoteLabel: 'Root Note',
    tempoLabel: 'Tempo',
    tempoHint: 'Speed of the music (BPM)',
    angleLabel: 'Branch Angle',
    angleHint: 'How wide the tree branches spread',
    densityLabel: 'Rhythm Density',
    densityHint: 'How many percussion hits in each cycle',
    treeShapeLabel: 'Tree Shape',
    themeLabel: 'Theme',
    ambientLabel: 'Ambient Sound',
    ambientWind: 'Wind',
    ambientRain: 'Rain',
    ambientNone: 'None',
    rainIntensityLabel: 'Rain Intensity',
    rainIntensityHint: 'Links visual rainfall, canopy splashes, and layered rain sound (0 = off)',
    rainOff: 'Off',
    thunderLabel: 'Distant Thunder',
    thunderHint: '(heavy rain only)',
    recursionParamsTitle: 'Recursion Parameters',
    recursionParamsHint: 'Algorithm choice & parameters per role (live synced with Lab)',
    soundPanelTitle: 'Sound — Instrument Timbres',
    soundPanelHint: 'Warm procedural timbres with vibrato & seeded humanisation',
    layerMelody: 'Melody',
    layerCanon: 'Canon',
    layerBass: 'Bass',
    layerPercussion: 'Percussion',
    layerAmbient: 'Ambient Pad',
    layerVolumesTitle: 'Layer Volumes',
    xrayLabel: 'X-Ray Mode',
    xrayHint: '(show recursion details)',
    evolveLabel: 'Evolve',
    evolveHint: '(seed changes each loop)',
    sleepLabel: 'Sleep Timer',
    sleepOff: 'Off',
    sleep5: '5 minutes',
    sleep15: '15 minutes',
    sleep30: '30 minutes',
    zoomLabel: 'Zoom into Tree',
    presetsLabel: 'Presets',
    shareBtn: '🔗 Copy Share Link to EKTARA',
    shareCopied: '✓ Link Copied!',
    explainerTitle: "What You're Seeing & Hearing",
    explainerNorgard: 'Nørgård Infinity Series → melody. A self-similar sequence where every value contains smaller copies of itself, creating a fractal melody.',
    explainerHanoi: 'Tower of Hanoi → bass. Discs move between pegs — big disc = slow low notes, small disc = quick high notes.',
    explainerEuclid: 'Euclidean Rhythm (Bjorklund) → percussion. Distributes beats as evenly as possible in a cycle, like folk rhythms around the world.',
    explainerLsystem: 'L-System → the tree. Rewriting rules grow branches recursively with angles from the melody, so the tree shape IS the music.',
    exportTitle: 'Export Composition',
    export30: '30 seconds (+6s tail)',
    export60: '1 minute (+6s tail)',
    export180: '3 minutes (+6s tail)',
    downloadWav: '⬇ Download WAV',
    exportJson: '📄 JSON',
    loadJson: '📂 Load',
    exportStarting: 'Starting offline render...',
    exportSaved: 'Saved {filename}',
    exportFailed: 'Export failed — please try a shorter duration or reload.',
    exportJsonError: 'Could not export parameters JSON.',
    loadJsonSuccess: 'Loaded {filename}',
    loadJsonError: 'Invalid JSON parameter file.'
  },
  presets: {
    'Quiet Forest': 'Quiet Forest',
    'Moonlit Pond': 'Moonlit Pond',
    'Deep Dream': 'Deep Dream',
    'Morning Light': 'Morning Light'
  },
  roles: {
    melody: 'Melody',
    bass: 'Bass',
    rhythm: 'Rhythm',
    tree: 'Visual Tree'
  },
  algorithms: {
    norgard: {
      name: 'Nørgård Infinity Series',
      desc: 'Self-similar integer sequence where every note mirrors smaller copies of itself.'
    },
    'thue-morse': {
      name: 'Thue-Morse Sequence',
      desc: 'Aperiodic binary walk (t(2n)=t(n), t(2n+1)=1-t(n)) that avoids mechanical repeats.'
    },
    'fibonacci-word': {
      name: 'Fibonacci Word',
      desc: 'Concatenating generations S_n = S_(n-1) + S_(n-2) shapes golden-ratio phrases.'
    },
    hanoi: {
      name: 'Tower of Hanoi',
      desc: 'Recursive disc moves between three pegs drive bass pitch and note duration.'
    },
    'gray-code': {
      name: 'Recursive Gray Code',
      desc: 'Reflect-and-prefix binary codes where only one bit flips each bass note.'
    },
    'cantor-bass': {
      name: 'Cantor Set Bass',
      desc: 'Recursively removes middle thirds to weave warm bass anchors with deep rests.'
    },
    bjorklund: {
      name: 'Euclidean (Bjorklund)',
      desc: 'Bjorklund recursion spaces hits evenly across steps like folk rhythms.'
    },
    'cantor-rhythm': {
      name: 'Cantor Set Pattern',
      desc: 'Fractal middle-third gaps create spacious, meditative rhythmic breathing.'
    },
    'thue-morse-rhythm': {
      name: 'Thue-Morse Pattern',
      desc: 'Alternating self-similar 0/1 stream drives soft brushes and chimes without monotony.'
    },
    lsystem: {
      name: 'L-System Tree',
      desc: 'String rewriting rules grow fractal branches angled by the melody.'
    },
    'koch-curve': {
      name: 'Koch Curve',
      desc: 'Each straight edge splits into four segments forming a crystalline crest.'
    },
    'sierpinski-triangle': {
      name: 'Sierpinski Triangle',
      desc: 'Mutually recursive arrowhead rules fold into a self-similar triangle.'
    }
  },
  lab: {
    solo: 'Solo',
    parameters: 'Parameters',
    play: '▶ Play',
    pause: '⏸ Pause',
    stepBack: '⏮ Step',
    stepFwd: '⏭ Step',
    replay: '↺ Replay',
    speed: 'Speed',
    scrubGen: 'Scrub Generation',
    captionDefault: 'Live playback — select any role card, swap its algorithm, or click Step.',
    captionResumed: 'Live playback resumed.',
    captionReplay: 'Replaying from start.',
    whatYouHear: 'What You Hear — Combined Recursive Layers',
    whatYouHearHint: 'Hover to highlight in Garden · Click to step to event',
    resetBtn: '↺ Reset',
    randomBtn: '🎲 Randomise'
  }
};
