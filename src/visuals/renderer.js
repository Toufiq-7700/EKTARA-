/**
 * Visual Renderer — Main Orchestrator
 * 
 * Ties together all visual layers (tree, Hanoi, fireflies, atmosphere, X-ray)
 * and runs the animation loop synced to the audio clock.
 * 
 * Uses requestAnimationFrame at 60fps, handles resize and devicePixelRatio.
 * Respects prefers-reduced-motion by slowing and softening animations.
 */

import { getTheme } from './themes.js';
import { computeTreeBranches, drawTree, createFallingParticles, updateAndDrawParticles } from './tree.js';
import { createHanoiState, applyHanoiMove, updateHanoiAnimation, drawHanoi } from './hanoi.js';
import { createFireflyRing, triggerFirefly, updateFireflies, drawFireflies } from './fireflies.js';
import { createStars, drawSky, drawStars, drawVignette, drawMist, drawGround } from './atmosphere.js';
import { drawXRay } from './xray.js';
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
let currentTheme = null;
let currentScore = null;
let activeEvents = [];
let xrayEnabled = false;
let reducedMotion = false;

// Growth animation
let growthProgress = 0; // 0 = no tree, 1 = fully grown
let targetGrowth = 1;

// Zoom
let zoomLevel = 1;
let targetZoom = 1;

// Track processed Hanoi events
let processedHanoiSteps = new Set();
let processedPercSteps = new Set();

// Audio time getter
let getAudioTimeFn = null;

/**
 * Initialize the visual renderer.
 * 
 * @param {HTMLCanvasElement} canvasEl - The canvas element
 * @param {Object} score - Score from buildScore()
 * @param {string} themeName - Theme name
 * @param {Function} getAudioTime - Function returning current audio time
 */
export function initVisuals(canvasEl, score, themeName = 'Dusk', getAudioTime) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  currentScore = score;
  currentTheme = getTheme(themeName);
  getAudioTimeFn = getAudioTime || (() => elapsedTime);

  // Check reduced motion preference
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  const rng = createPRNG(score.params?.seed || 42);

  // Initialize atmosphere
  stars = createStars(120, w, h, rng);

  // Initialize tree
  const treeX = w / 2;
  const groundY = h * 0.78;
  const treeHeight = h * 0.4;
  const depth = score.params?.depth || 4;
  const baseAngle = score.params?.branchAngle || 25;

  treeBranches = computeTreeBranches(
    score.lsystemCommands,
    score.branchAngles,
    baseAngle,
    treeX,
    groundY,
    treeHeight / (depth + 1),
    999
  );

  // Initialize falling particles
  particles = createFallingParticles(treeBranches, 25);

  // Initialize Hanoi
  const hanoiDepth = Math.min(depth, 6);
  hanoiState = createHanoiState(hanoiDepth);

  // Initialize firefly ring
  if (score.euclideanPattern) {
    fireflyState = createFireflyRing(
      score.euclideanPattern,
      treeX,
      groundY - treeHeight * 0.4,
      Math.min(w, h) * 0.25
    );
  }

  // Reset state
  processedHanoiSteps = new Set();
  processedPercSteps = new Set();
  growthProgress = 0;
  elapsedTime = 0;
  lastTime = 0;
  activeEvents = [];
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
 * Update the score and rebuild visuals (e.g., when depth changes).
 */
export function updateScore(newScore, themeName) {
  if (themeName) {
    currentTheme = getTheme(themeName);
  }
  currentScore = newScore;
  
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  const treeX = w / 2;
  const groundY = h * 0.78;
  const treeHeight = h * 0.4;
  const depth = newScore.params?.depth || 4;
  const baseAngle = newScore.params?.branchAngle || 25;

  treeBranches = computeTreeBranches(
    newScore.lsystemCommands,
    newScore.branchAngles,
    baseAngle,
    treeX,
    groundY,
    treeHeight / (depth + 1),
    999
  );

  particles = createFallingParticles(treeBranches, 25);

  const hanoiDepth = Math.min(depth, 6);
  hanoiState = createHanoiState(hanoiDepth);

  if (newScore.euclideanPattern) {
    fireflyState = createFireflyRing(
      newScore.euclideanPattern,
      treeX,
      groundY - treeHeight * 0.4,
      Math.min(w, h) * 0.25
    );
  }

  processedHanoiSteps = new Set();
  processedPercSteps = new Set();

  // Re-create stars with new seed
  const rng = createPRNG(newScore.params?.seed || 42);
  stars = createStars(120, w, h, rng);
}

/**
 * Set X-ray mode on/off.
 */
export function setXRay(enabled) {
  xrayEnabled = enabled;
}

/**
 * Set zoom level (1 = normal, >1 = zoomed into tree).
 */
export function setZoom(level) {
  targetZoom = Math.max(0.5, Math.min(4, level));
}

/**
 * Notify the renderer of a score event (called from audio engine).
 */
export function onVisualEvent(event) {
  activeEvents.push({ ...event, arrivalTime: elapsedTime });
}

/**
 * Set the theme.
 */
export function setTheme(themeName) {
  currentTheme = getTheme(themeName);
}

// ─── Main Animation Loop ─────────────────────────────────────────

function animate(now) {
  if (!isRunning) return;

  const dt = Math.min((now - lastTime) / 1000, 0.05); // cap delta
  lastTime = now;
  elapsedTime += dt;

  if (reducedMotion) {
    // Slow everything down for reduced motion
    elapsedTime += dt * 0.3 - dt; // effectively 0.3x speed
  }

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const groundY = h * 0.78;
  const treeX = w / 2;

  // Get audio time for syncing
  const audioTime = getAudioTimeFn ? getAudioTimeFn() : elapsedTime;

  // Update active events from score (look-ahead window)
  updateActiveEvents(audioTime);

  // Smooth zoom transition
  zoomLevel += (targetZoom - zoomLevel) * dt * 2;

  // Growth animation
  growthProgress = Math.min(1, growthProgress + dt * 0.15);

  // ─── Draw everything ───────────────────────────────────

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset to logical coords

  // Apply zoom (centered on tree)
  if (Math.abs(zoomLevel - 1) > 0.01) {
    ctx.translate(w / 2, groundY);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.translate(-w / 2, -groundY);
  }

  // Layer 0: Sky and atmosphere
  drawSky(ctx, currentTheme, w, h);
  drawStars(ctx, stars, currentTheme, elapsedTime);
  drawMist(ctx, currentTheme, w, h, elapsedTime);
  drawGround(ctx, currentTheme, w, h, groundY);

  // Layer 1: Hanoi pillars and discs
  if (hanoiState) {
    updateHanoiAnimation(hanoiState, dt);
    drawHanoi(ctx, hanoiState, currentTheme, treeX, groundY + 5, 0.8);
  }

  // Layer 2: The L-system tree (hero)
  if (treeBranches.length > 0) {
    const visibleBranches = treeBranches.slice(
      0, Math.floor(treeBranches.length * growthProgress)
    );
    const windPhase = elapsedTime * 0.5;
    drawTree(ctx, visibleBranches, currentTheme, activeEvents, elapsedTime, windPhase, reducedMotion);
    updateAndDrawParticles(ctx, particles, currentTheme, elapsedTime, groundY);
  }

  // Layer 3: Firefly ring
  if (fireflyState) {
    updateFireflies(fireflyState, dt, elapsedTime);
    drawFireflies(ctx, fireflyState, currentTheme);
  }

  // Vignette (on top of everything)
  drawVignette(ctx, w, h);

  // X-ray overlay
  if (xrayEnabled) {
    drawXRay(ctx, activeEvents, currentTheme, w, h);
  }

  ctx.restore();

  animFrameId = requestAnimationFrame(animate);
}

/**
 * Update which events are "active" (currently playing) based on audio time.
 */
function updateActiveEvents(audioTime) {
  if (!currentScore) return;

  // Clear old active events (keep events that are within their duration)
  activeEvents = activeEvents.filter(evt => {
    const age = elapsedTime - evt.arrivalTime;
    return age < 2.0; // keep for 2 seconds for visual fade
  });

  // Check score events that should trigger now
  for (const event of currentScore.events) {
    const eventTime = event.time;
    const timeDiff = audioTime - eventTime;

    // Trigger events within a small window
    if (timeDiff >= 0 && timeDiff < 0.1) {
      // Hanoi events
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
      }

      // Percussion events → firefly flashes
      if (event.voice === 'percussion' && event.meta?.algorithm === 'bjorklund') {
        const percKey = `${event.time}-${event.meta.step}`;
        if (!processedPercSteps.has(percKey) && fireflyState) {
          processedPercSteps.add(percKey);
          triggerFirefly(fireflyState, event.meta.step);
        }
      }

      // Add to active events for melody glow + X-ray
      if (!activeEvents.find(e => e.time === event.time && e.voice === event.voice)) {
        activeEvents.push({ ...event, arrivalTime: elapsedTime });
      }
    }
  }
}
