/**
 * L-System — Recursive String Rewriting
 * 
 * An L-system starts with an axiom string and applies rewriting rules
 * recursively for a number of generations. The final string is then
 * interpreted by turtle graphics to draw fractal plants and trees.
 * 
 * Recursive definition:
 *   lsystem(axiom, rules, 0) = axiom
 *   lsystem(axiom, rules, n) = apply rules to each character of lsystem(axiom, rules, n-1)
 * 
 * Example: axiom "F", rule F → "FF+[+F-F-F]-[-F+F+F]"
 *   Gen 0: "F"
 *   Gen 1: "FF+[+F-F-F]-[-F+F+F]"
 *   Gen 2: each F in gen 1 is replaced, producing a much longer string
 * 
 * Visual mapping: F = draw forward, + = turn right, - = turn left,
 *   [ = push position/angle, ] = pop position/angle
 * 
 * Musical mapping: generation depth controls texture density
 */

/**
 * Apply L-system rewriting rules recursively for `generations` iterations.
 * 
 * @param {string} axiom - The starting string
 * @param {Object<string, string>} rules - Rewriting rules (character → replacement)
 * @param {number} generations - How many times to apply the rules
 * @returns {string} The rewritten string after all generations
 */
export function lsystem(axiom, rules, generations) {
  // Base case: no more generations to apply
  if (generations <= 0) return axiom;

  // Apply rules to each character of the current string
  let next = '';
  for (const ch of axiom) {
    next += (rules[ch] !== undefined) ? rules[ch] : ch;
  }

  // Recurse with one fewer generation
  return lsystem(next, rules, generations - 1);
}

/**
 * Pre-defined L-system presets for organic-looking plants.
 * Each preset has an axiom, rules, and a suggested base angle (in degrees).
 */
export const LSYSTEM_PRESETS = {
  'Fern': {
    axiom: 'X',
    rules: {
      'X': 'F+[[X]-X]-F[-FX]+X',
      'F': 'FF'
    },
    angle: 25,
    maxGen: 5,
    description: 'A delicate fractal fern with curving fronds'
  },
  'Binary Tree': {
    axiom: 'F',
    rules: {
      'F': 'FF+[+F-F-F]-[-F+F+F]'
    },
    angle: 22.5,
    maxGen: 4,
    description: 'A symmetric branching tree'
  },
  'Wispy Bush': {
    axiom: 'F',
    rules: {
      'F': 'F[+F]F[-F][F]'
    },
    angle: 20,
    maxGen: 5,
    description: 'A wispy, asymmetric bush with many small branches'
  },
  'Canopy': {
    axiom: 'X',
    rules: {
      'X': 'F[+X][-X]FX',
      'F': 'FF'
    },
    angle: 30,
    maxGen: 5,
    description: 'A tall tree with a spreading canopy'
  }
};

const MAX_COMMANDS = 12000;

/**
 * Parse an L-system string into turtle graphics instructions.
 * Caps output to MAX_COMMANDS so extreme depth presets stay smooth at 60fps.
 * 
 * @param {string} str - The L-system output string
 * @returns {{type: string, value?: number}[]} Array of drawing commands
 */
export function parseLSystemToCommands(str) {
  const commands = [];
  for (const ch of str) {
    if (commands.length >= MAX_COMMANDS) break;
    switch (ch) {
      case 'F': commands.push({ type: 'forward' }); break;
      case 'f': commands.push({ type: 'forward_no_draw' }); break;
      case '+': commands.push({ type: 'right' }); break;
      case '-': commands.push({ type: 'left' }); break;
      case '[': commands.push({ type: 'push' }); break;
      case ']': commands.push({ type: 'pop' }); break;
      // X, other characters: skip (production variables)
    }
  }
  return commands;
}
