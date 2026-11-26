/**
 * Recursive Binary Reflected Gray Code
 *
 * Generates an ordering of all 2^n n-bit strings where consecutive values
 * differ by exactly one single bit flip.
 *
 * Recursive definition:
 *   grayCode(1) = ['0', '1']
 *   grayCode(n) = ['0' + x for x in grayCode(n-1)] + ['1' + x for x in reverse(grayCode(n-1))]
 *
 * For n = 3: ['000', '001', '011', '010', '110', '111', '101', '100']
 */

/**
 * Recursively generate n-bit reflected Gray code strings.
 * @param {number} bits - Number of bits (1 to 6)
 * @returns {string[]}
 */
export function grayCode(bits) {
  const n = Math.max(1, Math.min(6, Math.round(bits)));
  if (n === 1) return ['0', '1'];

  const prev = grayCode(n - 1);
  const firstHalf = prev.map(code => '0' + code);
  const secondHalf = prev.slice().reverse().map(code => '1' + code);
  return [...firstHalf, ...secondHalf];
}

/**
 * Compute all recursive levels 1..bits plus bit-flip transitions for Lab visualization.
 * @param {number} bits
 * @returns {{ levels: string[][], codes: string[], transitions: { index: number, code: string, value: number, flippedBit: number, onesCount: number }[] }}
 */
export function grayCodeTrace(bits) {
  const n = Math.max(1, Math.min(6, Math.round(bits)));
  const levels = [];
  for (let b = 1; b <= n; b++) {
    levels.push(grayCode(b));
  }
  const codes = levels[levels.length - 1];
  const transitions = codes.map((code, idx) => {
    const prev = idx === 0 ? codes[codes.length - 1] : codes[idx - 1];
    let flippedBit = 0;
    for (let i = 0; i < code.length; i++) {
      if (code[i] !== prev[i]) {
        flippedBit = code.length - 1 - i; // 0 = LSB, n-1 = MSB
        break;
      }
    }
    const onesCount = [...code].filter(c => c === '1').length;
    return {
      index: idx,
      code,
      value: parseInt(code, 2),
      flippedBit,
      onesCount
    };
  });
  return { levels, codes, transitions };
}
