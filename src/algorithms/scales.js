/**
 * Scale and Music Theory Utilities
 * 
 * Maps integer scale degrees to MIDI-compatible note values.
 * Used by the score builder to convert Nørgård values to pitches.
 */

/**
 * Scale interval definitions (semitones from root).
 * Each scale provides a set of "safe" intervals that sound good together.
 */
export const SCALES = {
  pentatonic: [0, 2, 4, 7, 9],           // Major pentatonic (no tension)
  lydian:     [0, 2, 4, 6, 7, 9, 11],    // Lydian mode (dreamy, bright)
  dorian:     [0, 2, 3, 5, 7, 9, 10],    // Dorian mode (mellow, jazzy)
};

/**
 * Map a scale degree to a MIDI note number.
 * Wraps around octaves naturally: degree 5 in pentatonic (5 notes) = degree 0 one octave up.
 * 
 * @param {number} degree - Integer scale degree (can be negative)
 * @param {string} scaleName - One of "pentatonic", "lydian", "dorian"
 * @param {number} rootMidi - MIDI number of the root note (default 60 = C4)
 * @returns {number} MIDI note number
 */
export function degreeToMidi(degree, scaleName = 'pentatonic', rootMidi = 60) {
  const scale = SCALES[scaleName] || SCALES.pentatonic;
  const len = scale.length;

  // Handle negative degrees: wrap into octaves
  const octave = Math.floor(degree / len);
  let idx = degree % len;
  if (idx < 0) idx += len;

  return rootMidi + octave * 12 + scale[idx];
}

/**
 * Convert a MIDI note number to a frequency in Hz (A4 = 440 Hz).
 * @param {number} midi 
 * @returns {number}
 */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Convert a MIDI note number to a note name string (e.g., "C4", "F#3").
 * @param {number} midi 
 * @returns {string}
 */
export function midiToName(midi) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = names[midi % 12];
  return `${note}${octave}`;
}

/**
 * Peg-to-interval mapping for Tower of Hanoi.
 * Each peg produces a different harmonic interval.
 */
export const PEG_INTERVALS = {
  'A': 0,    // Root
  'B': 7,    // Perfect fifth
  'C': 12    // Octave
};
