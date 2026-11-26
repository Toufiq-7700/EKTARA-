/**
 * Canonical User-Defined Recursion Parameters, Validation, Presets & Seeded Randomiser
 *
 * Single source of truth shared across algorithms, score builder, Algorithm Lab,
 * Control Drawer, URL hash sharing, JSON export/import, and Tone.Offline WAV export.
 */

import { createPRNG } from './prng.js';
import { LSYSTEM_PRESETS, validateLSystem } from './lsystem.js';

export const MAX_SCORE_EVENTS = 4000;

export const PEG_INTERVAL_CHOICES = [
  { label: 'Root (0)', value: 0 },
  { label: 'Maj 2nd (+2)', value: 2 },
  { label: 'Min 3rd (+3)', value: 3 },
  { label: 'Maj 3rd (+4)', value: 4 },
  { label: 'Fourth (+5)', value: 5 },
  { label: 'Fifth (+7)', value: 7 },
  { label: 'Sixth (+9)', value: 9 },
  { label: 'Octave (+12)', value: 12 }
];

export const DEFAULT_TIMBRES = {
  melody: 'Glass Bell',
  canon: 'Match Melody',
  bass: 'Warm Blend',
  percussion: 'Brush & Wood',
  ambient: 'Blooming Pad'
};

export const DEFAULT_NORGARD_PARAMS = {
  length: 64,
  offset: 0,
  intervalStep: 1,
  canonLayers: 2,
  speedRatio: 2,
  lowOctave: 3,
  highOctave: 6
};

export const DEFAULT_HANOI_PARAMS = {
  discs: 4,
  startPeg: 'A',
  targetPeg: 'C',
  pegIntervals: { A: 0, B: 7, C: 12 },
  moveLimit: 31
};

export const DEFAULT_EUCLID_PARAMS = {
  ringsCount: 1,
  accentEvery: 3,
  rings: [
    { pulses: 5, steps: 16, rotation: 0 },
    { pulses: 3, steps: 12, rotation: 2 },
    { pulses: 7, steps: 16, rotation: 4 }
  ]
};

export const DEFAULT_LSYSTEM_PARAMS = {
  preset: 'Fern',
  axiom: 'X',
  rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' },
  generations: 4,
  turnAngle: 25,
  lengthRatio: 0.72,
  lineThickness: 6,
  leafDensity: 0.7
};

export const DEFAULT_PARAMS = {
  seed: 42,
  depth: 4,
  scale: 'pentatonic',
  rootNote: 60,
  tempo: 60,
  branchAngle: 25,
  densityEuclid: 1.0,
  lsystemPreset: 'Fern',
  theme: 'Dusk',
  ambient: 'wind',
  rainIntensity: 0.35,
  thunderEnabled: true,
  timbres: { ...DEFAULT_TIMBRES },
  norgard: { ...DEFAULT_NORGARD_PARAMS },
  hanoi: {
    ...DEFAULT_HANOI_PARAMS,
    pegIntervals: { ...DEFAULT_HANOI_PARAMS.pegIntervals }
  },
  euclid: {
    ...DEFAULT_EUCLID_PARAMS,
    rings: DEFAULT_EUCLID_PARAMS.rings.map(r => ({ ...r }))
  },
  lsystem: {
    ...DEFAULT_LSYSTEM_PARAMS,
    rules: { ...DEFAULT_LSYSTEM_PARAMS.rules }
  }
};

/**
 * Deep-merge and normalize partial/legacy parameters into valid defaults.
 */
export function normalizeParams(input = {}) {
  const depth = clampInt(input.depth ?? DEFAULT_PARAMS.depth, 1, 8);
  const seed = Math.max(0, Math.round(Number(input.seed ?? DEFAULT_PARAMS.seed) || 0));

  const nIn = input.norgard || {};
  const lowOctave = clampInt(nIn.lowOctave ?? DEFAULT_NORGARD_PARAMS.lowOctave, 2, 5);
  const highOctave = Math.max(lowOctave + 1, clampInt(nIn.highOctave ?? DEFAULT_NORGARD_PARAMS.highOctave, 3, 7));
  const norgard = {
    length: clampInt(nIn.length ?? Math.min(256, Math.pow(2, Math.min(depth + 2, 8))), 8, 256),
    offset: clampInt(nIn.offset ?? DEFAULT_NORGARD_PARAMS.offset, 0, 512),
    intervalStep: clampInt(nIn.intervalStep ?? DEFAULT_NORGARD_PARAMS.intervalStep, 1, 3),
    canonLayers: clampInt(nIn.canonLayers ?? Math.min(3, Math.max(0, depth - 1)), 0, 3),
    speedRatio: Number(nIn.speedRatio) === 3 ? 3 : 2,
    lowOctave,
    highOctave
  };

  const hIn = input.hanoi || {};
  const startPeg = ['A', 'B', 'C'].includes(hIn.startPeg) ? hIn.startPeg : 'A';
  let targetPeg = ['A', 'B', 'C'].includes(hIn.targetPeg) ? hIn.targetPeg : 'C';
  if (targetPeg === startPeg) {
    targetPeg = startPeg === 'C' ? 'A' : 'C';
  }
  const pegIntervals = {
    A: Number(hIn.pegIntervals?.A ?? 0),
    B: Number(hIn.pegIntervals?.B ?? 7),
    C: Number(hIn.pegIntervals?.C ?? 12)
  };
  const hanoi = {
    discs: clampInt(hIn.discs ?? Math.min(6, Math.max(2, depth)), 2, 8),
    startPeg,
    targetPeg,
    pegIntervals,
    moveLimit: clampInt(hIn.moveLimit ?? 31, 3, 255)
  };

  const eIn = input.euclid || {};
  const rawRings = Array.isArray(eIn.rings) && eIn.rings.length > 0
    ? eIn.rings
    : DEFAULT_EUCLID_PARAMS.rings;
  const rings = [0, 1, 2].map(idx => {
    const src = rawRings[idx] || DEFAULT_EUCLID_PARAMS.rings[idx];
    const steps = clampInt(src.steps ?? 16, 2, 32);
    const pulses = Math.min(steps, clampInt(src.pulses ?? 5, 1, 16));
    const rotation = clampInt(src.rotation ?? 0, 0, steps - 1);
    return { pulses, steps, rotation };
  });
  const euclid = {
    ringsCount: clampInt(eIn.ringsCount ?? DEFAULT_EUCLID_PARAMS.ringsCount, 1, 3),
    accentEvery: clampInt(eIn.accentEvery ?? DEFAULT_EUCLID_PARAMS.accentEvery, 1, 8),
    rings
  };

  const lIn = input.lsystem || {};
  const presetName = lIn.preset || input.lsystemPreset || 'Fern';
  const presetObj = LSYSTEM_PRESETS[presetName] || LSYSTEM_PRESETS['Fern'];
  const axiom = typeof lIn.axiom === 'string' && lIn.axiom.length > 0
    ? lIn.axiom
    : presetObj.axiom;
  const rules = (lIn.rules && typeof lIn.rules === 'object' && Object.keys(lIn.rules).length > 0)
    ? { ...lIn.rules }
    : { ...presetObj.rules };
  const validation = validateLSystem(axiom, rules);
  const safeAxiom = validation.valid ? axiom.replace(/\s+/g, '') : presetObj.axiom;
  const safeRules = validation.valid ? rules : { ...presetObj.rules };

  const lsystem = {
    preset: presetName,
    axiom: safeAxiom,
    rules: safeRules,
    generations: clampInt(lIn.generations ?? Math.min(presetObj.maxGen || 5, depth), 1, 8),
    turnAngle: clampNum(lIn.turnAngle ?? input.branchAngle ?? presetObj.angle, 10, 45),
    lengthRatio: clampNum(lIn.lengthRatio ?? DEFAULT_LSYSTEM_PARAMS.lengthRatio, 0.5, 0.9),
    lineThickness: clampNum(lIn.lineThickness ?? DEFAULT_LSYSTEM_PARAMS.lineThickness, 2, 10),
    leafDensity: clampNum(lIn.leafDensity ?? DEFAULT_LSYSTEM_PARAMS.leafDensity, 0, 1)
  };

  return {
    ...DEFAULT_PARAMS,
    ...input,
    seed,
    depth,
    tempo: clampInt(input.tempo ?? 60, 40, 90),
    rootNote: clampInt(input.rootNote ?? 60, 48, 72),
    branchAngle: lsystem.turnAngle,
    lsystemPreset: lsystem.preset,
    rainIntensity: clampNum(input.rainIntensity ?? 0.35, 0, 1),
    thunderEnabled: input.thunderEnabled ?? true,
    timbres: { ...DEFAULT_TIMBRES, ...(input.timbres || {}) },
    norgard,
    hanoi,
    euclid,
    lsystem
  };
}

/**
 * Derive depth-coupled algorithm defaults when the user drags the global Depth Dial.
 */
export function applyDepthToParams(params, newDepth) {
  const d = clampInt(newDepth, 1, 8);
  const presetObj = LSYSTEM_PRESETS[params.lsystem?.preset || params.lsystemPreset] || LSYSTEM_PRESETS['Fern'];
  const ring0Steps = clampInt(8 + d * 2, 4, 32);
  const ring0Pulses = Math.min(ring0Steps, clampInt(2 + d, 1, 16));
  const next = normalizeParams({
    ...params,
    depth: d,
    norgard: {
      ...params.norgard,
      length: Math.min(256, Math.max(16, Math.pow(2, Math.min(d + 2, 8)))),
      canonLayers: Math.min(3, Math.max(0, d - 1))
    },
    hanoi: {
      ...params.hanoi,
      discs: Math.min(8, Math.max(2, d)),
      moveLimit: Math.min(63, Math.max(7, (1 << Math.min(d, 6)) - 1))
    },
    euclid: {
      ...params.euclid,
      rings: params.euclid.rings.map((r, i) =>
        i === 0 ? { ...r, pulses: ring0Pulses, steps: ring0Steps, rotation: r.rotation % ring0Steps } : r
      )
    },
    lsystem: {
      ...params.lsystem,
      generations: Math.min(presetObj.maxGen || 5, d)
    }
  });
  return next;
}

/**
 * Reset a single algorithm's parameters back to defaults.
 */
export function resetAlgorithmParams(params, algId) {
  const base = normalizeParams(params);
  if (algId === 'norgard') {
    return { ...base, norgard: { ...DEFAULT_NORGARD_PARAMS } };
  }
  if (algId === 'hanoi') {
    return {
      ...base,
      hanoi: {
        ...DEFAULT_HANOI_PARAMS,
        pegIntervals: { ...DEFAULT_HANOI_PARAMS.pegIntervals }
      }
    };
  }
  if (algId === 'bjorklund' || algId === 'euclid') {
    return {
      ...base,
      euclid: {
        ...DEFAULT_EUCLID_PARAMS,
        rings: DEFAULT_EUCLID_PARAMS.rings.map(r => ({ ...r }))
      }
    };
  }
  if (algId === 'lsystem') {
    return {
      ...base,
      branchAngle: DEFAULT_LSYSTEM_PARAMS.turnAngle,
      lsystemPreset: DEFAULT_LSYSTEM_PARAMS.preset,
      lsystem: {
        ...DEFAULT_LSYSTEM_PARAMS,
        rules: { ...DEFAULT_LSYSTEM_PARAMS.rules }
      }
    };
  }
  return base;
}

/**
 * Deterministically randomise a single algorithm's parameters using the composition seed + salt.
 */
export function randomiseAlgorithmParams(params, algId, salt = 0) {
  const base = normalizeParams(params);
  const rng = createPRNG((base.seed + 1) * 2654435761 ^ (salt + algId.length * 97));

  if (algId === 'norgard') {
    const lengths = [16, 32, 48, 64, 96, 128];
    const low = 2 + Math.floor(rng() * 2);
    const high = Math.min(7, low + 2 + Math.floor(rng() * 2));
    return {
      ...base,
      norgard: {
        length: lengths[Math.floor(rng() * lengths.length)],
        offset: Math.floor(rng() * 128),
        intervalStep: 1 + Math.floor(rng() * 3),
        canonLayers: Math.floor(rng() * 4),
        speedRatio: rng() < 0.7 ? 2 : 3,
        lowOctave: low,
        highOctave: high
      }
    };
  }

  if (algId === 'hanoi') {
    const pegs = ['A', 'B', 'C'];
    const startPeg = pegs[Math.floor(rng() * 3)];
    const others = pegs.filter(p => p !== startPeg);
    const targetPeg = others[Math.floor(rng() * others.length)];
    const discs = 2 + Math.floor(rng() * 5); // 2..6 relaxing range
    const choices = PEG_INTERVAL_CHOICES.map(c => c.value);
    return {
      ...base,
      hanoi: {
        discs,
        startPeg,
        targetPeg,
        pegIntervals: {
          A: choices[Math.floor(rng() * choices.length)],
          B: choices[Math.floor(rng() * choices.length)],
          C: choices[Math.floor(rng() * choices.length)]
        },
        moveLimit: Math.min(63, Math.max(7, (1 << discs) - 1))
      }
    };
  }

  if (algId === 'bjorklund' || algId === 'euclid') {
    const ringsCount = 1 + Math.floor(rng() * 3);
    const rings = [0, 1, 2].map(() => {
      const steps = 6 + Math.floor(rng() * 19); // 6..24
      const pulses = Math.max(1, Math.min(steps, 2 + Math.floor(rng() * Math.min(10, steps - 1))));
      const rotation = Math.floor(rng() * steps);
      return { pulses, steps, rotation };
    });
    return {
      ...base,
      euclid: {
        ringsCount,
        accentEvery: 2 + Math.floor(rng() * 5),
        rings
      }
    };
  }

  if (algId === 'lsystem') {
    const presetNames = Object.keys(LSYSTEM_PRESETS);
    const preset = presetNames[Math.floor(rng() * presetNames.length)];
    const pObj = LSYSTEM_PRESETS[preset];
    const generations = Math.max(2, Math.min(pObj.maxGen || 4, 2 + Math.floor(rng() * 4)));
    const turnAngle = Math.round(15 + rng() * 24);
    return {
      ...base,
      branchAngle: turnAngle,
      lsystemPreset: preset,
      lsystem: {
        preset,
        axiom: pObj.axiom,
        rules: { ...pObj.rules },
        generations,
        turnAngle,
        lengthRatio: Number((0.62 + rng() * 0.2).toFixed(2)),
        lineThickness: Math.round(4 + rng() * 4),
        leafDensity: Number((0.4 + rng() * 0.6).toFixed(2))
      }
    };
  }

  return base;
}

/**
 * Full scene presets including explicit per-algorithm recursion parameters.
 */
export const GARDEN_PRESETS = {
  'Quiet Forest': normalizeParams({
    seed: 42,
    depth: 3,
    scale: 'pentatonic',
    rootNote: 60,
    tempo: 50,
    theme: 'Moss',
    ambient: 'wind',
    rainIntensity: 0.15,
    thunderEnabled: true,
    timbres: { ...DEFAULT_TIMBRES, melody: 'Kalimba', bass: 'Warm Blend' },
    norgard: { length: 32, offset: 0, intervalStep: 1, canonLayers: 1, speedRatio: 2, lowOctave: 3, highOctave: 6 },
    hanoi: { discs: 3, startPeg: 'A', targetPeg: 'C', pegIntervals: { A: 0, B: 7, C: 12 }, moveLimit: 15 },
    euclid: {
      ringsCount: 1,
      accentEvery: 3,
      rings: [{ pulses: 3, steps: 8, rotation: 0 }, { pulses: 3, steps: 12, rotation: 2 }, { pulses: 5, steps: 16, rotation: 0 }]
    },
    lsystem: {
      preset: 'Fern',
      axiom: LSYSTEM_PRESETS['Fern'].axiom,
      rules: { ...LSYSTEM_PRESETS['Fern'].rules },
      generations: 3,
      turnAngle: 25,
      lengthRatio: 0.72,
      lineThickness: 6,
      leafDensity: 0.75
    }
  }),

  'Moonlit Pond': normalizeParams({
    seed: 137,
    depth: 5,
    scale: 'lydian',
    rootNote: 67,
    tempo: 45,
    theme: 'Moonlight',
    ambient: 'rain',
    rainIntensity: 0.55,
    thunderEnabled: true,
    timbres: { ...DEFAULT_TIMBRES, melody: 'Glass Bell', ambient: 'Celestial Drone' },
    norgard: { length: 64, offset: 16, intervalStep: 1, canonLayers: 2, speedRatio: 2, lowOctave: 3, highOctave: 6 },
    hanoi: { discs: 4, startPeg: 'A', targetPeg: 'B', pegIntervals: { A: 0, B: 7, C: 12 }, moveLimit: 15 },
    euclid: {
      ringsCount: 2,
      accentEvery: 4,
      rings: [{ pulses: 5, steps: 16, rotation: 2 }, { pulses: 3, steps: 12, rotation: 1 }, { pulses: 5, steps: 16, rotation: 0 }]
    },
    lsystem: {
      preset: 'Wispy Bush',
      axiom: LSYSTEM_PRESETS['Wispy Bush'].axiom,
      rules: { ...LSYSTEM_PRESETS['Wispy Bush'].rules },
      generations: 4,
      turnAngle: 22,
      lengthRatio: 0.74,
      lineThickness: 5,
      leafDensity: 0.85
    }
  }),

  'Deep Dream': normalizeParams({
    seed: 256,
    depth: 7,
    scale: 'dorian',
    rootNote: 55,
    tempo: 42,
    theme: 'Dusk',
    ambient: 'wind',
    rainIntensity: 0.75,
    thunderEnabled: true,
    timbres: { ...DEFAULT_TIMBRES, melody: 'Singing Bowl', bass: 'Deep Sub', ambient: 'Warm Strings' },
    norgard: { length: 128, offset: 32, intervalStep: 2, canonLayers: 3, speedRatio: 3, lowOctave: 2, highOctave: 5 },
    hanoi: { discs: 6, startPeg: 'A', targetPeg: 'C', pegIntervals: { A: 0, B: 5, C: 7 }, moveLimit: 31 },
    euclid: {
      ringsCount: 3,
      accentEvery: 3,
      rings: [{ pulses: 7, steps: 16, rotation: 3 }, { pulses: 5, steps: 12, rotation: 0 }, { pulses: 3, steps: 10, rotation: 2 }]
    },
    lsystem: {
      preset: 'Canopy',
      axiom: LSYSTEM_PRESETS['Canopy'].axiom,
      rules: { ...LSYSTEM_PRESETS['Canopy'].rules },
      generations: 5,
      turnAngle: 30,
      lengthRatio: 0.72,
      lineThickness: 7,
      leafDensity: 0.8
    }
  }),

  'Morning Light': normalizeParams({
    seed: 88,
    depth: 4,
    scale: 'pentatonic',
    rootNote: 72,
    tempo: 65,
    theme: 'Ember',
    ambient: 'none',
    rainIntensity: 0,
    thunderEnabled: false,
    timbres: { ...DEFAULT_TIMBRES, melody: 'Music Box', percussion: 'Water Chimes' },
    norgard: { length: 64, offset: 8, intervalStep: 1, canonLayers: 2, speedRatio: 2, lowOctave: 4, highOctave: 7 },
    hanoi: { discs: 4, startPeg: 'B', targetPeg: 'C', pegIntervals: { A: 0, B: 4, C: 12 }, moveLimit: 15 },
    euclid: {
      ringsCount: 2,
      accentEvery: 2,
      rings: [{ pulses: 5, steps: 12, rotation: 0 }, { pulses: 4, steps: 9, rotation: 1 }, { pulses: 3, steps: 8, rotation: 0 }]
    },
    lsystem: {
      preset: 'Binary Tree',
      axiom: LSYSTEM_PRESETS['Binary Tree'].axiom,
      rules: { ...LSYSTEM_PRESETS['Binary Tree'].rules },
      generations: 3,
      turnAngle: 22.5,
      lengthRatio: 0.7,
      lineThickness: 6,
      leafDensity: 0.65
    }
  })
};

function clampInt(val, min, max) {
  const n = Math.round(Number(val));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function clampNum(val, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
