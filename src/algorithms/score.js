/**
 * Score Builder — The Heart of Recursive Garden
 *
 * Reads the user's chosen algorithm plugin for each musical/visual role
 * (`melody`, `bass`, `rhythm`, `tree`) from `src/algorithms/registry.js`
 * instead of hard-coding defaults. Produces one deterministic, scale-quantised,
 * safety-capped score consumed by live playback, Garden visuals, Algorithm Lab,
 * and Tone.Offline WAV export.
 */

import { createPRNG } from './prng.js';
import { normalizeParams, MAX_SCORE_EVENTS } from './params.js';
import { getAlgorithmPlugin } from './registry.js';

/**
 * Build a complete score from global, role-selection, and per-algorithm parameters.
 *
 * @param {Object} [rawParams={}]
 * @returns {Object} The score with events, stats, visual metadata, and normalized params
 */
export function buildScore(rawParams = {}) {
  const params = normalizeParams(rawParams);
  const { seed, tempo, roles } = params;

  const rng = createPRNG(seed);
  const beatDuration = 60 / tempo;

  // 1. Melody role plugin
  const melodyPlugin = getAlgorithmPlugin('melody', roles.melody);
  const melodyRes = melodyPlugin.generate({ params, beatDuration }, rng);

  // 2. Bass role plugin
  const bassPlugin = getAlgorithmPlugin('bass', roles.bass);
  const bassRes = bassPlugin.generate({ params, beatDuration }, rng);

  const melodyDuration = melodyRes.durationSpan || 16;
  const bassDuration = bassRes.durationSpan || 16;
  const totalScoreSpan = Math.max(melodyDuration, bassDuration);

  // 3. Rhythm role plugin
  const rhythmPlugin = getAlgorithmPlugin('rhythm', roles.rhythm);
  const rhythmRes = rhythmPlugin.generate({ params, beatDuration, totalScoreSpan }, rng);

  // 4. Visual Tree role plugin
  const treePlugin = getAlgorithmPlugin('tree', roles.tree);
  const treeRes = treePlugin.generate({
    params,
    beatDuration,
    melodyValues: melodyRes.values || [0]
  }, rng);

  // Combine and sort all events chronologically
  const events = [
    ...(melodyRes.events || []),
    ...(bassRes.events || []),
    ...(rhythmRes.events || []),
    ...(treeRes.events || [])
  ].sort((a, b) => a.time - b.time);

  let eventsCapped = false;
  let finalEvents = events;
  if (events.length > MAX_SCORE_EVENTS) {
    eventsCapped = true;
    finalEvents = events.slice(0, MAX_SCORE_EVENTS);
  }

  const duration = finalEvents.length > 0
    ? finalEvents[finalEvents.length - 1].time + finalEvents[finalEvents.length - 1].duration + 2
    : 10;

  const lCfg = treeRes.lsystemConfig || params.lsystem;
  const r0 = (rhythmRes.euclideanRings && rhythmRes.euclideanRings[0]) || {
    pulses: 5,
    steps: 16,
    rotation: 0,
    pattern: rhythmRes.euclideanPattern || []
  };

  return {
    events: finalEvents,
    duration,
    roles: {
      melody: melodyPlugin.id,
      bass: bassPlugin.id,
      rhythm: rhythmPlugin.id,
      tree: treePlugin.id
    },
    lsystemCommands: treeRes.lsystemCommands || [],
    lsystemString: treeRes.lsystemString || '',
    lsystemConfig: lCfg,
    branchAngles: treeRes.branchAngles || [params.branchAngle],
    norgardValues: melodyRes.values || [0],
    euclideanPattern: rhythmRes.euclideanPattern || r0.pattern || [],
    euclideanRings: rhythmRes.euclideanRings || [r0],
    hanoiMoves: bassRes.hanoiMoves || [],
    params,
    stats: {
      totalEvents: finalEvents.length,
      rawEvents: events.length,
      capped: eventsCapped || !!lCfg.capped,
      capNotice: eventsCapped
        ? `Event safety cap reached (${MAX_SCORE_EVENTS.toLocaleString()} events max) to keep playback smooth.`
        : lCfg.warning || null,
      melody: melodyRes.stat,
      bass: bassRes.stat,
      rhythm: rhythmRes.stat,
      tree: treeRes.stat,
      // Legacy aliases for any direct callers
      norgard: melodyRes.stat,
      hanoi: bassRes.stat,
      euclid: rhythmRes.stat,
      lsystem: treeRes.stat
    }
  };
}
