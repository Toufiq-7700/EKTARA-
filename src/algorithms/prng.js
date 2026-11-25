/**
 * Seeded Pseudo-Random Number Generator (Mulberry32)
 * 
 * Ensures all randomness in Recursive Garden is deterministic
 * from a single seed value. Never use Math.random().
 * 
 * @param {number} seed - Integer seed value
 * @returns {function} A function that returns the next random number in [0, 1)
 */
export function createPRNG(seed) {
  let s = seed | 0;
  return function() {
    s |= 0;
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
