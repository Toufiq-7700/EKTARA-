/**
 * Audio Engine — Tone.js Playback for Recursive Garden
 * 
 * Consumes the score (array of timed events) and plays them through
 * carefully crafted synth voices. Each voice is designed for relaxation:
 * soft attacks, long releases, warm tones.
 * 
 * Voices:
 *   - Melody: sine/triangle pluck-bell with slow attack
 *   - Canon: same timbre, quieter, more reverb
 *   - Bass: warm low sine, long release
 *   - Percussion: soft brushed noise, filtered chimes, wood taps
 *   - Ambient: evolving pad (detuned oscillators + LPF)
 * 
 * Effects chain: reverb → stereo delay → limiter → master volume
 */

import * as Tone from 'tone';

// ─── State ────────────────────────────────────────────────────────

let isInitialized = false;
let isPlaying = false;
let scheduledEvents = [];
let currentScore = null;
let loopId = null;
let sleepTimerId = null;
let evolveEnabled = false;
let onEventCallback = null;

// Voice volumes (0-1)
const layerVolumes = {
  melody: 0.7,
  canon: 0.5,
  bass: 0.6,
  percussion: 0.4,
  ambient: 0.5
};

const layerMuted = {
  melody: false,
  canon: false,
  bass: false,
  percussion: false,
  ambient: false
};

// ─── Synths and Effects ───────────────────────────────────────────

let melodySynth, canonSynth, bassSynth;
let percChime, percBrush, percTap;
let ambientPad, ambientNoise;
let reverb, delay, limiter, masterVol;
let melodyCh, canonCh, bassCh, percCh, ambientCh;

/**
 * Initialize the audio engine. Must be called after a user gesture.
 */
export async function initAudio() {
  if (isInitialized) return;

  await Tone.start();

  // ─── Master effects chain ────────────────────────────────
  masterVol = new Tone.Volume(-6).toDestination();
  limiter = new Tone.Limiter(-3).connect(masterVol);
  reverb = new Tone.Reverb({ decay: 6, wet: 0.4 }).connect(limiter);
  await reverb.generate();
  delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.2, wet: 0.15 }).connect(reverb);

  // ─── Per-layer channels ──────────────────────────────────
  melodyCh = new Tone.Channel({ volume: -4, pan: 0 }).connect(delay);
  canonCh = new Tone.Channel({ volume: -10, pan: 0 }).connect(delay);
  bassCh = new Tone.Channel({ volume: -6, pan: 0 }).connect(reverb);
  percCh = new Tone.Channel({ volume: -12, pan: 0 }).connect(delay);
  ambientCh = new Tone.Channel({ volume: -10, pan: 0 }).connect(reverb);

  // ─── Melody synth: soft pluck-bell ───────────────────────
  melodySynth = new Tone.PolySynth(Tone.Synth, {
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

  // ─── Canon synth: same but quieter with more reverb ──────
  canonSynth = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 6,
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

  // ─── Bass synth: warm sine ───────────────────────────────
  bassSynth = new Tone.MonoSynth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.2,
      decay: 0.4,
      sustain: 0.6,
      release: 3.0
    },
    filterEnvelope: {
      attack: 0.1,
      decay: 0.3,
      sustain: 0.5,
      release: 2.0,
      baseFrequency: 100,
      octaves: 2
    },
    volume: -8
  }).connect(bassCh);

  // ─── Percussion: three types ─────────────────────────────
  // Chime: filtered metallic ping
  percChime = new Tone.MetalSynth({
    frequency: 800,
    envelope: { attack: 0.001, decay: 0.4, release: 0.3 },
    harmonicity: 5.1,
    modulationIndex: 16,
    resonance: 2000,
    octaves: 1,
    volume: -24
  }).connect(percCh);

  // Brush: filtered noise burst
  percBrush = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 },
    volume: -20
  }).connect(percCh);

  // Tap: soft membrane hit
  percTap = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    volume: -22
  }).connect(percCh);

  // ─── Ambient pad: detuned oscillators through LPF ────────
  ambientPad = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 4,
    voice: Tone.Synth,
    options: {
      oscillator: { type: 'sine4' },
      envelope: {
        attack: 4,
        decay: 2,
        sustain: 0.8,
        release: 6
      },
      volume: -18
    }
  }).connect(ambientCh);

  // Ambient noise: soft filtered white noise for wind/rain
  ambientNoise = new Tone.Noise('brown').connect(
    new Tone.Filter({ frequency: 400, type: 'lowpass' }).connect(
      new Tone.Volume(-30).connect(ambientCh)
    )
  );

  isInitialized = true;
  console.log('🔊 Audio engine initialized');
}

/**
 * Schedule and play a score.
 * 
 * @param {Object} score - Score from buildScore()
 * @param {Function} [onEvent] - Callback fired for each event: onEvent(event, time)
 */
export function playScore(score, onEvent) {
  if (!isInitialized) {
    console.warn('Audio not initialized. Call initAudio() first.');
    return;
  }

  stopPlayback();
  currentScore = score;
  onEventCallback = onEvent || null;

  // Apply 4-second fade-in
  if (masterVol) {
    masterVol.volume.value = -60;
    masterVol.volume.rampTo(-6, 4);
  }

  // Start ambient noise
  if (ambientNoise && ambientNoise.state !== 'started') {
    ambientNoise.start();
  }

  // Start ambient pad with the root note
  const rootNote = score.params?.rootNote || 60;
  const rootName = Tone.Frequency(rootNote, 'midi').toNote();
  if (ambientPad) {
    // Play a slow chord
    const padNotes = [rootName, Tone.Frequency(rootNote + 7, 'midi').toNote()];
    ambientPad.triggerAttack(padNotes, Tone.now(), 0.3);
  }

  // Schedule all events
  const now = Tone.now() + 0.5; // small offset to prevent timing issues
  scheduledEvents = [];

  for (const event of score.events) {
    const eventTime = now + event.time;

    const id = Tone.getTransport().schedule((time) => {
      triggerEvent(event, time);
      if (onEventCallback) {
        onEventCallback(event, time);
      }
    }, eventTime);

    scheduledEvents.push(id);
  }

  // Setup loop if needed
  const duration = score.duration;
  loopId = Tone.getTransport().schedule((time) => {
    if (evolveEnabled) {
      // Evolve: increment seed and rebuild
      const newParams = { ...score.params, seed: score.params.seed + 1 };
      // Will be called from outside to rebuild
      if (onEventCallback) {
        onEventCallback({ voice: '_loop', meta: { newParams } }, time);
      }
    } else {
      // Simple loop: replay same score
      playScore(score, onEvent);
    }
  }, now + duration);

  Tone.getTransport().start();
  isPlaying = true;
}

/**
 * Trigger a single musical event on the appropriate voice.
 */
function triggerEvent(event, time) {
  const { voice, note, duration, velocity, pan } = event;

  // Check mute
  if (layerMuted[voice]) return;

  try {
    switch (voice) {
      case 'melody':
        if (melodySynth && note) {
          melodySynth.triggerAttackRelease(note, duration, time, velocity * layerVolumes.melody);
        }
        break;

      case 'canon':
        if (canonSynth && note) {
          canonSynth.triggerAttackRelease(note, duration, time, velocity * layerVolumes.canon);
        }
        break;

      case 'bass':
        if (bassSynth && note) {
          bassSynth.triggerAttackRelease(note, duration, time, velocity * layerVolumes.bass);
        }
        break;

      case 'percussion': {
        const percVel = velocity * layerVolumes.percussion;
        const percType = event.meta?.percType || 'brush';
        switch (percType) {
          case 'chime':
            percChime?.triggerAttackRelease('16n', time, percVel);
            break;
          case 'brush':
            percBrush?.triggerAttackRelease('32n', time, percVel);
            break;
          case 'tap':
            percTap?.triggerAttackRelease('C2', '16n', time, percVel);
            break;
        }
        break;
      }
    }
  } catch (err) {
    // Swallow individual note errors to keep playback going
    console.warn('Audio event error:', err.message);
  }
}

/**
 * Pause playback.
 */
export function pausePlayback() {
  Tone.getTransport().pause();
  isPlaying = false;
}

/**
 * Resume playback after pause.
 */
export function resumePlayback() {
  Tone.getTransport().start();
  isPlaying = true;
}

/**
 * Stop playback and clear all scheduled events.
 */
export function stopPlayback() {
  Tone.getTransport().stop();
  Tone.getTransport().cancel();
  scheduledEvents = [];

  // Release all synths
  try {
    melodySynth?.releaseAll();
    canonSynth?.releaseAll();
    ambientPad?.releaseAll();
    if (ambientNoise?.state === 'started') ambientNoise.stop();
  } catch (e) { /* ignore */ }

  if (loopId !== null) {
    loopId = null;
  }

  isPlaying = false;
}

/**
 * Set master volume (0-1).
 */
export function setMasterVolume(value) {
  if (masterVol) {
    const db = value <= 0 ? -Infinity : 20 * Math.log10(value) - 6;
    masterVol.volume.rampTo(db, 0.1);
  }
}

/**
 * Set per-layer volume (0-1).
 */
export function setLayerVolume(layer, value) {
  layerVolumes[layer] = value;
  const channels = { melody: melodyCh, canon: canonCh, bass: bassCh, percussion: percCh, ambient: ambientCh };
  if (channels[layer]) {
    const db = value <= 0 ? -60 : 20 * Math.log10(value) - 6;
    channels[layer].volume.rampTo(db, 0.3);
  }
}

/**
 * Mute/unmute a layer.
 */
export function setLayerMute(layer, muted) {
  layerMuted[layer] = muted;
  const channels = { melody: melodyCh, canon: canonCh, bass: bassCh, percussion: percCh, ambient: ambientCh };
  if (channels[layer]) {
    channels[layer].mute = muted;
  }
}

/**
 * Set the sleep timer: fade out and stop after the given minutes.
 */
export function setSleepTimer(minutes) {
  if (sleepTimerId) {
    clearTimeout(sleepTimerId);
    sleepTimerId = null;
  }
  if (minutes <= 0) return;

  const fadeStart = (minutes * 60 - 10) * 1000; // start fading 10s before end
  const totalMs = minutes * 60 * 1000;

  sleepTimerId = setTimeout(() => {
    // Start fading
    if (masterVol) {
      masterVol.volume.rampTo(-60, 10);
    }
    setTimeout(() => {
      stopPlayback();
    }, 10000);
  }, fadeStart);
}

/**
 * Enable/disable evolve mode (seed increments after each loop).
 */
export function setEvolve(enabled) {
  evolveEnabled = enabled;
}

/**
 * Set ambient type: 'rain', 'wind', or 'none'.
 */
export function setAmbientType(type) {
  if (!ambientNoise) return;
  try {
    if (type === 'none') {
      if (ambientNoise.state === 'started') ambientNoise.stop();
    } else {
      ambientNoise.set({ type: type === 'rain' ? 'white' : 'brown' });
      if (ambientNoise.state !== 'started' && isPlaying) ambientNoise.start();
    }
  } catch (e) { /* ignore */ }
}

/**
 * Get playback state.
 */
export function getPlaybackState() {
  return {
    isPlaying,
    isInitialized,
    currentTime: Tone.now(),
    transportState: Tone.getTransport().state
  };
}

/**
 * Get current transport position for syncing visuals.
 */
export function getCurrentTime() {
  return Tone.getTransport().seconds;
}

/**
 * Dispose all audio resources.
 */
export function disposeAudio() {
  stopPlayback();
  try {
    melodySynth?.dispose();
    canonSynth?.dispose();
    bassSynth?.dispose();
    percChime?.dispose();
    percBrush?.dispose();
    percTap?.dispose();
    ambientPad?.dispose();
    ambientNoise?.dispose();
    reverb?.dispose();
    delay?.dispose();
    limiter?.dispose();
    masterVol?.dispose();
    melodyCh?.dispose();
    canonCh?.dispose();
    bassCh?.dispose();
    percCh?.dispose();
    ambientCh?.dispose();
  } catch (e) { /* ignore */ }
  isInitialized = false;
}
