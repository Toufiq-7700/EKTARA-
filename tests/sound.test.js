/**
 * Unit tests for procedural sound design humanisation & timbre options.
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import { createPRNG } from '../src/algorithms/prng.js';
import { humaniseEvent, TIMBRE_OPTIONS, DEFAULT_TIMBRES } from '../src/audio/instruments.js';
import { buildScore } from '../src/algorithms/score.js';

describe('Sound Design — Timbres & Seeded Humanisation', () => {
  it('provides all 4 requested melody timbres plus per-layer timbre dropdown options', () => {
    expect(TIMBRE_OPTIONS.melody).toEqual([
      'Glass Bell',
      'Music Box',
      'Kalimba',
      'Singing Bowl'
    ]);
    for (const layer of ['melody', 'canon', 'bass', 'percussion', 'ambient']) {
      expect(TIMBRE_OPTIONS[layer].length).toBeGreaterThanOrEqual(3);
      expect(TIMBRE_OPTIONS[layer]).toContain(DEFAULT_TIMBRES[layer]);
    }
  });

  it('humanises timing (+/- 10-25ms), velocity (+/- 10%), duration, and pitch drift deterministically', () => {
    const baseEvent = {
      time: 2.0,
      voice: 'melody',
      note: 'C4',
      frequency: 261.63,
      duration: 0.8,
      velocity: 0.5
    };

    const a = humaniseEvent(baseEvent, createPRNG(42));
    const b = humaniseEvent(baseEvent, createPRNG(42));
    expect(a).toEqual(b);

    const timeDiff = Math.abs(a.time - baseEvent.time);
    expect(timeDiff).toBeGreaterThanOrEqual(0.01);
    expect(timeDiff).toBeLessThanOrEqual(0.025);

    expect(a.velocity).toBeGreaterThanOrEqual(baseEvent.velocity * 0.9 - 1e-6);
    expect(a.velocity).toBeLessThanOrEqual(baseEvent.velocity * 1.1 + 1e-6);

    expect(a.duration).toBeGreaterThanOrEqual(baseEvent.duration * 0.88 - 1e-6);
    expect(a.duration).toBeLessThanOrEqual(baseEvent.duration * 1.12 + 1e-6);

    expect(Math.abs(a.driftCents)).toBeLessThanOrEqual(7);
  });

  it('clamps humanised timing >= 0 for events near t=0', () => {
    const early = { time: 0.0, voice: 'percussion', velocity: 0.15, duration: 0.1 };
    const rng = createPRNG(7);
    for (let i = 0; i < 20; i++) {
      const h = humaniseEvent(early, rng);
      expect(h.time).toBeGreaterThanOrEqual(0);
    }
  });

  it('generates soft deterministic Ektara drone events anchored on root/fifth with gentle pitch bends', () => {
    const score = buildScore({ seed: 42, depth: 4, rootNote: 60 });
    const droneEvents = score.events.filter(e => e.voice === 'drone');
    expect(droneEvents.length).toBeGreaterThanOrEqual(2);
    for (const ev of droneEvents) {
      expect([48, 55]).toContain(ev.midi);
      expect(ev.velocity).toBeLessThanOrEqual(0.4);
      expect(ev.meta.bendCents === 0 || (ev.meta.bendCents >= 20 && ev.meta.bendCents <= 40)).toBe(true);
    }
  });
});
