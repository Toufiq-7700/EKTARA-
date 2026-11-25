/**
 * Layered Canvas 2D Rain Particle System
 *
 * Renders realistic rainfall using object-pooled particles capped at 1500 total:
 *   - 3 depth layers (far = 0, mid = 1, near = 2) with parallax length, speed, alpha, and blur
 *   - Slanted fall angle driven by current wind strength
 *   - Ground splashes: tiny expanding ripple rings + 2-3 arcing micro-droplets
 *   - Canopy hits: small glints on branches/leaves + subtle leaf dip impulse
 *   - Smooth intensity interpolation (0 = off, 1 = downpour)
 *   - 100% deterministic via seeded PRNG (no Math.random)
 */

import { createPRNG } from '../algorithms/prng.js';

export const MAX_DROPS = 900;
export const MAX_RIPPLES = 180;
export const MAX_MICRO_DROPLETS = 360;
export const MAX_GLINTS = 60;
// Total pooled objects = 900 + 180 + 360 + 60 = 1500
export const MAX_TOTAL_PARTICLES = MAX_DROPS + MAX_RIPPLES + MAX_MICRO_DROPLETS + MAX_GLINTS;

// Layer configs: far (0), mid (1), near (2)
const LAYER_CONFIGS = [
  {
    name: 'far',
    share: 0.35,        // ~315 drops max
    speedMin: 270,
    speedMax: 350,
    lenMin: 7,
    lenMax: 12,
    width: 0.65,
    alphaMin: 0.12,
    alphaMax: 0.24,
    splashChance: 0.15,
    splashScale: 0.6,
    blurWidth: 0
  },
  {
    name: 'mid',
    share: 0.40,        // ~360 drops max
    speedMin: 470,
    speedMax: 590,
    lenMin: 14,
    lenMax: 23,
    width: 1.0,
    alphaMin: 0.26,
    alphaMax: 0.42,
    splashChance: 0.45,
    splashScale: 1.0,
    blurWidth: 0
  },
  {
    name: 'near',
    share: 0.25,        // ~225 drops max
    speedMin: 730,
    speedMax: 920,
    lenMin: 24,
    lenMax: 38,
    width: 1.35,
    alphaMin: 0.46,
    alphaMax: 0.68,
    splashChance: 0.85,
    splashScale: 1.55,
    blurWidth: 3.4      // soft outer streak for depth-of-field feel
  }
];

/**
 * Create a pooled rain simulation state.
 * @param {number} width - Logical canvas width
 * @param {number} height - Logical canvas height
 * @param {number} groundY - Y coordinate of the ground line
 * @param {number} [seed=42] - Seed for deterministic PRNG
 * @returns {Object} Pooled rain state
 */
export function createRainState(width, height, groundY, seed = 42) {
  const rng = createPRNG(seed + 7919);

  // Pre-allocate drop pool
  const drops = new Array(MAX_DROPS);
  const farCutoff = Math.floor(MAX_DROPS * LAYER_CONFIGS[0].share);
  const midCutoff = farCutoff + Math.floor(MAX_DROPS * LAYER_CONFIGS[1].share);

  for (let i = 0; i < MAX_DROPS; i++) {
    const layer = i < farCutoff ? 0 : i < midCutoff ? 1 : 2;
    const cfg = LAYER_CONFIGS[layer];
    const d = {
      active: false,
      layer,
      x: 0,
      y: 0,
      speed: cfg.speedMin + rng() * (cfg.speedMax - cfg.speedMin),
      length: cfg.lenMin + rng() * (cfg.lenMax - cfg.lenMin),
      alpha: cfg.alphaMin + rng() * (cfg.alphaMax - cfg.alphaMin),
      groundOffset: (layer === 2 ? 10 : layer === 1 ? 4 : -4) + (rng() - 0.5) * 10
    };
    resetDrop(d, width, groundY, rng, true);
    drops[i] = d;
  }

  // Pre-allocate ground ripple pool
  const ripples = new Array(MAX_RIPPLES);
  for (let i = 0; i < MAX_RIPPLES; i++) {
    ripples[i] = { active: false, x: 0, y: 0, radius: 0, maxRadius: 8, alpha: 0, age: 0, life: 0.4 };
  }

  // Pre-allocate splash micro-droplet pool
  const droplets = new Array(MAX_MICRO_DROPLETS);
  for (let i = 0; i < MAX_MICRO_DROPLETS; i++) {
    droplets[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, alpha: 0, size: 1, age: 0, life: 0.3 };
  }

  // Pre-allocate leaf/branch glint pool
  const glints = new Array(MAX_GLINTS);
  for (let i = 0; i < MAX_GLINTS; i++) {
    glints[i] = { active: false, x: 0, y: 0, size: 2, alpha: 0, age: 0, life: 0.25 };
  }

  return {
    width,
    height,
    groundY,
    rng,
    drops,
    ripples,
    droplets,
    glints,
    rippleCursor: 0,
    dropletCursor: 0,
    glintCursor: 0,
    targetIntensity: 0.35,
    currentIntensity: 0.35,
    windAngle: 0.08,
    canopyTargets: [],
    bounds: null
  };
}

function resetDrop(drop, width, groundY, rng, randomY = false) {
  const margin = width * 0.25;
  drop.x = -margin + rng() * (width + margin * 2);
  drop.y = randomY ? rng() * groundY : -drop.length - rng() * 90;
}

/**
 * Update cached branch/tip hit targets for fast O(1)-ish raindrop collisions.
 * @param {Object} state - Rain state
 * @param {Object[]} branches - Computed L-system tree branches
 */
export function setRainCanopyTargets(state, branches) {
  if (!state) return;
  if (!branches || branches.length === 0) {
    state.canopyTargets = [];
    state.bounds = null;
    return;
  }

  // Sample up to 90 upper/tip branches for lightweight collision checks
  const targets = [];
  const step = Math.max(1, Math.floor(branches.length / 90));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < branches.length; i += step) {
    const b = branches[i];
    if (b.depth === 0) continue; // skip root trunk
    const mx = (b.x1 + b.x2) * 0.5;
    const my = (b.y1 + b.y2) * 0.5;
    if (mx < minX) minX = mx;
    if (mx > maxX) maxX = mx;
    if (my < minY) minY = my;
    if (my > maxY) maxY = my;
    targets.push({ branch: b, x: b.isTip ? b.x2 : mx, y: b.isTip ? b.y2 : my, cooldown: 0 });
  }

  state.canopyTargets = targets;
  state.bounds = targets.length > 0
    ? { minX: minX - 18, maxX: maxX + 18, minY: minY - 18, maxY: maxY + 18 }
    : null;
}

/**
 * Update viewport dimensions cleanly on resize without reallocating pools.
 */
export function resizeRainState(state, width, height, groundY) {
  if (!state) return;
  state.width = width;
  state.height = height;
  state.groundY = groundY;
}

/**
 * Set target rain intensity in [0, 1]. Transitions smoothly in updateRain().
 */
export function setRainIntensityTarget(state, intensity) {
  if (!state) return;
  state.targetIntensity = Math.max(0, Math.min(1, intensity));
}

function spawnRipple(state, x, y, scale) {
  const r = state.ripples[state.rippleCursor];
  state.rippleCursor = (state.rippleCursor + 1) % MAX_RIPPLES;
  r.active = true;
  r.x = x;
  r.y = y;
  r.radius = 1.5 * scale;
  r.maxRadius = (6 + state.rng() * 6) * scale;
  r.alpha = 0.35 + scale * 0.12;
  r.age = 0;
  r.life = 0.28 + scale * 0.12;
}

function spawnSplashDroplets(state, x, y, scale, windAngle) {
  const count = scale > 1.2 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const p = state.droplets[state.dropletCursor];
    state.dropletCursor = (state.dropletCursor + 1) % MAX_MICRO_DROPLETS;
    p.active = true;
    p.x = x;
    p.y = y;
    const spread = (state.rng() - 0.5) * 95 * scale;
    p.vx = spread + windAngle * 40;
    p.vy = -(45 + state.rng() * 55) * scale;
    p.size = 0.9 + scale * 0.55;
    p.alpha = 0.45 + scale * 0.15;
    p.age = 0;
    p.life = 0.22 + state.rng() * 0.14;
  }
}

function spawnGlint(state, x, y) {
  const g = state.glints[state.glintCursor];
  state.glintCursor = (state.glintCursor + 1) % MAX_GLINTS;
  g.active = true;
  g.x = x;
  g.y = y;
  g.size = 2.2 + state.rng() * 2.0;
  g.alpha = 0.85;
  g.age = 0;
  g.life = 0.22;
}

/**
 * Advance rain simulation by `dt` seconds.
 * @param {Object} state - Rain state
 * @param {number} dt - Delta seconds
 * @param {number} windValue - Current wind value (e.g. [-1, 1] from gentle wind phase)
 * @param {boolean} [reducedMotion=false]
 */
export function updateRain(state, dt, windValue = 0.25, reducedMotion = false) {
  if (!state) return;

  // Smoothly interpolate intensity to prevent abrupt jumps
  const lerpRate = Math.min(1, dt * 2.2);
  state.currentIntensity += (state.targetIntensity - state.currentIntensity) * lerpRate;
  if (Math.abs(state.targetIntensity - state.currentIntensity) < 0.002) {
    state.currentIntensity = state.targetIntensity;
  }

  // Smooth wind angle (in radians, ~ -0.24 to +0.24 rad)
  const targetWind = windValue * 0.22;
  state.windAngle += (targetWind - state.windAngle) * Math.min(1, dt * 1.5);

  const intensity = state.currentIntensity;
  const speedScale = (0.72 + intensity * 0.55) * (reducedMotion ? 0.45 : 1);
  const activeCount = intensity <= 0.003 ? 0 : Math.min(MAX_DROPS, Math.round(intensity * MAX_DROPS));

  const sinA = Math.sin(state.windAngle);
  const cosA = Math.cos(state.windAngle);

  // Decay canopy cooldowns & branch dip offsets
  for (let i = 0; i < state.canopyTargets.length; i++) {
    const t = state.canopyTargets[i];
    if (t.cooldown > 0) t.cooldown = Math.max(0, t.cooldown - dt);
    if (t.branch.dipOffset) {
      t.branch.dipOffset *= Math.pow(0.03, dt);
      if (t.branch.dipOffset < 0.05) t.branch.dipOffset = 0;
    }
  }

  // Update drops
  const bounds = state.bounds;
  const targets = state.canopyTargets;
  for (let i = 0; i < MAX_DROPS; i++) {
    const d = state.drops[i];
    if (i >= activeCount) {
      d.active = false;
      continue;
    }

    if (!d.active) {
      d.active = true;
      resetDrop(d, state.width, state.groundY, state.rng, true);
    }

    const v = d.speed * speedScale;
    d.x += sinA * v * dt;
    d.y += cosA * v * dt;

    // Check canopy hit for mid & near drops inside tree bounding box
    if (
      d.layer >= 1 &&
      bounds &&
      targets.length > 0 &&
      d.x >= bounds.minX && d.x <= bounds.maxX &&
      d.y >= bounds.minY && d.y <= bounds.maxY
    ) {
      // Sample 1 candidate target deterministically per frame to keep O(1)
      const idx = Math.floor(state.rng() * targets.length);
      const t = targets[idx];
      if (t.cooldown <= 0) {
        const dx = d.x - t.x;
        const dy = d.y - t.y;
        if (dx * dx + dy * dy < 180) {
          t.cooldown = 0.22;
          t.branch.dipOffset = Math.min(5, (t.branch.dipOffset || 0) + (d.layer === 2 ? 3.2 : 1.8));
          spawnGlint(state, t.x, t.y);
          // 50% chance drop splits/absorbs on leaf
          if (state.rng() < 0.5) {
            resetDrop(d, state.width, state.groundY, state.rng, false);
            continue;
          }
        }
      }
    }

    // Check ground impact
    const hitY = state.groundY + d.groundOffset;
    if (d.y >= hitY) {
      const cfg = LAYER_CONFIGS[d.layer];
      if (state.rng() < cfg.splashChance * (0.4 + intensity * 0.6)) {
        spawnRipple(state, d.x, hitY, cfg.splashScale);
        spawnSplashDroplets(state, d.x, hitY, cfg.splashScale, state.windAngle);
      }
      resetDrop(d, state.width, state.groundY, state.rng, false);
    }
  }

  // Update ground ripples
  for (let i = 0; i < MAX_RIPPLES; i++) {
    const r = state.ripples[i];
    if (!r.active) continue;
    r.age += dt;
    if (r.age >= r.life) {
      r.active = false;
      continue;
    }
    const p = r.age / r.life;
    r.radius = 1.5 + (r.maxRadius - 1.5) * p;
  }

  // Update splash micro-droplets
  for (let i = 0; i < MAX_MICRO_DROPLETS; i++) {
    const m = state.droplets[i];
    if (!m.active) continue;
    m.age += dt;
    if (m.age >= m.life) {
      m.active = false;
      continue;
    }
    m.vy += 320 * dt; // gravity
    m.x += m.vx * dt;
    m.y += m.vy * dt;
  }

  // Update leaf glints
  for (let i = 0; i < MAX_GLINTS; i++) {
    const g = state.glints[i];
    if (!g.active) continue;
    g.age += dt;
    if (g.age >= g.life) {
      g.active = false;
    }
  }
}

/**
 * Draw a specific depth layer of raindrops (0 = far, 1 = mid, 2 = near)
 * so far drops can sit behind the tree and near drops in front.
 */
export function drawRainLayer(ctx, state, layer, theme) {
  if (!state || state.currentIntensity <= 0.003) return;

  const cfg = LAYER_CONFIGS[layer];
  const sinA = Math.sin(state.windAngle);
  const cosA = Math.cos(state.windAngle);
  const baseColor = theme?.rain?.streak || 'rgba(190, 215, 245, 1)';
  const intensityScale = Math.min(1, 0.45 + state.currentIntensity * 0.65);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = baseColor;

  // Near layer gets a soft blurred outer pass for depth
  if (cfg.blurWidth > 0) {
    ctx.lineWidth = cfg.blurWidth;
    ctx.beginPath();
    for (let i = 0; i < MAX_DROPS; i++) {
      const d = state.drops[i];
      if (!d.active || d.layer !== layer) continue;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - sinA * d.length, d.y - cosA * d.length);
    }
    ctx.globalAlpha = 0.14 * intensityScale;
    ctx.stroke();
  }

  // Crisp streak pass (batched by layer for 60fps performance)
  ctx.lineWidth = cfg.width;
  ctx.beginPath();
  for (let i = 0; i < MAX_DROPS; i++) {
    const d = state.drops[i];
    if (!d.active || d.layer !== layer) continue;
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - sinA * d.length, d.y - cosA * d.length);
  }
  ctx.globalAlpha = ((cfg.alphaMin + cfg.alphaMax) * 0.5) * intensityScale;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw ground splash ripples, arcing micro-droplets, and canopy hit glints.
 */
export function drawRainEffects(ctx, state, theme) {
  if (!state) return;

  const splashColor = theme?.rain?.splash || 'rgba(205, 228, 255, 1)';
  const glintColor = theme?.rain?.glint || '#e8f6ff';

  ctx.save();

  // Ground ripples
  ctx.strokeStyle = splashColor;
  ctx.lineWidth = 1;
  for (let i = 0; i < MAX_RIPPLES; i++) {
    const r = state.ripples[i];
    if (!r.active) continue;
    const p = r.age / r.life;
    ctx.globalAlpha = r.alpha * (1 - p);
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Micro-droplets
  ctx.fillStyle = splashColor;
  for (let i = 0; i < MAX_MICRO_DROPLETS; i++) {
    const m = state.droplets[i];
    if (!m.active) continue;
    const p = m.age / m.life;
    ctx.globalAlpha = m.alpha * (1 - p);
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Leaf/branch glints
  ctx.fillStyle = glintColor;
  for (let i = 0; i < MAX_GLINTS; i++) {
    const g = state.glints[i];
    if (!g.active) continue;
    const p = g.age / g.life;
    const fade = 1 - p;
    ctx.globalAlpha = g.alpha * fade;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.size * (0.7 + p * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
