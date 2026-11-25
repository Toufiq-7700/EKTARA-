/**
 * Audio Engine — Tone.js Playback for Recursive Garden
 *
 * Consumes the score (array of timed events) and plays it through the shared
 * Tone.js voice & effects graph (src/audio/graph.js) so live playback and
 * offline WAV export sound identical.
 */

import * as Tone from 'tone';
import {
  createAudioGraph,
  triggerScoreEvent,
  configureAmbientNoise,
  volumeToDb,
  DEFAULT_LAYER_VOLUMES,
  DEFAULT_LAYER_MIX_DB
} from './graph.js';

const START_OFFSET_SECONDS = 0.15;

// ─── State ────────────────────────────────────────────────────────

let isInitialized = false;
let isPlaying = false;
let graph = null;
let scheduledEvents = [];
let loopId = null;
let sleepTimerId = null;
let sleepStopTimeoutId = null;
let evolveEnabled = false;
let currentAmbientType = 'wind';
let masterVolumeNormalized = 0.8;
let currentScore = null;
let onEventCallback = null;
let onPlaybackStateChange = null;
let currentPadNotes = [];

const layerVolumes = { ...DEFAULT_LAYER_VOLUMES };
const layerMuted = {
  melody: false,
  canon: false,
  bass: false,
  percussion: false,
  ambient: false
};

/**
 * Register a listener invoked when playback starts/pauses/stops (e.g., sleep timer).
 * @param {Function|null} listener
 */
export function setPlaybackStateListener(listener) {
  onPlaybackStateChange = listener;
}

function notifyPlaybackState() {
  if (onPlaybackStateChange) {
    onPlaybackStateChange(getPlaybackState());
  }
}

/**
 * Initialize the audio engine. Must be called after a user gesture.
 */
export async function initAudio() {
  if (isInitialized) return;

  await Tone.start();
  graph = await createAudioGraph({
    layerVolumes,
    layerMuted,
    masterVolume: masterVolumeNormalized,
    ambientType: currentAmbientType
  });

  isInitialized = true;
}

/**
 * Schedule and play a score from Transport time 0.
 *
 * @param {Object} score - Score from buildScore()
 * @param {Function} [onEvent] - Callback fired for each event: onEvent(event, time)
 * @param {Object} [options] - { skipFadeIn?: boolean }
 */
export function playScore(score, onEvent, options = {}) {
  if (!isInitialized || !graph) {
    console.warn('Audio not initialized. Call initAudio() first.');
    return;
  }

  stopPlayback({ silentNotify: true });
  currentScore = score;
  onEventCallback = onEvent || null;

  const targetDb = volumeToDb(masterVolumeNormalized, -6);
  if (options.skipFadeIn) {
    graph.masterVol.volume.rampTo(targetDb, 0.25);
  } else {
    // Soft 4-second fade-in on start
    graph.masterVol.volume.value = -60;
    graph.masterVol.volume.rampTo(targetDb, 4);
  }

  // Start ambient noise only when enabled and unmuted
  configureAmbientNoise(graph, currentAmbientType);
  if (currentAmbientType !== 'none' && !layerMuted.ambient && graph.ambientNoise.state !== 'started') {
    graph.ambientNoise.start();
  }

  // Start ambient pad chord anchored on the root note
  const rootNote = score.params?.rootNote || 60;
  const rootName = Tone.Frequency(rootNote, 'midi').toNote();
  const fifthName = Tone.Frequency(rootNote + 7, 'midi').toNote();
  currentPadNotes = [rootName, fifthName];
  if (!layerMuted.ambient) {
    graph.ambientPad.triggerAttack(currentPadNotes, Tone.now(), 0.3);
  }

  // Reset Transport to 0 so getCurrentTime() aligns with score event times
  const transport = Tone.getTransport();
  transport.seconds = 0;
  scheduledEvents = [];

  for (const event of score.events) {
    const transportTime = START_OFFSET_SECONDS + event.time;
    const id = transport.schedule((time) => {
      try {
        triggerScoreEvent(graph, event, time, layerMuted);
      } catch (err) {
        console.warn('Audio event error:', err.message);
      }
      if (onEventCallback) {
        onEventCallback(event, time);
      }
    }, transportTime);

    scheduledEvents.push(id);
  }

  // Schedule seamless loop or Evolve transition at end of score
  const cycleEnd = START_OFFSET_SECONDS + score.duration;
  loopId = transport.schedule((time) => {
    setTimeout(() => {
      if (!isPlaying) return;
      if (evolveEnabled) {
        const nextSeed = (score.params?.seed ?? 42) + 1;
        const curDepth = score.params?.depth ?? 4;
        // Gently drift depth +/- 1 every few cycles while keeping within [2, 7]
        const drift = nextSeed % 3 === 0 ? (nextSeed % 2 === 0 ? 1 : -1) : 0;
        const nextDepth = Math.max(2, Math.min(7, curDepth + drift));
        const newParams = { ...score.params, seed: nextSeed, depth: nextDepth };
        if (onEventCallback) {
          onEventCallback({ voice: '_loop', meta: { newParams } }, time);
        }
      } else {
        playScore(score, onEventCallback, { skipFadeIn: true });
      }
    }, 0);
  }, cycleEnd);

  transport.start();
  isPlaying = true;
  notifyPlaybackState();
}

/**
 * Pause playback cleanly (including ambient pad & noise).
 */
export function pausePlayback() {
  Tone.getTransport().pause();
  try {
    graph?.melodySynth?.releaseAll();
    graph?.canonSynth?.releaseAll();
    graph?.ambientPad?.releaseAll();
    if (graph?.ambientNoise?.state === 'started') {
      graph.ambientNoise.stop();
    }
  } catch (_) { /* ignore */ }
  isPlaying = false;
  notifyPlaybackState();
}

/**
 * Resume playback after pause.
 */
export function resumePlayback() {
  if (!isInitialized || !graph) return;
  if (currentAmbientType !== 'none' && !layerMuted.ambient && graph.ambientNoise.state !== 'started') {
    graph.ambientNoise.start();
  }
  if (!layerMuted.ambient && currentPadNotes.length > 0) {
    graph.ambientPad.triggerAttack(currentPadNotes, Tone.now(), 0.3);
  }
  Tone.getTransport().start();
  isPlaying = true;
  notifyPlaybackState();
}

/**
 * Stop playback and clear all scheduled events.
 */
export function stopPlayback(options = {}) {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.seconds = 0;
  scheduledEvents = [];
  loopId = null;

  try {
    graph?.melodySynth?.releaseAll();
    graph?.canonSynth?.releaseAll();
    graph?.ambientPad?.releaseAll();
    if (graph?.ambientNoise?.state === 'started') {
      graph.ambientNoise.stop();
    }
  } catch (_) { /* ignore */ }

  isPlaying = false;
  if (!options.silentNotify) {
    notifyPlaybackState();
  }
}

/**
 * Set master volume (0-1).
 */
export function setMasterVolume(value) {
  masterVolumeNormalized = Math.max(0, Math.min(1, value));
  if (graph?.masterVol) {
    graph.masterVol.volume.rampTo(volumeToDb(masterVolumeNormalized, -6), 0.1);
  }
}

/**
 * Set per-layer volume (0-1).
 */
export function setLayerVolume(layer, value) {
  const clamped = Math.max(0, Math.min(1, value));
  layerVolumes[layer] = clamped;
  const channel = graph?.channels?.[layer];
  if (channel) {
    channel.volume.rampTo(volumeToDb(clamped, DEFAULT_LAYER_MIX_DB[layer] ?? -6), 0.25);
  }
}

/**
 * Mute/unmute a layer.
 */
export function setLayerMute(layer, muted) {
  layerMuted[layer] = !!muted;
  const channel = graph?.channels?.[layer];
  if (channel) {
    channel.mute = !!muted;
  }
  if (layer === 'ambient' && graph) {
    if (muted) {
      graph.ambientPad.releaseAll();
      if (graph.ambientNoise.state === 'started') graph.ambientNoise.stop();
    } else if (isPlaying) {
      if (currentAmbientType !== 'none' && graph.ambientNoise.state !== 'started') {
        graph.ambientNoise.start();
      }
      if (currentPadNotes.length > 0) {
        graph.ambientPad.triggerAttack(currentPadNotes, Tone.now(), 0.3);
      }
    }
  }
}

/**
 * Get current layer volumes and mute states (used by WAV export to match live mix).
 */
export function getAudioMixSettings() {
  return {
    masterVolume: masterVolumeNormalized,
    layerVolumes: { ...layerVolumes },
    layerMuted: { ...layerMuted },
    ambientType: currentAmbientType
  };
}

/**
 * Set the sleep timer: fade out smoothly over the final 10s and stop.
 */
export function setSleepTimer(minutes) {
  if (sleepTimerId) {
    clearTimeout(sleepTimerId);
    sleepTimerId = null;
  }
  if (sleepStopTimeoutId) {
    clearTimeout(sleepStopTimeoutId);
    sleepStopTimeoutId = null;
  }
  if (minutes <= 0) return;

  const totalMs = minutes * 60 * 1000;
  const fadeMs = Math.min(10000, totalMs);
  const fadeStart = Math.max(0, totalMs - fadeMs);

  sleepTimerId = setTimeout(() => {
    if (graph?.masterVol) {
      graph.masterVol.volume.rampTo(-60, fadeMs / 1000);
    }
    sleepStopTimeoutId = setTimeout(() => {
      stopPlayback();
    }, fadeMs);
  }, fadeStart);
}

/**
 * Enable/disable evolve mode (seed increments and depth drifts gently each loop).
 */
export function setEvolve(enabled) {
  evolveEnabled = !!enabled;
}

/**
 * Set ambient type: 'rain', 'wind', or 'none'.
 */
export function setAmbientType(type) {
  currentAmbientType = type;
  if (!graph) return;
  try {
    if (type === 'none') {
      if (graph.ambientNoise.state === 'started') {
        graph.ambientNoise.stop();
      }
    } else {
      configureAmbientNoise(graph, type);
      if (graph.ambientNoise.state !== 'started' && isPlaying && !layerMuted.ambient) {
        graph.ambientNoise.start();
      }
    }
  } catch (_) { /* ignore */ }
}

/**
 * Get playback state.
 */
export function getPlaybackState() {
  return {
    isPlaying,
    isInitialized,
    currentTime: getCurrentTime(),
    transportState: Tone.getTransport().state
  };
}

/**
 * Get current score playback position (seconds) for syncing visuals.
 */
export function getCurrentTime() {
  return Math.max(0, Tone.getTransport().seconds - START_OFFSET_SECONDS);
}

/**
 * Dispose all audio resources.
 */
export function disposeAudio() {
  stopPlayback({ silentNotify: true });
  if (sleepTimerId) clearTimeout(sleepTimerId);
  if (sleepStopTimeoutId) clearTimeout(sleepStopTimeoutId);
  graph?.dispose();
  graph = null;
  isInitialized = false;
}
