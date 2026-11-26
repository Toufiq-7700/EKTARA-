/**
 * Thue-Morse Sequence
 *
 * A classic automatic / self-similar binary sequence used in music and combinatorics
 * to avoid consecutive repetitions ("cube-free" word).
 *
 * Recursive definition:
 *   t(0) = 0
 *   t(2n) = t(n)
 *   t(2n + 1) = 1 - t(n)
 *
 * First values: 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, ...
 */

const memo = new Map();

/**
 * Compute the n-th bit of the Thue-Morse sequence (recursive, memoized).
 * @param {number} n - Non-negative integer index
 * @returns {0 | 1}
 */
export function thueMorse(n) {
  if (n < 0) throw new Error(`thueMorse(n): n must be >= 0, got ${n}`);
  if (memo.has(n)) return memo.get(n);

  let res;
  if (n === 0) {
    res = 0;
  } else if (n % 2 === 0) {
    res = thueMorse(n / 2);
  } else {
    res = 1 - thueMorse((n - 1) / 2);
  }
  memo.set(n, res);
  return res;
}

/**
 * Generate `length` values of the Thue-Morse sequence starting at `offset`.
 * @param {number} length
 * @param {number} [offset=0]
 * @returns {(0|1)[]}
 */
export function thueMorseSequence(length, offset = 0) {
  const start = Math.max(0, Math.round(offset) || 0);
  const seq = [];
  for (let i = 0; i < length; i++) {
    seq.push(thueMorse(start + i));
  }
  return seq;
}

/**
 * Derive relaxing, leap-limited scale degrees from the Thue-Morse bits.
 * Bit 1 steps gently up, bit 0 steps gently down, folded inside [-maxRange, +maxRange].
 */
export function thueMorseDegrees(length, offset = 0, stepSize = 1, maxRange = 5) {
  const bits = thueMorseSequence(length, offset);
  const degrees = [];
  let cur = 0;
  for (let i = 0; i < bits.length; i++) {
    const dir = bits[i] === 1 ? stepSize : -stepSize;
    let next = cur + dir;
    if (next > maxRange || next < -maxRange) {
      next = cur - dir;
    }
    degrees.push(next);
    cur = next;
  }
  return { bits, degrees };
}

export function clearThueMorseCache() {
  memo.clear();
}
