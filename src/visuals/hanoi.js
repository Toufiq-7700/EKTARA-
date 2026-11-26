/**
 * Tower of Hanoi Visualization
 * 
 * Three luminous pillars at the base of the scene.
 * Discs of light glide between pegs in smooth arcs when the bass plays.
 * Ground ripples appear when a disc lands.
 */

/**
 * Create the initial Hanoi visual state.
 * @param {number} numDiscs - Number of discs
 * @returns {Object} The Hanoi visual state
 */
export function createHanoiState(numDiscs, startPeg = 'A') {
  const pegs = { A: [], B: [], C: [] };
  const initialPeg = pegs[startPeg] ? startPeg : 'A';
  // Start: all discs on startPeg, largest at bottom
  for (let d = numDiscs; d >= 1; d--) {
    pegs[initialPeg].push(d);
  }
  return {
    pegs,
    numDiscs,
    startPeg: initialPeg,
    animating: null,
    ripples: []
  };
}

/**
 * Apply a Hanoi move to the visual state (with animation).
 */
export function applyHanoiMove(state, move) {
  // Remove disc from source peg
  const fromPeg = state.pegs[move.from];
  const idx = fromPeg.indexOf(move.disc);
  if (idx !== -1) fromPeg.splice(idx, 1);

  // Start animation
  state.animating = {
    disc: move.disc,
    fromPeg: move.from,
    toPeg: move.to,
    progress: 0
  };
}

/**
 * Update animation state.
 */
export function updateHanoiAnimation(state, dt) {
  if (state.animating) {
    state.animating.progress += dt * 1.5; // animation speed
    if (state.animating.progress >= 1) {
      // Complete: place disc on target peg
      state.pegs[state.animating.toPeg].push(state.animating.disc);
      // Create a landing ripple
      state.ripples.push({
        x: getPegX(state.animating.toPeg),
        progress: 0,
        maxRadius: 20 + state.animating.disc * 8
      });
      state.animating = null;
    }
  }

  // Update ripples
  for (const ripple of state.ripples) {
    ripple.progress += dt * 0.8;
  }
  state.ripples = state.ripples.filter(r => r.progress < 1);
}

function getPegX(peg) {
  const positions = { A: -100, B: 0, C: 100 };
  return positions[peg] || 0;
}

/**
 * Draw the Hanoi visualization.
 */
export function drawHanoi(ctx, state, theme, centerX, groundY, scale = 1, highlightedDisc = null) {
  const pegHeight = 80 * scale;
  const discHeight = 10 * scale;
  const maxDiscWidth = 50 * scale;
  const pegWidth = 4 * scale;

  // Draw three pillars
  for (const pegName of ['A', 'B', 'C']) {
    const px = centerX + getPegX(pegName) * scale;

    // Pillar glow
    ctx.beginPath();
    ctx.rect(px - pegWidth / 2, groundY - pegHeight, pegWidth, pegHeight);
    ctx.fillStyle = theme.hanoi.pillar;
    ctx.shadowColor = theme.hanoi.pillar;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw discs on this peg
    const discs = state.pegs[pegName];
    for (let i = 0; i < discs.length; i++) {
      const disc = discs[i];
      const discWidth = (disc / state.numDiscs) * maxDiscWidth;
      const dy = groundY - (i + 1) * discHeight;
      const colorIdx = (disc - 1) % theme.hanoi.disc.length;

      ctx.beginPath();
      ctx.roundRect(px - discWidth, dy, discWidth * 2, discHeight - 2, 3);
      ctx.fillStyle = theme.hanoi.disc[colorIdx];
      ctx.globalAlpha = 0.8;
      ctx.fill();
      if (highlightedDisc === disc) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Draw animating disc
  if (state.animating) {
    const { disc, fromPeg, toPeg, progress } = state.animating;
    const fromX = centerX + getPegX(fromPeg) * scale;
    const toX = centerX + getPegX(toPeg) * scale;
    const discWidth = (disc / state.numDiscs) * maxDiscWidth;
    const colorIdx = (disc - 1) % theme.hanoi.disc.length;

    // Arc trajectory
    const t = progress;
    const x = fromX + (toX - fromX) * t;
    const arcHeight = pegHeight + 30 * scale;
    const y = groundY - discHeight - arcHeight * Math.sin(t * Math.PI);

    ctx.beginPath();
    ctx.roundRect(x - discWidth, y, discWidth * 2, discHeight - 2, 3);
    ctx.fillStyle = theme.hanoi.disc[colorIdx];
    ctx.shadowColor = theme.hanoi.disc[colorIdx];
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    if (highlightedDisc === disc) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Draw ripples
  for (const ripple of state.ripples) {
    const rx = centerX + ripple.x * scale;
    const radius = ripple.maxRadius * ripple.progress;
    const alpha = (1 - ripple.progress) * 0.4;

    ctx.beginPath();
    ctx.ellipse(rx, groundY, radius, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.strokeStyle = theme.hanoi.ripple;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
