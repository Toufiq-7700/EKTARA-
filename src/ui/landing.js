/**
 * EKTARA Landing Page Controller
 *
 * Renders:
 *  - Full-screen animated night-river backdrop with drifting stars, soft mist,
 *    a slow-growing low-CPU L-system tree (fixed seed 137), fireflies, and
 *    an interactive glowing vertical "ektara string" that vibrates on hover/touch
 *    and plucks on Begin.
 *  - Four compact mini-canvas animations in the "How it works" cards.
 *  - Respects `prefers-reduced-motion: reduce` (renders clean static frames).
 */

import { lsystemSafe, parseLSystemToCommands, LSYSTEM_PRESETS } from '../algorithms/lsystem.js';
import { computeTreeBranches } from '../visuals/tree.js';
import { createPRNG } from '../algorithms/prng.js';

export function initLandingExperience() {
  const heroCanvas = document.getElementById('landing-canvas');
  const stringZone = document.getElementById('ektara-string-zone');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!heroCanvas) {
    return { pluckString: () => {}, destroy: () => {} };
  }

  const ctx = heroCanvas.getContext('2d');
  let rafId = null;
  let destroyed = false;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let startTime = performance.now();

  // String interaction state (purely visual)
  let stringHover = false;
  let stringPluckAmp = 0;
  let stringPluckTime = 0;

  // Fixed-seed background L-system tree (computed once for low CPU cost)
  const rng = createPRNG(137);
  const preset = LSYSTEM_PRESETS['Fern'];
  const lsys = lsystemSafe(preset.axiom, preset.rules, 4);
  const lsysCommands = parseLSystemToCommands(lsys.result);
  const branchAngles = Array.from({ length: 32 }, (_, i) => {
    const sign = i % 2 === 0 ? 1 : -1;
    return preset.angle + sign * ((i * 7) % 5);
  });
  let cachedBranches = [];

  // Stars & fireflies
  const stars = Array.from({ length: 75 }, () => ({
    x: rng(),
    y: rng() * 0.72,
    r: 0.6 + rng() * 1.3,
    phase: rng() * Math.PI * 2,
    speed: 0.4 + rng() * 0.8
  }));

  const fireflies = Array.from({ length: 18 }, () => ({
    x: 0.2 + rng() * 0.6,
    y: 0.25 + rng() * 0.55,
    phase: rng() * Math.PI * 2,
    speedX: (rng() - 0.5) * 0.014,
    speedY: (rng() - 0.5) * 0.01,
    r: 1.5 + rng() * 2.1,
    hue: rng() > 0.45 ? '#f5cf86' : '#a0f078'
  }));

  function rebuildTreeGeometry() {
    cachedBranches = computeTreeBranches(
      lsysCommands,
      branchAngles,
      preset.angle,
      width * 0.5,
      height * 0.86,
      Math.min(height * 0.62, 520),
      4,
      0.72
    );
  }

  function resizeHero() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    heroCanvas.width = Math.max(1, Math.round(width * dpr));
    heroCanvas.height = Math.max(1, Math.round(height * dpr));
    heroCanvas.style.width = `${width}px`;
    heroCanvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildTreeGeometry();
  }

  resizeHero();
  const onResize = () => {
    resizeHero();
    if (reducedMotion) drawHeroFrame(0);
  };
  window.addEventListener('resize', onResize);

  if (stringZone) {
    stringZone.addEventListener('pointerenter', () => { stringHover = true; });
    stringZone.addEventListener('pointerleave', () => { stringHover = false; });
    stringZone.addEventListener('touchstart', () => {
      stringHover = true;
      stringPluckAmp = Math.max(stringPluckAmp, 9);
      stringPluckTime = performance.now();
    }, { passive: true });
    stringZone.addEventListener('touchend', () => { stringHover = false; }, { passive: true });
  }

  function drawHeroFrame(elapsedSec) {
    // 1. Night-river gradient
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#070816');
    sky.addColorStop(0.58, '#0f132c');
    sky.addColorStop(0.84, '#13223b');
    sky.addColorStop(1, '#09101f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // 2. Slow-drifting stars
    for (const s of stars) {
      const drift = reducedMotion ? 0 : (elapsedSec * 0.002 * s.speed) % 1;
      const sx = ((s.x + drift) % 1) * width;
      const sy = s.y * height;
      const alpha = reducedMotion ? 0.45 : 0.25 + 0.45 * Math.sin(elapsedSec * s.speed + s.phase);
      ctx.fillStyle = `rgba(226, 232, 255, ${Math.max(0.1, alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Soft river mist band near bottom
    const mist = ctx.createLinearGradient(0, height * 0.72, 0, height);
    mist.addColorStop(0, 'rgba(30, 52, 82, 0)');
    mist.addColorStop(0.55, 'rgba(54, 88, 126, 0.14)');
    mist.addColorStop(1, 'rgba(10, 16, 30, 0.48)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, height * 0.72, width, height * 0.28);

    // 4. Slow-growing generative L-system tree (low intensity, background)
    const growthProgress = reducedMotion ? 1 : Math.min(1, 0.18 + elapsedSec * 0.085);
    const maxVisibleDepth = growthProgress * 4.2;
    const swayBase = reducedMotion ? 0 : Math.sin(elapsedSec * 0.55) * 4;

    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < cachedBranches.length; i++) {
      const b = cachedBranches[i];
      if (b.depth > maxVisibleDepth) continue;
      const depthFade = Math.max(0.08, 0.34 - b.depth * 0.055);
      const sway = swayBase * (b.depth / 4);
      ctx.strokeStyle = b.depth <= 1
        ? `rgba(140, 185, 165, ${depthFade})`
        : `rgba(120, 215, 175, ${depthFade})`;
      ctx.lineWidth = Math.max(0.7, 2.8 - b.depth * 0.55);
      ctx.beginPath();
      ctx.moveTo(b.x1 + sway * 0.4, b.y1);
      ctx.lineTo(b.x2 + sway, b.y2);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Drifting fireflies
    for (const f of fireflies) {
      const fx = (((f.x + (reducedMotion ? 0 : elapsedSec * f.speedX)) % 1 + 1) % 1) * width;
      const fy = (((f.y + (reducedMotion ? 0 : elapsedSec * f.speedY + Math.sin(elapsedSec + f.phase) * 0.015)) % 0.85 + 0.85) % 0.85) * height;
      const glow = reducedMotion ? 0.55 : 0.3 + 0.55 * Math.sin(elapsedSec * 1.8 + f.phase);
      ctx.save();
      ctx.globalAlpha = Math.max(0.12, glow);
      ctx.fillStyle = f.hue;
      ctx.shadowColor = f.hue;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(fx, fy, f.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Vertical glowing "ektara string" down the center
    const cx = width * 0.5;
    const topY = height * 0.05;
    const botY = height * 0.94;
    const span = botY - topY;

    let amp = reducedMotion ? 0 : (stringHover ? 7.5 : 2.2);
    let freq = stringHover ? 26 : 5.2;
    if (!reducedMotion && stringPluckAmp > 0.15) {
      const age = (performance.now() - stringPluckTime) / 1000;
      const decayed = stringPluckAmp * Math.exp(-age * 3.4);
      amp += decayed;
      freq = 34;
      if (decayed < 0.15) stringPluckAmp = 0;
    }

    ctx.save();
    ctx.strokeStyle = stringHover || stringPluckAmp > 0.5
      ? 'rgba(255, 212, 138, 0.82)'
      : 'rgba(240, 178, 102, 0.42)';
    ctx.lineWidth = stringHover || stringPluckAmp > 0.5 ? 2 : 1.3;
    ctx.shadowColor = 'rgba(240, 168, 96, 0.75)';
    ctx.shadowBlur = stringHover || stringPluckAmp > 0.5 ? 18 : 10;

    ctx.beginPath();
    const steps = 42;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = topY + u * span;
      // Standing wave envelope (pinned at top and bottom)
      const envelope = Math.sin(u * Math.PI);
      const wave = Math.sin(elapsedSec * freq + u * Math.PI * 2) * amp * envelope;
      const x = cx + wave;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Soft anchor nodes at top & bottom of the string
    ctx.fillStyle = 'rgba(246, 201, 142, 0.75)';
    ctx.beginPath();
    ctx.arc(cx, topY, 3, 0, Math.PI * 2);
    ctx.arc(cx, botY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── 4 Mini-Animations for "How it works" Cards ───────────────────
  const miniCanvases = {
    norgard: document.getElementById('mini-canvas-norgard'),
    hanoi: document.getElementById('mini-canvas-hanoi'),
    euclid: document.getElementById('mini-canvas-euclid'),
    lsystem: document.getElementById('mini-canvas-lsystem')
  };

  function drawMiniNorgard(t) {
    const cvs = miniCanvases.norgard;
    if (!cvs) return;
    const c = cvs.getContext('2d');
    const w = cvs.width;
    const h = cvs.height;
    c.clearRect(0, 0, w, h);

    const vals = [0, 1, -1, 2, 1, 0, -2, 3, -1, 0, 2, -1, 0, -1, 1, 4];
    c.strokeStyle = 'rgba(240, 200, 120, 0.45)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < vals.length; i++) {
      const x = 10 + (i / (vals.length - 1)) * (w - 20);
      const y = h * 0.52 - vals[i] * 5.5;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();

    // Half-speed self-similar overlay
    c.strokeStyle = '#f0c878';
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const x = 10 + (i / 7) * (w - 20);
      const y = h * 0.52 - vals[i] * 5.5;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();

    const active = Math.floor((t * 3.5) % vals.length);
    const ax = 10 + (active / (vals.length - 1)) * (w - 20);
    const ay = h * 0.52 - vals[active] * 5.5;
    c.fillStyle = '#fff1c9';
    c.beginPath();
    c.arc(ax, ay, 3.5, 0, Math.PI * 2);
    c.fill();
  }

  function drawMiniHanoi(t) {
    const cvs = miniCanvases.hanoi;
    if (!cvs) return;
    const c = cvs.getContext('2d');
    const w = cvs.width;
    const h = cvs.height;
    c.clearRect(0, 0, w, h);

    const pegsX = [w * 0.22, w * 0.5, w * 0.78];
    const baseY = h - 10;
    c.strokeStyle = 'rgba(120, 200, 240, 0.35)';
    c.lineWidth = 2;
    for (const px of pegsX) {
      c.beginPath();
      c.moveTo(px, baseY);
      c.lineTo(px, 12);
      c.stroke();
    }

    // 7-move 3-disc Hanoi sequence
    const moves = [
      [0, 2, 1], [0, 1, 2], [2, 1, 1], [0, 2, 3],
      [1, 0, 1], [1, 2, 2], [0, 2, 1]
    ];
    const phase = (t * 0.9) % moves.length;
    const idx = Math.floor(phase);
    const frac = phase - idx;

    // Reconstruct stacks before idx
    const stacks = [[3, 2, 1], [], []];
    for (let m = 0; m < idx; m++) {
      const [from, to] = moves[m];
      const disc = stacks[from].pop();
      stacks[to].push(disc);
    }
    const [curFrom, curTo] = moves[idx];
    const movingDisc = stacks[curFrom].pop();

    const drawDisc = (x, y, size, highlight = false) => {
      const dw = 10 + size * 8;
      c.fillStyle = highlight ? '#b8ecff' : '#78c8f0';
      c.beginPath();
      c.roundRect(x - dw / 2, y - 4, dw, 6, 3);
      c.fill();
    };

    for (let p = 0; p < 3; p++) {
      stacks[p].forEach((d, pos) => drawDisc(pegsX[p], baseY - 5 - pos * 8, d));
    }

    if (movingDisc) {
      const sx = pegsX[curFrom];
      const ex = pegsX[curTo];
      const mx = sx + (ex - sx) * frac;
      const my = baseY - 22 - Math.sin(frac * Math.PI) * 18;
      drawDisc(mx, my, movingDisc, true);
    }
  }

  function drawMiniEuclid(t) {
    const cvs = miniCanvases.euclid;
    if (!cvs) return;
    const c = cvs.getContext('2d');
    const w = cvs.width;
    const h = cvs.height;
    c.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = Math.min(w, h) * 0.34;
    const pattern = [1, 0, 0, 1, 0, 0, 1, 0];
    const active = Math.floor((t * 4) % 8);

    c.strokeStyle = 'rgba(160, 240, 120, 0.28)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.stroke();

    // Polygon connecting hits
    const hits = [];
    for (let i = 0; i < 8; i++) {
      const ang = -Math.PI / 2 + (i / 8) * Math.PI * 2;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      if (pattern[i]) hits.push([x, y]);
    }
    c.strokeStyle = 'rgba(160, 240, 120, 0.5)';
    c.beginPath();
    hits.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
    c.closePath();
    c.stroke();

    for (let i = 0; i < 8; i++) {
      const ang = -Math.PI / 2 + (i / 8) * Math.PI * 2;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      const isHit = pattern[i] === 1;
      const isCur = i === active;
      c.fillStyle = isCur ? '#ffffff' : isHit ? '#a0f078' : 'rgba(160, 240, 120, 0.25)';
      c.beginPath();
      c.arc(x, y, isCur ? 4.2 : isHit ? 3.2 : 1.8, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawMiniLSystem(t) {
    const cvs = miniCanvases.lsystem;
    if (!cvs) return;
    const c = cvs.getContext('2d');
    const w = cvs.width;
    const h = cvs.height;
    c.clearRect(0, 0, w, h);

    const sway = reducedMotion ? 0 : Math.sin(t * 1.4) * 0.08;
    const maxD = reducedMotion ? 4 : 1.5 + ((Math.sin(t * 0.9) + 1) * 0.5) * 2.5;

    function branch(x, y, len, ang, d) {
      if (d > maxD || len < 2) return;
      const nx = x + Math.cos(ang) * len;
      const ny = y + Math.sin(ang) * len;
      c.strokeStyle = d < 1.5 ? '#f078c8' : 'rgba(240, 120, 200, 0.65)';
      c.lineWidth = Math.max(0.8, 2.6 - d * 0.5);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(nx, ny);
      c.stroke();
      branch(nx, ny, len * 0.68, ang - 0.44 + sway, d + 1);
      branch(nx, ny, len * 0.68, ang + 0.44 + sway, d + 1);
    }

    branch(w * 0.5, h - 6, h * 0.28, -Math.PI / 2, 0);
  }

  function frame(now) {
    if (destroyed) return;
    const elapsedSec = (now - startTime) / 1000;
    drawHeroFrame(elapsedSec);
    drawMiniNorgard(elapsedSec);
    drawMiniHanoi(elapsedSec);
    drawMiniEuclid(elapsedSec);
    drawMiniLSystem(elapsedSec);
    if (!reducedMotion) {
      rafId = requestAnimationFrame(frame);
    }
  }

  if (reducedMotion) {
    frame(startTime);
  } else {
    rafId = requestAnimationFrame(frame);
  }

  return {
    pluckString() {
      stringPluckAmp = 22;
      stringPluckTime = performance.now();
      if (reducedMotion) drawHeroFrame(0);
    },
    destroy() {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    }
  };
}
