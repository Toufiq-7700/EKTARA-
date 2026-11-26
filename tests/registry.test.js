/**
 * Unit tests for all new recursive algorithm plugins, the algorithm registry,
 * and verifying every role/algorithm combination builds a valid score.
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import { thueMorse, thueMorseSequence, clearThueMorseCache } from '../src/algorithms/thueMorse.js';
import { fibonacciWord } from '../src/algorithms/fibonacciWord.js';
import { grayCode } from '../src/algorithms/grayCode.js';
import { cantorPattern } from '../src/algorithms/cantor.js';
import { ALGORITHM_REGISTRY, getAlgorithmPlugin, ROLES } from '../src/algorithms/registry.js';
import { buildScore } from '../src/algorithms/score.js';
import { MAX_SCORE_EVENTS } from '../src/algorithms/params.js';

describe('New Recursive Algorithms — Known Values', () => {
  it('Thue-Morse starts with 0, 1, 1, 0, 1, 0, 0, 1', () => {
    clearThueMorseCache();
    expect(thueMorseSequence(8)).toEqual([0, 1, 1, 0, 1, 0, 0, 1]);
    expect(thueMorse(0)).toBe(0);
    for (let n = 0; n < 16; n++) {
      expect(thueMorse(2 * n)).toBe(thueMorse(n));
      expect(thueMorse(2 * n + 1)).toBe(1 - thueMorse(n));
    }
  });

  it('Fibonacci word starts with 0100101001001 (S_5)', () => {
    expect(fibonacciWord(0)).toBe('0');
    expect(fibonacciWord(1)).toBe('01');
    expect(fibonacciWord(5)).toBe('0100101001001');
  });

  it('Recursive 3-bit Gray code generates all 8 single-bit-flip codes', () => {
    const g3 = grayCode(3);
    expect(g3).toEqual(['000', '001', '011', '010', '110', '111', '101', '100']);
    // Adjacent entries differ by exactly 1 bit
    for (let i = 0; i < g3.length; i++) {
      const a = g3[i];
      const b = g3[(i + 1) % g3.length];
      let diffs = 0;
      for (let bit = 0; bit < a.length; bit++) {
        if (a[bit] !== b[bit]) diffs++;
      }
      expect(diffs).toBe(1);
    }
  });

  it('Cantor pattern at depth 2 produces [1,0,1,0,0,0,1,0,1]', () => {
    const p2 = cantorPattern(2).map(v => (v ? 1 : 0));
    expect(p2).toEqual([1, 0, 1, 0, 0, 0, 1, 0, 1]);
  });
});

describe('Algorithm Plugin Registry & Full Role Combinations', () => {
  it('registers plugins for all four roles with uniform interface', () => {
    for (const role of ROLES) {
      const plugins = ALGORITHM_REGISTRY[role];
      expect(plugins.length).toBeGreaterThanOrEqual(3);
      for (const plugin of plugins) {
        expect(plugin.id).toBeTruthy();
        expect(plugin.role).toBe(role);
        expect(plugin.name).toBeTruthy();
        expect(plugin.description).toBeTruthy();
        expect(typeof plugin.generate).toBe('function');
        expect(typeof plugin.trace).toBe('function');
        expect(Array.isArray(plugin.paramSchema)).toBe(true);
      }
    }
  });

  it('every role/algorithm combination produces a valid, sorted, bounded score without throwing', () => {
    const melodies = ALGORITHM_REGISTRY.melody.map(p => p.id);
    const basses = ALGORITHM_REGISTRY.bass.map(p => p.id);
    const rhythms = ALGORITHM_REGISTRY.rhythm.map(p => p.id);
    const trees = ALGORITHM_REGISTRY.tree.map(p => p.id);

    for (const melody of melodies) {
      for (const bass of basses) {
        for (const rhythm of rhythms) {
          for (const tree of trees) {
            const score = buildScore({
              seed: 42,
              depth: 3,
              scale: 'pentatonic',
              roles: { melody, bass, rhythm, tree }
            });
            expect(score.roles).toEqual({ melody, bass, rhythm, tree });
            expect(score.events.length).toBeGreaterThan(0);
            expect(score.events.length).toBeLessThanOrEqual(MAX_SCORE_EVENTS);
            expect(score.lsystemCommands.length).toBeGreaterThan(0);
            for (let i = 1; i < score.events.length; i++) {
              expect(score.events[i].time).toBeGreaterThanOrEqual(score.events[i - 1].time);
            }
            // Verify plugin trace runs cleanly
            expect(getAlgorithmPlugin('melody', melody).trace({ params: score.params })).toBeTruthy();
            expect(getAlgorithmPlugin('bass', bass).trace({ params: score.params })).toBeTruthy();
            expect(getAlgorithmPlugin('rhythm', rhythm).trace({ params: score.params })).toBeTruthy();
            expect(getAlgorithmPlugin('tree', tree).trace({ params: score.params })).toBeTruthy();
          }
        }
      }
    }
  });
});
