/**
 * Procedural Instrument Timbres & Seeded Humanisation
 *
 * Crafts warm, organic Tone.js timbres (no external audio files) for every layer:
 *   - Melody: Glass Bell (FM), Music Box (sine + octave partial), Kalimba (filtered triangle),
 *             Singing Bowl (detuned 1x / 2.76x / 5.4x beating partials)
 *   - Bass:   Warm sine + triangle blend through low-pass & light Chebyshev saturation
 *   - Pad:    4-oscillator detuned fat synth through slow LPF LFO & stereo Chorus
 *   - Perc:   Band-passed brushed noise, low-passed wooden tap, filtered soft chime
 *
 * Also applies deterministic seeded humanisation (timing, velocity, duration, pitch drift).
 */

import * as Tone from 'tone';

export const DEFAULT_TIMBRES = {
  melody: 'Glass Bell',
  canon: 'Match Melody',
  bass: 'Warm Blend',
  percussion: 'Brush & Wood',
  ambient: 'Blooming Pad'
};

export const TIMBRE_OPTIONS = {
  melody: ['Glass Bell', 'Music Box', 'Kalimba', 'Singing Bowl'],
  canon: ['Match Melody', 'Glass Bell', 'Music Box', 'Kalimba', 'Singing Bowl'],
  bass: ['Warm Blend', 'Deep Sub', 'Mellow Pluck'],
  percussion: ['Brush & Wood', 'Water Chimes', 'Soft Bamboo'],
  ambient: ['Blooming Pad', 'Warm Strings', 'Celestial Drone']
};

/**
 * Deterministically humanise a single score event using a seeded PRNG:
 *   - Timing jitter: +/- 10 to 25 ms (clamped >= 0)
 *   - Velocity variation: +/- 10%
 *   - Note length variation: +/- 12%
 *   - Pitch drift: +/- 7 cents on melodic voices
 *
 * @param {Object} event - Event from buildScore()
 * @param {Function} rng - Seeded PRNG returning [0, 1)
 * @returns {Object} Humanised copy of the event
 */
export function humaniseEvent(event, rng) {
  // Choose magnitude in [10ms, 25ms] with random sign -> organic, non-mechanical timing
  const sign = rng() < 0.5 ? -1 : 1;
  const jitterMs = sign * (0.01 + rng() * 0.015);
  const time = Math.max(0, (event.time ?? 0) + jitterMs);

  const velFactor = 0.9 + rng() * 0.2; // +/- 10%
  const velocity = Math.max(0.01, Math.min(1, (event.velocity ?? 0.5) * velFactor));

  const durFactor = 0.88 + rng() * 0.24; // +/- 12%
  const duration = Math.max(0.06, (event.duration ?? 0.3) * durFactor);

  // Subtle +/- 7 cents pitch drift on pitched notes
  let frequency = event.frequency || 0;
  let driftCents = 0;
  if (frequency > 0 && (event.voice === 'melody' || event.voice === 'canon')) {
    driftCents = (rng() * 2 - 1) * 7;
    frequency = frequency * Math.pow(2, driftCents / 1200);
  }

  return {
    ...event,
    time,
    velocity,
    duration,
    frequency,
    driftCents
  };
}

/**
 * Polyphonic Singing Bowl generator using 3 inharmonic partials per voice:
 * 1x, 2.76x (+1.8 Hz beating), and 5.4x (-2.4 Hz beating), slow attack & long decay.
 */
function createSingingBowlSynth(destination, volumeOffsetDb = 0) {
  const SLOTS = 4;
  let cursor = 0;
  const slots = [];

  for (let i = 0; i < SLOTS; i++) {
    const p1 = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.22, decay: 3.4, sustain: 0.14, release: 4.2 },
      volume: -6 + volumeOffsetDb
    }).connect(destination);

    const p2 = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.28, decay: 2.8, sustain: 0.08, release: 3.6 },
      volume: -17 + volumeOffsetDb
    }).connect(destination);

    const p3 = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.32, decay: 2.1, sustain: 0.04, release: 2.8 },
      volume: -24 + volumeOffsetDb
    }).connect(destination);

    slots.push({ p1, p2, p3 });
  }

  return {
    triggerAttackRelease(freqHz, duration, time, velocity) {
      const slot = slots[cursor];
      cursor = (cursor + 1) % SLOTS;
      const f = typeof freqHz === 'number' ? freqHz : Tone.Frequency(freqHz).toFrequency();
      const dur = Math.max(0.35, duration);
      slot.p1.triggerAttackRelease(f, dur, time, velocity);
      slot.p2.triggerAttackRelease(f * 2.76 + 1.8, dur * 0.9, time, velocity * 0.75);
      slot.p3.triggerAttackRelease(f * 5.4 - 2.4, dur * 0.75, time, velocity * 0.5);
    },
    releaseAll() {
      for (const s of slots) {
        try {
          s.p1.triggerRelease();
          s.p2.triggerRelease();
          s.p3.triggerRelease();
        } catch (_) { /* ignore */ }
      }
    },
    dispose() {
      for (const s of slots) {
        try { s.p1.dispose(); s.p2.dispose(); s.p3.dispose(); } catch (_) { /* ignore */ }
      }
    }
  };
}

/**
 * Create a melodic instrument for one of the 4 selectable timbres:
 * "Glass Bell", "Music Box", "Kalimba", "Singing Bowl".
 */
export function createMelodyVoice(timbre, destination, volumeOffsetDb = 0) {
  if (timbre === 'Singing Bowl') {
    return createSingingBowlSynth(destination, volumeOffsetDb);
  }

  if (timbre === 'Music Box') {
    return new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 8,
      voice: Tone.Synth,
      options: {
        // Bright sine fundamental + quiet octave-up partial + subtle 3rd
        oscillator: { type: 'custom', partials: [1, 0.28, 0.05] },
        envelope: {
          attack: 0.008,
          decay: 0.85,
          sustain: 0.04,
          release: 1.15
        },
        volume: -6 + volumeOffsetDb
      }
    }).connect(destination);
  }

  if (timbre === 'Kalimba') {
    return new Tone.PolySynth(Tone.MonoSynth, {
      maxPolyphony: 8,
      voice: Tone.MonoSynth,
      options: {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.012,
          decay: 0.34,
          sustain: 0.04,
          release: 0.52
        },
        filter: { type: 'lowpass', Q: 1.4, rolloff: -12 },
        filterEnvelope: {
          attack: 0.005,
          decay: 0.16,
          sustain: 0.08,
          release: 0.24,
          baseFrequency: 320,
          octaves: 3.2
        },
        volume: -5 + volumeOffsetDb
      }
    }).connect(destination);
  }

  // Default: "Glass Bell" — FM synthesis with low modulation index & slight inharmonicity
  return new Tone.PolySynth(Tone.FMSynth, {
    maxPolyphony: 8,
    voice: Tone.FMSynth,
    options: {
      harmonicity: 2.01,
      modulationIndex: 1.8,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: {
        attack: 0.025,
        decay: 1.8,
        sustain: 0.08,
        release: 2.8
      },
      modulationEnvelope: {
        attack: 0.02,
        decay: 0.9,
        sustain: 0.04,
        release: 1.2
      },
      volume: -6 + volumeOffsetDb
    }
  }).connect(destination);
}

/**
 * Create the warm Bass voice (sine + triangle blend -> gentle LPF -> light Chebyshev saturation).
 */
export function createBassVoice(timbre, destination) {
  const isDeep = timbre === 'Deep Sub';
  const isPluck = timbre === 'Mellow Pluck';

  const sat = new Tone.Chebyshev({ order: 2, wet: isDeep ? 0.1 : 0.18 }).connect(destination);
  const lowpass = new Tone.Filter({
    frequency: isPluck ? 440 : isDeep ? 260 : 340,
    type: 'lowpass',
    Q: 0.7
  }).connect(sat);

  const sineLayer = new Tone.MonoSynth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: isPluck ? 0.035 : 0.065,
      decay: isPluck ? 0.5 : 0.8,
      sustain: 0.55,
      release: 2.8
    },
    filter: { type: 'lowpass', frequency: 600 },
    filterEnvelope: {
      attack: 0.04,
      decay: 0.35,
      sustain: 0.5,
      release: 2.0,
      baseFrequency: 120,
      octaves: 1.8
    },
    volume: -6
  }).connect(lowpass);

  const triLayer = new Tone.MonoSynth({
    oscillator: { type: 'triangle' },
    envelope: {
      attack: isPluck ? 0.035 : 0.075,
      decay: isPluck ? 0.4 : 0.6,
      sustain: 0.4,
      release: 2.4
    },
    filter: { type: 'lowpass', frequency: 420 },
    filterEnvelope: {
      attack: 0.05,
      decay: 0.3,
      sustain: 0.35,
      release: 1.8,
      baseFrequency: 100,
      octaves: 2.0
    },
    volume: isDeep ? -15 : -11
  }).connect(lowpass);

  return {
    triggerAttackRelease(freqOrNote, duration, time, velocity) {
      sineLayer.triggerAttackRelease(freqOrNote, duration, time, velocity);
      triLayer.triggerAttackRelease(freqOrNote, duration, time, velocity * 0.8);
    },
    releaseAll() {
      try {
        sineLayer.triggerRelease();
        triLayer.triggerRelease();
      } catch (_) { /* ignore */ }
    },
    dispose() {
      try {
        sineLayer.dispose();
        triLayer.dispose();
        lowpass.dispose();
        sat.dispose();
      } catch (_) { /* ignore */ }
    }
  };
}

/**
 * Create the blooming Ambient Pad (4 detuned oscillators -> slow LPF LFO -> Chorus).
 */
export function createPadVoice(timbre, destination) {
  const isStrings = timbre === 'Warm Strings';
  const isCelestial = timbre === 'Celestial Drone';

  const chorus = new Tone.Chorus({
    frequency: isStrings ? 0.45 : 0.3,
    delayTime: 4.5,
    depth: 0.65,
    wet: 0.55
  }).connect(destination).start();

  const padFilter = new Tone.Filter({
    frequency: 600,
    type: 'lowpass',
    Q: 0.8
  }).connect(chorus);

  const filterLfo = new Tone.LFO({
    frequency: isCelestial ? 0.05 : 0.08,
    min: 240,
    max: isStrings ? 1150 : 880,
    type: 'sine'
  }).start().connect(padFilter.frequency);

  const padSynth = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 4,
    voice: Tone.Synth,
    options: {
      oscillator: {
        type: isStrings ? 'fattriangle' : 'fatsine',
        count: 4,
        spread: isCelestial ? 28 : 20
      },
      envelope: {
        attack: 4.5,
        decay: 2.5,
        sustain: 0.8,
        release: 6.0
      },
      volume: -18
    }
  }).connect(padFilter);

  return {
    triggerAttack(notes, time, velocity) {
      padSynth.triggerAttack(notes, time, velocity);
    },
    triggerRelease(notes, time) {
      padSynth.triggerRelease(notes, time);
    },
    releaseAll() {
      try { padSynth.releaseAll(); } catch (_) { /* ignore */ }
    },
    dispose() {
      try {
        padSynth.dispose();
        filterLfo.dispose();
        padFilter.dispose();
        chorus.dispose();
      } catch (_) { /* ignore */ }
    }
  };
}

/**
 * Create soft organic Percussion voices (band-passed brushed noise, muted wooden tap, filtered chime).
 */
export function createPercussionVoices(timbre, destination) {
  const isChimeFocus = timbre === 'Water Chimes';
  const isBamboo = timbre === 'Soft Bamboo';

  const brushFilter = new Tone.Filter({
    frequency: isChimeFocus ? 2100 : 1450,
    type: 'bandpass',
    Q: 1.4
  }).connect(destination);

  const tapFilter = new Tone.Filter({
    frequency: isBamboo ? 920 : 720,
    type: 'lowpass',
    Q: 1.0
  }).connect(destination);

  const chimeFilter = new Tone.Filter({
    frequency: isChimeFocus ? 2400 : 1850,
    type: 'lowpass',
    Q: 0.8
  }).connect(destination);

  const percBrush = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.016, decay: 0.14, sustain: 0, release: 0.1 },
    volume: -21
  }).connect(brushFilter);

  const percTap = new Tone.MembraneSynth({
    pitchDecay: 0.018,
    octaves: isBamboo ? 1.5 : 2,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.008, decay: 0.14, sustain: 0, release: 0.09 },
    volume: -22
  }).connect(tapFilter);

  const percChime = new Tone.MetalSynth({
    frequency: isChimeFocus ? 980 : 760,
    envelope: { attack: 0.012, decay: 0.36, release: 0.28 },
    harmonicity: 4.2,
    modulationIndex: 7,
    resonance: 1600,
    octaves: 0.8,
    volume: -25
  }).connect(chimeFilter);

  return {
    percBrush,
    percTap,
    percChime,
    isBamboo,
    dispose() {
      const nodes = [
        percBrush, percTap, percChime,
        brushFilter, tapFilter, chimeFilter
      ];
      for (const n of nodes) {
        try { n.dispose(); } catch (_) { /* ignore */ }
      }
    }
  };
}

/**
 * Create the soft Ektara Drone voice:
 * Karplus-Strong plucked string (Tone.PluckSynth) blended with a warm filtered
 * triangle body that supports slow 20–40 cent pitch bends like a pressed ektara handle.
 */
export function createDroneVoice(destination) {
  const filter = new Tone.Filter({
    frequency: 980,
    type: 'lowpass',
    Q: 0.75
  }).connect(destination);

  const pluck = new Tone.PluckSynth({
    attackNoise: 0.6,
    dampening: 2600,
    resonance: 0.94,
    release: 1.8,
    volume: -6
  }).connect(filter);

  const body = new Tone.MonoSynth({
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.025,
      decay: 1.4,
      sustain: 0.25,
      release: 2.2
    },
    filter: { type: 'lowpass', frequency: 720, Q: 0.8 },
    filterEnvelope: {
      attack: 0.015,
      decay: 0.4,
      sustain: 0.3,
      release: 1.2,
      baseFrequency: 180,
      octaves: 2.0
    },
    volume: -12
  }).connect(filter);

  return {
    triggerAttackRelease(freqHz, duration, time, velocity = 0.3, bendCents = 0) {
      const f = typeof freqHz === 'number' ? freqHz : Tone.Frequency(freqHz).toFrequency();
      const dur = Math.max(0.4, duration);
      const t = time ?? Tone.now();
      pluck.triggerAttack(f, t);
      if (bendCents > 0) {
        body.detune.setValueAtTime(0, t);
        body.detune.linearRampToValueAtTime(bendCents, t + Math.min(0.55, dur * 0.35));
        body.detune.linearRampToValueAtTime(0, t + Math.min(1.5, dur * 0.9));
      } else {
        body.detune.setValueAtTime(0, t);
      }
      body.triggerAttackRelease(f, dur, t, velocity);
    },
    releaseAll() {
      try { body.triggerRelease(); } catch (_) { /* ignore */ }
    },
    dispose() {
      try { pluck.dispose(); } catch (_) { /* ignore */ }
      try { body.dispose(); } catch (_) { /* ignore */ }
      try { filter.dispose(); } catch (_) { /* ignore */ }
    }
  };
}
