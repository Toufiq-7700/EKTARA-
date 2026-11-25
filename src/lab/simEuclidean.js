/**
 * Euclidean Rhythm (Bjorklund) — Lab Simulation
 *
 * Left pane: Step-by-step group merging visualization
 *   [x][x][x][.][.][.][.][.] -> [x.][x.][x.][.][.] -> [x..][x..][x.]
 * Right pane: Circular rhythm wheel with hit dots, Euclidean polygon,
 *   and a sweeping playhead hand synced to the audio beat.
 */

import { bjorklundSteps } from '../algorithms/bjorklund.js';
import { ALGORITHMS } from '../algorithms/meta.js';

const COLOR = ALGORITHMS.bjorklund.color;

export function createEuclideanSim() {
  let dotBoxes = [];
  let customK = null;
  let customN = null;

  function setKN(k, n) {
    customK = k;
    customN = n;
  }

  function draw(ctx, width, height, { score, currentTime, hoveredTarget, reducedMotion }) {
    dotBoxes = [];
    if (!score) return;

    const depth = score.params?.depth || 4;
    const density = score.params?.densityEuclid || 1;
    const n = customN ?? (8 + depth * 2);
    const k = customK ?? Math.min(n, Math.max(1, Math.round((2 + depth) * density)));
    const { steps: mergeSteps, pattern } = bjorklundSteps(k, n);

    const tempo = score.params?.tempo || 60;
    const stepDuration = (60 / tempo) * 0.25;
    const cycleDuration = n * stepDuration;
    const cyclePhase = (currentTime % cycleDuration) / cycleDuration;
    const currentStep = Math.floor(cyclePhase * n) % n;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`● Bjorklund Euclidean Rhythm — E(${k}, ${n})`, 16, 26);

    const splitX = width > 560 ? width * 0.54 : width;

    // ─── Left Pane: Animated Bjorklund Group Merging ────────────────
    ctx.fillStyle = '#b8b0cc';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Recursive Group Distribution (Euclid GCD):', 16, 52);

    // Highlight one merge stage over time cleanly
    const stageIdx = reducedMotion
      ? mergeSteps.length - 1
      : Math.floor((currentTime * 0.6) % mergeSteps.length);

    let y = 80;
    for (let s = 0; s < mergeSteps.length; s++) {
      const groups = mergeSteps[s];
      const isActiveStage = s === stageIdx;
      const isFinal = s === mergeSteps.length - 1;

      ctx.fillStyle = isActiveStage ? 'rgba(160, 240, 120, 0.14)' : 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.roundRect(16, y - 18, splitX - 28, 34, 6);
      ctx.fill();

      ctx.fillStyle = isFinal ? COLOR : isActiveStage ? '#e4fadc' : '#9e96b0';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`Step ${s}:`, 24, y + 4);

      // Render group tokens like [x..]
      let gx = 92;
      for (const grp of groups) {
        const token = `[${grp.join('')}]`;
        const tw = token.length * 8.5 + 10;
        if (gx + tw > splitX - 20) break;

        ctx.fillStyle = grp.includes('x')
          ? 'rgba(160, 240, 120, 0.22)'
          : 'rgba(255, 255, 255, 0.07)';
        ctx.strokeStyle = isActiveStage ? COLOR : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(gx, y - 12, tw, 22, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = grp.includes('x') ? '#f0ffe8' : '#9c94b0';
        ctx.fillText(token, gx + 5, y + 4);
        gx += tw + 5;
      }

      y += 42;
      if (y > height - 30) break;
    }

    // ─── Right Pane: Circular Wheel + Sweeping Hand ─────────────────
    const wheelCenterX = width > 560 ? splitX + (width - splitX) * 0.5 : width * 0.5;
    const wheelCenterY = width > 560 ? height * 0.54 : Math.min(height - 95, y + 90);
    const radius = Math.max(55, Math.min(
      (width > 560 ? (width - splitX) * 0.36 : width * 0.3),
      (height - 70) * 0.36
    ));

    // Ring track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wheelCenterX, wheelCenterY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Polygon connecting hits
    const hitCoords = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = wheelCenterX + Math.cos(ang) * radius;
      const py = wheelCenterY + Math.sin(ang) * radius;
      if (pattern[i]) hitCoords.push({ x: px, y: py });
    }
    if (hitCoords.length > 2) {
      ctx.strokeStyle = 'rgba(160, 240, 120, 0.45)';
      ctx.fillStyle = 'rgba(160, 240, 120, 0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hitCoords[0].x, hitCoords[0].y);
      for (let i = 1; i < hitCoords.length; i++) ctx.lineTo(hitCoords[i].x, hitCoords[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Sweeping hand
    const handAng = (reducedMotion ? currentStep / n : cyclePhase) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = COLOR;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(wheelCenterX, wheelCenterY);
    ctx.lineTo(
      wheelCenterX + Math.cos(handAng) * (radius - 10),
      wheelCenterY + Math.sin(handAng) * (radius - 10)
    );
    ctx.stroke();

    // Step dots
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = wheelCenterX + Math.cos(ang) * radius;
      const py = wheelCenterY + Math.sin(ang) * radius;
      const isHit = pattern[i];
      const isCurrent = i === currentStep;
      const isHl = hoveredTarget?.algorithm === 'bjorklund' && (hoveredTarget.step % n) === i;
      const r = isHit ? (isCurrent ? 10 : 7) : (isCurrent ? 6 : 4);

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = isHit ? (isCurrent ? '#ffffff' : COLOR) : 'rgba(255,255,255,0.18)';
      ctx.fill();

      if (isCurrent || isHl) {
        ctx.strokeStyle = isHl ? '#ffffff' : COLOR;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      dotBoxes.push({ x: px, y: py, r: 14, step: i });
    }

    // Center summary
    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${k}/${n} hits`, wheelCenterX, wheelCenterY + 5);
    ctx.textAlign = 'left';
  }

  function hitTest(x, y) {
    for (const d of dotBoxes) {
      const dx = x - d.x;
      const dy = y - d.y;
      if (dx * dx + dy * dy <= d.r * d.r) {
        return { algorithm: 'bjorklund', step: d.step };
      }
    }
    return null;
  }

  return { draw, hitTest, setKN };
}
