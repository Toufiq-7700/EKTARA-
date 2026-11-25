/**
 * Tower of Hanoi — Recursive Move Generator
 * 
 * The classic recursive puzzle: move n discs from one peg to another,
 * using a third peg as temporary storage. Only one disc moves at a time,
 * and a larger disc can never sit on a smaller one.
 * 
 * Recursive definition:
 *   hanoi(n, from, to, via):
 *     1. Move n-1 discs from `from` to `via` (using `to`)
 *     2. Move disc n from `from` to `to`
 *     3. Move n-1 discs from `via` to `to` (using `from`)
 * 
 * Musical mapping:
 *   - Peg (A/B/C) → pitch (root / fifth / octave)
 *   - Disc size → note duration & register (big disc = slow low, small disc = fast high)
 *   - Total moves for n discs = 2^n - 1
 */

/**
 * Recursively generate all Hanoi moves as an array.
 * Each move includes the disc number (1 = smallest), source/target pegs,
 * and the step number for timing.
 * 
 * @param {number} n - Number of discs (1-based, disc n is the largest)
 * @param {string} from - Source peg label (default "A")
 * @param {string} to - Target peg label (default "C")
 * @param {string} via - Auxiliary peg label (default "B")
 * @returns {{disc: number, from: string, to: string, step: number}[]}
 */
export function hanoi(n, from = 'A', to = 'C', via = 'B') {
  const moves = [];
  let step = 0;

  function solve(discs, src, dst, aux) {
    if (discs === 0) return;

    // Step 1: Move n-1 smaller discs out of the way
    solve(discs - 1, src, aux, dst);

    // Step 2: Move the current disc
    moves.push({
      disc: discs,
      from: src,
      to: dst,
      step: step++
    });

    // Step 3: Move n-1 smaller discs onto the target
    solve(discs - 1, aux, dst, src);
  }

  solve(n, from, to, via);
  return moves;
}

/**
 * Returns the total number of moves for n discs: 2^n - 1.
 * @param {number} n 
 * @returns {number}
 */
export function hanoiMoveCount(n) {
  return (1 << n) - 1;
}
