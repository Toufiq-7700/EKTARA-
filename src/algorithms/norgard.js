/**
 * Nørgård Infinity Series
 * 
 * A self-similar integer sequence invented by Per Nørgård.
 * The sequence contains copies of itself at every power-of-two zoom,
 * making it ideal for generating fractal melodies.
 * 
 * Recursive definition:
 *   n(0) = 0
 *   n(2k) = -n(k)
 *   n(2k+1) = n(k) + 1
 * 
 * First values: 0, 1, -1, 2, 1, 0, -2, 3, -1, 2, 0, 1, 2, -1, -3, 4, ...
 * 
 * Musical mapping: each value becomes a scale degree, so the melody
 * contains smaller, faster copies of itself — a recursive canon.
 */

// Memoization cache for computed values
const memo = new Map();

/**
 * Compute the k-th value of the Nørgård infinity series (recursive, memoized).
 * 
 * @param {number} k - Non-negative index into the series
 * @returns {number} The infinity series value at index k
 */
export function norgard(k) {
  if (k < 0) throw new Error(`norgard(k): k must be >= 0, got ${k}`);

  if (memo.has(k)) return memo.get(k);

  let result;
  if (k === 0) {
    result = 0;
  } else if (k % 2 === 0) {
    // Even index: n(2k) = -n(k)
    result = -norgard(k / 2);
  } else {
    // Odd index: n(2k+1) = n(k) + 1
    result = norgard((k - 1) / 2) + 1;
  }

  memo.set(k, result);
  return result;
}

/**
 * Generate the first `length` values of the Nørgård infinity series.
 * 
 * @param {number} length - How many values to generate
 * @returns {number[]} Array of infinity series values
 */
export function norgardSequence(length) {
  const seq = [];
  for (let i = 0; i < length; i++) {
    seq.push(norgard(i));
  }
  return seq;
}

/**
 * Clear the memoization cache (useful for testing).
 */
export function clearNorgardCache() {
  memo.clear();
}
