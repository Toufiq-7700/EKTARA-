/**
 * Recursion X-Ray Mode
 * 
 * An overlay that shows judges the algorithms are real:
 * labels like "nørgård(11) = 2, depth 3", "hanoi: disc 2 A→C",
 * and a mini call-stack diagram.
 */

/**
 * Draw the X-ray overlay showing active recursion calls.
 */
export function drawXRay(ctx, activeEvents, theme, width, height) {
  if (!activeEvents || activeEvents.length === 0) return;

  const padding = 16;
  const lineHeight = 18;
  const maxLabels = 8;

  // Gather unique active labels
  const labels = [];
  const seen = new Set();
  for (const evt of activeEvents) {
    if (evt.meta?.label && !seen.has(evt.meta.label)) {
      seen.add(evt.meta.label);
      labels.push({
        text: evt.meta.label,
        algorithm: evt.meta.algorithm,
        voice: evt.voice
      });
      if (labels.length >= maxLabels) break;
    }
  }

  if (labels.length === 0) return;

  // Draw panel background (top-right)
  const panelWidth = 280;
  const panelHeight = padding * 2 + labels.length * lineHeight + 20;
  const panelX = width - panelWidth - 20;
  const panelY = 20;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 8);
  ctx.fill();

  // Header
  ctx.fillStyle = theme.accent;
  ctx.font = 'bold 11px monospace';
  ctx.fillText('⟨ RECURSION X-RAY ⟩', panelX + padding, panelY + padding + 10);

  // Algorithm labels
  ctx.font = '11px monospace';
  const colors = {
    norgard: '#f0c878',
    hanoi: '#78c8f0',
    bjorklund: '#a0f078',
    lsystem: '#f078c8'
  };

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const y = panelY + padding + 30 + i * lineHeight;

    // Color dot for algorithm type
    ctx.fillStyle = colors[label.algorithm] || theme.text;
    ctx.beginPath();
    ctx.arc(panelX + padding + 4, y - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Label text
    ctx.fillStyle = colors[label.algorithm] || theme.text;
    ctx.fillText(label.text, panelX + padding + 14, y);
  }

  // Mini call depth indicator
  const depthY = panelY + panelHeight - 15;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '9px monospace';
  ctx.fillText('call stack depth:', panelX + padding, depthY);

  // Draw depth bars
  const algTypes = [...new Set(labels.map(l => l.algorithm))];
  let barX = panelX + padding + 100;
  for (const alg of algTypes) {
    const depth = labels.filter(l => l.algorithm === alg).length;
    ctx.fillStyle = colors[alg] || theme.text;
    for (let d = 0; d < depth; d++) {
      ctx.fillRect(barX + d * 6, depthY - 8, 4, 8);
    }
    barX += depth * 6 + 10;
  }
}
