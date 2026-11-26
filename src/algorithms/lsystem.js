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
  },
  'Koch Curve': {
    axiom: 'F',
    rules: {
      'F': 'F+F--F+F'
    },
    angle: 60,
    maxGen: 4,
    startAngle: 0,
    description: 'Recursive Koch snowflake curve subdividing each edge into four'
  },
  'Sierpinski Triangle': {
    axiom: 'XF',
    rules: {
      'X': 'YF+XF+Y',
      'Y': 'XF-YF-X'
    },
    angle: 60,
    maxGen: 5,
    startAngle: -30,
    description: 'Sierpinski arrowhead curve recursively tessellating a triangle'
  }
};

export const ALLOWED_LSYSTEM_SYMBOLS = new Set(['F', '+', '-', '[', ']', 'X', 'Y']);
export const MAX_LSYSTEM_CHARS = 60000;
export const MAX_COMMANDS = 12000;

/**
 * Validate an L-system axiom and production rules.
 * Only symbols F, +, -, [, ], X, Y (and whitespace) are allowed.
 *
 * @param {string} axiom
 * @param {Object<string, string>} rules
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateLSystem(axiom, rules) {
  const errors = [];
  const cleanAxiom = typeof axiom === 'string' ? axiom.replace(/\s+/g, '') : '';
  if (!cleanAxiom) {
    errors.push('Axiom cannot be empty.');
  } else {
    for (const ch of cleanAxiom) {
      if (!ALLOWED_LSYSTEM_SYMBOLS.has(ch)) {
        errors.push(`Invalid symbol "${ch}" in axiom. Allowed: F, +, -, [, ], X, Y.`);
        break;
      }
    }
  }

  if (!rules || typeof rules !== 'object' || Object.keys(rules).length === 0) {
    errors.push('At least one production rule is required.');
  } else {
    for (const [lhs, rhs] of Object.entries(rules)) {
      if (!lhs || lhs.length !== 1 || !ALLOWED_LSYSTEM_SYMBOLS.has(lhs)) {
        errors.push(`Rule key "${lhs}" must be a single allowed symbol (F, X, Y, +, -, [, ]).`);
      }
      const cleanRhs = typeof rhs === 'string' ? rhs.replace(/\s+/g, '') : '';
      if (!cleanRhs) {
        errors.push(`Rule for "${lhs}" cannot be empty.`);
      } else {
        for (const ch of cleanRhs) {
          if (!ALLOWED_LSYSTEM_SYMBOLS.has(ch)) {
            errors.push(`Invalid symbol "${ch}" in rule ${lhs} → ${rhs}. Allowed: F, +, -, [, ], X, Y.`);
            break;
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Safely rewrite an L-system up to `generations`, capping string length at
 * `MAX_LSYSTEM_CHARS` so exponential rules never freeze the browser.
 */
export function lsystemSafe(axiom, rules, generations, maxChars = MAX_LSYSTEM_CHARS) {
  let current = (axiom || 'F').replace(/\s+/g, '');
  let capped = false;
  let actualGenerations = 0;

  for (let g = 0; g < generations; g++) {
    let next = '';
    for (const ch of current) {
      const rep = rules[ch] !== undefined ? rules[ch].replace(/\s+/g, '') : ch;
      if (next.length + rep.length > maxChars) {
        capped = true;
        break;
      }
      next += rep;
    }
    if (capped) break;
    current = next;
    actualGenerations = g + 1;
  }

  let commandCount = 0;
  for (const ch of current) {
    if (ch === 'F' || ch === '+' || ch === '-' || ch === '[' || ch === ']') {
      commandCount++;
    }
  }
  if (commandCount > MAX_COMMANDS) capped = true;

  return {
    result: current,
    capped,
    actualGenerations,
    estimatedCommands: Math.min(commandCount, MAX_COMMANDS),
    rawCommands: commandCount,
    warning: capped
      ? `Safety cap reached at generation ${actualGenerations} (${Math.min(commandCount, MAX_COMMANDS).toLocaleString()} commands max) to keep 60fps.`
      : null
  };
}

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
