/**
 * Recursion X-Ray Mode
 *
 * Overlay showing judges the algorithms are real across all roles
 * (melody, bass, rhythm, tree), colored by role.
 */

import { resolveEventRole, ROLES_META } from '../algorithms/meta.js';

export function drawXRay(ctx, activeEvents, theme, width, _height) {
  if (!activeEvents || activeEvents.length === 0) return;

  const padding = 16;
  const lineHeight = 18;
  const maxLabels = 8;

  const labels = [];
  const seen = new Set();
  for (const evt of activeEvents) {
    if (evt.meta?.label && !seen.has(evt.meta.label)) {
      seen.add(evt.meta.label);
      labels.push({
        text: evt.meta.label,
        role: resolveEventRole(evt),
        algorithm: evt.meta.algorithm,
        voice: evt.voice
      });
      if (labels.length >= maxLabels) break;
    }
  }

  if (labels.length === 0) return;

  const panelWidth = Math.min(315, Math.max(220, width - 40));
  const panelHeight = padding * 2 + labels.length * lineHeight + 38;
  const panelX = 20;
  const panelY = 58;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 8);
  ctx.fill();

  ctx.fillStyle = theme.accent;
  ctx.font = 'bold 11px monospace';
  ctx.fillText('⟨ RECURSION X-RAY ⟩', panelX + padding, panelY + padding + 10);

  ctx.font = '11px monospace';
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const y = panelY + padding + 30 + i * lineHeight;
    const roleColor = ROLES_META[label.role]?.color || theme.text;

    ctx.fillStyle = roleColor;
    ctx.beginPath();
    ctx.arc(panelX + padding + 4, y - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = roleColor;
    ctx.fillText(label.text, panelX + padding + 14, y);
  }

  const depthY = panelY + panelHeight - 15;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '9px monospace';
  ctx.fillText('active layers:', panelX + padding, depthY);

  const roleTypes = [...new Set(labels.map(l => l.role))];
  let barX = panelX + padding + 92;
  for (const role of roleTypes) {
    const count = labels.filter(l => l.role === role).length;
    ctx.fillStyle = ROLES_META[role]?.color || theme.text;
    for (let d = 0; d < count; d++) {
      ctx.fillRect(barX + d * 6, depthY - 8, 4, 8);
    }
    barX += count * 6 + 10;
  }
}
