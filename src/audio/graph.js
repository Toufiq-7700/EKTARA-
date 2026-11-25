/**
 * Shared Audio Graph Builder
 *
 * Creates the exact same Tone.js voices, channels, and effects chain for both
 * live playback (src/audio/engine.js) and offline WAV export (src/audio/export.js).
 * Keeping this in one module guarantees exported audio matches live playback.
 */

import * as Tone from 'tone';

export const DEFAULT_LAYER_VOLUMES = {
  melody: 0.7,
  canon: 0.5,
  bass: 0.6,
  percussion: 0.4,
  ambient: 0.5
};

export const DEFAULT_LAYER_MIX_DB = {
  melody: -4,
  canon: -10,
  bass: -6,
  percussion: -12,
  ambient: -10
};

export const EXPORT_TAIL_SECONDS = 6;

/**
 * Convert normalized volume [0, 1] plus base channel trim (dB) into target dB.
 * @param {number} normalized - Volume in [0, 1]
 * @param {number} baseDb - Base channel trim in dB
 * @returns {number} Volume in dB
 */
export function volumeToDb(normalized, baseDb = 0) {
  const clamped = Math.max(0, Math.min(1, normalized));
  if (clamped <= 0.0001) return -60;
  return baseDb + 20 * Math.log10(clamped);
}

/**
 * Configure ambient noise filter and level for 'wind', 'rain', or 'none'.
 * @param {Object} graph - Audio graph returned by createAudioGraph
 * @param {string} ambientType - 'wind' | 'rain' | 'none'
 */
export function configureAmbientNoise(graph, ambientType) {
  if (!graph?.ambientNoise || !graph?.ambientNoiseFilter || !graph?.ambientNoiseVol) return;

  if (ambientType === 'rain') {
    graph.ambientNoise.type = 'pink';
    graph.ambientNoiseFilter.frequency.value = 1100;
    graph.ambientNoiseFilter.Q.value = 0.7;
    graph.ambientNoiseVol.volume.value = -28;
  } else if (ambientType === 'wind') {
    graph.ambientNoise.type = 'brown';
    graph.ambientNoiseFilter.frequency.value = 340;
    graph.ambientNoiseFilter.Q.value = 1.0;
    graph.ambientNoiseVol.volume.value = -26;
  }
}

/**
 * Build the complete Tone.js synth + effects graph on the active Tone context
 * (either the live AudioContext or a Tone.Offline OfflineContext).
 *
 * @param {Object} [options]
 * @param {Object} [options.layerVolumes] - Per-layer normalized volumes (0-1)
 * @param {Object} [options.layerMuted] - Per-layer mute flags
 * @param {number} [options.masterVolume] - Normalized master volume (0-1)
 * @param {string} [options.ambientType] - 'wind' | 'rain' | 'none'
 * @returns {Promise<Object>} Audio graph with synths, channels, effects, and dispose()
 */
export async function createAudioGraph(options = {}) {
  const layerVolumes = { ...DEFAULT_LAYER_VOLUMES, ...(options.layerVolumes || {}) };
  const layerMuted = {
    melody: false,
    canon: false,
    bass: false,
    percussion: false,
    ambient: false,
    ...(options.layerMuted || {})
  };
  const masterVolume = options.masterVolume ?? 0.8;
  const ambientType = options.ambientType || 'wind';

  // Master chain: reverb -> limiter -> master volume -> destination
  const masterVol = new Tone.Volume(volumeToDb(masterVolume, -6)).toDestination();
  const limiter = new Tone.Limiter(-3).connect(masterVol);
  const reverb = new Tone.Reverb({ decay: EXPORT_TAIL_SECONDS, wet: 0.4 }).connect(limiter);
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

  // Melody synth: soft sine pluck-bell with slow attack
  const melodySynth = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 8,
    voice: Tone.Synth,
    options: {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.15,
        decay: 0.6,
        sustain: 0.3,
        release: 1.5
      },
      volume: -6
    }
  }).connect(melodyCh);

  // Canon synth: softer triangle echo with longer release
  const canonSynth = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 8,
    voice: Tone.Synth,
    options: {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.3,
        decay: 0.8,
        sustain: 0.2,
        release: 2.5
      },
      volume: -12
    }
  }).connect(canonCh);

  // Bass synth: warm low sine with soft filter envelope
  const bassSynth = new Tone.MonoSynth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.2,
      decay: 0.4,
      sustain: 0.6,
      release: 3.0
    },
    filterEnvelope: {
      attack: 0.12,
      decay: 0.3,
      sustain: 0.5,
      release: 2.0,
      baseFrequency: 110,
      octaves: 2
    },
    volume: -8
  }).connect(bassCh);

  // Percussion: soft chime, brushed pink noise, and gentle wood-like tap
  const percChime = new Tone.MetalSynth({
    frequency: 800,
    envelope: { attack: 0.005, decay: 0.4, release: 0.3 },
    harmonicity: 5.1,
    modulationIndex: 12,
    resonance: 1800,
    octaves: 1,
    volume: -24
  }).connect(percCh);

  const percBrush = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.008, decay: 0.15, sustain: 0, release: 0.1 },
    volume: -20
  }).connect(percCh);

  const percTap = new Tone.MembraneSynth({
    pitchDecay: 0.015,
    octaves: 2,
    envelope: { attack: 0.004, decay: 0.2, sustain: 0, release: 0.1 },
    volume: -22
  }).connect(percCh);

  // Ambient pad: warm detuned harmonics through low-pass filter
  const ambientPadFilter = new Tone.Filter({ frequency: 900, type: 'lowpass' }).connect(ambientCh);
  const ambientPad = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 4,
    voice: Tone.Synth,
    options: {
      oscillator: { type: 'sine4' },
      envelope: {
        attack: 4,
        decay: 2,
        sustain: 0.8,
        release: 5
      },
      volume: -18
    }
  }).connect(ambientPadFilter);

  // Ambient wind / rain noise
  const ambientNoiseVol = new Tone.Volume(-26).connect(ambientCh);
  const ambientNoiseFilter = new Tone.Filter({ frequency: 340, type: 'lowpass' }).connect(ambientNoiseVol);
  const ambientNoise = new Tone.Noise(ambientType === 'rain' ? 'pink' : 'brown').connect(ambientNoiseFilter);

  const graph = {
    masterVol,
    limiter,
    reverb,
    delay,
    channels: {
      melody: melodyCh,
      canon: canonCh,
      bass: bassCh,
      percussion: percCh,
      ambient: ambientCh
    },
    melodySynth,
    canonSynth,
    bassSynth,
    percChime,
    percBrush,
    percTap,
    ambientPad,
    ambientPadFilter,
    ambientNoise,
    ambientNoiseFilter,
    ambientNoiseVol,
    dispose() {
      const nodes = [
        melodySynth, canonSynth, bassSynth,
        percChime, percBrush, percTap,
        ambientPad, ambientPadFilter,
        ambientNoise, ambientNoiseFilter, ambientNoiseVol,
        melodyCh, canonCh, bassCh, percCh, ambientCh,
        delay, reverb, limiter, masterVol
      ];
      for (const node of nodes) {
        try {
          node?.dispose();
        } catch (_) {
          /* ignore dispose errors */
        }
      }
    }
  };

  configureAmbientNoise(graph, ambientType);
  return graph;
}

/**
 * Trigger a single score event on the provided audio graph.
 *
 * @param {Object} graph - Audio graph from createAudioGraph()
 * @param {Object} event - Timed event from buildScore()
 * @param {number} time - Web Audio scheduled time
 * @param {Object} [layerMuted] - Optional mute map
 */
export function triggerScoreEvent(graph, event, time, layerMuted = {}) {
  const { voice, note, duration, velocity } = event;
  if (layerMuted[voice]) return;

  const safeVel = Math.max(0.01, Math.min(1, velocity ?? 0.5));
  const safeDur = Math.max(0.05, duration ?? 0.2);

  switch (voice) {
    case 'melody':
      if (note) {
        graph.melodySynth.triggerAttackRelease(note, safeDur, time, safeVel);
      }
      break;
    case 'canon':
      if (note) {
        graph.canonSynth.triggerAttackRelease(note, safeDur, time, safeVel);
      }
      break;
    case 'bass':
      if (note) {
        graph.bassSynth.triggerAttackRelease(note, safeDur, time, safeVel);
      }
      break;
    case 'percussion': {
      const percType = event.meta?.percType || 'brush';
      if (percType === 'chime') {
        graph.percChime.triggerAttackRelease('16n', time, safeVel);
      } else if (percType === 'tap') {
        graph.percTap.triggerAttackRelease('C2', '16n', time, safeVel);
      } else {
        graph.percBrush.triggerAttackRelease('32n', time, safeVel);
      }
      break;
    }
  }
}
