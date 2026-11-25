/**
 * Audio Engine — Tone.js Playback for Recursive Garden
 *
 * Consumes the score (array of timed events) and plays it through the shared
 * Tone.js voice & effects graph (src/audio/graph.js) so live playback and
 * offline WAV export sound identical.
 */

import * as Tone from 'tone';
import { createPRNG } from '../algorithms/prng.js';
import { DEFAULT_TIMBRES, humaniseEvent } from './instruments.js';
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
let currentRainIntensity = 0.35;
let currentThunderEnabled = true;
let masterVolumeNormalized = 0.8;
let playbackSpeed = 1.0;
let currentScore = null;
let onEventCallback = null;
let onPlaybackStateChange = null;
let currentPadNotes = [];

const layerVolumes = { ...DEFAULT_LAYER_VOLUMES };
const layerTimbres = { ...DEFAULT_TIMBRES };
const layerMuted = {
  melody: false,
  canon: false,
  bass: false,
  percussion: false,
  ambient: false
};
const algorithmDisabled = {
  norgard: false,
  hanoi: false,
  bjorklund: false,
  lsystem: false
};

function isVoiceEffectivelyMuted(voice) {
  if (layerMuted[voice]) return true;
  if ((voice === 'melody' || voice === 'canon') && algorithmDisabled.norgard) return true;
  if (voice === 'canon' && algorithmDisabled.lsystem) return true;
  if (voice === 'bass' && algorithmDisabled.hanoi) return true;
  if (voice === 'percussion' && algorithmDisabled.bjorklund) return true;
  return false;
}

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
export async function initAudio(initialOptions = {}) {
  if (isInitialized) return;

  if (typeof initialOptions.rainIntensity === 'number') {
    currentRainIntensity = Math.max(0, Math.min(1, initialOptions.rainIntensity));
  }
  if (typeof initialOptions.thunderEnabled === 'boolean') {
    currentThunderEnabled = initialOptions.thunderEnabled;
  }
  if (initialOptions.ambientType) {
    currentAmbientType = initialOptions.ambientType;
  }

  if (initialOptions.timbres) {
    Object.assign(layerTimbres, initialOptions.timbres);
  }

  await Tone.start();
  graph = await createAudioGraph({
    layerVolumes,
    layerMuted,
    timbres: layerTimbres,
    masterVolume: masterVolumeNormalized,
    ambientType: currentAmbientType,
    rainIntensity: currentRainIntensity,
    thunderEnabled: currentThunderEnabled,
    seed: initialOptions.seed ?? 42
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

  // Start wind noise only when ambient === 'wind' and unmuted
  configureAmbientNoise(graph, currentAmbientType);
  if (currentAmbientType === 'wind' && !layerMuted.ambient && graph.ambientNoise.state !== 'started') {
    graph.ambientNoise.start();
  }

  // Start layered rain soundscape if intensity > 0 and ambient is unmuted
  if (!layerMuted.ambient && currentRainIntensity > 0.001) {
    graph.rainSynth.setIntensity(currentRainIntensity, 0.8);
  } else {
    graph.rainSynth.setIntensity(0, 0.1);
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
  const humanRng = createPRNG((score.params?.seed ?? 42) + 9091);

  for (const rawEvent of score.events) {
    const event = humaniseEvent(rawEvent, humanRng);
    const transportTime = START_OFFSET_SECONDS + event.time / playbackSpeed;
    const id = transport.schedule((time) => {
      const liveMuted = {
        melody: isVoiceEffectivelyMuted('melody'),
        canon: isVoiceEffectivelyMuted('canon'),
        bass: isVoiceEffectivelyMuted('bass'),
        percussion: isVoiceEffectivelyMuted('percussion'),
        ambient: isVoiceEffectivelyMuted('ambient')
      };
      try {
        triggerScoreEvent(graph, { ...event, duration: event.duration / playbackSpeed }, time, liveMuted);
      } catch (err) {
        console.warn('Audio event error:', err.message);
      }
      if (onEventCallback) {
        onEventCallback(rawEvent, time);
      }
    }, transportTime);

    scheduledEvents.push(id);
  }

  // Schedule seamless loop or Evolve transition at end of score
  const cycleEnd = START_OFFSET_SECONDS + score.duration / playbackSpeed;
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
    graph?.rainSynth?.stop();
  } catch (_) { /* ignore */ }
  isPlaying = false;
  notifyPlaybackState();
}

/**
 * Resume playback after pause.
 */
export function resumePlayback() {
  if (!isInitialized || !graph) return;
  if (currentAmbientType === 'wind' && !layerMuted.ambient && graph.ambientNoise.state !== 'started') {
    graph.ambientNoise.start();
  }
  if (!layerMuted.ambient && currentRainIntensity > 0.001) {
    graph.rainSynth.setIntensity(currentRainIntensity, 0.4);
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
    graph?.rainSynth?.stop();
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
      graph.rainSynth.stop();
    } else if (isPlaying) {
      if (currentAmbientType === 'wind' && graph.ambientNoise.state !== 'started') {
        graph.ambientNoise.start();
      }
      if (currentRainIntensity > 0.001) {
        graph.rainSynth.setIntensity(currentRainIntensity, 0.35);
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
    timbres: { ...layerTimbres },
    ambientType: currentAmbientType,
    rainIntensity: currentRainIntensity,
    thunderEnabled: currentThunderEnabled
  };
}

/**
 * Smoothly change a layer's procedural timbre with no clicks.
 */
export function setLayerTimbre(layer, timbreName) {
  layerTimbres[layer] = timbreName;
  if (!graph) return;
  graph.setLayerTimbre(layer, timbreName, layerVolumes[layer]);
  if (layer === 'ambient' && isPlaying && !layerMuted.ambient && currentPadNotes.length > 0) {
    setTimeout(() => {
      if (isPlaying && !layerMuted.ambient && graph?.ambientPad) {
        graph.ambientPad.triggerAttack(currentPadNotes, Tone.now(), 0.3);
      }
    }, 110);
  }
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
    if (type !== 'wind') {
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
 * Set rain intensity (0 = fully stop rain nodes, 1 = heavy downpour).
 */
export function setRainIntensity(intensity) {
  currentRainIntensity = Math.max(0, Math.min(1, intensity));
  if (!graph) return;
  if (layerMuted.ambient || !isPlaying) {
    if (currentRainIntensity <= 0.001) {
      graph.rainSynth.setIntensity(0, 0.2);
    }
    return;
  }
  graph.rainSynth.setIntensity(currentRainIntensity, 0.35);
}

/**
 * Enable or disable distant thunder during heavy rain.
 */
export function setThunderEnabled(enabled) {
  currentThunderEnabled = !!enabled;
  graph?.rainSynth?.setThunderEnabled(currentThunderEnabled);
}

/**
 * Get live rain audio node status (useful for verification/debugging).
 */
export function getRainAudioState() {
  return graph?.rainSynth?.getState() || null;
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
  return Math.max(0, (Tone.getTransport().seconds - START_OFFSET_SECONDS) * playbackSpeed);
}

/**
 * Enable or disable an algorithm layer (synced with Algorithm Lab cards).
 */
export function setAlgorithmEnabled(algorithmId, enabled) {
  algorithmDisabled[algorithmId] = !enabled;
  if (!graph) return;
  if (graph.channels.melody) {
    graph.channels.melody.mute = isVoiceEffectivelyMuted('melody');
  }
  if (graph.channels.canon) {
    graph.channels.canon.mute = isVoiceEffectivelyMuted('canon');
  }
  if (graph.channels.bass) {
    graph.channels.bass.mute = isVoiceEffectivelyMuted('bass');
  }
  if (graph.channels.percussion) {
    graph.channels.percussion.mute = isVoiceEffectivelyMuted('percussion');
  }
}

/**
 * Set Lab playback speed multiplier (0.25x to 2x) and smoothly reschedule if needed.
 */
export function setPlaybackSpeed(speed) {
  const clamped = Math.max(0.25, Math.min(2, Number(speed) || 1));
  if (Math.abs(clamped - playbackSpeed) < 0.001) return;
  playbackSpeed = clamped;
  if (currentScore && isInitialized && isPlaying) {
    playScore(currentScore, onEventCallback, { skipFadeIn: true });
  }
}

export function getPlaybackSpeed() {
  return playbackSpeed;
}

/**
 * Preview a single recursive score event immediately (used by Lab Step Mode).
 */
export function previewEvent(event) {
  if (!isInitialized || !graph || !event) return;
  try {
    const now = Tone.now() + 0.02;
    const previewDur = Math.min(1.2, Math.max(0.12, event.duration || 0.3));
    triggerScoreEvent(
      graph,
      { ...event, duration: previewDur },
      now,
      {
        melody: isVoiceEffectivelyMuted('melody'),
        canon: isVoiceEffectivelyMuted('canon'),
        bass: isVoiceEffectivelyMuted('bass'),
        percussion: isVoiceEffectivelyMuted('percussion')
      }
    );
  } catch (_) { /* ignore */ }
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
