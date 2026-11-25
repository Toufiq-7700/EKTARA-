/**
 * Canonical Algorithm Metadata & Plain-English Caption Formatter
 *
 * Keeps color, shape symbol, label, and description consistent across
 * Lab cards, live simulations, What-You-Hear timeline, Garden highlights,
 * and X-Ray overlay. Uses shapes + labels alongside colors for accessibility.
 */

export const ALGORITHMS = {
  norgard: {
    id: 'norgard',
    title: 'Melody: Nørgård',
    shortName: 'Nørgård',
    shape: '◆',
    color: '#f0c878',
    bgTint: 'rgba(240, 200, 120, 0.14)',
    description: 'Self-similar integer sequence where every note mirrors smaller copies of itself.'
  },
  hanoi: {
    id: 'hanoi',
    title: 'Bass: Hanoi',
    shortName: 'Hanoi',
    shape: '▬',
    color: '#78c8f0',
    bgTint: 'rgba(120, 200, 240, 0.14)',
    description: 'Recursive disc moves between three pegs drive bass pitch and note duration.'
  },
  bjorklund: {
    id: 'bjorklund',
    title: 'Rhythm: Euclidean',
    shortName: 'Euclidean',
    shape: '●',
    color: '#a0f078',
    bgTint: 'rgba(160, 240, 120, 0.14)',
    description: 'Bjorklund recursion spaces hits evenly across steps like world-music rhythms.'
  },
  lsystem: {
    id: 'lsystem',
    title: 'Tree: L-System',
    shortName: 'L-System',
    shape: '▲',
    color: '#f078c8',
    bgTint: 'rgba(240, 120, 200, 0.14)',
    description: 'String rewriting rules grow fractal branches angled by the Nørgård melody.'
  }
};

export const ALGORITHM_ORDER = ['norgard', 'hanoi', 'bjorklund', 'lsystem'];

/**
 * Format a timed score event into a plain-English explanation for Lab Step Mode.
 * @param {Object} event - Score event from buildScore()
 * @returns {string}
 */
export function formatEventCaption(event) {
  if (!event) return 'Click Step Forward or Play to inspect recursive events.';
  const m = event.meta || {};
  if (m.algorithm === 'norgard') {
    const prefix = event.voice === 'canon'
      ? `Canon ${m.canonLayer || 1}: Nørgård(${m.index})`
      : `Nørgård(${m.index})`;
    return `${prefix} = ${m.value} → scale degree ${m.value} → note ${event.note} (${event.duration.toFixed(2)}s)`;
  }
  if (m.algorithm === 'hanoi') {
    const pegRole = m.to === 'A' ? 'Root' : m.to === 'B' ? '5th' : 'Octave';
    return `Hanoi move ${m.step + 1}: disc ${m.disc} ${m.from}→${m.to} (${pegRole}) → bass ${event.note} (${event.duration.toFixed(2)}s)`;
  }
  if (m.algorithm === 'bjorklund') {
    return `Euclidean E(${m.pulses},${m.steps}) step ${m.step} → soft ${m.percType} (pan ${event.pan.toFixed(2)})`;
  }
  return `${event.voice}: ${event.note || ''}`;
}
