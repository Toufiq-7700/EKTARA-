/**
 * Visual Renderer — Main Orchestrator
 *
 * Ties together all visual layers (tree, Hanoi, fireflies, atmosphere, X-ray)
 * and runs the animation loop synced to the audio clock.
 *
 * Uses requestAnimationFrame at 60fps, handles resize and devicePixelRatio,
 * uses O(1) cursor event scanning, and respects prefers-reduced-motion.
 */

import { getTheme } from './themes.js';
import { computeTreeBranches, drawTree, createFallingParticles, updateAndDrawParticles } from './tree.js';
import { createHanoiState, applyHanoiMove, updateHanoiAnimation, drawHanoi } from './hanoi.js';
import { createFireflyRing, triggerFirefly, updateFireflies, drawFireflies } from './fireflies.js';
import { createStars, drawSky, drawStars, drawVignette, drawMist, drawGround } from './atmosphere.js';
import { drawXRay } from './xray.js';
import {
  createRainState,
  setRainCanopyTargets,
  resizeRainState,
  setRainIntensityTarget,
  updateRain,
  drawRainLayer,
  drawRainEffects
} from './rain.js';
import { createPRNG } from '../algorithms/prng.js';

// ─── State ────────────────────────────────────────────────────────

let canvas, ctx;
let animFrameId = null;
let lastTime = 0;
let elapsedTime = 0;
let isRunning = false;

// Visual sub-states
let treeBranches = [];
let hanoiState = null;
let fireflyState = null;
let stars = [];
let particles = [];
let rainState = null;
let currentTheme = null;
let currentScore = null;
let activeEvents = [];
let xrayEnabled = false;
let reducedMotion = false;

// Growth & crossfade animation
let growthProgress = 0;
let sceneFade = 1;

// Zoom
let zoomLevel = 1;
let targetZoom = 1;

// Cursor-based event tracking (O(1) per frame)
let eventCursor = 0;
let lastAudioTime = 0;
let processedHanoiSteps = new Set();
let processedPercSteps = new Set();

// Audio time getter
let getAudioTimeFn = null;

/**
 * Shared layout builder used on init, score updates, and viewport resizes.
 */
function buildVisualLayout(score, resetGrowth = false) {
  if (!canvas || !score) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const treeX = w / 2;
  const groundY = h * 0.78;
  const treeHeight = Math.min(h * 0.48, w * 0.65);
  const depth = score.params?.depth || 4;
  const baseAngle = score.params?.branchAngle || 25;
  const rng = createPRNG(score.params?.seed || 42);

  stars = createStars(120, w, h, rng);

  treeBranches = computeTreeBranches(
    score.lsystemCommands,
    score.branchAngles,
    baseAngle,
    treeX,
    groundY,
    treeHeight,
    999
  );

  particles = createFallingParticles(treeBranches, 25, rng);

  if (!rainState) {
    rainState = createRainState(w, h, groundY, score.params?.seed || 42);
    setRainIntensityTarget(rainState, score.params?.rainIntensity ?? 0.35);
  } else {
    resizeRainState(rainState, w, h, groundY);
  }
  setRainCanopyTargets(rainState, treeBranches);

  const hanoiDepth = Math.min(depth, 6);
  hanoiState = createHanoiState(hanoiDepth);

  if (score.euclideanPattern) {
    fireflyState = createFireflyRing(
      score.euclideanPattern,
      treeX,
      groundY - treeHeight * 0.45,
      Math.min(w, h) * 0.25,
      rng
    );
  }

  eventCursor = 0;
  lastAudioTime = 0;
  processedHanoiSteps = new Set();
  processedPercSteps = new Set();
  if (resetGrowth) {
    growthProgress = 0;
  }
}

/**
 * Initialize the visual renderer.
 */
export function initVisuals(canvasEl, score, themeName = 'Dusk', getAudioTime) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  currentScore = score;
  currentTheme = getTheme(themeName);
  getAudioTimeFn = getAudioTime || (() => elapsedTime);
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  elapsedTime = 0;
  lastTime = 0;
  activeEvents = [];
  sceneFade = 0;
  buildVisualLayout(score, true);
}

/**
 * Start the animation loop.
 */
export function startVisuals() {
  if (isRunning) return;
  isRunning = true;
  lastTime = performance.now();
  animFrameId = requestAnimationFrame(animate);
}

/**
 * Stop the animation loop.
 */
export function stopVisuals() {
  isRunning = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

/**
 * Update the score and rebuild visuals smoothly (e.g., when depth or preset changes).
 */
export function updateScore(newScore, themeName) {
  if (themeName) {
    currentTheme = getTheme(themeName);
  }
  currentScore = newScore;
  activeEvents = [];
  sceneFade = 0.25; // smooth dip & fade back in
  buildVisualLayout(newScore, false);
  growthProgress = Math.max(0.35, growthProgress);
}

/**
 * Recompute layout positions cleanly when the viewport resizes.
 */
export function resizeVisuals() {
  if (currentScore) {
    buildVisualLayout(currentScore, false);
  }
}

/**
 * Set X-ray mode on/off.
 */
export function setXRay(enabled) {
  xrayEnabled = !!enabled;
}

/**
 * Set zoom level (0.5 = wide, >1 = zoomed into tree).
 */
export function setZoom(level) {
  targetZoom = Math.max(0.5, Math.min(4, level));
}

export function getZoom() {
  return targetZoom;
}

/**
 * Notify the renderer of an event (kept for external hooks; cursor sync handles score events).
 */
export function onVisualEvent(event) {
  if (!event || event.voice === '_loop') return;
  if (activeEvents.length > 32) {
    activeEvents.shift();
  }
}

/**
 * Set the theme.
 */
export function setTheme(themeName) {
  currentTheme = getTheme(themeName);
}

/**
 * Set target rain intensity (0 = off, 1 = downpour) smoothly.
 */
export function setVisualRainIntensity(intensity) {
  if (rainState) {
    setRainIntensityTarget(rainState, intensity);
  }
}

// ─── Main Animation Loop ─────────────────────────────────────────

function animate(now) {
  if (!isRunning) return;

  const rawDt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const motionDt = reducedMotion ? rawDt * 0.35 : rawDt;
  elapsedTime += motionDt;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const groundY = h * 0.78;
  const treeX = w / 2;

  const audioTime = getAudioTimeFn ? getAudioTimeFn() : elapsedTime;
  updateActiveEvents(audioTime);

  // Smooth wind value linked across rain slant and tree sway
  const windValue = Math.sin(elapsedTime * 0.22) * 0.55 + Math.cos(elapsedTime * 0.11) * 0.25 + 0.15;
  if (rainState) {
    updateRain(rainState, motionDt, windValue, reducedMotion);
  }
  const rainIntensity = rainState ? rainState.currentIntensity : 0;

  // Smooth zoom & crossfade
  zoomLevel += (targetZoom - zoomLevel) * Math.min(1, rawDt * 4);
  sceneFade = Math.min(1, sceneFade + rawDt * 1.8);
  growthProgress = Math.min(1, growthProgress + motionDt * 0.18);

  // ─── Draw everything ───────────────────────────────────

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Apply zoom (centered on tree)
  if (Math.abs(zoomLevel - 1) > 0.005) {
    ctx.translate(w / 2, groundY * 0.85);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-w / 2, -groundY * 0.85);
  }

  // Layer 0: Sky and atmosphere (darkens smoothly under heavy rain)
  drawSky(ctx, currentTheme, w, h, rainIntensity);
  drawStars(ctx, stars, currentTheme, elapsedTime, rainIntensity);
  drawMist(ctx, currentTheme, w, h, elapsedTime, groundY, rainIntensity);
  drawGround(ctx, currentTheme, w, h, groundY);

  // Far rain layer (behind tree & pillars)
  drawRainLayer(ctx, rainState, 0, currentTheme);

  ctx.save();
  ctx.globalAlpha = sceneFade;

  // Layer 1: Hanoi pillars and discs
  if (hanoiState) {
    updateHanoiAnimation(hanoiState, motionDt);
    drawHanoi(ctx, hanoiState, currentTheme, treeX, groundY + 5, 0.8);
  }

  // Mid rain layer (around tree)
  drawRainLayer(ctx, rainState, 1, currentTheme);

  // Layer 2: The L-system tree (hero)
  if (treeBranches.length > 0) {
    const visibleBranches = treeBranches.slice(
      0,
      Math.max(1, Math.floor(treeBranches.length * growthProgress))
    );
    const windPhase = elapsedTime * 0.5 + windValue * 0.6;
    drawTree(ctx, visibleBranches, currentTheme, activeEvents, elapsedTime, windPhase, reducedMotion);
    updateAndDrawParticles(ctx, particles, currentTheme, elapsedTime, groundY);
  }

  // Layer 3: Firefly ring
  if (fireflyState) {
    updateFireflies(fireflyState, motionDt, elapsedTime);
    drawFireflies(ctx, fireflyState, currentTheme);
  }

  // Near rain layer + ground splashes + canopy glints (foreground)
  drawRainLayer(ctx, rainState, 2, currentTheme);
  drawRainEffects(ctx, rainState, currentTheme);

  ctx.restore();

  // Reset transform for screen-space vignette and X-ray overlay
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawVignette(ctx, w, h);

  if (xrayEnabled) {
    drawXRay(ctx, activeEvents, currentTheme, w, h);
  }

  ctx.restore();

  animFrameId = requestAnimationFrame(animate);
}

/**
 * Advance through the sorted score events in O(1) amortized time per frame.
 */
function updateActiveEvents(audioTime) {
  if (!currentScore || !currentScore.events) return;

  // Handle loop wrap-around cleanly
  if (audioTime + 0.05 < lastAudioTime) {
    eventCursor = 0;
    processedHanoiSteps.clear();
    processedPercSteps.clear();
    if (currentScore.params) {
      hanoiState = createHanoiState(Math.min(currentScore.params.depth || 4, 6));
    }
  }
  lastAudioTime = audioTime;

  // Expire finished highlights
  activeEvents = activeEvents.filter(evt => elapsedTime - evt.arrivalTime < 1.6);

  const events = currentScore.events;
  while (eventCursor < events.length && events[eventCursor].time <= audioTime) {
    const event = events[eventCursor];
    eventCursor++;

    // Ignore stale events far in the past (e.g., after tab switch)
    if (audioTime - event.time > 0.5) continue;

    if (event.voice === 'bass' && event.meta?.algorithm === 'hanoi') {
      const stepKey = event.meta.step;
      if (!processedHanoiSteps.has(stepKey) && hanoiState) {
        processedHanoiSteps.add(stepKey);
        applyHanoiMove(hanoiState, {
          disc: event.meta.disc,
          from: event.meta.from,
          to: event.meta.to
        });
      }
    } else if (event.voice === 'percussion' && event.meta?.algorithm === 'bjorklund') {
      const percKey = `${event.time}-${event.meta.step}`;
      if (!processedPercSteps.has(percKey) && fireflyState) {
        processedPercSteps.add(percKey);
        triggerFirefly(fireflyState, event.meta.step);
      }
    }

    activeEvents.push({ ...event, arrivalTime: elapsedTime });
  }
}
