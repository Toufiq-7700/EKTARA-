/**
 * Euclidean Rhythm — Firefly Ring Visualization
 * 
 * A ring of fireflies orbits the tree. Each Bjorklund hit flashes
 * its firefly. A faint rotating polygon connects the active hits.
 */

/**
 * Create the firefly ring state.
 * @param {boolean[]} pattern - Euclidean rhythm pattern
 * @param {number} centerX - Ring center X
 * @param {number} centerY - Ring center Y
 * @param {number} radius - Ring radius
 * @returns {Object} Firefly ring state
 */
export function createFireflyRing(pattern, centerX, centerY, radius, rng = () => 0.5) {
  const fireflies = pattern.map((isHit, i) => {
    const angle = (i / pattern.length) * Math.PI * 2 - Math.PI / 2;
    return {
      angle,
      isHit,
      brightness: 0,       // current glow intensity (0-1)
      baseX: centerX + Math.cos(angle) * radius,
      baseY: centerY + Math.sin(angle) * radius,
      wobble: rng() * Math.PI * 2
    };
  });

  return {
    fireflies,
    pattern,
    rotation: 0,
    radius,
    centerX,
    centerY,
    currentStep: 0
  };
}

/**
 * Flash a firefly when its step is hit.
 */
export function triggerFirefly(state, stepIndex) {
  const idx = stepIndex % state.fireflies.length;
  if (state.fireflies[idx]) {
    state.fireflies[idx].brightness = 1.0;
    state.currentStep = idx;
  }
}

/**
 * Update firefly animation (decay glow, rotate ring).
 */
export function updateFireflies(state, dt, time) {
  state.rotation += dt * 0.1; // slow rotation

  for (const ff of state.fireflies) {
    // Decay brightness
    ff.brightness = Math.max(0, ff.brightness - dt * 1.5);

    // Recalculate position with rotation
    const rotatedAngle = ff.angle + state.rotation;
    ff.baseX = state.centerX + Math.cos(rotatedAngle) * state.radius;
    ff.baseY = state.centerY + Math.sin(rotatedAngle) * state.radius;

    // Subtle wobble
    ff.baseX += Math.sin(time * 1.5 + ff.wobble) * 2;
    ff.baseY += Math.cos(time * 1.2 + ff.wobble) * 2;
  }
}

/**
 * Draw the firefly ring and connecting polygon.
 */
export function drawFireflies(ctx, state, theme) {
  // Draw the connecting polygon (only active/hit fireflies)
  const activePoints = state.fireflies.filter(ff => ff.isHit);
  if (activePoints.length > 2) {
    ctx.beginPath();
    ctx.moveTo(activePoints[0].baseX, activePoints[0].baseY);
    for (let i = 1; i < activePoints.length; i++) {
      ctx.lineTo(activePoints[i].baseX, activePoints[i].baseY);
    }
    ctx.closePath();
    ctx.strokeStyle = theme.firefly.polygon;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Fill with very faint color
    ctx.fillStyle = theme.firefly.polygon;
    ctx.globalAlpha = 0.05;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Draw each firefly
  for (const ff of state.fireflies) {
    const size = ff.isHit ? 3 : 1.5;
    const baseAlpha = ff.isHit ? 0.4 : 0.15;
    const glowAlpha = ff.brightness;

    // Outer glow
    if (glowAlpha > 0.05) {
      const gradient = ctx.createRadialGradient(
        ff.baseX, ff.baseY, 0,
        ff.baseX, ff.baseY, 15
      );
      gradient.addColorStop(0, theme.firefly.glow);
      gradient.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(ff.baseX, ff.baseY, 15, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.globalAlpha = glowAlpha * 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Core dot
    ctx.beginPath();
    ctx.arc(ff.baseX, ff.baseY, size + glowAlpha * 3, 0, Math.PI * 2);
    ctx.fillStyle = theme.firefly.glow;
    ctx.globalAlpha = baseAlpha + glowAlpha * 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
