/**
 * Atmosphere — Sky, Stars, Mist, and Vignette
 * 
 * The background layer that sets the mood.
 * Slow gradient sky, drifting stars, soft vignette, and light mist.
 */

/**
 * Create star field.
 * @param {number} count 
 * @param {number} width 
 * @param {number} height 
 * @param {function} rng - Seeded PRNG
 * @returns {Object[]}
 */
export function createStars(count, width, height, rng) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rng() * width,
      y: rng() * height * 0.6, // only in upper 60%
      size: 0.5 + rng() * 1.5,
      twinklePhase: rng() * Math.PI * 2,
      twinkleSpeed: 0.3 + rng() * 0.7,
      baseAlpha: 0.3 + rng() * 0.5
    });
  }
  return stars;
}

/**
 * Draw the gradient sky.
 */
export function drawSky(ctx, theme, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, theme.sky.top);
  gradient.addColorStop(0.4, theme.sky.mid);
  gradient.addColorStop(0.75, theme.sky.bottom);
  gradient.addColorStop(1, theme.sky.horizon);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw twinkling stars.
 */
export function drawStars(ctx, stars, theme, time) {
  for (const star of stars) {
    const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
    const alpha = star.baseAlpha + twinkle * 0.2;

    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = theme.stars;
    ctx.globalAlpha = Math.max(0.1, Math.min(1, alpha));
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/**
 * Draw soft vignette around edges.
 */
export function drawVignette(ctx, width, height) {
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.7
  );
  gradient.addColorStop(0, 'transparent');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw drifting mist layers.
 */
export function drawMist(ctx, theme, width, height, time) {
  for (let layer = 0; layer < 3; layer++) {
    const y = height * (0.6 + layer * 0.1);
    const drift = Math.sin(time * 0.1 + layer * 2) * 50;

    ctx.beginPath();
    ctx.ellipse(
      width / 2 + drift,
      y,
      width * 0.6,
      30 + layer * 15,
      0, 0, Math.PI * 2
    );
    ctx.fillStyle = theme.mist;
    ctx.fill();
  }
}

/**
 * Draw the ground plane.
 */
export function drawGround(ctx, theme, width, height, groundY) {
  const gradient = ctx.createLinearGradient(0, groundY - 20, 0, height);
  gradient.addColorStop(0, theme.sky.horizon);
  gradient.addColorStop(0.3, theme.ground);
  gradient.addColorStop(1, theme.ground);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, groundY - 20, width, height - groundY + 20);
}
