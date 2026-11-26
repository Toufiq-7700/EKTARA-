/**
 * Fibonacci Word — Recursive Substitution Sequence
 *
 * Builds an aperiodic, self-similar binary word by concatenating the two
 * previous generations:
 *   S_0 = "0"
 *   S_1 = "01"
 *   S_n = S_{n-1} + S_{n-2}
 *
 * Examples:
 *   S_2 = "010"
 *   S_3 = "01001"
 *   S_4 = "01001010"
 *   S_5 = "0100101001001"
 */

/**
 * Recursively compute the n-th Fibonacci word, capped cleanly at maxChars.
 * @param {number} n - Non-negative generation index
 * @param {number} [maxChars=4096]
 * @returns {string}
 */
export function fibonacciWord(n, maxChars = 4096) {
  if (n < 0) throw new Error(`fibonacciWord(n): n must be >= 0, got ${n}`);
  if (n === 0) return '0';
  if (n === 1) return '01';

  let a = '0';
  let b = '01';
  for (let i = 2; i <= n; i++) {
    const next = b + a;
    if (next.length > maxChars) {
      return next.slice(0, maxChars);
    }
    a = b;
    b = next;
  }
  return b;
}

/**
 * Return every generation S_0 .. S_n for step-by-step Lab visualization.
 * @param {number} n
 * @param {number} [maxChars=1024]
 * @returns {string[]}
 */
export function fibonacciWordSteps(n, maxChars = 1024) {
  const steps = ['0'];
  if (n <= 0) return steps;
  steps.push('01');
  if (n === 1) return steps;

  for (let i = 2; i <= n; i++) {
    const next = steps[i - 1] + steps[i - 2];
    steps.push(next.length > maxChars ? next.slice(0, maxChars) : next);
  }
  return steps;
}
