/**
 * Offline WAV & Parameter JSON Export
 *
 * Renders the current score offline using Tone.Offline with the exact same
 * voice & effects graph (src/audio/graph.js) and deterministic seeded noise,
 * then encodes the stereo AudioBuffer into a 16-bit PCM WAV file.
 */

import * as Tone from 'tone';
import { buildScore } from '../algorithms/score.js';
import { createPRNG } from '../algorithms/prng.js';
import { humaniseEvent } from './instruments.js';
import {
  createAudioGraph,
  triggerScoreEvent,
  EXPORT_TAIL_SECONDS,
  volumeToDb
} from './graph.js';

/**
 * Encode a stereo (or mono, upmixed to stereo) AudioBuffer-like object
 * into a standard 16-bit signed PCM stereo WAV ArrayBuffer.
 *
 * @param {Object} audioBuffer - Object with sampleRate, length, numberOfChannels, getChannelData(ch)
 * @returns {ArrayBuffer} Complete RIFF/WAVE file bytes
 */
export function encodeWav(audioBuffer) {
  const numChannels = 2; // Always output stereo 16-bit WAV
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');

  // fmt subchunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample

  // data subchunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }

  return buffer;
}

function writeAscii(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Build an export filename matching `ektara-<seed>-<depth>.<ext>`.
 */
export function buildExportFilename(params, ext = 'wav') {
  const seed = params?.seed ?? 42;
  const depth = params?.depth ?? 4;
  return `ektara-${seed}-${depth}.${ext}`;
}

/**
 * Render the composition offline via Tone.Offline and return a stereo WAV Blob.
 * Includes a reverb/release tail so the final notes ring out naturally.
 * Uses seeded PRNG for Tone's internal noise/reverb generation so repeated exports
 * with the same seed are identical.
 *
 * @param {Object} params - Current garden parameters
 * @param {Object} [options]
 * @param {number} [options.durationSeconds=60] - Target composition length (30, 60, or 180)
 * @param {Object} [options.mixSettings] - { masterVolume, layerVolumes, layerMuted, ambientType }
 * @param {boolean} [options.evolve=false] - Whether evolve mode is active across cycles
 * @param {Function} [options.onProgress] - Progress callback: onProgress(percent, message)
 * @returns {Promise<{ blob: Blob, filename: string, sampleRate: number, totalDuration: number }>}
 */
export async function exportScoreToWav(params, options = {}) {
  const durationSeconds = options.durationSeconds ?? 60;
  const mixSettings = options.mixSettings || {};
  const evolve = !!options.evolve;
  const onProgress = options.onProgress || (() => {});
  const signal = options.signal;
  const totalRenderDuration = durationSeconds + EXPORT_TAIL_SECONDS;
  const seed = params?.seed ?? 42;

  const checkAborted = () => {
    if (signal?.aborted) {
      throw new DOMException('Export cancelled', 'AbortError');
    }
  };
  checkAborted();

  onProgress(10, 'Preparing recursive score...');
  const initialScore = buildScore(params);

  // Temporarily make Math.random deterministic during Tone.Offline so
  // Reverb impulse responses and Noise buffer offsets match per seed.
  const originalRandom = Math.random;
  const origPolyGC = Tone.PolySynth?.prototype?._collectGarbage;
  Math.random = createPRNG(seed);
  if (Tone.PolySynth?.prototype) {
    Tone.PolySynth.prototype._collectGarbage = function () {
      if (this.context?.isOffline) return;
      return origPolyGC?.apply(this, arguments);
    };
  }

  let progressTimer = null;
  let renderedBuffer;

  try {
    onProgress(25, 'Rendering voices & reverb offline...');

    // Smoothly advance indicator while OfflineAudioContext renders
    let simulatedPct = 30;
    progressTimer = setInterval(() => {
      simulatedPct = Math.min(82, simulatedPct + 4);
      onProgress(simulatedPct, 'Rendering audio offline...');
    }, 200);

    const renderPromise = Tone.Offline(async ({ transport }) => {
      checkAborted();
      const ambientType = mixSettings.ambientType ?? params.ambient ?? 'wind';
      const rainIntensity = mixSettings.rainIntensity ?? params.rainIntensity ?? 0.35;
      const thunderEnabled = mixSettings.thunderEnabled ?? params.thunderEnabled ?? true;

      const offlineGraph = await createAudioGraph({
        layerVolumes: mixSettings.layerVolumes,
        layerMuted: mixSettings.layerMuted,
        timbres: mixSettings.timbres || params.timbres,
        masterVolume: mixSettings.masterVolume ?? 0.8,
        ambientType,
        rainIntensity,
        thunderEnabled,
        seed
      });
      checkAborted();

      const targetDb = volumeToDb(mixSettings.masterVolume ?? 0.8, -6);
      // Match live 4-second fade-in, then gentle fade-out at end of tail
      offlineGraph.masterVol.volume.setValueAtTime(-60, 0);
      offlineGraph.masterVol.volume.rampTo(targetDb, Math.min(4, durationSeconds * 0.25), 0);
      offlineGraph.masterVol.volume.setValueAtTime(targetDb, Math.max(0.5, totalRenderDuration - 1.5));
      offlineGraph.masterVol.volume.rampTo(-60, 1.5, Math.max(0.5, totalRenderDuration - 1.5));

      const ambientMuted = !!mixSettings.layerMuted?.ambient;

      if (ambientType === 'wind' && !ambientMuted) {
        offlineGraph.ambientNoise.start(0);
        offlineGraph.ambientNoise.stop(Math.max(0.5, durationSeconds - 0.5));
      }
      if (!ambientMuted && rainIntensity > 0.001) {
        offlineGraph.rainSynth.scheduleOffline(durationSeconds, rainIntensity);
      }

      const rootNote = params.rootNote || 60;
      const rootName = Tone.Frequency(rootNote, 'midi').toNote();
      const fifthName = Tone.Frequency(rootNote + 7, 'midi').toNote();
      if (!ambientMuted) {
        offlineGraph.ambientPad.triggerAttack([rootName, fifthName], 0, 0.3);
        offlineGraph.ambientPad.triggerRelease([rootName, fifthName], Math.max(1, durationSeconds - 1));
      }

      // Schedule cycles up to durationSeconds, leaving EXPORT_TAIL_SECONDS for reverb decay
      let cycleStart = 0.15;
      let cycleParams = { ...params };
      let cycleScore = initialScore;

      while (cycleStart < durationSeconds - 0.5) {
        const cycleRng = createPRNG((cycleParams.seed ?? 42) + 9091);
        for (const rawEvent of cycleScore.events) {
          const event = humaniseEvent(rawEvent, cycleRng);
          const eventTime = cycleStart + event.time;
          if (eventTime >= durationSeconds - 0.25) break;

          transport.schedule((time) => {
            triggerScoreEvent(offlineGraph, event, time, mixSettings.layerMuted);
          }, eventTime);
        }

        cycleStart += cycleScore.duration;
        if (evolve && cycleStart < durationSeconds - 0.5) {
          const nextSeed = (cycleParams.seed ?? 42) + 1;
          const curDepth = cycleParams.depth ?? 4;
          const drift = nextSeed % 3 === 0 ? (nextSeed % 2 === 0 ? 1 : -1) : 0;
          cycleParams = {
            ...cycleParams,
            seed: nextSeed,
            depth: Math.max(2, Math.min(7, curDepth + drift))
          };
          cycleScore = buildScore(cycleParams);
        }
      }

      transport.start(0);
    }, totalRenderDuration, 2, 44100);

    if (signal) {
      renderedBuffer = await Promise.race([
        renderPromise,
        new Promise((_, reject) => {
          if (signal.aborted) reject(new DOMException('Export cancelled', 'AbortError'));
          else signal.addEventListener('abort', () => reject(new DOMException('Export cancelled', 'AbortError')), { once: true });
        })
      ]);
    } else {
      renderedBuffer = await renderPromise;
    }
    checkAborted();
  } finally {
    if (progressTimer) clearInterval(progressTimer);
    Math.random = originalRandom;
    if (Tone.PolySynth?.prototype && origPolyGC) {
      Tone.PolySynth.prototype._collectGarbage = origPolyGC;
    }
  }

  onProgress(88, 'Encoding 16-bit stereo WAV...');
  const rawBuffer = renderedBuffer.get();
  const wavArrayBuffer = encodeWav(rawBuffer);
  const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });

  onProgress(100, 'Ready!');
  return {
    blob,
    filename: buildExportFilename(params, 'wav'),
    sampleRate: rawBuffer.sampleRate,
    totalDuration: totalRenderDuration
  };
}

/**
 * Create a JSON Blob of the composition parameters for sharing/reproducibility.
 */
export function exportParamsToJson(params) {
  const payload = {
    app: 'EKTARA',
    nativeName: 'একতারা',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    params: { ...params }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  return {
    blob,
    filename: buildExportFilename(params, 'json')
  };
}

/**
 * Trigger a browser download for a Blob.
 */
export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
