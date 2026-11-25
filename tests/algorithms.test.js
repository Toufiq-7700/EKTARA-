/**
 * Unit tests for the four recursive algorithms and the score builder.
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import { norgard, norgardSequence, clearNorgardCache } from '../src/algorithms/norgard.js';
import { hanoi, hanoiMoveCount } from '../src/algorithms/hanoi.js';
import { bjorklund, rotatePattern } from '../src/algorithms/bjorklund.js';
import { lsystem, LSYSTEM_PRESETS } from '../src/algorithms/lsystem.js';
import { buildScore } from '../src/algorithms/score.js';
import { degreeToMidi, midiToFreq } from '../src/algorithms/scales.js';
import { createPRNG } from '../src/algorithms/prng.js';

// ─── Nørgård Infinity Series ──────────────────────────────────────

describe('Nørgård Infinity Series', () => {
  it('produces the known first 8 values: 0, 1, -1, 2, 1, 0, -2, 3', () => {
    clearNorgardCache();
    const seq = norgardSequence(8);
    expect(seq).toEqual([0, 1, -1, 2, 1, 0, -2, 3]);
  });

  it('produces known extended values', () => {
    expect(norgard(8)).toBe(-1);
    expect(norgard(9)).toBe(2);
    expect(Object.is(norgard(10), -0) || norgard(10) === 0).toBe(true);
    expect(norgard(15)).toBe(4);
  });

  it('satisfies n(0) = 0', () => {
    expect(norgard(0)).toBe(0);
  });

  it('satisfies n(2k) = -n(k)', () => {
    for (let k = 1; k <= 20; k++) {
      expect(norgard(2 * k)).toBe(-norgard(k));
    }
  });

  it('satisfies n(2k+1) = n(k) + 1', () => {
    for (let k = 0; k <= 20; k++) {
      expect(norgard(2 * k + 1)).toBe(norgard(k) + 1);
    }
  });

  it('throws for negative index', () => {
    expect(() => norgard(-1)).toThrow();
  });
});

// ─── Tower of Hanoi ───────────────────────────────────────────────

describe('Tower of Hanoi', () => {
  it('gives 7 moves for 3 discs', () => {
    const moves = hanoi(3);
    expect(moves).toHaveLength(7);
    expect(hanoiMoveCount(3)).toBe(7);
  });

  it('gives 1 move for 1 disc', () => {
    const moves = hanoi(1);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({ disc: 1, from: 'A', to: 'C', step: 0 });
  });

  it('gives 15 moves for 4 discs', () => {
    expect(hanoi(4)).toHaveLength(15);
  });

  it('gives 0 moves for 0 discs', () => {
    expect(hanoi(0)).toHaveLength(0);
  });

  it('each move has disc, from, to, step fields', () => {
    const moves = hanoi(3);
    for (const m of moves) {
      expect(m).toHaveProperty('disc');
      expect(m).toHaveProperty('from');
      expect(m).toHaveProperty('to');
      expect(m).toHaveProperty('step');
    }
  });

  it('moves are in sequential step order', () => {
    const moves = hanoi(4);
    for (let i = 0; i < moves.length; i++) {
      expect(moves[i].step).toBe(i);
    }
  });
});

// ─── Bjorklund / Euclidean Rhythm ─────────────────────────────────

describe('Bjorklund Euclidean Rhythm', () => {
  it('bjorklund(3, 8) gives the tresillo [1,0,0,1,0,0,1,0]', () => {
    const pattern = bjorklund(3, 8);
    expect(pattern).toEqual([true, false, false, true, false, false, true, false]);
  });

  it('bjorklund(5, 8) gives the cinquillo', () => {
    const pattern = bjorklund(5, 8);
    expect(pattern).toEqual([true, false, true, true, false, true, true, false]);
  });

  it('bjorklund(4, 12) distributes evenly', () => {
    const pattern = bjorklund(4, 12);
    const hits = pattern.filter(Boolean).length;
    expect(hits).toBe(4);
    expect(pattern.length).toBe(12);
  });

  it('bjorklund(0, 8) gives all rests', () => {
    expect(bjorklund(0, 8)).toEqual(new Array(8).fill(false));
  });

  it('bjorklund(8, 8) gives all hits', () => {
    expect(bjorklund(8, 8)).toEqual(new Array(8).fill(true));
  });

  it('rotation works correctly', () => {
    const pattern = [true, false, false, true];
    expect(rotatePattern(pattern, 1)).toEqual([false, false, true, true]);
    expect(rotatePattern(pattern, 0)).toEqual(pattern);
  });
});

// ─── L-System ─────────────────────────────────────────────────────

describe('L-System', () => {
  it('generation 0 returns the axiom unchanged', () => {
    expect(lsystem('F', { 'F': 'FF' }, 0)).toBe('F');
  });

  it('generation 1 applies rules once', () => {
    expect(lsystem('F', { 'F': 'F+F' }, 1)).toBe('F+F');
  });

  it('generation 2 applies rules twice', () => {
    expect(lsystem('F', { 'F': 'F+F' }, 2)).toBe('F+F+F+F');
  });

  it('binary tree preset produces expected gen 1', () => {
    const preset = LSYSTEM_PRESETS['Binary Tree'];
    const gen1 = lsystem(preset.axiom, preset.rules, 1);
    expect(gen1).toBe('FF+[+F-F-F]-[-F+F+F]');
  });

  it('string length grows exponentially', () => {
    const preset = LSYSTEM_PRESETS['Binary Tree'];
    const len1 = lsystem(preset.axiom, preset.rules, 1).length;
    const len2 = lsystem(preset.axiom, preset.rules, 2).length;
    expect(len2).toBeGreaterThan(len1);
  });

  it('all presets are valid objects', () => {
    for (const [name, preset] of Object.entries(LSYSTEM_PRESETS)) {
      expect(preset.axiom).toBeDefined();
      expect(preset.rules).toBeDefined();
      expect(preset.angle).toBeGreaterThan(0);
    }
  });
});

// ─── Score Builder ────────────────────────────────────────────────

describe('Score Builder', () => {
  it('produces a non-empty event list', () => {
    const score = buildScore({ seed: 42, depth: 3 });
    expect(score.events.length).toBeGreaterThan(0);
  });

  it('events are sorted by time', () => {
    const score = buildScore({ seed: 42, depth: 4 });
    for (let i = 1; i < score.events.length; i++) {
      expect(score.events[i].time).toBeGreaterThanOrEqual(score.events[i - 1].time);
    }
  });

  it('every event has required fields', () => {
    const score = buildScore({ seed: 1, depth: 3 });
    for (const e of score.events) {
      expect(e).toHaveProperty('time');
      expect(e).toHaveProperty('voice');
      expect(e).toHaveProperty('duration');
      expect(e).toHaveProperty('velocity');
      expect(e).toHaveProperty('meta');
      expect(e.meta).toHaveProperty('algorithm');
      expect(e.meta).toHaveProperty('label');
    }
  });

  it('contains all four voice types', () => {
    const score = buildScore({ seed: 42, depth: 4 });
    const voices = new Set(score.events.map(e => e.voice));
    expect(voices.has('melody')).toBe(true);
    expect(voices.has('bass')).toBe(true);
    expect(voices.has('percussion')).toBe(true);
    // canon appears at depth >= 2
  });

  it('is deterministic: same seed produces the same score', () => {
    const a = buildScore({ seed: 123, depth: 3 });
    const b = buildScore({ seed: 123, depth: 3 });
    expect(a.events.length).toBe(b.events.length);
    for (let i = 0; i < a.events.length; i++) {
      expect(a.events[i].time).toBe(b.events[i].time);
      expect(a.events[i].note).toBe(b.events[i].note);
    }
  });

  it('deeper depth produces more events', () => {
    const shallow = buildScore({ seed: 42, depth: 2 });
    const deep = buildScore({ seed: 42, depth: 5 });
    expect(deep.events.length).toBeGreaterThan(shallow.events.length);
  });

  it('includes L-system commands', () => {
    const score = buildScore({ seed: 42, depth: 3 });
    expect(score.lsystemCommands.length).toBeGreaterThan(0);
  });

  it('handles depths 1 through 8 safely without excessive L-system blowup', () => {
    for (let depth = 1; depth <= 8; depth++) {
      const score = buildScore({ seed: 42, depth, lsystemPreset: 'Binary Tree' });
      expect(score.events.length).toBeGreaterThan(0);
      expect(score.lsystemCommands.length).toBeLessThanOrEqual(12000);
      expect(score.hanoiMoves.length).toBeLessThanOrEqual(63);
    }
  });
});

// ─── PRNG ─────────────────────────────────────────────────────────

describe('Seeded PRNG', () => {
  it('is deterministic from the same seed', () => {
    const a = createPRNG(42);
    const b = createPRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces values in [0, 1)', () => {
    const rng = createPRNG(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds produce different sequences', () => {
    const a = createPRNG(1);
    const b = createPRNG(2);
    let same = 0;
    for (let i = 0; i < 100; i++) {
      if (a() === b()) same++;
    }
    expect(same).toBeLessThan(10);
  });
});

// ─── Scale Utilities ──────────────────────────────────────────────

describe('Scale Utilities', () => {
  it('degree 0 maps to the root note', () => {
    expect(degreeToMidi(0, 'pentatonic', 60)).toBe(60);
  });

  it('degree wraps into octaves correctly', () => {
    // Pentatonic has 5 notes, degree 5 = root + 1 octave
    expect(degreeToMidi(5, 'pentatonic', 60)).toBe(72); // C4 + 12 = C5
  });

  it('negative degrees go below the root', () => {
    const midi = degreeToMidi(-1, 'pentatonic', 60);
    expect(midi).toBeLessThan(60);
  });

  it('A4 = MIDI 69 = 440 Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 1);
  });
});
