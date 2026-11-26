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
import {
  createEktaraStringState,
  triggerStringPluck,
  updateEktaraString,
  drawEktaraString
} from './ektaraString.js';
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
let externalTime = null;
let hoveredTarget = null;
let ektaraStringState = createEktaraStringState();
let getAudioLevelFn = null;

// Auto-Quality adaptive performance controller (keeps 60fps at depth 7)
let qualityMode = 'auto';        // 'auto' | 'high' | 'balanced' | 'lite'
let resolvedQuality = 'high';    // 'high' | 'balanced' | 'lite'
let avgFrameMs = 16.6;
let slowFrames = 0;
let fastFrames = 0;
let userRainIntensity = 0.35;
const visibleAlgorithms = {
  melody: true,
  bass: true,
  rhythm: true,
  tree: true,
  norgard: true,
  hanoi: true,
  bjorklund: true,
  lsystem: true
};

function isRoleVisible(role) {
  if (role === 'melody') return visibleAlgorithms.melody && visibleAlgorithms.norgard;
  if (role === 'bass') return visibleAlgorithms.bass && visibleAlgorithms.hanoi;
  if (role === 'rhythm') return visibleAlgorithms.rhythm && visibleAlgorithms.bjorklund;
  if (role === 'tree') return visibleAlgorithms.tree && visibleAlgorithms.lsystem;
  return true;
}

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
  const lCfg = score.lsystemConfig || score.params?.lsystem || {};
  const baseAngle = lCfg.turnAngle ?? score.params?.branchAngle ?? 25;
  const lengthRatio = lCfg.lengthRatio ?? 0.72;
  const leafDensity = lCfg.leafDensity ?? 0.7;
  const rng = createPRNG(score.params?.seed || 42);

  stars = createStars(120, w, h, rng);

  treeBranches = computeTreeBranches(
    score.lsystemCommands,
    score.branchAngles,
    baseAngle,
    treeX,
    groundY,
    treeHeight,
    999,
    lengthRatio,
    {
      startAngle: lCfg.startAngle ?? -90,
      centerToStart: !!lCfg.centerToStart
    }
  );

  const particleCount = Math.round(leafDensity * 36);
  particles = createFallingParticles(treeBranches, particleCount, rng);

  if (!rainState) {
    rainState = createRainState(w, h, groundY, score.params?.seed || 42);
    setRainIntensityTarget(rainState, score.params?.rainIntensity ?? 0.35);
  } else {
    resizeRainState(rainState, w, h, groundY);
  }
  setRainCanopyTargets(rainState, treeBranches);

  const hCfg = score.params?.hanoi || {};
  const hanoiDiscs = hCfg.discs ?? Math.min(depth, 6);
  hanoiState = createHanoiState(hanoiDiscs, hCfg.startPeg || 'A');

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

export function setAudioLevelGetter(fn) {
  getAudioLevelFn = typeof fn === 'function' ? fn : null;
}

export function pluckGardenString(normalizedPos = 0.5, noteLabel = '') {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  triggerStringPluck(ektaraStringState, normalizedPos, noteLabel, canvas.width / dpr, canvas.height / dpr);
}

/**
 * Set target rain intensity (0 = off, 1 = downpour) smoothly.
 */
export function setVisualRainIntensity(intensity) {
  userRainIntensity = Math.max(0, Math.min(1, Number(intensity) || 0));
  if (rainState) {
    const scale = resolvedQuality === 'lite' ? 0.35 : resolvedQuality === 'balanced' ? 0.65 : 1;
    setRainIntensityTarget(rainState, userRainIntensity * scale);
  }
}

export function setQualityMode(mode) {
  if (['auto', 'high', 'balanced', 'lite'].includes(mode)) {
    qualityMode = mode;
    if (mode !== 'auto') resolvedQuality = mode;
    else resolvedQuality = 'high';
    slowFrames = 0;
    fastFrames = 0;
    setVisualRainIntensity(userRainIntensity);
  }
}

export function getQualityStatus() {
  return { mode: qualityMode, active: resolvedQuality, avgFrameMs: Math.round(avgFrameMs) };
}

/**
 * Toggle visibility of an algorithm's visual layer in the Garden.
 */
export function setVisualAlgorithmEnabled(algorithmId, enabled) {
  visibleAlgorithms[algorithmId] = !!enabled;
}

/**
 * Override clock time (used when Lab Step Mode scrubs to a specific timestamp).
 */
export function setExternalVisualTime(timeOrNull) {
  externalTime = timeOrNull;
  if (timeOrNull !== null && currentScore) {
    // Recompute Hanoi disc state up to timeOrNull cleanly
    const hCfg = currentScore.params?.hanoi || {};
    const hanoiDiscs = hCfg.discs ?? Math.min(currentScore.params?.depth || 4, 6);
    hanoiState = createHanoiState(hanoiDiscs, hCfg.startPeg || 'A');
    processedHanoiSteps.clear();
    processedPercSteps.clear();
    eventCursor = 0;
    lastAudioTime = 0;
    activeEvents = [];
    for (const ev of currentScore.events) {
      if (ev.time > timeOrNull) break;
      if (ev.voice === 'bass' && ev.meta?.algorithm === 'hanoi' && !processedHanoiSteps.has(ev.meta.step)) {
        processedHanoiSteps.add(ev.meta.step);
        // Apply immediately without waiting for arc animation
        const fromPeg = hanoiState.pegs[ev.meta.from];
        const idx = fromPeg.indexOf(ev.meta.disc);
        if (idx !== -1) fromPeg.splice(idx, 1);
        hanoiState.pegs[ev.meta.to].push(ev.meta.disc);
      }
      if (timeOrNull - ev.time <= 1.2) {
        activeEvents.push({ ...ev, arrivalTime: elapsedTime });
        if (ev.voice === 'percussion' && fireflyState) {
          triggerFirefly(fireflyState, ev.meta.step);
        }
      }
    }
    growthProgress = 1;
  }
}

/**
 * Set linked-highlighting target from Lab or Garden hover.
 */
export function setHoveredTarget(target) {
  hoveredTarget = target || null;
}

/**
 * Hit-test Garden canvas coordinates (logical CSS pixels relative to canvas top-left)
 * for linked highlighting back to the Algorithm Lab.
 */
export function hitTestGarden(clientX, clientY) {
  if (!canvas || !currentScore) return null;
  const rect = canvas.getBoundingClientRect();
  let x = clientX - rect.left;
  let y = clientY - rect.top;
  const w = rect.width;
  const h = rect.height;
  const groundY = h * 0.78;
  const treeX = w / 2;

  // Invert zoom transform
  if (Math.abs(zoomLevel - 1) > 0.005) {
    x = (x - w / 2) / zoomLevel + w / 2;
    y = (y - groundY * 0.85) / zoomLevel + groundY * 0.85;
  }

  // 1. Fireflies (rhythm role)
  if (isRoleVisible('rhythm') && fireflyState) {
    for (let i = 0; i < fireflyState.fireflies.length; i++) {
      const ff = fireflyState.fireflies[i];
      const dx = x - ff.baseX;
      const dy = y - ff.baseY;
      if (dx * dx + dy * dy <= 196) {
        return { role: 'rhythm', algorithm: 'bjorklund', step: i };
      }
    }
  }

  // 2. Hanoi pillars/discs (bass role)
  if (isRoleVisible('bass') && hanoiState) {
    const scale = 0.8;
    const pegPositions = { A: -100, B: 0, C: 100 };
    const discHeight = 10 * scale;
    const maxDiscWidth = 50 * scale;
    for (const peg of ['A', 'B', 'C']) {
      const px = treeX + pegPositions[peg] * scale;
      const discs = hanoiState.pegs[peg];
      for (let i = 0; i < discs.length; i++) {
        const disc = discs[i];
        const dw = (disc / hanoiState.numDiscs) * maxDiscWidth;
        const dy = groundY + 5 - (i + 1) * discHeight;
        if (x >= px - dw - 4 && x <= px + dw + 4 && y >= dy - 4 && y <= dy + discHeight + 4) {
          return { role: 'bass', algorithm: 'hanoi', disc, peg };
        }
      }
    }
  }

  // 3. Tree branches (melody / tree role)
  if (isRoleVisible('tree') && treeBranches.length > 0) {
    let best = null;
    let bestDist = 100;
    const step = Math.max(1, Math.floor(treeBranches.length / 400));
    for (let i = 0; i < treeBranches.length; i += step) {
      const b = treeBranches[i];
      const mx = (b.x1 + b.x2) * 0.5;
      const my = (b.y1 + b.y2) * 0.5;
      const d2 = (x - mx) * (x - mx) + (y - my) * (y - my);
      if (d2 < bestDist) {
        bestDist = d2;
        best = b;
      }
    }
    if (best) {
      const activeMel = currentScore.roles?.melody || 'norgard';
      return {
        role: isRoleVisible('melody') ? 'melody' : 'tree',
        algorithm: isRoleVisible('melody') ? activeMel : (currentScore.roles?.tree || 'lsystem'),
        index: best.index
      };
    }
  }

  return null;
}

// ─── Main Animation Loop ─────────────────────────────────────────

function animate(now) {
  if (!isRunning) return;

  const rawFrameMs = now - lastTime;
  const rawDt = Math.min(rawFrameMs / 1000, 0.05);
  lastTime = now;
  const motionDt = reducedMotion ? rawDt * 0.35 : rawDt;
  elapsedTime += motionDt;

  // Auto quality fallback if frame times degrade (e.g., depth 7 on slower GPUs)
  if (rawFrameMs > 0 && rawFrameMs < 200) {
    avgFrameMs = avgFrameMs * 0.92 + rawFrameMs * 0.08;
    if (qualityMode === 'auto') {
      if (avgFrameMs > 24) {
        slowFrames++;
        fastFrames = 0;
        if (slowFrames > 45) {
          const next = resolvedQuality === 'high' ? 'balanced' : 'lite';
          if (next !== resolvedQuality) {
            resolvedQuality = next;
            setVisualRainIntensity(userRainIntensity);
          }
          slowFrames = 0;
        }
      } else if (avgFrameMs < 15.5) {
        fastFrames++;
        slowFrames = 0;
        if (fastFrames > 180 && resolvedQuality !== 'high') {
          resolvedQuality = resolvedQuality === 'lite' ? 'balanced' : 'high';
          setVisualRainIntensity(userRainIntensity);
          fastFrames = 0;
        }
      }
    }
  }

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const groundY = h * 0.78;
  const treeX = w / 2;

  const audioTime = externalTime !== null
    ? externalTime
    : (getAudioTimeFn ? getAudioTimeFn() : elapsedTime);
  if (externalTime === null) {
    updateActiveEvents(audioTime);
  }

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

  // Layer 1: Bass pillars and discs (Hanoi or pulse-pillars for Gray code / Cantor)
  if (isRoleVisible('bass') && hanoiState) {
    if (externalTime === null) {
      updateHanoiAnimation(hanoiState, motionDt);
    }
    const isBassHl = hoveredTarget && (hoveredTarget.role === 'bass' || hoveredTarget.algorithm === 'hanoi');
    const hanoiDisc = isBassHl ? (hoveredTarget.disc || 1) : null;
    drawHanoi(ctx, hanoiState, currentTheme, treeX, groundY + 5, 0.8, hanoiDisc);
  }

  // Mid rain layer (around tree)
  drawRainLayer(ctx, rainState, 1, currentTheme);

  // Layer 2: The L-system / Fractal tree (hero)
  if (isRoleVisible('tree') && treeBranches.length > 0) {
    const visibleCount = Math.max(1, Math.floor(treeBranches.length * growthProgress));
    const windPhase = elapsedTime * 0.5 + windValue * 0.6;
    const isMelOrTreeHl = hoveredTarget && (
      hoveredTarget.role === 'melody' ||
      hoveredTarget.role === 'tree' ||
      hoveredTarget.algorithm === 'norgard' ||
      hoveredTarget.algorithm === 'lsystem'
    );
    const branchHl = isMelOrTreeHl ? (hoveredTarget.index ?? 0) : null;
    const hlColor = (hoveredTarget?.role === 'tree' || hoveredTarget?.algorithm === 'lsystem')
      ? '#f078c8'
      : '#f0c878';
    const lCfg = currentScore?.lsystemConfig || currentScore?.params?.lsystem || {};
    const effLeafDensity = resolvedQuality === 'lite' ? 0 : (lCfg.leafDensity ?? 0.7);
    drawTree(ctx, treeBranches, currentTheme, activeEvents, elapsedTime, windPhase, reducedMotion, {
      glowEnabled: isRoleVisible('melody'),
      highlightedBranchIdx: branchHl,
      highlightColor: hlColor,
      lineThickness: lCfg.lineThickness ?? 6,
      leafDensity: effLeafDensity,
      shadowBlurGlow: resolvedQuality === 'high',
      visibleCount
    });
    if (resolvedQuality !== 'lite') {
      updateAndDrawParticles(ctx, particles, currentTheme, elapsedTime, groundY);
    }
  }

  // Layer 3: Firefly ring (rhythm role)
  if (isRoleVisible('rhythm') && fireflyState) {
    if (externalTime === null) {
      updateFireflies(fireflyState, motionDt, elapsedTime);
    }
    const isRhythmHl = hoveredTarget && (hoveredTarget.role === 'rhythm' || hoveredTarget.algorithm === 'bjorklund');
    const fireflyHl = isRhythmHl ? (hoveredTarget.step ?? 0) : null;
    drawFireflies(ctx, fireflyState, currentTheme, fireflyHl);
  }

  // Near rain layer + ground splashes + canopy glints (foreground)
  drawRainLayer(ctx, rainState, 2, currentTheme);
  drawRainEffects(ctx, rainState, currentTheme);

  // Layer 4: Playable virtual Ektara string (left edge / mobile bottom)
  updateEktaraString(ektaraStringState, motionDt, reducedMotion);
  const audioLevel = getAudioLevelFn ? getAudioLevelFn() : 0;
  drawEktaraString(ctx, ektaraStringState, w, h, elapsedTime, audioLevel, reducedMotion);

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
      const hCfg = currentScore.params.hanoi || {};
      hanoiState = createHanoiState(
        hCfg.discs ?? Math.min(currentScore.params.depth || 4, 6),
        hCfg.startPeg || 'A'
      );
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
    } else if (event.voice === 'bass' && hanoiState) {
      // Animate a subtle disc glide across pegs for Gray Code / Cantor Bass
      const stepKey = `alt-${event.time}-${event.meta?.index ?? 0}`;
      if (!processedHanoiSteps.has(stepKey)) {
        processedHanoiSteps.add(stepKey);
        const pegs = ['A', 'B', 'C'];
        const curPeg = pegs.find(p => hanoiState.pegs[p].length > 0) || 'A';
        const nextPeg = pegs[(pegs.indexOf(curPeg) + 1) % 3];
        const disc = hanoiState.pegs[curPeg][hanoiState.pegs[curPeg].length - 1] || 1;
        applyHanoiMove(hanoiState, { disc, from: curPeg, to: nextPeg });
      }
    } else if (event.voice === 'percussion' && fireflyState) {
      const stepNum = event.meta?.step ?? 0;
      const percKey = `${event.time}-${stepNum}`;
      if (!processedPercSteps.has(percKey)) {
        processedPercSteps.add(percKey);
        triggerFirefly(fireflyState, stepNum);
      }
    } else if (event.voice === 'drone' && canvas) {
      const dpr = window.devicePixelRatio || 1;
      triggerStringPluck(
        ektaraStringState,
        event.meta?.isFifth ? 0.58 : 0.15,
        event.note || '',
        canvas.width / dpr,
        canvas.height / dpr
      );
    }

    activeEvents.push({ ...event, arrivalTime: elapsedTime });
  }
}
