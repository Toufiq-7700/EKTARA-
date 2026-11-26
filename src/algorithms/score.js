/**
 * Score Builder — The Heart of Recursive Garden
 *
 * Combines all four user-configurable recursive algorithms into a single
 * deterministic timeline of timed musical events. Live playback, 60fps Canvas
 * visuals, Algorithm Lab simulations, and Tone.Offline WAV export all consume
 * this exact same score.
 *
 * Safety limit: total events are capped at MAX_SCORE_EVENTS (4000) so extreme
 * combinations stay responsive and relaxing.
 */

import { norgardSequence } from './norgard.js';
import { hanoi, hanoiMoveCount } from './hanoi.js';
import { bjorklund, rotatePattern, validateEuclideanParams } from './bjorklund.js';
import { lsystemSafe, parseLSystemToCommands } from './lsystem.js';
import {
  degreeToMidi,
  midiToFreq,
  midiToName,
  clampMidiToOctaves
} from './scales.js';
import { createPRNG } from './prng.js';
import { normalizeParams, MAX_SCORE_EVENTS } from './params.js';

/**
 * Build a complete score from global and per-algorithm parameters.
 *
 * @param {Object} [rawParams={}]
 * @returns {Object} The score with events, stats, visual metadata, and normalized params
 */
export function buildScore(rawParams = {}) {
  const params = normalizeParams(rawParams);
  const { seed, depth, scale, rootNote, tempo } = params;
  const nCfg = params.norgard;
  const hCfg = params.hanoi;
  const eCfg = params.euclid;
  const lCfg = params.lsystem;

  const rng = createPRNG(seed);
  const beatDuration = 60 / tempo; // seconds per beat
  const events = [];

  // ─── Layer 1: Generalised Nørgård Melody + Canons ───────────────
  const norgardValues = norgardSequence(nCfg.length, nCfg.offset, nCfg.intervalStep);

  for (let i = 0; i < norgardValues.length; i++) {
    const degree = norgardValues[i];
    const rawMidi = degreeToMidi(degree, scale, rootNote);
    const midi = clampMidiToOctaves(rawMidi, nCfg.lowOctave, nCfg.highOctave);
    const time = i * beatDuration * 0.5;
    const velocity = 0.4 + rng() * 0.14;

    events.push({
      time,
      voice: 'melody',
      note: midiToName(midi),
      frequency: midiToFreq(midi),
      midi,
      duration: beatDuration * 0.85,
      velocity,
      pan: ((degree % 5) * 0.14) - 0.28,
      meta: {
        algorithm: 'norgard',
        depth,
        index: nCfg.offset + i,
        localIndex: i,
        value: degree,
        intervalStep: nCfg.intervalStep,
        label: `nørgård(${nCfg.offset + i}) = ${degree}`
      }
    });
  }

  // Canon layers (0 to 3 layers, speedRatio 2x or 3x)
  const totalMelodyDuration = norgardValues.length * beatDuration * 0.5;
  for (let canon = 1; canon <= nCfg.canonLayers; canon++) {
    const canonRate = Math.pow(nCfg.speedRatio, canon);
    const canonVelocity = 0.22 / canon;
    const stepTime = (beatDuration * 0.5) / canonRate;
    const canonLen = Math.min(256, Math.floor(totalMelodyDuration / stepTime));

    for (let i = 0; i < canonLen; i++) {
      const val = norgardValues[i % norgardValues.length];
      const rawMidi = degreeToMidi(val, scale, rootNote + canon * 12);
      const midi = clampMidiToOctaves(rawMidi, nCfg.lowOctave, nCfg.highOctave);
      const time = i * stepTime;

      events.push({
        time,
        voice: 'canon',
        note: midiToName(midi),
        frequency: midiToFreq(midi),
        midi,
        duration: Math.max(0.18, (beatDuration * 0.55) / canonRate),
        velocity: canonVelocity,
        pan: canon % 2 === 0 ? -0.4 : 0.4,
        meta: {
          algorithm: 'norgard',
          depth,
          index: nCfg.offset + (i % norgardValues.length),
          localIndex: i % norgardValues.length,
          value: val,
          canonLayer: canon,
          speedRatio: nCfg.speedRatio,
          label: `canon ${canon} (${canonRate}×): nørgård(${nCfg.offset + (i % norgardValues.length)}) = ${val}`
        }
      });
    }
  }

  // ─── Layer 2: Tower of Hanoi → Bass ─────────────────────────────
  const totalPossibleHanoiMoves = hanoiMoveCount(hCfg.discs);
  const allHanoiMoves = hanoi(hCfg.discs, hCfg.startPeg, hCfg.targetPeg);
  const hanoiMoves = allHanoiMoves.slice(0, hCfg.moveLimit);
  const bassBeatSpacing = beatDuration * 2;
  const bassBaseMidi = rootNote - 24;

  for (const move of hanoiMoves) {
    const pegInterval = hCfg.pegIntervals?.[move.to] ?? 0;
    const bassMidi = clampMidiToOctaves(bassBaseMidi + pegInterval, 1, 3);
    const discFactor = move.disc / hCfg.discs;
    const duration = beatDuration * (1 + discFactor * 3);
    const velocity = 0.22 + discFactor * 0.24;
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
        depth: hCfg.discs,
        discs: hCfg.discs,
        disc: move.disc,
        from: move.from,
        to: move.to,
        step: move.step,
        totalMoves: totalPossibleHanoiMoves,
        label: `hanoi: disc ${move.disc} ${move.from}→${move.to}`
      }
    });
  }

  // ─── Layer 3: Polyrhythmic Euclidean Rhythm → Percussion ────────
  const activeRings = [];
  const percTypes = ['chime', 'brush', 'tap'];
  const totalScoreSpan = Math.max(totalMelodyDuration, hanoiMoves.length * bassBeatSpacing);

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
        const velocity = Math.min(0.32, isAccented ? baseVel * 1.45 : baseVel);

        events.push({
          time,
          voice: 'percussion',
          note: percType,
          frequency: 0,
          midi: 0,
          duration: 0.1,
          velocity,
          pan: (step / n) * 1.4 - 0.7,
          meta: {
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

  // ─── Layer 4: User-Defined L-System → Tree Visual Data ──────────
  const lSafe = lsystemSafe(lCfg.axiom, lCfg.rules, lCfg.generations);
  const lsystemCommands = parseLSystemToCommands(lSafe.result);
  const forwardCount = lsystemCommands.filter(c => c.type === 'forward').length;
  const branchAngles = new Array(Math.max(1, forwardCount));
  for (let i = 0; i < branchAngles.length; i++) {
    const v = norgardValues[i % norgardValues.length];
    branchAngles[i] = lCfg.turnAngle + v * 2;
  }

  // Sort chronologically, then enforce safety cap MAX_SCORE_EVENTS
  events.sort((a, b) => a.time - b.time);

  let eventsCapped = false;
  let finalEvents = events;
  if (events.length > MAX_SCORE_EVENTS) {
    eventsCapped = true;
    finalEvents = events.slice(0, MAX_SCORE_EVENTS);
  }

  const duration = finalEvents.length > 0
    ? finalEvents[finalEvents.length - 1].time + finalEvents[finalEvents.length - 1].duration + 2
    : 10;

  const r0 = activeRings[0] || { pulses: 5, steps: 16, rotation: 0, pattern: [] };

  return {
    events: finalEvents,
    duration,
    lsystemCommands,
    lsystemString: lSafe.result,
    lsystemConfig: {
      ...lCfg,
      actualGenerations: lSafe.actualGenerations,
      estimatedCommands: lSafe.estimatedCommands,
      capped: lSafe.capped,
      warning: lSafe.warning
    },
    branchAngles,
    norgardValues,
    euclideanPattern: r0.pattern,
    euclideanRings: activeRings,
    hanoiMoves,
    params,
    stats: {
      totalEvents: finalEvents.length,
      rawEvents: events.length,
      capped: eventsCapped || lSafe.capped,
      capNotice: eventsCapped
        ? `Event safety cap reached (${MAX_SCORE_EVENTS.toLocaleString()} events max) to keep playback smooth.`
        : lSafe.warning,
      norgard: `Nørgård: ${nCfg.length} notes (offset ${nCfg.offset}, d=${nCfg.intervalStep}, ${nCfg.canonLayers} canons @ ${nCfg.speedRatio}×)`,
      hanoi: `Hanoi: ${hCfg.discs} discs (${totalPossibleHanoiMoves} total moves, ${hanoiMoves.length} played ${hCfg.startPeg}→${hCfg.targetPeg})`,
      euclid: activeRings.length === 1
        ? `Euclidean: ${r0.pulses} of ${r0.steps}, rotation ${r0.rotation}, accent /${eCfg.accentEvery}`
        : `Euclidean: ${activeRings.length} rings (${activeRings.map(r => `${r.pulses}/${r.steps}`).join(' + ')})`,
      lsystem: `L-System: gen ${lSafe.actualGenerations}, ${lsystemCommands.length.toLocaleString()} commands${lSafe.capped ? ' (capped)' : ''}`
    }
  };
}
