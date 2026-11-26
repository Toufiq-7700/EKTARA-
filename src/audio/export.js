/**
 * Offline WAV & Parameter JSON Export
 *
 * Renders the current score offline using a fast native Web Audio
 * OfflineAudioContext with deterministic seeded synthesis, reverb, rain/wind,
 * and safety limiting, then encodes the stereo AudioBuffer into a 16-bit PCM WAV file.
 */

import { buildScore } from '../algorithms/score.js';
import { createPRNG } from '../algorithms/prng.js';
import { humaniseEvent } from './instruments.js';
import { EXPORT_TAIL_SECONDS, volumeToDb } from './graph.js';

const SAMPLE_RATE = 44100;

function dbToGain(db) {
  return db <= -60 ? 0 : Math.pow(10, db / 20);
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function addToneNote(left, right, totalSamples, {
  freq,
  time,
  duration,
  velocity = 0.5,
  fmRatio = 0,
  fmIndex = 0,
  attack = 0.015,
  release = 0.8,
  pan = 0,
  warm = false
}) {
  const startIdx = Math.max(0, Math.floor(time * SAMPLE_RATE));
  const durSamples = Math.max(1, Math.floor(Math.max(0.05, duration) * SAMPLE_RATE));
  const relSamples = Math.max(1, Math.floor(release * SAMPLE_RATE));
  const attSamples = Math.max(1, Math.floor(Math.min(attack, Math.max(0.005, duration * 0.4)) * SAMPLE_RATE));
  const endIdx = Math.min(totalSamples, startIdx + durSamples + relSamples);
  if (startIdx >= endIdx) return;

  const peak = Math.max(0.0005, Math.min(0.65, velocity));
  const panClamped = Math.max(-0.85, Math.min(0.85, pan));
  const lGain = peak * Math.cos((panClamped + 1) * Math.PI * 0.25);
  const rGain = peak * Math.sin((panClamped + 1) * Math.PI * 0.25);

  const twoPi = Math.PI * 2;
  const phaseInc = (twoPi * Math.max(20, freq)) / SAMPLE_RATE;
  const modInc = fmRatio > 0 ? (twoPi * Math.max(20, freq * fmRatio)) / SAMPLE_RATE : 0;
  const modAmp = fmRatio > 0 && fmIndex > 0 ? (fmIndex / Math.max(20, freq)) : 0;

  let phase = 0;
  let modPhase = 0;
  const totalLen = durSamples + relSamples;

  for (let i = startIdx; i < endIdx; i++) {
    const n = i - startIdx;
    let env;
    if (n < attSamples) {
      env = n / attSamples;
    } else if (n < durSamples) {
      env = 1 - 0.28 * ((n - attSamples) / Math.max(1, durSamples - attSamples));
    } else {
      const rn = (n - durSamples) / relSamples;
      env = 0.72 * (1 - rn) * (1 - rn);
    }

    let sample;
    if (modInc > 0) {
      const modDecay = Math.exp(-3.5 * (n / totalLen));
      sample = Math.sin(phase + modAmp * modDecay * Math.sin(modPhase));
      modPhase += modInc;
    } else if (warm) {
      sample = Math.sin(phase) * 0.8 + Math.sin(phase * 2) * 0.14;
    } else {
      sample = Math.sin(phase);
    }
    phase += phaseInc;

    const val = sample * env;
    left[i] += val * lGain;
    right[i] += val * rGain;
  }
}

function addPercussionHit(left, right, totalSamples, rng, time, velocity = 0.3, high = false) {
  const dur = high ? 0.14 : 0.22;
  const startIdx = Math.max(0, Math.floor(time * SAMPLE_RATE));
  const len = Math.max(1, Math.floor(dur * SAMPLE_RATE));
  const endIdx = Math.min(totalSamples, startIdx + len);
  const peak = Math.max(0.001, Math.min(0.28, velocity * 0.45));
  const freq = high ? 2400 : 750;
  const phaseInc = (Math.PI * 2 * freq) / SAMPLE_RATE;
  let phase = 0;

  for (let i = startIdx; i < endIdx; i++) {
    const tNorm = (i - startIdx) / len;
    const env = Math.exp(-7 * tNorm);
    const noise = rng() * 2 - 1;
    const tone = Math.sin(phase);
    phase += phaseInc;
    const val = (tone * 0.55 + noise * 0.45) * env * peak;
    left[i] += val;
    right[i] += val;
  }
}

const MELODY_TIMBRE_SPEC = {
  kalimba: { fmRatio: 2, fmIndex: 55, attack: 0.008, release: 0.9 },
  music_box: { fmRatio: 3, fmIndex: 80, attack: 0.004, release: 1.0 },
  marimba: { fmRatio: 4, fmIndex: 30, attack: 0.006, release: 0.65 },
  singing_bowl: { fmRatio: 2.756, fmIndex: 40, attack: 0.06, release: 1.6 },
  glass_bell: { fmRatio: 2.5, fmIndex: 75, attack: 0.008, release: 1.1 },
  sitar: { fmRatio: 1, fmIndex: 50, attack: 0.012, release: 0.95 },
  bansuri: { fmRatio: 0, fmIndex: 0, attack: 0.08, release: 0.5 }
};

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
  const rng = createPRNG(seed);

  onProgress(25, 'Synthesizing stereo audio...');
  const totalSamples = Math.ceil(totalRenderDuration * SAMPLE_RATE);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const layerVols = mixSettings.layerVolumes || {};
  const layerMuted = mixSettings.layerMuted || {};
  const getLayerGain = (name, def = 0.75) =>
    layerMuted[name] ? 0 : dbToGain(volumeToDb(layerVols[name] ?? def, 0));

  const layerGainVal = {
    melody: getLayerGain('melody', 0.8),
    bass: getLayerGain('bass', 0.75),
    pad: getLayerGain('pad', 0.65),
    percussion: getLayerGain('percussion', 0.6),
    ambient: getLayerGain('ambient', 0.65),
    canon: getLayerGain('canon', 0.7)
  };

  const timbres = mixSettings.timbres || params?.timbres || {};
  const melSpec = MELODY_TIMBRE_SPEC[timbres.melody] || MELODY_TIMBRE_SPEC.kalimba;
  const canonSpec = MELODY_TIMBRE_SPEC[timbres.canon] || MELODY_TIMBRE_SPEC.glass_bell;

  const ambientType = mixSettings.ambientType ?? params?.ambient ?? 'wind';
  const rainIntensity = mixSettings.rainIntensity ?? params?.rainIntensity ?? 0.35;
  const thunderEnabled = mixSettings.thunderEnabled ?? params?.thunderEnabled ?? true;
  const ambientMuted = !!layerMuted.ambient;

  // Ambient wind / rain / thunder
  if (!ambientMuted && layerGainVal.ambient > 0) {
    const ambSamples = Math.min(totalSamples, Math.floor((durationSeconds - 0.3) * SAMPLE_RATE));
    const ambGain = layerGainVal.ambient;
    let brownL = 0;
    let brownR = 0;
    const windLevel = ambientType === 'wind' ? 0.14 : 0;
    const rainLevel = rainIntensity > 0.001 ? 0.07 + rainIntensity * 0.14 : 0;

    if (windLevel > 0 || rainLevel > 0) {
      for (let i = 0; i < ambSamples; i++) {
        const wL = rng() * 2 - 1;
        const wR = rng() * 2 - 1;
        brownL = (brownL + 0.025 * wL) / 1.025;
        brownR = (brownR + 0.025 * wR) / 1.025;
        const amb = (brownL * 2.8 * (windLevel + rainLevel * 0.6) + wL * rainLevel * 0.08) * ambGain;
        const ambR = (brownR * 2.8 * (windLevel + rainLevel * 0.6) + wR * rainLevel * 0.08) * ambGain;
        left[i] += amb;
        right[i] += ambR;
      }
    }

    if (rainIntensity > 0.001) {
      const dropInterval = Math.max(0.22, 0.75 - rainIntensity * 0.45);
      for (let t = 0.25; t < durationSeconds - 0.5; t += dropInterval * (0.6 + rng() * 0.8)) {
        addToneNote(left, right, totalSamples, {
          freq: 900 + rng() * 1900,
          time: t,
          duration: 0.03,
          velocity: (0.03 + rainIntensity * 0.05) * ambGain,
          attack: 0.002,
          release: 0.09,
          pan: rng() * 1.4 - 0.7
        });
      }

      if (thunderEnabled && rainIntensity > 0.35 && durationSeconds >= 15) {
        const thunderTime = Math.min(durationSeconds - 5, 6 + rng() * (durationSeconds * 0.5));
        const thStart = Math.floor(thunderTime * SAMPLE_RATE);
        const thLen = Math.min(totalSamples - thStart, Math.floor(3.8 * SAMPLE_RATE));
        let thL = 0;
        for (let i = 0; i < thLen; i++) {
          thL = (thL + 0.015 * (rng() * 2 - 1)) / 1.015;
          const env = i < SAMPLE_RATE * 0.6
            ? i / (SAMPLE_RATE * 0.6)
            : Math.exp(-1.4 * ((i - SAMPLE_RATE * 0.6) / (SAMPLE_RATE * 3.2)));
          const v = thL * 2.5 * 0.2 * rainIntensity * env * ambGain;
          left[thStart + i] += v;
          right[thStart + i] += v;
        }
      }
    }
  }

  // Warm root + fifth ambient pad
  if (!ambientMuted && layerGainVal.pad > 0) {
    const rootNote = params?.rootNote || 60;
    const padStop = Math.max(1, durationSeconds - 1);
    [rootNote, rootNote + 7].forEach((midi, idx) => {
      addToneNote(left, right, totalSamples, {
        freq: midiToFreq(midi),
        time: 0.05,
        duration: Math.max(0.5, padStop - 0.5),
        velocity: 0.13 * layerGainVal.pad,
        attack: 1.5,
        release: 1.8,
        pan: idx === 0 ? -0.25 : 0.25
      });
    });
  }

  // Schedule score cycles
  let cycleStart = 0.15;
  let cycleParams = { ...params };
  let cycleScore = initialScore;

  while (cycleStart < durationSeconds - 0.5) {
    checkAborted();
    const cycleRng = createPRNG((cycleParams.seed ?? 42) + 9091);
    for (const rawEvent of cycleScore.events) {
      const event = humaniseEvent(rawEvent, cycleRng);
      const eventTime = cycleStart + event.time;
      if (eventTime >= durationSeconds - 0.25) break;

      const layer = event.layer || 'melody';
      if (layerMuted[layer]) continue;

      const midiVal = Number.isFinite(event.midi)
        ? event.midi
        : (typeof event.note === 'number' && Number.isFinite(event.note) ? event.note : 60);
      const freq = Number.isFinite(event.frequency) && event.frequency > 0
        ? event.frequency
        : midiToFreq(midiVal);
      const dur = Number.isFinite(event.duration) ? Math.max(0.08, event.duration) : 0.4;
      const vel = Number.isFinite(event.velocity) ? Math.max(0.05, Math.min(0.9, event.velocity)) : 0.5;
      const pan = Math.max(-0.85, Math.min(0.85, (midiVal - 60) * 0.025));

      if (layer === 'melody') {
        addToneNote(left, right, totalSamples, {
          ...melSpec,
          freq,
          time: eventTime,
          duration: dur,
          velocity: vel * 0.42 * layerGainVal.melody,
          pan
        });
      } else if (layer === 'canon') {
        addToneNote(left, right, totalSamples, {
          ...canonSpec,
          freq,
          time: eventTime,
          duration: dur,
          velocity: vel * 0.32 * layerGainVal.canon,
          pan: -pan * 0.8
        });
      } else if (layer === 'bass') {
        addToneNote(left, right, totalSamples, {
          freq,
          time: eventTime,
          duration: dur,
          velocity: vel * 0.45 * layerGainVal.bass,
          attack: 0.03,
          release: 0.6,
          pan: 0,
          warm: true
        });
      } else if (layer === 'pad') {
        addToneNote(left, right, totalSamples, {
          freq,
          time: eventTime,
          duration: dur,
          velocity: vel * 0.22 * layerGainVal.pad,
          attack: 0.25,
          release: 1.2,
          pan: pan * 0.5
        });
      } else if (layer === 'drone') {
        addToneNote(left, right, totalSamples, {
          freq,
          time: eventTime,
          duration: dur,
          velocity: vel * 0.28 * layerGainVal.pad,
          attack: 0.04,
          release: 1.1,
          pan: 0.15,
          warm: true
        });
      } else if (layer === 'percussion' || layer === 'rhythm') {
        addPercussionHit(left, right, totalSamples, rng, eventTime, vel * layerGainVal.percussion, midiVal > 66);
      }
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

  checkAborted();
  onProgress(65, 'Applying stereo reverb & mastering...');

  // Lightweight stereo feedback-delay reverb + master fade-in/out + soft limiter (-3 dB)
  const delayL = Math.floor(0.083 * SAMPLE_RATE);
  const delayR = Math.floor(0.117 * SAMPLE_RATE);
  const revBufL = new Float32Array(delayL);
  const revBufR = new Float32Array(delayR);
  let idxL = 0;
  let idxR = 0;
  let lpL = 0;
  let lpR = 0;

  const targetGain = dbToGain(volumeToDb(mixSettings.masterVolume ?? 0.8, -6));
  const fadeInSamples = Math.max(1, Math.floor(Math.min(4, durationSeconds * 0.25) * SAMPLE_RATE));
  const fadeOutSamples = Math.max(1, Math.floor(1.5 * SAMPLE_RATE));
  const fadeOutStartIdx = totalSamples - fadeOutSamples;
  const ceiling = 0.707; // -3 dBFS safety ceiling

  for (let i = 0; i < totalSamples; i++) {
    const dryL = left[i];
    const dryR = right[i];

    lpL = lpL * 0.55 + revBufL[idxL] * 0.45;
    lpR = lpR * 0.55 + revBufR[idxR] * 0.45;
    revBufL[idxL] = dryL + lpL * 0.36;
    revBufR[idxR] = dryR + lpR * 0.36;
    idxL = (idxL + 1) % delayL;
    idxR = (idxR + 1) % delayR;

    let envGain = targetGain;
    if (i < fadeInSamples) {
      envGain *= i / fadeInSamples;
    } else if (i >= fadeOutStartIdx) {
      envGain *= Math.max(0, (totalSamples - i) / fadeOutSamples);
    }

    const mixedL = (dryL + lpL * 0.26) * envGain;
    const mixedR = (dryR + lpR * 0.26) * envGain;
    left[i] = Math.tanh(mixedL / ceiling) * ceiling;
    right[i] = Math.tanh(mixedR / ceiling) * ceiling;
  }

  checkAborted();
  onProgress(88, 'Encoding 16-bit stereo WAV...');
  const rawBuffer = {
    sampleRate: SAMPLE_RATE,
    length: totalSamples,
    numberOfChannels: 2,
    getChannelData: (ch) => (ch === 0 ? left : right)
  };
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
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 30000);
}
