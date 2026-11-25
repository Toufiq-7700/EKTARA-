/**
 * Procedural Tone.js Rain Soundscape
 *
 * Synthesizes realistic, wide-stereo rainfall with zero external audio files:
 *   - High-passed white noise -> surface hiss (stereo-widened)
 *   - Band-passed pink noise  -> rainfall body
 *   - Low-passed brown noise  -> distant rumble / weight
 *   - Random soft droplet ticks (short sine/filtered blips with random pitch & pan)
 *     whose trigger rate scales directly with visual drop intensity
 *   - Optional soft distant thunder at heavy intensity (rare, gentle, slow fade)
 *
 * Routed through the ambient channel -> reverb -> master limiter (-3 dB).
 * At intensity 0, all rain noise nodes and schedulers are completely stopped.
 */

import * as Tone from 'tone';
import { createPRNG } from '../algorithms/prng.js';

/**
 * Compute target filter cutoffs, layer gains, droplet rate, and thunder probability
 * from rain intensity in [0, 1].
 */
export function computeRainAudioParams(intensity) {
  const x = Math.max(0, Math.min(1, intensity));
  return {
    intensity: x,
    // Output gain scales smoothly from silence to lush rainfall
    gain: x <= 0 ? 0 : Math.pow(x, 0.85) * 0.85,
    // High-pass hiss opens slightly lower as intensity rises
    hissFreq: 4200 - x * 1700,          // 4200 Hz -> 2500 Hz
    hissDb: -26 + x * 8,
    // Band-pass body rises in brightness
    bodyFreq: 800 + x * 700,            // 800 Hz -> 1500 Hz
    bodyDb: -22 + x * 8,
    // Low-pass rumble warms up in downpours
    rumbleFreq: 140 + x * 190,          // 140 Hz -> 330 Hz
    rumbleDb: -24 + x * 9,
    // Droplet ticks per second linked to visual drop count
    dropletRateHz: x <= 0 ? 0 : 1.5 + x * 18,
    // Thunder only possible above heavy intensity (0.65+)
    thunderChancePerSec: x > 0.65 ? (x - 0.65) * 0.12 : 0
  };
}

/**
 * Create the layered procedural rain synth graph on the active Tone context.
 *
 * @param {Tone.ToneAudioNode} destination - Ambient channel connected to reverb -> limiter
 * @param {Object} [options]
 * @param {number} [options.seed=42]
 * @param {number} [options.initialIntensity=0]
 * @param {boolean} [options.thunderEnabled=true]
 * @returns {Object} Rain audio controller
 */
export function createRainSynth(destination, options = {}) {
  const rng = createPRNG((options.seed ?? 42) + 31337);
  let currentIntensity = Math.max(0, Math.min(1, options.initialIntensity ?? 0));
  let thunderEnabled = options.thunderEnabled ?? true;
  let isRunning = false;
  let stopTimeoutId = null;
  let dropletTimerId = null;
  let thunderTimerId = null;
  let lastThunderTime = -999;
  let thunderStarted = false;

  // Master rain gain node (0..1 linear gain -> smooth no-click ramping)
  const rainOutput = new Tone.Gain(0).connect(destination);
  const stereoWidener = new Tone.StereoWidener(0.75).connect(rainOutput);

  // Layer 1: High-passed white noise (surface hiss, panned wide across L/R)
  const hissGain = new Tone.Gain(0.5).connect(stereoWidener);
  const hissFilter = new Tone.Filter({ frequency: 3400, type: 'highpass', Q: 0.6 }).connect(hissGain);
  const hissPanner = new Tone.Panner(0.18).connect(hissFilter);
  const hissNoise = new Tone.Noise('white').connect(hissPanner);

  // Layer 2: Band-passed pink noise (rain body)
  const bodyGain = new Tone.Gain(0.7).connect(stereoWidener);
  const bodyFilter = new Tone.Filter({ frequency: 1100, type: 'bandpass', Q: 0.75 }).connect(bodyGain);
  const bodyPanner = new Tone.Panner(-0.18).connect(bodyFilter);
  const bodyNoise = new Tone.Noise('pink').connect(bodyPanner);

  // Layer 3: Low-passed brown noise (distant weight / low rumble)
  const rumbleGain = new Tone.Gain(0.6).connect(rainOutput);
  const rumbleFilter = new Tone.Filter({ frequency: 220, type: 'lowpass', Q: 0.7 }).connect(rumbleGain);
  const rumbleNoise = new Tone.Noise('brown').connect(rumbleFilter);

  // Layer 4: Soft procedural droplet ticks (sine blips + micro-filtered noise, wide pan)
  const dropletPanner = new Tone.Panner(0).connect(rainOutput);
  const dropletFilter = new Tone.Filter({ frequency: 1800, type: 'bandpass', Q: 2.2 }).connect(dropletPanner);
  const dropletSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.002, decay: 0.035, sustain: 0, release: 0.025 },
    volume: -24
  }).connect(dropletPanner);
  const dropletTick = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.018, sustain: 0, release: 0.01 },
    volume: -28
  }).connect(dropletFilter);

  // Layer 5: Optional distant thunder (rare, gentle low rumble with long fade)
  const thunderPanner = new Tone.Panner(0).connect(rainOutput);
  const thunderGain = new Tone.Gain(0).connect(thunderPanner);
  const thunderFilter = new Tone.Filter({ frequency: 85, type: 'lowpass', Q: 0.9 }).connect(thunderGain);
  const thunderNoise = new Tone.Noise('brown').connect(thunderFilter);

  function startNoiseNodes() {
    if (stopTimeoutId) {
      clearTimeout(stopTimeoutId);
      stopTimeoutId = null;
    }
    if (hissNoise.state !== 'started') hissNoise.start();
    if (bodyNoise.state !== 'started') bodyNoise.start();
    if (rumbleNoise.state !== 'started') rumbleNoise.start();
    isRunning = true;
  }

  function stopNoiseNodesImmediate() {
    if (dropletTimerId) {
      clearTimeout(dropletTimerId);
      dropletTimerId = null;
    }
    if (thunderTimerId) {
      clearTimeout(thunderTimerId);
      thunderTimerId = null;
    }
    try {
      if (hissNoise.state === 'started') hissNoise.stop();
      if (bodyNoise.state === 'started') bodyNoise.stop();
      if (rumbleNoise.state === 'started') rumbleNoise.stop();
      if (thunderNoise.state === 'started') thunderNoise.stop();
    } catch (_) { /* ignore */ }
    thunderStarted = false;
    isRunning = false;
  }

  function triggerDroplet(time, intensity) {
    if (intensity <= 0.01) return;
    // Near-layer droplets get wider stereo spread [-0.88, +0.88]
    const isNearDrop = rng() < 0.35;
    const panWidth = isNearDrop ? 0.88 : 0.45;
    const pan = (rng() * 2 - 1) * panWidth;
    const freq = isNearDrop ? 750 + rng() * 900 : 1400 + rng() * 1700;
    const vel = (0.12 + rng() * 0.25) * (0.4 + intensity * 0.6);

    try {
      dropletPanner.pan.setValueAtTime(pan, time);
      if (rng() < 0.6) {
        dropletSynth.triggerAttackRelease(freq, 0.04, time, vel);
      } else {
        dropletFilter.frequency.setValueAtTime(freq, time);
        dropletTick.triggerAttackRelease('64n', time, vel * 0.9);
      }
    } catch (_) { /* ignore scheduling edge cases */ }
  }

  function triggerThunder(time, intensity) {
    if (!thunderEnabled || intensity <= 0.65) return;
    try {
      if (!thunderStarted && thunderNoise.state !== 'started') {
        thunderNoise.start(time);
        thunderStarted = true;
      }
      const pan = (rng() * 2 - 1) * 0.5;
      thunderPanner.pan.setValueAtTime(pan, time);
      thunderFilter.frequency.setValueAtTime(110, time);
      thunderFilter.frequency.exponentialRampToValueAtTime(42, time + 5.5);

      const peak = 0.16 + (intensity - 0.65) * 0.28; // gentle, never sudden
      thunderGain.gain.cancelScheduledValues(time);
      thunderGain.gain.setValueAtTime(0.0001, time);
      thunderGain.gain.linearRampToValueAtTime(peak, time + 1.3);
      thunderGain.gain.exponentialRampToValueAtTime(0.0001, time + 6.2);
    } catch (_) { /* ignore */ }
  }

  function scheduleNextLiveDroplet() {
    if (!isRunning || currentIntensity <= 0.003) return;
    const p = computeRainAudioParams(currentIntensity);
    const meanIntervalMs = 1000 / Math.max(0.5, p.dropletRateHz);
    const jitterMs = meanIntervalMs * (0.4 + rng() * 1.2);

    dropletTimerId = setTimeout(() => {
      if (!isRunning || currentIntensity <= 0.003) return;
      triggerDroplet(Tone.now() + 0.02, currentIntensity);
      scheduleNextLiveDroplet();
    }, jitterMs);
  }

  function scheduleNextLiveThunder() {
    if (!isRunning || currentIntensity <= 0.65 || !thunderEnabled) {
      thunderTimerId = null;
      return;
    }
    const waitMs = 14000 + rng() * 18000; // rare: every 14–32s
    thunderTimerId = setTimeout(() => {
      if (!isRunning || currentIntensity <= 0.65 || !thunderEnabled) return;
      const now = Tone.now();
      if (now - lastThunderTime > 12) {
        lastThunderTime = now;
        triggerThunder(now + 0.1, currentIntensity);
      }
      scheduleNextLiveThunder();
    }, waitMs);
  }

  function applyIntensity(intensity, rampSeconds = 0.35) {
    currentIntensity = Math.max(0, Math.min(1, intensity));
    const p = computeRainAudioParams(currentIntensity);

    if (currentIntensity <= 0.001) {
      // Fade cleanly to 0, then fully stop all rain nodes so zero hiss remains
      rainOutput.gain.rampTo(0, 0.25);
      if (dropletTimerId) {
        clearTimeout(dropletTimerId);
        dropletTimerId = null;
      }
      if (thunderTimerId) {
        clearTimeout(thunderTimerId);
        thunderTimerId = null;
      }
      if (!stopTimeoutId && isRunning) {
        stopTimeoutId = setTimeout(() => {
          stopTimeoutId = null;
          if (currentIntensity <= 0.001) {
            stopNoiseNodesImmediate();
          }
        }, 300);
      }
      return;
    }

    const wasRunning = isRunning;
    startNoiseNodes();

    hissFilter.frequency.rampTo(p.hissFreq, rampSeconds);
    bodyFilter.frequency.rampTo(p.bodyFreq, rampSeconds);
    rumbleFilter.frequency.rampTo(p.rumbleFreq, rampSeconds);
    hissGain.gain.rampTo(Tone.dbToGain(p.hissDb) * 2.2, rampSeconds);
    bodyGain.gain.rampTo(Tone.dbToGain(p.bodyDb) * 2.2, rampSeconds);
    rumbleGain.gain.rampTo(Tone.dbToGain(p.rumbleDb) * 2.2, rampSeconds);
    rainOutput.gain.rampTo(p.gain, rampSeconds);

    if (!wasRunning || !dropletTimerId) {
      scheduleNextLiveDroplet();
    }
    if (thunderEnabled && currentIntensity > 0.65 && !thunderTimerId) {
      scheduleNextLiveThunder();
    } else if ((!thunderEnabled || currentIntensity <= 0.65) && thunderTimerId) {
      clearTimeout(thunderTimerId);
      thunderTimerId = null;
    }
  }

  /**
   * Schedule rain + droplets + optional distant thunder offline over [0, durationSeconds].
   */
  function scheduleOffline(durationSeconds, intensity) {
    const x = Math.max(0, Math.min(1, intensity));
    if (x <= 0.001) return;

    const p = computeRainAudioParams(x);
    hissFilter.frequency.setValueAtTime(p.hissFreq, 0);
    bodyFilter.frequency.setValueAtTime(p.bodyFreq, 0);
    rumbleFilter.frequency.setValueAtTime(p.rumbleFreq, 0);
    hissGain.gain.setValueAtTime(Tone.dbToGain(p.hissDb) * 2.2, 0);
    bodyGain.gain.setValueAtTime(Tone.dbToGain(p.bodyDb) * 2.2, 0);
    rumbleGain.gain.setValueAtTime(Tone.dbToGain(p.rumbleDb) * 2.2, 0);

    rainOutput.gain.setValueAtTime(0, 0);
    rainOutput.gain.linearRampToValueAtTime(p.gain, Math.min(2, durationSeconds * 0.15));
    rainOutput.gain.setValueAtTime(p.gain, Math.max(0.5, durationSeconds - 1.5));
    rainOutput.gain.linearRampToValueAtTime(0, durationSeconds);

    hissNoise.start(0).stop(durationSeconds);
    bodyNoise.start(0).stop(durationSeconds);
    rumbleNoise.start(0).stop(durationSeconds);

    // Deterministic droplet ticks matching visual drop rate
    let t = 0.2;
    while (t < durationSeconds - 0.5) {
      triggerDroplet(t, x);
      const step = (1 / Math.max(0.5, p.dropletRateHz)) * (0.4 + rng() * 1.2);
      t += step;
    }

    // Rare gentle thunder at heavy intensity
    if (thunderEnabled && x > 0.65) {
      thunderStarted = true;
      thunderNoise.start(0).stop(durationSeconds);
      let tt = 6 + rng() * 10;
      while (tt < durationSeconds - 6.5) {
        triggerThunder(tt, x);
        tt += 16 + rng() * 16;
      }
    }
  }

  return {
    setIntensity: applyIntensity,
    setThunderEnabled(enabled) {
      thunderEnabled = !!enabled;
      if (!thunderEnabled && thunderTimerId) {
        clearTimeout(thunderTimerId);
        thunderTimerId = null;
      } else if (thunderEnabled && isRunning && currentIntensity > 0.65 && !thunderTimerId) {
        scheduleNextLiveThunder();
      }
    },
    start() {
      if (currentIntensity > 0.001) {
        applyIntensity(currentIntensity, 0.4);
      }
    },
    stop() {
      if (stopTimeoutId) {
        clearTimeout(stopTimeoutId);
        stopTimeoutId = null;
      }
      rainOutput.gain.cancelScheduledValues(Tone.now());
      rainOutput.gain.value = 0;
      stopNoiseNodesImmediate();
    },
    scheduleOffline,
    getState() {
      return {
        isRunning,
        intensity: currentIntensity,
        thunderEnabled,
        noiseStates: {
          hiss: hissNoise.state,
          body: bodyNoise.state,
          rumble: rumbleNoise.state
        }
      };
    },
    dispose() {
      stopNoiseNodesImmediate();
      const nodes = [
        hissNoise, bodyNoise, rumbleNoise, thunderNoise,
        hissFilter, bodyFilter, rumbleFilter, thunderFilter,
        hissPanner, bodyPanner, dropletPanner, thunderPanner,
        hissGain, bodyGain, rumbleGain, thunderGain,
        dropletSynth, dropletTick, dropletFilter,
        stereoWidener, rainOutput
      ];
      for (const n of nodes) {
        try { n?.dispose(); } catch (_) { /* ignore */ }
      }
    }
  };
}
