/**
 * L-System Tree Renderer — The Hero Visual
 * 
 * Draws the fractal tree using turtle graphics from the L-system commands.
 * Branch angles are offset by Nørgård values, so the tree's shape IS the melody.
 * 
 * Features:
 *   - Grows generation by generation with animation
 *   - Branch glow when melody notes play (additive blend)
 *   - Leaves/blossoms at tips that drift down
 *   - Wind sway via layered sine motion
 */

/**
 * Compute the tree's branch structure from L-system commands,
 * automatically fitting the tree height cleanly into `targetHeight`.
 *
 * @param {Object[]} commands - L-system parsed commands
 * @param {number[]} branchAngles - Nørgård-derived angle offsets
 * @param {number} baseAngle - Base branch angle in degrees
 * @param {number} startX - Starting X position
 * @param {number} startY - Starting Y position
 * @param {number} targetHeight - Desired visual tree height in pixels
 * @param {number} maxDepth - Current max depth to show (for growth animation)
 * @returns {Object[]} Array of branch objects (capped at 2200 for 60fps)
 */
export function computeTreeBranches(commands, branchAngles, baseAngle, startX, startY, targetHeight, maxDepth = 999) {
  const MAX_BRANCHES = 2200;
  const raw = [];
  const stack = [];
  let x = 0;
  let y = 0;
  let angle = -90; // Start pointing up (degrees)
  let depth = 0;
  let branchIndex = 0;
  let currentLength = 1;
  const lengthDecay = 0.72; // branches shrink per depth level

  let minY = 0;
  let maxY = 0;
  let minX = 0;
  let maxX = 0;

  for (const cmd of commands) {
    if (raw.length >= MAX_BRANCHES) break;
    if (depth > maxDepth) {
      if (cmd.type === 'push') {
        depth++;
        continue;
      }
      if (cmd.type === 'pop') {
        depth--;
        continue;
      }
      continue;
    }

    switch (cmd.type) {
      case 'forward': {
        const rad = (angle * Math.PI) / 180;
        const endX = x + Math.cos(rad) * currentLength;
        const endY = y + Math.sin(rad) * currentLength;

        if (endY < minY) minY = endY;
        if (endY > maxY) maxY = endY;
        if (endX < minX) minX = endX;
        if (endX > maxX) maxX = endX;

        raw.push({
          x1: x, y1: y,
          x2: endX, y2: endY,
          depth,
          index: branchIndex,
          length: currentLength,
          angle,
          isTip: false
        });

        x = endX;
        y = endY;
        branchIndex++;
        break;
      }

      case 'right': {
        const angleOffset = branchAngles[branchIndex % (branchAngles.length || 1)] ?? baseAngle;
        angle += angleOffset;
        break;
      }

      case 'left': {
        const angleOffset = branchAngles[branchIndex % (branchAngles.length || 1)] ?? baseAngle;
        angle -= angleOffset;
        break;
      }

      case 'push':
        stack.push({ x, y, angle, depth, currentLength });
        depth++;
        currentLength *= lengthDecay;
        break;

      case 'pop':
        if (stack.length > 0) {
          if (raw.length > 0) {
            raw[raw.length - 1].isTip = true;
          }
          const state = stack.pop();
          x = state.x;
          y = state.y;
          angle = state.angle;
          depth = state.depth;
          currentLength = state.currentLength;
        }
        break;
    }
  }

  // Normalize scale so tree fits comfortably in targetHeight regardless of depth
  const spanY = Math.max(0.01, maxY - minY);
  const scale = targetHeight / spanY;

  return raw.map(b => ({
    ...b,
    x1: startX + b.x1 * scale,
    y1: startY + b.y1 * scale,
    x2: startX + b.x2 * scale,
    y2: startY + b.y2 * scale,
    length: b.length * scale
  }));
}

/**
 * Draw the tree branches on canvas.
 */
export function drawTree(ctx, branches, theme, activeEvents, time, windPhase, reducedMotion) {
  if (!branches || branches.length === 0) return;

  // Build a set of active branch indices from melody events
  const activeBranches = new Set();
  if (activeEvents) {
    for (const evt of activeEvents) {
      if (evt.meta?.algorithm === 'norgard') {
        activeBranches.add(evt.meta.index % branches.length);
      }
    }
  }

  for (const branch of branches) {
    // Apply wind sway
    let swayX = 0, swayY = 0;
    if (!reducedMotion) {
      const swayAmount = branch.depth * 0.5;
      swayX = Math.sin(windPhase + branch.index * 0.3) * swayAmount;
      swayY = Math.cos(windPhase * 0.7 + branch.index * 0.2) * swayAmount * 0.3;
    }

    const dip = branch.dipOffset || 0;
    const x1 = branch.x1 + swayX * 0.5;
    const y1 = branch.y1 + swayY * 0.5 + dip * 0.35;
    const x2 = branch.x2 + swayX;
    const y2 = branch.y2 + swayY + dip;

    // Branch width based on depth (thicker trunk, thinner tips)
    const maxWidth = 6;
    const lineWidth = Math.max(0.6, maxWidth - branch.depth * 0.8);

    const isActive = activeBranches.has(branch.index);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    if (isActive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = theme.tree.glow;
      ctx.shadowColor = theme.tree.glow;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = branch.depth === 0 ? theme.tree.trunk : theme.tree.branch;
      ctx.stroke();
    }

    // Draw leaves/blossoms at tips
    if (branch.isTip) {
      ctx.beginPath();
      ctx.arc(x2, y2, 2 + Math.sin(time * 0.5 + branch.index) * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = branch.index % 3 === 0 ? theme.tree.blossom : theme.tree.leaf;
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

/**
 * Generate falling particles (leaves/petals) deterministically using seeded PRNG.
 */
export function createFallingParticles(branches, maxParticles = 30, rng = () => 0.5) {
  const tips = branches.filter(b => b.isTip);
  const particles = [];

  for (let i = 0; i < Math.min(maxParticles, tips.length); i++) {
    const tip = tips[i % tips.length];
    particles.push({
      originX: tip.x2,
      originY: tip.y2,
      x: tip.x2,
      y: tip.y2,
      vx: (rng() - 0.5) * 0.3,
      vy: 0.2 + rng() * 0.3,
      size: 1.5 + rng() * 1.5,
      baseAlpha: 0.4 + rng() * 0.3,
      alpha: 0.4 + rng() * 0.3,
      type: i % 2 === 0 ? 'leaf' : 'petal',
      wobblePhase: rng() * Math.PI * 2
    });
  }
  return particles;
}

export function updateAndDrawParticles(ctx, particles, theme, time, groundY) {
  for (const p of particles) {
    p.x += p.vx + Math.sin(time * 0.5 + p.wobblePhase) * 0.2;
    p.y += p.vy;
    p.alpha -= 0.001;

    // Reset back to tip origin when below ground or faded out
    if (p.y > groundY || p.alpha <= 0) {
      p.x = p.originX;
      p.y = p.originY;
      p.alpha = p.baseAlpha;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.type === 'leaf' ? theme.tree.leaf : theme.tree.blossom;
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
