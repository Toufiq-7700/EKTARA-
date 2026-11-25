/**
 * Bjorklund / Euclidean Rhythm Algorithm
 * 
 * Distributes k pulses (hits) as evenly as possible across n steps,
 * using the same mathematical principle as Euclid's GCD algorithm.
 * This produces rhythms found in music worldwide:
 *   - bjorklund(3, 8) → [1,0,0,1,0,0,1,0] (Cuban tresillo)
 *   - bjorklund(5, 8) → [1,0,1,1,0,1,1,0] (Cuban cinquillo)
 *   - bjorklund(7, 12) → [1,0,1,1,0,1,0,1,1,0,1,0] (West African bell)
 * 
 * Recursive definition:
 *   1. Start with k groups of [1] and (n-k) groups of [0]
 *   2. Distribute the shorter groups onto the longer groups (like Euclid's GCD)
 *   3. Repeat until one group type remains
 * 
 * Musical mapping: each `true` in the pattern triggers a percussion event
 * (chime, brush, or tap). The rotation parameter shifts the downbeat.
 */

/**
 * Compute a Euclidean rhythm pattern using the recursive Bjorklund algorithm.
 * 
 * @param {number} pulses - Number of active hits (k)
 * @param {number} steps  - Total steps in the cycle (n)
 * @returns {boolean[]} Array of length `steps`, true = hit, false = rest
 */
export function bjorklund(pulses, steps) {
  if (pulses < 0 || steps <= 0) {
    throw new Error(`bjorklund: invalid args (pulses=${pulses}, steps=${steps})`);
  }
  if (pulses > steps) pulses = steps;
  if (pulses === 0) return new Array(steps).fill(false);
  if (pulses === steps) return new Array(steps).fill(true);

  // Build initial groups: `pulses` groups of [1] and (steps - pulses) groups of [0]
  let left = Array.from({ length: pulses }, () => [1]);
  let right = Array.from({ length: steps - pulses }, () => [0]);

  // Recursively distribute remainder groups
  return distributeRecursive(left, right);
}

/**
 * Recursive step of the Bjorklund algorithm.
 * Appends elements from the shorter array onto elements of the longer array,
 * then recurses on the new remainder.
 * 
 * @param {number[][]} left - Current longer groups
 * @param {number[][]} right - Current shorter/remainder groups
 * @returns {boolean[]} Flattened boolean pattern
 */
function distributeRecursive(left, right) {
  // Base case: nothing more to distribute
  if (right.length <= 1) {
    return left.concat(right).flat().map(v => v === 1);
  }

  const newLeft = [];
  const newRight = [];

  // Pair up: append one right element to each left element
  const pairs = Math.min(left.length, right.length);
  for (let i = 0; i < pairs; i++) {
    newLeft.push([...left[i], ...right[i]]);
  }

  // Leftovers become the new remainder
  if (left.length > right.length) {
    for (let i = pairs; i < left.length; i++) {
      newRight.push(left[i]);
    }
  } else {
    for (let i = pairs; i < right.length; i++) {
      newRight.push(right[i]);
    }
  }

  return distributeRecursive(newLeft, newRight);
}

/**
 * Compute all intermediate group-merging steps of the Bjorklund algorithm
 * for visualization in the Algorithm Lab.
 *
 * @param {number} pulses - Active hits (k)
 * @param {number} steps - Total steps (n)
 * @returns {{ steps: string[][][], pattern: boolean[] }}
 */
export function bjorklundSteps(pulses, steps) {
  if (pulses < 0 || steps <= 0) {
    throw new Error(`bjorklundSteps: invalid args (pulses=${pulses}, steps=${steps})`);
  }
  const k = Math.min(pulses, steps);
  if (k === 0) {
    const empty = Array.from({ length: steps }, () => ['.']);
    return { steps: [empty], pattern: new Array(steps).fill(false) };
  }
  if (k === steps) {
    const full = Array.from({ length: steps }, () => ['x']);
    return { steps: [full], pattern: new Array(steps).fill(true) };
  }

  let left = Array.from({ length: k }, () => ['x']);
  let right = Array.from({ length: steps - k }, () => ['.']);
  const history = [[...left, ...right].map(g => [...g])];

  while (right.length > 1) {
    const newLeft = [];
    const newRight = [];
    const pairs = Math.min(left.length, right.length);

    for (let i = 0; i < pairs; i++) {
      newLeft.push([...left[i], ...right[i]]);
    }
    if (left.length > right.length) {
      for (let i = pairs; i < left.length; i++) newRight.push(left[i]);
    } else {
      for (let i = pairs; i < right.length; i++) newRight.push(right[i]);
    }

    left = newLeft;
    right = newRight;
    history.push([...left, ...right].map(g => [...g]));
  }

  const pattern = left.concat(right).flat().map(ch => ch === 'x');
  return { steps: history, pattern };
}

/**
 * Rotate a Euclidean pattern by `offset` steps.
 * This shifts where the "downbeat" falls in the cycle.
 * 
 * @param {boolean[]} pattern - The Bjorklund pattern
 * @param {number} offset - Number of positions to rotate left
 * @returns {boolean[]} Rotated pattern
 */
export function rotatePattern(pattern, offset) {
  const len = pattern.length;
  if (len === 0) return pattern;
  const r = ((offset % len) + len) % len;
  return [...pattern.slice(r), ...pattern.slice(0, r)];
}
