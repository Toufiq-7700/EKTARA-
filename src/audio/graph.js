/**
 * Shared Audio Graph Builder
 *
 * Creates the exact same Tone.js voices, timbres, vibrato, channels, and effects
 * chain for both live playback (src/audio/engine.js) and offline WAV export
 * (src/audio/export.js) so exported audio matches live playback.
 */

import * as Tone from 'tone';
import { createRainSynth } from './rain.js';
import {
  DEFAULT_TIMBRES,
  createMelodyVoice,
  createBassVoice,
  createPadVoice,
  createPercussionVoices,
  createDroneVoice
} from './instruments.js';

export const DEFAULT_LAYER_VOLUMES = {
  melody: 0.7,
  canon: 0.5,
  bass: 0.6,
  percussion: 0.4,
  ambient: 0.5,
  drone: 0.45
};

export const DEFAULT_LAYER_MIX_DB = {
  melody: -4,
  canon: -10,
  bass: -6,
  percussion: -12,
  ambient: -10,
  drone: -11
};

export const EXPORT_TAIL_SECONDS = 6;

/**
 * Convert normalized volume [0, 1] plus base channel trim (dB) into target dB.
 */
export function volumeToDb(normalized, baseDb = 0) {
  const clamped = Math.max(0, Math.min(1, normalized));
  if (clamped <= 0.0001) return -60;
  return baseDb + 20 * Math.log10(clamped);
}

/**
 * Configure ambient wind noise filter and level.
 */
export function configureAmbientNoise(graph, ambientType) {
  if (!graph?.ambientNoise || !graph?.ambientNoiseFilter || !graph?.ambientNoiseVol) return;

  if (ambientType === 'wind') {
    graph.ambientNoise.type = 'brown';
    graph.ambientNoiseFilter.frequency.value = 340;
    graph.ambientNoiseFilter.Q.value = 1.0;
    graph.ambientNoiseVol.volume.value = -26;
  }
}

/**
 * Build the complete Tone.js synth + effects graph on the active Tone context.
 */
export async function createAudioGraph(options = {}) {
  const layerVolumes = { ...DEFAULT_LAYER_VOLUMES, ...(options.layerVolumes || {}) };
  const layerMuted = {
    melody: false,
    canon: false,
    bass: false,
    percussion: false,
    ambient: false,
    drone: false,
    ...(options.layerMuted || {})
  };
  const timbres = { ...DEFAULT_TIMBRES, ...(options.timbres || {}) };
  const masterVolume = options.masterVolume ?? 0.8;
  const ambientType = options.ambientType || 'wind';

  // Master chain: reverb -> limiter (-3 dB) -> master volume -> meter/destination
  const masterVol = new Tone.Volume(volumeToDb(masterVolume, -6)).toDestination();
  const meter = new Tone.Meter({ smoothing: 0.85 });
  masterVol.connect(meter);
  const limiter = new Tone.Limiter(-3).connect(masterVol);
  const reverb = new Tone.Reverb({ decay: EXPORT_TAIL_SECONDS, wet: 0.42 }).connect(limiter);
  await reverb.ready;
  const delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.2, wet: 0.15 }).connect(reverb);

  // Per-layer channels
  const melodyCh = new Tone.Channel({
    volume: volumeToDb(layerVolumes.melody, DEFAULT_LAYER_MIX_DB.melody),
    mute: !!layerMuted.melody
  }).connect(delay);
  const canonCh = new Tone.Channel({
    volume: volumeToDb(layerVolumes.canon, DEFAULT_LAYER_MIX_DB.canon),
    mute: !!layerMuted.canon
  }).connect(delay);
  const bassCh = new Tone.Channel({
    volume: volumeToDb(layerVolumes.bass, DEFAULT_LAYER_MIX_DB.bass),
    mute: !!layerMuted.bass
  }).connect(reverb);
  const percCh = new Tone.Channel({
    volume: volumeToDb(layerVolumes.percussion, DEFAULT_LAYER_MIX_DB.percussion),
    mute: !!layerMuted.percussion
  }).connect(delay);
  const ambientCh = new Tone.Channel({
    volume: volumeToDb(layerVolumes.ambient, DEFAULT_LAYER_MIX_DB.ambient),
    mute: !!layerMuted.ambient
  }).connect(reverb);
  const droneCh = new Tone.Channel({
    volume: volumeToDb(layerVolumes.drone, DEFAULT_LAYER_MIX_DB.drone),
    mute: !!layerMuted.drone
  }).connect(reverb);

  // Subtle delayed vibrato for melody & canon notes
  const melodyVibrato = new Tone.Vibrato({ frequency: 4.6, depth: 0.045, type: 'sine' }).connect(melodyCh);
  const canonVibrato = new Tone.Vibrato({ frequency: 4.1, depth: 0.055, type: 'sine' }).connect(canonCh);

  const resolveCanonTimbre = () =>
    timbres.canon === 'Match Melody' ? timbres.melody : timbres.canon;

  let melodySynth = createMelodyVoice(timbres.melody, melodyVibrato, 0);
  let canonSynth = createMelodyVoice(resolveCanonTimbre(), canonVibrato, -6);
  let bassSynth = createBassVoice(timbres.bass, bassCh);
  let percVoices = createPercussionVoices(timbres.percussion, percCh);
  let ambientPad = createPadVoice(timbres.ambient, ambientCh);
  let droneSynth = createDroneVoice(droneCh);

  // Ambient wind noise
  const ambientNoiseVol = new Tone.Volume(-26).connect(ambientCh);
  const ambientNoiseFilter = new Tone.Filter({ frequency: 340, type: 'lowpass' }).connect(ambientNoiseVol);
  const ambientNoise = new Tone.Noise('brown').connect(ambientNoiseFilter);

  // Layered procedural rain soundscape
  const rainSynth = createRainSynth(ambientCh, {
    seed: options.seed ?? 42,
    initialIntensity: options.rainIntensity ?? 0,
    thunderEnabled: options.thunderEnabled ?? true
  });

  const graph = {
    masterVol,
    meter,
    limiter,
    reverb,
    delay,
    timbres,
    channels: {
      melody: melodyCh,
      canon: canonCh,
      bass: bassCh,
      percussion: percCh,
      ambient: ambientCh,
      drone: droneCh
    },
    melodyVibrato,
    canonVibrato,
    get melodySynth() { return melodySynth; },
    get canonSynth() { return canonSynth; },
    get bassSynth() { return bassSynth; },
    get percVoices() { return percVoices; },
    get ambientPad() { return ambientPad; },
    get droneSynth() { return droneSynth; },
    ambientNoise,
    ambientNoiseFilter,
    ambientNoiseVol,
    rainSynth,

    /**
     * Smoothly swap a layer's timbre with a brief gain dip so no clicks occur.
     */
    setLayerTimbre(layer, newTimbre, normalizedVol) {
      timbres[layer] = newTimbre;
      const ch = this.channels[layer];
      if (!ch) return;

      const baseMix = DEFAULT_LAYER_MIX_DB[layer] ?? -6;
      if (typeof normalizedVol === 'number') layerVolumes[layer] = normalizedVol;
      const curVol = layerVolumes[layer] ?? 0.6;
      const targetDb = volumeToDb(curVol, baseMix);

      // Brief fade down, swap, fade back in smoothly
      ch.volume.rampTo(-60, 0.08);
      setTimeout(() => {
        try {
          if (layer === 'melody') {
            melodySynth?.releaseAll();
            melodySynth?.dispose();
            melodySynth = createMelodyVoice(newTimbre, melodyVibrato, 0);
            if (timbres.canon === 'Match Melody') {
              canonSynth?.releaseAll();
              canonSynth?.dispose();
              canonSynth = createMelodyVoice(newTimbre, canonVibrato, -6);
            }
          } else if (layer === 'canon') {
            canonSynth?.releaseAll();
            canonSynth?.dispose();
            canonSynth = createMelodyVoice(resolveCanonTimbre(), canonVibrato, -6);
          } else if (layer === 'bass') {
            bassSynth?.releaseAll();
            bassSynth?.dispose();
            bassSynth = createBassVoice(newTimbre, bassCh);
          } else if (layer === 'percussion') {
            percVoices?.dispose();
            percVoices = createPercussionVoices(newTimbre, percCh);
          } else if (layer === 'ambient') {
            ambientPad?.releaseAll();
            ambientPad?.dispose();
            ambientPad = createPadVoice(newTimbre, ambientCh);
          }
        } catch (_) { /* ignore swap edge case */ }
        ch.volume.rampTo(targetDb, 0.25);
      }, 90);
    },

    dispose() {
      rainSynth?.dispose();
      try { melodySynth?.dispose(); } catch (_) { /* ignore */ }
      try { canonSynth?.dispose(); } catch (_) { /* ignore */ }
      try { bassSynth?.dispose(); } catch (_) { /* ignore */ }
      try { percVoices?.dispose(); } catch (_) { /* ignore */ }
      try { ambientPad?.dispose(); } catch (_) { /* ignore */ }
      try { droneSynth?.dispose(); } catch (_) { /* ignore */ }
      const nodes = [
        melodyVibrato, canonVibrato,
        ambientNoise, ambientNoiseFilter, ambientNoiseVol,
        melodyCh, canonCh, bassCh, percCh, ambientCh, droneCh,
        delay, reverb, limiter, meter, masterVol
      ];
      for (const node of nodes) {
        try { node?.dispose(); } catch (_) { /* ignore */ }
      }
    }
  };

  configureAmbientNoise(graph, ambientType);
  return graph;
}

/**
 * Trigger a single (humanised) score event on the provided audio graph.
 */
export function triggerScoreEvent(graph, event, time, layerMuted = {}) {
  const { voice, note, frequency, duration, velocity } = event;
  if (layerMuted[voice]) return;

  const safeVel = Math.max(0.01, Math.min(1, velocity ?? 0.5));
  const safeDur = Math.max(0.06, duration ?? 0.25);
  const pitchArg = frequency > 0 ? frequency : note;

  switch (voice) {
    case 'melody':
      if (pitchArg) {
        // Delayed vibrato blooms gently after attack
        graph.melodyVibrato.depth.setValueAtTime(0, time);
        graph.melodyVibrato.depth.linearRampToValueAtTime(0.045, time + 0.28);
        graph.melodySynth.triggerAttackRelease(pitchArg, safeDur, time, safeVel);
      }
      break;
    case 'canon':
      if (pitchArg) {
        graph.canonVibrato.depth.setValueAtTime(0, time);
        graph.canonVibrato.depth.linearRampToValueAtTime(0.055, time + 0.35);
        graph.canonSynth.triggerAttackRelease(pitchArg, safeDur, time, safeVel);
      }
      break;
    case 'bass':
      if (pitchArg) {
        graph.bassSynth.triggerAttackRelease(pitchArg, safeDur, time, safeVel);
      }
      break;
    case 'percussion': {
      const percType = event.meta?.percType || 'brush';
      const pv = graph.percVoices;
      if (!pv) break;
      if (percType === 'chime') {
        pv.percChime.triggerAttackRelease('16n', time, safeVel * 0.85);
      } else if (percType === 'tap') {
        pv.percTap.triggerAttackRelease(pv.isBamboo ? 'G2' : 'D2', '16n', time, safeVel * 0.9);
      } else {
        pv.percBrush.triggerAttackRelease('32n', time, safeVel * 0.85);
      }
      break;
    }
    case 'drone':
      if (pitchArg && graph.droneSynth) {
        graph.droneSynth.triggerAttackRelease(pitchArg, safeDur, time, safeVel, event.meta?.bendCents || 0);
      }
      break;
  }
}
