/**
 * Nørgård Infinity Series (Generalised)
 * 
 * A self-similar integer sequence invented by Per Nørgård.
 * Generalised with an interval step d (default d = 1 gives the classic series):
 * 
 * Recursive definition:
 *   n(0) = 0
 *   n(2k) = -n(k)
 *   n(2k+1) = n(k) + d
 * 
 * Classic values (d = 1): 0, 1, -1, 2, 1, 0, -2, 3, -1, 2, 0, 1, 2, -1, -3, 4, ...
 * 
 * Musical mapping: each value becomes a scale degree, so the melody
 * contains smaller, faster copies of itself — a recursive canon.
 */

// Memoization caches keyed by interval step d
const memoByStep = new Map();

/**
 * Compute the k-th value of the Nørgård infinity series (recursive, memoized).
 * 
 * @param {number} k - Non-negative index into the series
 * @param {number} [d=1] - Interval step parameter (1 to 3)
 * @returns {number} The infinity series value at index k
 */
export function norgard(k, d = 1) {
  if (k < 0) throw new Error(`norgard(k): k must be >= 0, got ${k}`);
  const step = Math.round(d) || 1;

  let memo = memoByStep.get(step);
  if (!memo) {
    memo = new Map();
    memoByStep.set(step, memo);
  }
  if (memo.has(k)) return memo.get(k);

  let result;
  if (k === 0) {
    result = 0;
  } else if (k % 2 === 0) {
    // Even index: n(2k) = -n(k)
    result = -norgard(k / 2, step);
  } else {
    // Odd index: n(2k+1) = n(k) + d
    result = norgard((k - 1) / 2, step) + step;
  }

  memo.set(k, result);
  return result;
}

/**
 * Generate `length` values of the Nørgård infinity series starting at `offset`.
 * 
 * @param {number} length - How many values to generate
 * @param {number} [offset=0] - Starting index offset in the infinite series
 * @param {number} [d=1] - Interval step parameter
 * @returns {number[]} Array of infinity series values
 */
export function norgardSequence(length, offset = 0, d = 1) {
  const start = Math.max(0, Math.round(offset) || 0);
  const seq = [];
  for (let i = 0; i < length; i++) {
    seq.push(norgard(start + i, d));
  }
  return seq;
}

/**
 * Clear the memoization cache (useful for testing).
 */
export function clearNorgardCache() {
  memoByStep.clear();
}
