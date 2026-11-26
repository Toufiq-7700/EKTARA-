/**
 * Playable Virtual Ektara String (Garden Visual + Light Ripple)
 *
 * Draws a glowing vertical string near the left edge on wide viewports
 * (or a horizontal string near the bottom on narrow/mobile viewports).
 * - Resting vibration reacts smoothly to live audio level.
 * - Plucking animates a damped sine wave and emits a soft light ripple
 *   that travels up into the fractal tree.
 * - Respects `prefers-reduced-motion: reduce`.
 */

export function createEktaraStringState() {
  return {
    pluckAmp: 0,
    pluckPhase: 0,
    activePos: 0.5,
    ripples: [], // { x, y, targetX, targetY, progress, color }
    lastNoteLabel: ''
  };
}

export function triggerStringPluck(state, normalizedPos = 0.5, noteLabel = '', width = 800, height = 600) {
  if (!state) return;
  state.pluckAmp = 14;
  state.pluckPhase = 0;
  state.activePos = Math.max(0, Math.min(1, normalizedPos));
  if (noteLabel) state.lastNoteLabel = noteLabel;

  const isMobile = width <= 640;
  const startX = isMobile
    ? width * (0.14 + state.activePos * 0.72)
    : Math.max(36, width * 0.065);
  const startY = isMobile
    ? height * 0.90
    : height * (0.84 - state.activePos * 0.70);

  state.ripples.push({
    x: startX,
    y: startY,
    targetX: width * 0.5,
    targetY: height * 0.52,
    progress: 0
  });
  if (state.ripples.length > 6) state.ripples.shift();
}

export function updateEktaraString(state, dt, reducedMotion = false) {
  if (!state) return;
  if (!reducedMotion) {
    state.pluckPhase += dt * 36;
    state.pluckAmp *= Math.exp(-dt * 3.8);
    if (state.pluckAmp < 0.08) state.pluckAmp = 0;
  } else {
    state.pluckAmp = 0;
  }

  for (let i = state.ripples.length - 1; i >= 0; i--) {
    state.ripples[i].progress += dt * (reducedMotion ? 2.5 : 0.95);
    if (state.ripples[i].progress >= 1) {
      state.ripples.splice(i, 1);
    }
  }
}

export function drawEktaraString(ctx, state, width, height, elapsedTime, audioLevel = 0, reducedMotion = false) {
  if (!state) return;
  const isMobile = width <= 640;

  // Resting vibration gently reacts to current audio level
  const restingAmp = reducedMotion ? 0 : (0.6 + audioLevel * 3.8);
  const totalAmp = restingAmp + state.pluckAmp;
  const freq = state.pluckAmp > 0.5 ? 28 : 6.5;

  ctx.save();
  ctx.strokeStyle = state.pluckAmp > 0.5
    ? 'rgba(255, 222, 156, 0.92)'
    : `rgba(240, 186, 112, ${(0.46 + audioLevel * 0.34).toFixed(2)})`;
  ctx.lineWidth = state.pluckAmp > 0.5 ? 2.2 : 1.5;
  ctx.shadowColor = 'rgba(240, 174, 96, 0.75)';
  ctx.shadowBlur = state.pluckAmp > 0.5 ? 16 : 8 + audioLevel * 8;

  const steps = 36;
  ctx.beginPath();

  if (isMobile) {
    const x1 = width * 0.14;
    const x2 = width * 0.86;
    const baseY = height * 0.90;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = x1 + u * (x2 - x1);
      const env = Math.sin(u * Math.PI);
      const wave = Math.sin(elapsedTime * freq + state.pluckPhase + u * Math.PI * 2) * totalAmp * env;
      const y = baseY + wave;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Anchor pegs & active pitch bead
    ctx.fillStyle = 'rgba(246, 201, 142, 0.85)';
    ctx.beginPath();
    ctx.arc(x1, baseY, 3.2, 0, Math.PI * 2);
    ctx.arc(x2, baseY, 3.2, 0, Math.PI * 2);
    ctx.fill();

    const beadX = x1 + state.activePos * (x2 - x1);
    ctx.fillStyle = '#ffe5ba';
    ctx.beginPath();
    ctx.arc(beadX, baseY, state.pluckAmp > 0.5 ? 5 : 3.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const baseX = Math.max(36, width * 0.065);
    const yTop = height * 0.14;
    const yBot = height * 0.84;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = yBot - u * (yBot - yTop);
      const env = Math.sin(u * Math.PI);
      const wave = Math.sin(elapsedTime * freq + state.pluckPhase + u * Math.PI * 2) * totalAmp * env;
      const x = baseX + wave;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Anchor pegs & active pitch bead
    ctx.fillStyle = 'rgba(246, 201, 142, 0.85)';
    ctx.beginPath();
    ctx.arc(baseX, yTop, 3.2, 0, Math.PI * 2);
    ctx.arc(baseX, yBot, 3.6, 0, Math.PI * 2);
    ctx.fill();

    const beadY = yBot - state.activePos * (yBot - yTop);
    ctx.fillStyle = '#ffe5ba';
    ctx.beginPath();
    ctx.arc(baseX, beadY, state.pluckAmp > 0.5 ? 5.2 : 4, 0, Math.PI * 2);
    ctx.fill();

    if (state.lastNoteLabel && state.pluckAmp > 0.3) {
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = `rgba(255, 226, 186, ${Math.min(1, state.pluckAmp / 5).toFixed(2)})`;
      ctx.fillText(state.lastNoteLabel, baseX + 12, beadY + 4);
    }
  }

  // Soft ripples of light traveling from the string up into the tree
  for (const r of state.ripples) {
    const p = r.progress;
    const ease = 1 - Math.pow(1 - p, 2);
    const rx = r.x + (r.targetX - r.x) * ease;
    const ry = r.y + (r.targetY - r.y) * ease - Math.sin(p * Math.PI) * 32;
    const alpha = (1 - p) * 0.65;
    const rad = 10 + p * 44;

    ctx.strokeStyle = `rgba(246, 201, 142, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 1.6;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(rx, ry, rad * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 232, 190, ${(alpha * 0.9).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(rx, ry, 3.5 * (1 - p * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
