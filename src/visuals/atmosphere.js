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
 * Draw the gradient sky, darkening smoothly as rain intensity increases.
 */
export function drawSky(ctx, theme, width, height, rainIntensity = 0) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, theme.sky.top);
  gradient.addColorStop(0.4, theme.sky.mid);
  gradient.addColorStop(0.75, theme.sky.bottom);
  gradient.addColorStop(1, theme.sky.horizon);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (rainIntensity > 0.01) {
    // Subtle storm-cloud darkening proportional to rain intensity
    ctx.fillStyle = `rgba(6, 10, 20, ${(rainIntensity * 0.42).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Draw twinkling stars (dimmed gently when overcast rain is heavy).
 */
export function drawStars(ctx, stars, theme, time, rainIntensity = 0) {
  const cloudDim = Math.max(0.15, 1 - rainIntensity * 0.8);
  for (const star of stars) {
    const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
    const alpha = (star.baseAlpha + twinkle * 0.2) * cloudDim;

    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = theme.stars;
    ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
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
 * Draw drifting mist layers plus soft ground mist during rain.
 */
export function drawMist(ctx, theme, width, height, time, groundY = height * 0.78, rainIntensity = 0) {
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

  if (rainIntensity > 0.02) {
    const mistAlpha = rainIntensity * 0.16;
    const grad = ctx.createLinearGradient(0, groundY - 75, 0, groundY + 18);
    grad.addColorStop(0, 'rgba(180, 200, 225, 0)');
    grad.addColorStop(0.65, `rgba(180, 200, 225, ${mistAlpha.toFixed(3)})`);
    grad.addColorStop(1, 'rgba(180, 200, 225, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY - 75, width, 95);
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
