/**
 * "What You Hear" Horizontal Timeline Strip
 *
 * 4-lane scrolling piano roll at the bottom of the Algorithm Lab showing
 * how Nørgård, Hanoi, Euclidean, and L-System events interleave over time.
 * Supports hover (linked highlighting) and click (seek/step to event).
 */

import { ALGORITHMS, ALGORITHM_ORDER } from '../algorithms/meta.js';

const WINDOW_SECONDS = 12;

export function createTimelineStrip() {
  let blockBoxes = [];

  function draw(ctx, width, height, { score, currentTime, enabledMap, hoveredTarget }) {
    blockBoxes = [];
    if (!score) return;

    ctx.clearRect(0, 0, width, height);
    const labelW = 128;
    const trackW = Math.max(80, width - labelW - 12);
    const laneH = (height - 12) / 4;
    const startT = Math.max(0, currentTime - WINDOW_SECONDS * 0.28);
    const endT = startT + WINDOW_SECONDS;
    const playheadX = labelW + ((currentTime - startT) / WINDOW_SECONDS) * trackW;

    // Draw 4 lane backgrounds + labels
    for (let laneIdx = 0; laneIdx < ALGORITHM_ORDER.length; laneIdx++) {
      const id = ALGORITHM_ORDER[laneIdx];
      const meta = ALGORITHMS[id];
      const y = 6 + laneIdx * laneH;
      const enabled = enabledMap[id] !== false;

      ctx.fillStyle = laneIdx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)';
      ctx.fillRect(labelW, y, trackW, laneH - 2);

      ctx.globalAlpha = enabled ? 1 : 0.4;
      ctx.fillStyle = meta.color;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`${meta.shape} ${meta.shortName}`, 10, y + laneH * 0.62);
      ctx.globalAlpha = 1;
    }

    // Draw event blocks in [startT, endT]
    for (const ev of score.events) {
      if (ev.time + ev.duration < startT || ev.time > endT) continue;

      let algId = ev.meta?.algorithm;
      if (!algId) continue;

      const laneIdx = ALGORITHM_ORDER.indexOf(algId);
      if (laneIdx === -1) continue;

      const meta = ALGORITHMS[algId];
      const enabled = enabledMap[algId] !== false;
      const y = 6 + laneIdx * laneH + 3;
      const bh = Math.max(8, laneH - 8);
      const bx = labelW + ((Math.max(startT, ev.time) - startT) / WINDOW_SECONDS) * trackW;
      const bw = Math.max(5, (Math.min(endT, ev.time + ev.duration) - Math.max(startT, ev.time)) / WINDOW_SECONDS * trackW);

      const isHl = hoveredTarget && (
        (algId === 'norgard' && hoveredTarget.algorithm === 'norgard' && hoveredTarget.index === ev.meta.index) ||
        (algId === 'hanoi' && hoveredTarget.algorithm === 'hanoi' && hoveredTarget.disc === ev.meta.disc) ||
        (algId === 'bjorklund' && hoveredTarget.algorithm === 'bjorklund' && hoveredTarget.step === ev.meta.step)
      );

      ctx.globalAlpha = enabled ? (ev.voice === 'canon' ? 0.45 : 0.85) : 0.18;
      ctx.fillStyle = isHl ? '#ffffff' : meta.color;
      ctx.beginPath();
      ctx.roundRect(bx, y, bw, bh, 3);
      ctx.fill();
      ctx.globalAlpha = 1;

      blockBoxes.push({ x: bx, y, w: bw, h: bh, event: ev, algId });

      // Mirror melody phrases onto L-System lane to illustrate texture density
      if (algId === 'norgard' && ev.voice === 'melody' && ev.meta.index % 2 === 0) {
        const ly = 6 + 3 * laneH + 4;
        const lEnabled = enabledMap.lsystem !== false;
        ctx.globalAlpha = lEnabled ? 0.5 : 0.15;
        ctx.fillStyle = ALGORITHMS.lsystem.color;
        ctx.beginPath();
        ctx.roundRect(bx, ly, Math.max(6, bw * 1.4), Math.max(6, laneH - 10), 3);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Playhead vertical line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 4);
    ctx.lineTo(playheadX, height - 4);
    ctx.stroke();
  }

  function hitTest(x, y) {
    for (let i = blockBoxes.length - 1; i >= 0; i--) {
      const b = blockBoxes[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        const m = b.event.meta || {};
        if (b.algId === 'norgard') return { algorithm: 'norgard', index: m.index, event: b.event };
        if (b.algId === 'hanoi') return { algorithm: 'hanoi', disc: m.disc, event: b.event };
        if (b.algId === 'bjorklund') return { algorithm: 'bjorklund', step: m.step, event: b.event };
      }
    }
    return null;
  }

  return { draw, hitTest };
}
