/**
 * Algorithm Plugin Registry
 *
 * Every recursive algorithm for each musical/visual role (`melody`, `bass`,
 * `rhythm`, `tree`) is registered as a self-contained plugin with a uniform interface:
 *   {
 *     id, role, name, description, preview,
 *     defaultParams, paramSchema,
 *     generate(context, rng) -> events / tree descriptor,
 *     trace(context) -> step-by-step data for the Algorithm Lab
 *   }
 */

import { norgard, norgardSequence } from './norgard.js';
import { thueMorse, thueMorseSequence, thueMorseDegrees } from './thueMorse.js';
import { fibonacciWord, fibonacciWordSteps } from './fibonacciWord.js';
import { hanoi, hanoiMoveCount } from './hanoi.js';
import { grayCodeTrace } from './grayCode.js';
import { cantorPattern, cantorSteps } from './cantor.js';
import { bjorklund, bjorklundSteps, rotatePattern, validateEuclideanParams } from './bjorklund.js';
import { lsystemSafe, parseLSystemToCommands, LSYSTEM_PRESETS } from './lsystem.js';
import { degreeToMidi, midiToFreq, midiToName, clampMidiToOctaves } from './scales.js';

export const ROLES = ['melody', 'bass', 'rhythm', 'tree'];

export const DEFAULT_ROLES = {
  melody: 'norgard',
  bass: 'hanoi',
  rhythm: 'bjorklund',
  tree: 'lsystem'
};

/**
 * Clamp melodic leaps smoothly so any algorithm stays calm and singable.
 */
function limitMelodicLeap(prevMidi, targetMidi, maxSemitones = 7) {
  if (prevMidi === null) return targetMidi;
  let m = targetMidi;
  while (m - prevMidi > maxSemitones) m -= 12;
  while (prevMidi - m > maxSemitones) m += 12;
  return m;
}

// ─── MELODY PLUGINS ─────────────────────────────────────────────────────────────

const norgardPlugin = {
  id: 'norgard',
  role: 'melody',
  name: 'Nørgård Infinity Series',
  description: 'Self-similar integer sequence where every note mirrors smaller copies of itself.',
  preview: '0, 1, -1, 2, 1, 0, -2, 3',
  defaultParams: {
    length: 64,
    offset: 0,
    intervalStep: 1,
    canonLayers: 2,
    speedRatio: 2,
    lowOctave: 3,
    highOctave: 6
  },
  paramSchema: [
    { key: 'length', label: 'Length', type: 'range', min: 8, max: 256, step: 4, tooltip: 'Notes in melody cycle' },
    { key: 'offset', label: 'Start Offset', type: 'range', min: 0, max: 512, step: 1, tooltip: 'Starting index k in series' },
    { key: 'intervalStep', label: 'Interval Step d', type: 'range', min: 1, max: 3, step: 1, tooltip: 'n(2k+1) = n(k) + d' },
    { key: 'canonLayers', label: 'Canon Layers', type: 'range', min: 0, max: 3, step: 1, tooltip: 'Octave-up recursive echoes' },
    { key: 'speedRatio', label: 'Canon Speed', type: 'select', options: [{ label: '2× faster', value: 2 }, { label: '3× faster', value: 3 }], tooltip: 'Canon rate multiplier' },
    { key: 'lowOctave', label: 'Low Oct', type: 'range', min: 2, max: 5, step: 1, tooltip: 'Lowest allowed octave' },
    { key: 'highOctave', label: 'High Oct', type: 'range', min: 3, max: 7, step: 1, tooltip: 'Highest allowed octave' }
  ],
  generate(ctx, rng) {
    const { params, beatDuration } = ctx;
    const cfg = params.norgard;
    const values = norgardSequence(cfg.length, cfg.offset, cfg.intervalStep);
    const events = [];
    let prevMidi = null;

    for (let i = 0; i < values.length; i++) {
      const degree = values[i];
      const rawMidi = degreeToMidi(degree, params.scale, params.rootNote);
      const bounded = clampMidiToOctaves(rawMidi, cfg.lowOctave, cfg.highOctave);
      const midi = clampMidiToOctaves(limitMelodicLeap(prevMidi, bounded, 7), cfg.lowOctave, cfg.highOctave);
      prevMidi = midi;

      events.push({
        time: i * beatDuration * 0.5,
        voice: 'melody',
        note: midiToName(midi),
        frequency: midiToFreq(midi),
        midi,
        duration: beatDuration * 0.85,
        velocity: 0.4 + rng() * 0.14,
        pan: ((degree % 5) * 0.14) - 0.28,
        meta: {
          role: 'melody',
          algorithm: 'norgard',
          depth: params.depth,
          index: cfg.offset + i,
          localIndex: i,
          value: degree,
          intervalStep: cfg.intervalStep,
          label: `nørgård(${cfg.offset + i}) = ${degree}`
        }
      });
    }

    const totalMelodyDur = values.length * beatDuration * 0.5;
    for (let canon = 1; canon <= cfg.canonLayers; canon++) {
      const rate = Math.pow(cfg.speedRatio, canon);
      const stepTime = (beatDuration * 0.5) / rate;
      const canonLen = Math.min(256, Math.floor(totalMelodyDur / stepTime));
      for (let i = 0; i < canonLen; i++) {
        const val = values[i % values.length];
        const midi = clampMidiToOctaves(degreeToMidi(val, params.scale, params.rootNote + canon * 12), cfg.lowOctave, cfg.highOctave);
        events.push({
          time: i * stepTime,
          voice: 'canon',
          note: midiToName(midi),
          frequency: midiToFreq(midi),
          midi,
          duration: Math.max(0.18, (beatDuration * 0.55) / rate),
          velocity: 0.22 / canon,
          pan: canon % 2 === 0 ? -0.4 : 0.4,
          meta: {
            role: 'melody',
            algorithm: 'norgard',
            depth: params.depth,
            index: cfg.offset + (i % values.length),
            localIndex: i % values.length,
            value: val,
            canonLayer: canon,
            speedRatio: cfg.speedRatio,
            label: `canon ${canon} (${rate}×): nørgård(${cfg.offset + (i % values.length)}) = ${val}`
          }
        });
      }
    }

    return {
      events,
      values,
      durationSpan: totalMelodyDur,
      stat: `Nørgård: ${cfg.length} notes (offset ${cfg.offset}, d=${cfg.intervalStep}, ${cfg.canonLayers} canons @ ${cfg.speedRatio}×)`
    };
  },
  trace(ctx) {
    const cfg = ctx.params.norgard;
    return {
      algorithm: 'norgard',
      values: norgardSequence(Math.min(64, cfg.length), cfg.offset, cfg.intervalStep),
      offset: cfg.offset,
      intervalStep: cfg.intervalStep
    };
  }
};

const thueMorseMelodyPlugin = {
  id: 'thue-morse',
  role: 'melody',
  name: 'Thue-Morse Sequence',
  description: 'Aperiodic binary walk (t(2n)=t(n), t(2n+1)=1-t(n)) that avoids mechanical repeats.',
  preview: '0, 1, 1, 0, 1, 0, 0, 1',
  defaultParams: {
    length: 48,
    offset: 0,
    stepSize: 1,
    restEvery: 6,
    lowOctave: 3,
    highOctave: 6
  },
  paramSchema: [
    { key: 'length', label: 'Length', type: 'range', min: 8, max: 128, step: 4, tooltip: 'Steps in the Thue-Morse melody' },
    { key: 'offset', label: 'Start Offset', type: 'range', min: 0, max: 256, step: 1, tooltip: 'Starting index n in sequence' },
    { key: 'stepSize', label: 'Step Size', type: 'range', min: 1, max: 2, step: 1, tooltip: 'Scale steps moved per bit' },
    { key: 'restEvery', label: 'Breathing Rest', type: 'range', min: 4, max: 12, step: 1, tooltip: 'Insert a gentle rest every N notes' },
    { key: 'lowOctave', label: 'Low Oct', type: 'range', min: 2, max: 5, step: 1, tooltip: 'Lowest allowed octave' },
    { key: 'highOctave', label: 'High Oct', type: 'range', min: 3, max: 7, step: 1, tooltip: 'Highest allowed octave' }
  ],
  generate(ctx, rng) {
    const { params, beatDuration } = ctx;
    const cfg = { ...this.defaultParams, ...(params.pluginParams?.['thue-morse'] || {}) };
    const { bits, degrees } = thueMorseDegrees(cfg.length, cfg.offset, cfg.stepSize, 5);
    const events = [];

    for (let i = 0; i < degrees.length; i++) {
      // Keep breathing rests for relaxation
      if (cfg.restEvery > 0 && (i + 1) % cfg.restEvery === 0) continue;

      const deg = degrees[i];
      const midi = clampMidiToOctaves(degreeToMidi(deg, params.scale, params.rootNote), cfg.lowOctave, cfg.highOctave);
      events.push({
        time: i * beatDuration * 0.55,
        voice: 'melody',
        note: midiToName(midi),
        frequency: midiToFreq(midi),
        midi,
        duration: beatDuration * 0.9,
        velocity: 0.38 + (bits[i] ? 0.1 : 0.02) + rng() * 0.08,
        pan: bits[i] ? 0.25 : -0.25,
        meta: {
          role: 'melody',
          algorithm: 'thue-morse',
          index: cfg.offset + i,
          localIndex: i,
          bit: bits[i],
          value: deg,
          label: `t(${cfg.offset + i}) = ${bits[i]} → deg ${deg}`
        }
      });
    }

    return {
      events,
      values: degrees,
      durationSpan: degrees.length * beatDuration * 0.55,
      stat: `Thue-Morse: ${cfg.length} steps (offset ${cfg.offset}, ${events.length} sounding notes)`
    };
  },
  trace(ctx) {
    const cfg = { ...this.defaultParams, ...(ctx.params.pluginParams?.['thue-morse'] || {}) };
    const { bits, degrees } = thueMorseDegrees(Math.min(32, cfg.length), cfg.offset, cfg.stepSize, 5);
    return { algorithm: 'thue-morse', bits, degrees, offset: cfg.offset };
  }
};

const fibonacciMelodyPlugin = {
  id: 'fibonacci-word',
  role: 'melody',
  name: 'Fibonacci Word',
  description: 'Concatenating generations S_n = S_(n-1) + S_(n-2) shapes golden-ratio phrases.',
  preview: '0100101001001',
  defaultParams: {
    generation: 7,
    maxNotes: 64,
    lowOctave: 3,
    highOctave: 6
  },
  paramSchema: [
    { key: 'generation', label: 'Generation n', type: 'range', min: 3, max: 10, step: 1, tooltip: 'Word generation S_n = S_(n-1) + S_(n-2)' },
    { key: 'maxNotes', label: 'Phrase Length', type: 'range', min: 13, max: 144, step: 1, tooltip: 'Cap notes per cycle' },
    { key: 'lowOctave', label: 'Low Oct', type: 'range', min: 2, max: 5, step: 1, tooltip: 'Lowest allowed octave' },
    { key: 'highOctave', label: 'High Oct', type: 'range', min: 3, max: 7, step: 1, tooltip: 'Highest allowed octave' }
  ],
  generate(ctx, rng) {
    const { params, beatDuration } = ctx;
    const cfg = { ...this.defaultParams, ...(params.pluginParams?.['fibonacci-word'] || {}) };
    const word = fibonacciWord(cfg.generation, cfg.maxNotes).slice(0, cfg.maxNotes);
    const events = [];
    const values = [];
    let deg = 0;

    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (ch === '1') {
        deg = deg >= 4 ? deg - 2 : deg + 2;
      } else {
        deg = deg <= -3 ? deg + 1 : deg - 1;
      }
      values.push(deg);

      // Pause gently on every '00' pair tail so the golden-ratio rhythm breathes
      if (i > 1 && word[i] === '0' && word[i - 1] === '0') continue;

      const midi = clampMidiToOctaves(degreeToMidi(deg, params.scale, params.rootNote), cfg.lowOctave, cfg.highOctave);
      events.push({
        time: i * beatDuration * 0.55,
        voice: 'melody',
        note: midiToName(midi),
        frequency: midiToFreq(midi),
        midi,
        duration: ch === '1' ? beatDuration * 1.15 : beatDuration * 0.8,
        velocity: ch === '1' ? 0.45 + rng() * 0.1 : 0.35 + rng() * 0.08,
        pan: ch === '1' ? 0.22 : -0.22,
        meta: {
          role: 'melody',
          algorithm: 'fibonacci-word',
          index: i,
          localIndex: i,
          bit: Number(ch),
          value: deg,
          generation: cfg.generation,
          label: `S_${cfg.generation}[${i}] = '${ch}' → deg ${deg}`
        }
      });
    }

    return {
      events,
      values,
      durationSpan: word.length * beatDuration * 0.55,
      stat: `Fibonacci S_${cfg.generation}: ${word.length} chars, ${events.length} notes`
    };
  },
  trace(ctx) {
    const cfg = { ...this.defaultParams, ...(ctx.params.pluginParams?.['fibonacci-word'] || {}) };
    const steps = fibonacciWordSteps(Math.min(8, cfg.generation), 89);
    return {
      algorithm: 'fibonacci-word',
      generation: cfg.generation,
      steps,
      word: steps[steps.length - 1]
    };
  }
};

// ─── BASS PLUGINS ───────────────────────────────────────────────────────────────

const hanoiPlugin = {
  id: 'hanoi',
  role: 'bass',
  name: 'Tower of Hanoi',
  description: 'Recursive disc moves between three pegs drive bass pitch and note duration.',
  preview: 'disc 1 A→C, disc 2 A→B...',
  defaultParams: {
    discs: 4,
    startPeg: 'A',
    targetPeg: 'C',
    pegIntervals: { A: 0, B: 7, C: 12 },
    moveLimit: 31
  },
  paramSchema: [
    { key: 'discs', label: 'Discs', type: 'range', min: 2, max: 8, step: 1, tooltip: '2^n - 1 recursive moves' },
    { key: 'moveLimit', label: 'Move Limit', type: 'range', min: 3, max: 255, step: 1, tooltip: 'Cap moves per loop' }
  ],
  generate(ctx) {
    const { params, beatDuration } = ctx;
    const hCfg = params.hanoi;
    const totalPossible = hanoiMoveCount(hCfg.discs);
    const moves = hanoi(hCfg.discs, hCfg.startPeg, hCfg.targetPeg).slice(0, hCfg.moveLimit);
    const spacing = beatDuration * 2;
    const baseMidi = params.rootNote - 24;
    const events = [];

    for (const move of moves) {
      const iv = hCfg.pegIntervals?.[move.to] ?? 0;
      const midi = clampMidiToOctaves(baseMidi + iv, 1, 3);
      const discFactor = move.disc / hCfg.discs;
      events.push({
        time: move.step * spacing,
        voice: 'bass',
        note: midiToName(midi),
        frequency: midiToFreq(midi),
        midi,
        duration: beatDuration * (1 + discFactor * 3),
        velocity: 0.22 + discFactor * 0.24,
        pan: 0,
        meta: {
          role: 'bass',
          algorithm: 'hanoi',
          depth: hCfg.discs,
          discs: hCfg.discs,
          disc: move.disc,
          from: move.from,
          to: move.to,
          step: move.step,
          totalMoves: totalPossible,
          label: `hanoi: disc ${move.disc} ${move.from}→${move.to}`
        }
      });
    }

    return {
      events,
      hanoiMoves: moves,
      durationSpan: moves.length * spacing,
      stat: `Hanoi: ${hCfg.discs} discs (${totalPossible} total moves, ${moves.length} played ${hCfg.startPeg}→${hCfg.targetPeg})`
    };
  },
  trace(ctx) {
    const hCfg = ctx.params.hanoi;
    return {
      algorithm: 'hanoi',
      discs: hCfg.discs,
      startPeg: hCfg.startPeg,
      targetPeg: hCfg.targetPeg,
      pegIntervals: hCfg.pegIntervals
    };
  }
};

const grayCodePlugin = {
  id: 'gray-code',
  role: 'bass',
  name: 'Recursive Gray Code',
  description: 'Reflect-and-prefix binary codes where only one bit flips each bass note.',
  preview: '000, 001, 011, 010, 110...',
  defaultParams: {
    bits: 3,
    spacingBeats: 2
  },
  paramSchema: [
    { key: 'bits', label: 'Bit Width', type: 'range', min: 2, max: 5, step: 1, tooltip: 'Generates 2^n Gray codes' },
    { key: 'spacingBeats', label: 'Beat Spacing', type: 'range', min: 1, max: 4, step: 0.5, tooltip: 'Beats between bass pulses' }
  ],
  generate(ctx) {
    const { params, beatDuration } = ctx;
    const cfg = { ...this.defaultParams, ...(params.pluginParams?.['gray-code'] || {}) };
    const { transitions } = grayCodeTrace(cfg.bits);
    const spacing = beatDuration * cfg.spacingBeats;
    const baseMidi = params.rootNote - 24;
    const events = [];

    for (let i = 0; i < transitions.length; i++) {
      const tr = transitions[i];
      // Map set-bit count to scale degrees 0, 2, 4, 5 (root, 3rd, 5th, octave)
      const degreeMap = [0, 2, 4, 5, 4, 2];
      const deg = degreeMap[tr.onesCount % degreeMap.length];
      const midi = clampMidiToOctaves(degreeToMidi(deg, params.scale, baseMidi), 1, 3);
      const durScale = 1 + (tr.flippedBit / Math.max(1, cfg.bits - 1)) * 1.8;

      events.push({
        time: i * spacing,
        voice: 'bass',
        note: midiToName(midi),
        frequency: midiToFreq(midi),
        midi,
        duration: beatDuration * durScale,
        velocity: 0.24 + (tr.onesCount / cfg.bits) * 0.18,
        pan: 0,
        meta: {
          role: 'bass',
          algorithm: 'gray-code',
          index: i,
          code: tr.code,
          flippedBit: tr.flippedBit,
          onesCount: tr.onesCount,
          disc: tr.flippedBit + 1,
          label: `gray(${tr.code}) flip bit ${tr.flippedBit} → ${midiToName(midi)}`
        }
      });
    }

    return {
      events,
      durationSpan: transitions.length * spacing,
      stat: `Gray Code: ${cfg.bits} bits (${transitions.length} single-bit transitions)`
    };
  },
  trace(ctx) {
    const cfg = { ...this.defaultParams, ...(ctx.params.pluginParams?.['gray-code'] || {}) };
    return {
      algorithm: 'gray-code',
      bits: cfg.bits,
      ...grayCodeTrace(cfg.bits)
    };
  }
};

const cantorBassPlugin = {
  id: 'cantor-bass',
  role: 'bass',
  name: 'Cantor Set Bass',
  description: 'Recursively removes middle thirds to weave warm bass anchors with deep rests.',
  preview: '1 0 1 0 0 0 1 0 1',
  defaultParams: {
    depth: 2,
    repeats: 2
  },
  paramSchema: [
    { key: 'depth', label: 'Cantor Depth', type: 'range', min: 1, max: 3, step: 1, tooltip: 'Produces 3^depth intervals' },
    { key: 'repeats', label: 'Cycles', type: 'range', min: 1, max: 4, step: 1, tooltip: 'How many Cantor cycles to play' }
  ],
  generate(ctx) {
    const { params, beatDuration } = ctx;
    const cfg = { ...this.defaultParams, ...(params.pluginParams?.['cantor-bass'] || {}) };
    const pat = cantorPattern(cfg.depth);
    const stepDur = beatDuration * 1.25;
    const baseMidi = params.rootNote - 24;
    const events = [];

    for (let rep = 0; rep < cfg.repeats; rep++) {
      for (let i = 0; i < pat.length; i++) {
        if (!pat[i]) continue;
        // Edge segments anchor on root, inner active segments step gently to 5th
        const deg = (i === 0 || i === pat.length - 1) ? 0 : 4;
        const midi = clampMidiToOctaves(degreeToMidi(deg, params.scale, baseMidi), 1, 3);
        events.push({
          time: (rep * pat.length + i) * stepDur,
          voice: 'bass',
          note: midiToName(midi),
          frequency: midiToFreq(midi),
          midi,
          duration: stepDur * 1.4,
          velocity: deg === 0 ? 0.38 : 0.28,
          pan: 0,
          meta: {
            role: 'bass',
            algorithm: 'cantor-bass',
            depth: cfg.depth,
            index: i,
            totalSteps: pat.length,
            disc: (i % 3) + 1,
            label: `cantor(${cfg.depth}) [${i + 1}/${pat.length}] → ${midiToName(midi)}`
          }
        });
      }
    }

    return {
      events,
      durationSpan: cfg.repeats * pat.length * stepDur,
      stat: `Cantor Bass: depth ${cfg.depth} (${pat.filter(Boolean).length}/${pat.length} active per cycle)`
    };
  },
  trace(ctx) {
    const cfg = { ...this.defaultParams, ...(ctx.params.pluginParams?.['cantor-bass'] || {}) };
    return {
      algorithm: 'cantor-bass',
      depth: cfg.depth,
      levels: cantorSteps(cfg.depth)
    };
  }
};

// ─── RHYTHM PLUGINS ─────────────────────────────────────────────────────────────

const bjorklundPlugin = {
  id: 'bjorklund',
  role: 'rhythm',
  name: 'Euclidean (Bjorklund)',
  description: 'Bjorklund recursion spaces hits evenly across steps like world-music rhythms.',
  preview: 'E(5,16): x..x..x..x..x...',
  defaultParams: {
    ringsCount: 1,
    accentEvery: 3
  },
  paramSchema: [], // Managed by rich multi-ring editor in paramEditors.js
  generate(ctx, rng) {
    const { params, beatDuration, totalScoreSpan } = ctx;
    const eCfg = params.euclid;
    const activeRings = [];
    const percTypes = ['chime', 'brush', 'tap'];
    const events = [];

    for (let rIdx = 0; rIdx < eCfg.ringsCount; rIdx++) {
      const ringCfg = eCfg.rings[rIdx];
      const check = validateEuclideanParams(ringCfg.pulses, ringCfg.steps);
      const k = check.valid ? check.pulses : Math.min(ringCfg.steps, Math.max(1, ringCfg.pulses));
      const n = Math.max(2, Math.min(32, check.steps || 16));
      const rot = ((ringCfg.rotation || 0) % n + n) % n;

      const pattern = rotatePattern(bjorklund(k, n), rot);
      activeRings.push({ ringIndex: rIdx, pulses: k, steps: n, rotation: rot, pattern });

      const stepDur = beatDuration * 0.25;
      const cycleDur = n * stepDur;
      const repeats = Math.ceil(totalScoreSpan / cycleDur) + 1;
      let hitCounter = 0;

      for (let rep = 0; rep < repeats; rep++) {
        for (let step = 0; step < n; step++) {
          if (!pattern[step]) continue;
          const time = (rep * n + step) * stepDur;
          if (time > totalScoreSpan + 1.5) break;

          const isAccented = (hitCounter % eCfg.accentEvery) === 0;
          hitCounter++;
          const percType = percTypes[(step + rIdx) % percTypes.length];
          const baseVel = 0.08 + rng() * 0.1;

          events.push({
            time,
            voice: 'percussion',
            note: percType,
            frequency: 0,
            midi: 0,
            duration: 0.1,
            velocity: Math.min(0.32, isAccented ? baseVel * 1.45 : baseVel),
            pan: (step / n) * 1.4 - 0.7,
            meta: {
              role: 'rhythm',
              algorithm: 'bjorklund',
              ringIndex: rIdx,
              pulses: k,
              steps: n,
              step,
              rotation: rot,
              accented: isAccented,
              percType,
              label: `E${rIdx + 1}(${k},${n}) step ${step}${isAccented ? ' ★' : ''}`
            }
          });
        }
      }
    }

    const r0 = activeRings[0];
    return {
      events,
      euclideanRings: activeRings,
      euclideanPattern: r0.pattern,
      stat: activeRings.length === 1
        ? `Euclidean: ${r0.pulses} of ${r0.steps}, rotation ${r0.rotation}, accent /${eCfg.accentEvery}`
        : `Euclidean: ${activeRings.length} rings (${activeRings.map(r => `${r.pulses}/${r.steps}`).join(' + ')})`
    };
  },
  trace(ctx) {
    const r0 = ctx.params.euclid.rings[0];
    return {
      algorithm: 'bjorklund',
      ...bjorklundSteps(r0.pulses, r0.steps),
      pulses: r0.pulses,
      stepsCount: r0.steps
    };
  }
};

const cantorRhythmPlugin = {
  id: 'cantor-rhythm',
  role: 'rhythm',
  name: 'Cantor Set Pattern',
  description: 'Fractal middle-third gaps create spacious, meditative rhythmic breathing.',
  preview: 'x . x . . . x . x',
  defaultParams: {
    depth: 2,
    subdivision: 0.5
  },
  paramSchema: [
    { key: 'depth', label: 'Cantor Depth', type: 'range', min: 1, max: 3, step: 1, tooltip: 'Produces 3^depth steps' },
    { key: 'subdivision', label: 'Step Beats', type: 'range', min: 0.25, max: 1, step: 0.25, tooltip: 'Beats per Cantor step' }
  ],
  generate(ctx, rng) {
    const { beatDuration, totalScoreSpan } = ctx;
    const cfg = { ...this.defaultParams, ...(ctx.params.pluginParams?.['cantor-rhythm'] || {}) };
    const pat = cantorPattern(cfg.depth);
    const stepDur = beatDuration * cfg.subdivision;
    const cycleDur = pat.length * stepDur;
    const repeats = Math.ceil(totalScoreSpan / cycleDur) + 1;
    const percTypes = ['chime', 'brush', 'tap'];
    const events = [];

    for (let rep = 0; rep < repeats; rep++) {
      for (let step = 0; step < pat.length; step++) {
        if (!pat[step]) continue;
        const time = (rep * pat.length + step) * stepDur;
        if (time > totalScoreSpan + 1.5) break;
        const percType = percTypes[step % percTypes.length];
        events.push({
          time,
          voice: 'percussion',
          note: percType,
          frequency: 0,
          midi: 0,
          duration: 0.1,
          velocity: 0.09 + rng() * 0.1,
          pan: (step / pat.length) * 1.2 - 0.6,
          meta: {
            role: 'rhythm',
            algorithm: 'cantor-rhythm',
            depth: cfg.depth,
            step,
            steps: pat.length,
            percType,
            label: `Cantor(${cfg.depth}) step ${step + 1}/${pat.length} → ${percType}`
          }
        });
      }
    }

    return {
      events,
      euclideanPattern: pat,
      euclideanRings: [{ ringIndex: 0, pulses: pat.filter(Boolean).length, steps: pat.length, rotation: 0, pattern: pat }],
      stat: `Cantor Rhythm: depth ${cfg.depth} (${pat.filter(Boolean).length}/${pat.length} hits)`
    };
  },
  trace(ctx) {
    const cfg = { ...this.defaultParams, ...(ctx.params.pluginParams?.['cantor-rhythm'] || {}) };
    return {
      algorithm: 'cantor-rhythm',
      depth: cfg.depth,
      levels: cantorSteps(cfg.depth)
    };
  }
};

const thueMorseRhythmPlugin = {
  id: 'thue-morse-rhythm',
  role: 'rhythm',
  name: 'Thue-Morse Pattern',
  description: 'Alternating self-similar 0/1 stream drives soft brushes and chimes without monotony.',
  preview: '0 1 1 0 1 0 0 1',
  defaultParams: {
    steps: 16,
    offset: 0
  },
  paramSchema: [
    { key: 'steps', label: 'Cycle Steps', type: 'range', min: 8, max: 32, step: 4, tooltip: 'Length of Thue-Morse rhythm cycle' },
    { key: 'offset', label: 'Start Offset', type: 'range', min: 0, max: 64, step: 1, tooltip: 'Starting index in sequence' }
  ],
  generate(ctx, rng) {
    const { beatDuration, totalScoreSpan } = ctx;
    const cfg = { ...this.defaultParams, ...(ctx.params.pluginParams?.['thue-morse-rhythm'] || {}) };
    const bits = thueMorseSequence(cfg.steps, cfg.offset);
    const pat = bits.map(b => b === 1);
    const stepDur = beatDuration * 0.35;
    const cycleDur = bits.length * stepDur;
    const repeats = Math.ceil(totalScoreSpan / cycleDur) + 1;
    const events = [];

    for (let rep = 0; rep < repeats; rep++) {
      for (let step = 0; step < bits.length; step++) {
        const bit = bits[step];
        // Rest gently every 4th '0' to preserve calm space
        if (bit === 0 && step % 4 === 2) continue;
        const time = (rep * bits.length + step) * stepDur;
        if (time > totalScoreSpan + 1.5) break;
        const percType = bit === 1 ? (step % 3 === 0 ? 'chime' : 'tap') : 'brush';
        events.push({
          time,
          voice: 'percussion',
          note: percType,
          frequency: 0,
          midi: 0,
          duration: 0.1,
          velocity: (bit === 1 ? 0.12 : 0.07) + rng() * 0.07,
          pan: (step / bits.length) * 1.2 - 0.6,
          meta: {
            role: 'rhythm',
            algorithm: 'thue-morse-rhythm',
            step,
            steps: bits.length,
            bit,
            percType,
            label: `t(${cfg.offset + step})=${bit} → ${percType}`
          }
        });
      }
    }

    return {
      events,
      euclideanPattern: pat,
      euclideanRings: [{ ringIndex: 0, pulses: pat.filter(Boolean).length, steps: bits.length, rotation: 0, pattern: pat }],
      stat: `Thue-Morse Rhythm: ${cfg.steps} steps (${pat.filter(Boolean).length} accents)`
    };
  },
  trace(ctx) {
    const cfg = { ...this.defaultParams, ...(ctx.params.pluginParams?.['thue-morse-rhythm'] || {}) };
    return {
      algorithm: 'thue-morse-rhythm',
      bits: thueMorseSequence(cfg.steps, cfg.offset),
      offset: cfg.offset
    };
  }
};

// ─── TREE PLUGINS ───────────────────────────────────────────────────────────────

function makeTreePlugin({ id, name, description, preview, presetKey, defaultGens, defaultAngle, centerToStart = false }) {
  return {
    id,
    role: 'tree',
    name,
    description,
    preview,
    defaultParams: {
      generations: defaultGens,
      turnAngle: defaultAngle
    },
    paramSchema: id === 'lsystem' ? [] : [
      { key: 'generations', label: 'Generations', type: 'range', min: 1, max: 5, step: 1, tooltip: 'Recursive subdivision depth' },
      { key: 'turnAngle', label: 'Turn Angle', type: 'range', min: 30, max: 90, step: 1, tooltip: 'Turtle turn angle in degrees' }
    ],
    generate(ctx) {
      const { params, melodyValues = [0] } = ctx;
      const lCfg = params.lsystem;
      const preset = LSYSTEM_PRESETS[presetKey];
      const useUserCustom = id === 'lsystem';
      const pluginOverride = params.pluginParams?.[id] || {};

      const axiom = useUserCustom ? lCfg.axiom : preset.axiom;
      const rules = useUserCustom ? lCfg.rules : preset.rules;
      const generations = useUserCustom
        ? lCfg.generations
        : (pluginOverride.generations ?? Math.min(preset.maxGen || 4, params.depth));
      const turnAngle = useUserCustom
        ? lCfg.turnAngle
        : (pluginOverride.turnAngle ?? preset.angle);

      const safe = lsystemSafe(axiom, rules, generations);
      const commands = parseLSystemToCommands(safe.result);
      const forwardCount = commands.filter(c => c.type === 'forward').length;
      const branchAngles = new Array(Math.max(1, forwardCount));
      for (let i = 0; i < branchAngles.length; i++) {
        const mv = melodyValues[i % Math.max(1, melodyValues.length)] || 0;
        branchAngles[i] = useUserCustom ? (turnAngle + mv * 2) : turnAngle;
      }

      return {
        events: [],
        lsystemCommands: commands,
        lsystemString: safe.result,
        branchAngles,
        lsystemConfig: {
          ...lCfg,
          preset: useUserCustom ? lCfg.preset : presetKey,
          axiom,
          rules,
          generations,
          turnAngle,
          startAngle: preset?.startAngle ?? -90,
          centerToStart,
          actualGenerations: safe.actualGenerations,
          estimatedCommands: safe.estimatedCommands,
          capped: safe.capped,
          warning: safe.warning
        },
        stat: `${name}: gen ${safe.actualGenerations}, ${commands.length.toLocaleString()} commands${safe.capped ? ' (capped)' : ''}`
      };
    },
    trace(ctx) {
      const generated = this.generate(ctx);
      return {
        algorithm: id,
        ...generated.lsystemConfig,
        lsystemString: generated.lsystemString,
        lsystemCommands: generated.lsystemCommands
      };
    }
  };
}

const lsystemPlugin = makeTreePlugin({
  id: 'lsystem',
  name: 'L-System Tree',
  description: 'String rewriting rules grow fractal branches angled by the melody.',
  preview: 'F → FF+[+F-F-F]-[-F+F+F]',
  presetKey: 'Fern',
  defaultGens: 4,
  defaultAngle: 25,
  centerToStart: false
});

const kochCurvePlugin = makeTreePlugin({
  id: 'koch-curve',
  name: 'Koch Curve',
  description: 'Each straight edge splits into four segments forming a crystalline snow crest.',
  preview: 'F → F+F--F+F (60°)',
  presetKey: 'Koch Curve',
  defaultGens: 3,
  defaultAngle: 60,
  centerToStart: true
});

const sierpinskiPlugin = makeTreePlugin({
  id: 'sierpinski-triangle',
  name: 'Sierpinski Triangle',
  description: 'Mutually recursive arrowhead rules fold into a self-similar triangle.',
  preview: 'X → YF+XF+Y, Y → XF-YF-X',
  presetKey: 'Sierpinski Triangle',
  defaultGens: 4,
  defaultAngle: 60,
  centerToStart: true
});

// ─── REGISTRY ───────────────────────────────────────────────────────────────────

export const ALGORITHM_REGISTRY = {
  melody: [norgardPlugin, thueMorseMelodyPlugin, fibonacciMelodyPlugin],
  bass: [hanoiPlugin, grayCodePlugin, cantorBassPlugin],
  rhythm: [bjorklundPlugin, cantorRhythmPlugin, thueMorseRhythmPlugin],
  tree: [lsystemPlugin, kochCurvePlugin, sierpinskiPlugin]
};

/**
 * Look up a plugin by role and optional algorithm id (falls back to default for that role).
 */
export function getAlgorithmPlugin(role, id) {
  const list = ALGORITHM_REGISTRY[role] || [];
  return list.find(p => p.id === id) || list[0] || null;
}

/**
 * List all plugins registered for a role.
 */
export function getAlgorithmsForRole(role) {
  return ALGORITHM_REGISTRY[role] || [];
}
