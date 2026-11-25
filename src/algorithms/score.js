/**
 * Score Builder — The Heart of Recursive Garden
 * 
 * Combines all four recursive algorithms into a single timeline of
 * timed musical events. This is the "score-first" architecture:
 * the algorithms produce pure data, and playback / visuals / export
 * all consume the same event list.
 * 
 * The Depth Dial controls:
 *   - Nørgård melody length (and canon layers)
 *   - Number of Hanoi discs
 *   - Euclidean rhythm density
 *   - L-system generation count
 */

import { norgardSequence } from './norgard.js';
import { hanoi } from './hanoi.js';
import { bjorklund, rotatePattern } from './bjorklund.js';
import { lsystem, LSYSTEM_PRESETS, parseLSystemToCommands } from './lsystem.js';
import { degreeToMidi, midiToFreq, midiToName, PEG_INTERVALS, SCALES } from './scales.js';
import { createPRNG } from './prng.js';

/**
 * Build a complete score from the given parameters.
 * 
 * @param {Object} params
 * @param {number} params.seed - Deterministic seed for PRNG
 * @param {number} params.depth - Recursion depth (1-8), the Depth Dial
 * @param {string} params.scale - Scale name: "pentatonic", "lydian", "dorian"
 * @param {number} params.rootNote - MIDI root note (default 60 = C4)
 * @param {number} params.tempo - BPM (40-90)
 * @param {number} params.branchAngle - Base branch angle in degrees (15-45)
 * @param {number} params.densityEuclid - Euclidean pulse count multiplier (0.5-2.0)
 * @param {string} params.lsystemPreset - L-system preset name
 * @returns {Object} The score: { events, duration, lsystemCommands, params }
 */
export function buildScore(params = {}) {
  const {
    seed = 42,
    depth = 4,
    scale = 'pentatonic',
    rootNote = 60,
    tempo = 60,
    branchAngle = 25,
    densityEuclid = 1.0,
    lsystemPreset = 'Fern'
  } = params;

  const rng = createPRNG(seed);
  const beatDuration = 60 / tempo; // seconds per beat
  const events = [];

  // ─── Layer 1: Nørgård Melody + Canon ────────────────────────────
  const melodyLength = Math.pow(2, depth + 2); // 8, 16, 32, ... 1024
  const norgardValues = norgardSequence(melodyLength);

  // Main melody line
  for (let i = 0; i < norgardValues.length; i++) {
    const degree = norgardValues[i];
    const midi = degreeToMidi(degree, scale, rootNote);
    const time = i * beatDuration * 0.5; // 2 notes per beat
    const velocity = 0.4 + rng() * 0.15;

    events.push({
      time,
      voice: 'melody',
      note: midiToName(midi),
      frequency: midiToFreq(midi),
      midi,
      duration: beatDuration * 0.8,
      velocity,
      pan: (degree % 5) * 0.15 - 0.3, // subtle stereo spread
      meta: {
        algorithm: 'norgard',
        depth,
        index: i,
        value: degree,
        label: `nørgård(${i}) = ${degree}`
      }
    });
  }

  // Canon layers: each depth level adds a faster, quieter, octave-up copy
  // (capped at gentle upper register <= MIDI 91 so high depths stay relaxing)
  for (let canon = 1; canon < Math.min(depth, 4); canon++) {
    const canonRate = Math.pow(2, canon);       // 2x, 4x, 8x faster
    const canonVelocity = 0.22 / canon;         // progressively quieter
    const stepTime = (beatDuration * 0.5) / canonRate;
    const canonLen = Math.min(melodyLength, Math.floor((melodyLength * beatDuration * 0.5) / stepTime));

    for (let i = 0; i < canonLen; i++) {
      const value = norgardValues[i % norgardValues.length];
      let midi = degreeToMidi(value, scale, rootNote + canon * 12);
      // Keep canon notes softly below harsh high frequencies
      while (midi > 91) midi -= 12;
      const time = i * stepTime;

      events.push({
        time,
        voice: 'canon',
        note: midiToName(midi),
        frequency: midiToFreq(midi),
        midi,
        duration: Math.max(0.18, beatDuration * 0.5 / canonRate),
        velocity: canonVelocity,
        pan: canon % 2 === 0 ? -0.4 : 0.4,
        meta: {
          algorithm: 'norgard',
          depth,
          index: i,
          value,
          canonLayer: canon,
          label: `canon ${canon} (${canonRate}×): nørgård(${i}) = ${value}`
        }
      });
    }
  }

  // ─── Layer 2: Tower of Hanoi → Bass ─────────────────────────────
  const hanoiDepth = Math.min(depth, 6); // cap at 6 discs (63 moves max)
  const hanoiMoves = hanoi(hanoiDepth);
  const bassBeatSpacing = beatDuration * 2; // bass is slower than melody

  for (const move of hanoiMoves) {
    const pegInterval = PEG_INTERVALS[move.to] || 0;
    const bassMidi = rootNote - 24 + pegInterval; // 2 octaves below root
    // Bigger discs → longer notes, lower register
    const discFactor = move.disc / hanoiDepth;
    const duration = beatDuration * (1 + discFactor * 3);
    const velocity = 0.2 + discFactor * 0.25;
    const time = move.step * bassBeatSpacing;

    events.push({
      time,
      voice: 'bass',
      note: midiToName(bassMidi),
      frequency: midiToFreq(bassMidi),
      midi: bassMidi,
      duration,
      velocity,
      pan: 0,
      meta: {
        algorithm: 'hanoi',
        depth: hanoiDepth,
        disc: move.disc,
        from: move.from,
        to: move.to,
        step: move.step,
        label: `hanoi: disc ${move.disc} ${move.from}→${move.to}`
      }
    });
  }

  // ─── Layer 3: Euclidean Rhythm → Percussion ─────────────────────
  const euclidSteps = 8 + depth * 2; // 10 to 24 steps
  const euclidPulses = Math.max(1, Math.round((2 + depth) * densityEuclid));
  const clampedPulses = Math.min(euclidPulses, euclidSteps);
  let pattern = bjorklund(clampedPulses, euclidSteps);
  const rotation = Math.floor(rng() * euclidSteps);
  pattern = rotatePattern(pattern, rotation);

  // Repeat the pattern to fill the score duration
  const totalMelodyDuration = norgardValues.length * beatDuration * 0.5;
  const patternDuration = euclidSteps * beatDuration * 0.25;
  const repeats = Math.ceil(totalMelodyDuration / patternDuration) + 1;

  const percTypes = ['chime', 'brush', 'tap'];
  for (let rep = 0; rep < repeats; rep++) {
    for (let step = 0; step < euclidSteps; step++) {
      if (!pattern[step]) continue;
      const time = (rep * euclidSteps + step) * beatDuration * 0.25;
      if (time > totalMelodyDuration + 2) break;
      const percType = percTypes[step % percTypes.length];
      const velocity = 0.1 + rng() * 0.15;

      events.push({
        time,
        voice: 'percussion',
        note: percType,
        frequency: 0,
        midi: 0,
        duration: 0.1,
        velocity,
        pan: (step / euclidSteps) * 1.4 - 0.7, // wide stereo
        meta: {
          algorithm: 'bjorklund',
          pulses: clampedPulses,
          steps: euclidSteps,
          step,
          rotation,
          percType,
          label: `E(${clampedPulses},${euclidSteps}) step ${step}`
        }
      });
    }
  }

  // ─── Layer 4: L-system → Visual Data ───────────────────────────
  const preset = LSYSTEM_PRESETS[lsystemPreset] || LSYSTEM_PRESETS['Fern'];
  // Cap generations per preset so exponential rules (e.g. Binary Tree) stay 60fps at depth 8
  const lsystemDepth = Math.min(depth, preset.maxGen || 5);
  const lsystemStr = lsystem(preset.axiom, preset.rules, lsystemDepth);
  const lsystemCommands = parseLSystemToCommands(lsystemStr);

  // Map Nørgård values to branch angle offsets
  const branchAngles = norgardValues.slice(0, lsystemCommands.filter(c => c.type === 'forward').length)
    .map(v => branchAngle + v * 2); // subtle variation from melody

  // Sort all events by time for sequential playback
  events.sort((a, b) => a.time - b.time);

  // Calculate total duration
  const duration = events.length > 0
    ? events[events.length - 1].time + events[events.length - 1].duration + 2
    : 10;

  return {
    events,
    duration,
    lsystemCommands,
    lsystemString: lsystemStr,
    branchAngles,
    norgardValues,
    euclideanPattern: pattern,
    hanoiMoves,
    params: { seed, depth, scale, rootNote, tempo, branchAngle, densityEuclid, lsystemPreset }
  };
}
