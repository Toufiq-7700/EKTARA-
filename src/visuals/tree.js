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
 * Compute the tree's branch structure from L-system commands.
 * Returns an array of branches, each with start/end positions, depth, and index.
 * 
 * @param {Object[]} commands - L-system parsed commands
 * @param {number[]} branchAngles - Nørgård-derived angle offsets
 * @param {number} baseAngle - Base branch angle in degrees
 * @param {number} startX - Starting X position
 * @param {number} startY - Starting Y position
 * @param {number} length - Initial branch length
 * @param {number} maxDepth - Current max depth to show (for growth animation)
 * @returns {Object[]} Array of branch objects
 */
export function computeTreeBranches(commands, branchAngles, baseAngle, startX, startY, length, maxDepth = 999) {
  const branches = [];
  const stack = [];
  let x = startX;
  let y = startY;
  let angle = -90; // Start pointing up (degrees)
  let depth = 0;
  let branchIndex = 0;
  let currentLength = length;
  const lengthDecay = 0.72; // branches shrink per depth level

  for (const cmd of commands) {
    if (depth > maxDepth) {
      // Skip commands beyond current animated depth
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
        const rad = angle * Math.PI / 180;
        const endX = x + Math.cos(rad) * currentLength;
        const endY = y + Math.sin(rad) * currentLength;

        branches.push({
          x1: x, y1: y,
          x2: endX, y2: endY,
          depth,
          index: branchIndex,
          length: currentLength,
          angle,
          isTip: false // updated later
        });

        x = endX;
        y = endY;
        branchIndex++;
        break;
      }

      case 'right': {
        const angleOffset = branchAngles[branchIndex % branchAngles.length] || baseAngle;
        angle += angleOffset;
        break;
      }

      case 'left': {
        const angleOffset = branchAngles[branchIndex % branchAngles.length] || baseAngle;
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
          // Mark the last branch at this depth as a tip
          if (branches.length > 0) {
            branches[branches.length - 1].isTip = true;
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

  return branches;
}

/**
 * Draw the tree branches on canvas.
 */
export function drawTree(ctx, branches, theme, activeEvents, time, windPhase, reducedMotion) {
  const w = ctx.canvas.width / (window.devicePixelRatio || 1);
  const h = ctx.canvas.height / (window.devicePixelRatio || 1);

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

    const x1 = branch.x1 + swayX * 0.5;
    const y1 = branch.y1 + swayY * 0.5;
    const x2 = branch.x2 + swayX;
    const y2 = branch.y2 + swayY;

    // Branch width based on depth (thicker trunk, thinner tips)
    const maxWidth = 6;
    const lineWidth = Math.max(0.5, maxWidth - branch.depth * 0.8);

    // Base color
    const isActive = activeBranches.has(branch.index);
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    if (isActive) {
      // Glowing branch
      ctx.strokeStyle = theme.tree.glow;
      ctx.shadowColor = theme.tree.glow;
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
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
 * Generate falling particles (leaves/petals).
 */
export function createFallingParticles(branches, maxParticles = 30) {
  const tips = branches.filter(b => b.isTip);
  const particles = [];

  for (let i = 0; i < Math.min(maxParticles, tips.length); i++) {
    const tip = tips[i % tips.length];
    particles.push({
      x: tip.x2,
      y: tip.y2,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 0.2 + Math.random() * 0.3,
      size: 1.5 + Math.random() * 1.5,
      alpha: 0.4 + Math.random() * 0.3,
      type: i % 2 === 0 ? 'leaf' : 'petal',
      wobblePhase: Math.random() * Math.PI * 2
    });
  }
  return particles;
}

export function updateAndDrawParticles(ctx, particles, theme, time, groundY) {
  for (const p of particles) {
    p.x += p.vx + Math.sin(time * 0.5 + p.wobblePhase) * 0.2;
    p.y += p.vy;
    p.alpha -= 0.001;

    // Reset when below ground or invisible
    if (p.y > groundY || p.alpha <= 0) {
      p.y = p.y - groundY; // wrap to top area
      p.alpha = 0.4 + Math.random() * 0.3;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.type === 'leaf' ? theme.tree.leaf : theme.tree.blossom;
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
