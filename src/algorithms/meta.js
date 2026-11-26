/**
 * Canonical Role Metadata & Plain-English Caption Formatter
 *
 * Colors and shape badges stay tied to the MUSICAL ROLE (`melody`, `bass`,
 * `rhythm`, `tree`) so switching algorithms inside a role keeps the UI calm
 * and visually consistent.
 */

export const ROLES_META = {
  melody: {
    role: 'melody',
    id: 'melody',
    title: 'Melody',
    shortName: 'Melody',
    shape: '◆',
    color: '#f0c878',
    bgTint: 'rgba(240, 200, 120, 0.14)'
  },
  bass: {
    role: 'bass',
    id: 'bass',
    title: 'Bass',
    shortName: 'Bass',
    shape: '▬',
    color: '#78c8f0',
    bgTint: 'rgba(120, 200, 240, 0.14)'
  },
  rhythm: {
    role: 'rhythm',
    id: 'rhythm',
    title: 'Rhythm',
    shortName: 'Rhythm',
    shape: '●',
    color: '#a0f078',
    bgTint: 'rgba(160, 240, 120, 0.14)'
  },
  tree: {
    role: 'tree',
    id: 'tree',
    title: 'Visual Tree',
    shortName: 'Tree',
    shape: '▲',
    color: '#f078c8',
    bgTint: 'rgba(240, 120, 200, 0.14)'
  }
};

export const ROLE_ORDER = ['melody', 'bass', 'rhythm', 'tree'];

// Keep legacy exports for backward compatibility with existing helpers/tests
export const ALGORITHMS = {
  ...ROLES_META,
  norgard: ROLES_META.melody,
  hanoi: ROLES_META.bass,
  bjorklund: ROLES_META.rhythm,
  lsystem: ROLES_META.tree
};
export const ALGORITHM_ORDER = ROLE_ORDER;

/**
 * Resolve role ('melody' | 'bass' | 'rhythm' | 'tree') from any event.
 */
export function resolveEventRole(event) {
  if (!event) return 'melody';
  if (event.meta?.role) return event.meta.role;
  if (event.voice === 'melody' || event.voice === 'canon') return 'melody';
  if (event.voice === 'bass') return 'bass';
  if (event.voice === 'percussion') return 'rhythm';
  return 'tree';
}

/**
 * Format a timed score event into a plain-English explanation for Lab Step Mode.
 * Supports every registered algorithm across all four roles.
 */
export function formatEventCaption(event) {
  if (!event) return 'Click Step Forward or Play to inspect recursive events.';
  const m = event.meta || {};
  const alg = m.algorithm;

  if (alg === 'norgard') {
    const prefix = event.voice === 'canon'
      ? `Canon ${m.canonLayer || 1}: Nørgård(${m.index})`
      : `Nørgård(${m.index})`;
    return `${prefix} = ${m.value} → scale degree ${m.value} → note ${event.note} (${event.duration.toFixed(2)}s)`;
  }
  if (alg === 'thue-morse') {
    return `Thue-Morse t(${m.index}) = ${m.bit} → scale degree ${m.value} → note ${event.note} (${event.duration.toFixed(2)}s)`;
  }
  if (alg === 'fibonacci-word') {
    return `Fibonacci S_${m.generation}[${m.index}] = '${m.bit}' → scale degree ${m.value} → note ${event.note} (${event.duration.toFixed(2)}s)`;
  }
  if (alg === 'hanoi') {
    const pegRole = m.to === 'A' ? 'Root' : m.to === 'B' ? '5th' : 'Octave';
    return `Hanoi move ${m.step + 1}: disc ${m.disc} ${m.from}→${m.to} (${pegRole}) → bass ${event.note} (${event.duration.toFixed(2)}s)`;
  }
  if (alg === 'gray-code') {
    return `Gray code ${m.code} (flip bit ${m.flippedBit}) → bass ${event.note} (${event.duration.toFixed(2)}s)`;
  }
  if (alg === 'cantor-bass') {
    return `Cantor depth ${m.depth} [${m.index + 1}/${m.totalSteps}] → active third → bass ${event.note} (${event.duration.toFixed(2)}s)`;
  }
  if (alg === 'bjorklund') {
    return `Euclidean E(${m.pulses},${m.steps}) step ${m.step} → soft ${m.percType} (pan ${event.pan.toFixed(2)})`;
  }
  if (alg === 'cantor-rhythm') {
    return `Cantor rhythm depth ${m.depth} step ${m.step + 1}/${m.steps} → soft ${m.percType}`;
  }
  if (alg === 'thue-morse-rhythm') {
    return `Thue-Morse rhythm step ${m.step} (bit ${m.bit}) → soft ${m.percType}`;
  }
  return `${event.voice}: ${event.note || ''}`;
}
