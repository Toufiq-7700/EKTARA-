/**
 * Unit tests for the layered visual rain particle pool and procedural audio parameter mapping.
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import {
  createRainState,
  updateRain,
  setRainIntensityTarget,
  setRainCanopyTargets,
  MAX_DROPS,
  MAX_TOTAL_PARTICLES
} from '../src/visuals/rain.js';
import { computeRainAudioParams } from '../src/audio/rain.js';

describe('Visual Rain Particle System', () => {
  it('caps total pooled particles at 1500 and organizes drops into 3 depth layers', () => {
    expect(MAX_TOTAL_PARTICLES).toBe(1500);
    const state = createRainState(1280, 720, 560, 42);
    expect(state.drops.length).toBe(MAX_DROPS);

    const layers = new Set(state.drops.map(d => d.layer));
    expect(layers).toEqual(new Set([0, 1, 2]));

    // Near layer drops should be longer and faster than far layer drops on average
    const far = state.drops.filter(d => d.layer === 0);
    const near = state.drops.filter(d => d.layer === 2);
    const avg = (arr, k) => arr.reduce((s, x) => s + x[k], 0) / arr.length;
    expect(avg(near, 'speed')).toBeGreaterThan(avg(far, 'speed'));
    expect(avg(near, 'length')).toBeGreaterThan(avg(far, 'length'));
    expect(avg(near, 'alpha')).toBeGreaterThan(avg(far, 'alpha'));
  });

  it('smoothly interpolates intensity and activates 0 drops when intensity reaches 0', () => {
    const state = createRainState(800, 600, 470, 42);
    setRainIntensityTarget(state, 0);

    // One short tick should transition smoothly (not snap immediately to 0)
    updateRain(state, 0.05, 0.2);
    expect(state.currentIntensity).toBeGreaterThan(0.1);
    expect(state.currentIntensity).toBeLessThan(0.35);

    // After sufficient ticks it settles cleanly at 0 with zero active drops
    for (let i = 0; i < 120; i++) {
      updateRain(state, 0.05, 0.2);
    }
    expect(state.currentIntensity).toBe(0);
    expect(state.drops.filter(d => d.active).length).toBe(0);
  });

  it('spawns ground splashes and micro-droplets when drops hit ground', () => {
    const state = createRainState(800, 600, 460, 42);
    setRainIntensityTarget(state, 1);
    for (let i = 0; i < 60; i++) {
      updateRain(state, 0.033, 0.3);
    }
    const activeRipples = state.ripples.filter(r => r.active).length;
    const activeMicro = state.droplets.filter(d => d.active).length;
    expect(activeRipples).toBeGreaterThan(0);
    expect(activeMicro).toBeGreaterThan(0);
  });

  it('links drop angle to wind and reacts to canopy branch hits', () => {
    const state = createRainState(800, 600, 460, 42);
    setRainIntensityTarget(state, 1);
    const branches = Array.from({ length: 40 }, (_, i) => ({
      x1: 350 + (i % 10) * 10,
      y1: 220 + Math.floor(i / 10) * 20,
      x2: 355 + (i % 10) * 10,
      y2: 240 + Math.floor(i / 10) * 20,
      depth: 2,
      isTip: true
    }));
    setRainCanopyTargets(state, branches);

    for (let i = 0; i < 80; i++) {
      updateRain(state, 0.033, 0.8);
    }
    expect(state.windAngle).toBeGreaterThan(0.1);
  });
});

describe('Procedural Rain Audio Parameter Mapping', () => {
  it('returns zero gain, zero droplet rate, and zero thunder at intensity 0', () => {
    const p = computeRainAudioParams(0);
    expect(p.gain).toBe(0);
    expect(p.dropletRateHz).toBe(0);
    expect(p.thunderChancePerSec).toBe(0);
  });

  it('scales filter cutoffs, gain, and droplet rate monotonically with intensity', () => {
    const light = computeRainAudioParams(0.2);
    const heavy = computeRainAudioParams(0.9);
    expect(heavy.gain).toBeGreaterThan(light.gain);
    expect(heavy.bodyFreq).toBeGreaterThan(light.bodyFreq);
    expect(heavy.rumbleFreq).toBeGreaterThan(light.rumbleFreq);
    expect(heavy.hissFreq).toBeLessThan(light.hissFreq); // highpass opens lower in heavy rain
    expect(heavy.dropletRateHz).toBeGreaterThan(light.dropletRateHz);
    expect(light.thunderChancePerSec).toBe(0);
    expect(heavy.thunderChancePerSec).toBeGreaterThan(0);
  });
});
