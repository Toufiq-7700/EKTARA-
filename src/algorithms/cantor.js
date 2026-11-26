/**
 * Cantor Set — Recursive Middle-Third Removal
 *
 * Starts with a solid interval [1] and at each depth recursively removes
 * the middle third of every active segment:
 *   1 -> [1, 0, 1]
 *   0 -> [0, 0, 0]
 *
 * Depth 0: [1]
 * Depth 1: [1, 0, 1]
 * Depth 2: [1, 0, 1, 0, 0, 0, 1, 0, 1]  (length 3^2 = 9)
 */

/**
 * Recursively compute the Cantor set boolean pattern at `depth` (0 to 4).
 * @param {number} depth - Recursion depth (0..4, length 3^depth)
 * @returns {boolean[]}
 */
export function cantorPattern(depth) {
  const d = Math.max(0, Math.min(4, Math.round(depth)));
  if (d === 0) return [true];

  const prev = cantorPattern(d - 1);
  const out = [];
  for (const active of prev) {
    if (active) {
      out.push(true, false, true);
    } else {
      out.push(false, false, false);
    }
  }
  return out;
}

/**
 * Return every recursion level 0..depth for step-by-step Lab visualization.
 * @param {number} depth
 * @returns {boolean[][]}
 */
export function cantorSteps(depth) {
  const d = Math.max(0, Math.min(4, Math.round(depth)));
  const levels = [];
  for (let i = 0; i <= d; i++) {
    levels.push(cantorPattern(i));
  }
  return levels;
}
