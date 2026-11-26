/**
 * Euclidean Rhythm (Bjorklund) — Lab Simulation
 *
 * Left pane: Step-by-step group merging visualization
 *   [x][x][x][.][.][.][.][.] -> [x.][x.][x.][.][.] -> [x..][x..][x.]
 * Right pane: Circular rhythm wheel with hit dots, Euclidean polygon,
 *   and a sweeping playhead hand synced to the audio beat.
 */

import { bjorklundSteps, rotatePattern } from '../algorithms/bjorklund.js';
import { ALGORITHMS } from '../algorithms/meta.js';

const COLOR = ALGORITHMS.bjorklund.color;
const RING_COLORS = ['#a0f078', '#78e0c8', '#d4f078'];

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

    const rings = score.euclideanRings && score.euclideanRings.length > 0
      ? score.euclideanRings
      : [{ pulses: 5, steps: 16, rotation: 0, pattern: score.euclideanPattern || [] }];

    const r0 = rings[0];
    const n = customN ?? r0.steps;
    const k = Math.min(n, customK ?? r0.pulses);
    const { steps: mergeSteps, pattern: basePat } = bjorklundSteps(k, n);
    const r0Rot = r0.rotation || 0;
    const r0Pattern = customK === null && customN === null && r0.pattern.length === n
      ? r0.pattern
      : rotatePattern(basePat, r0Rot);

    const tempo = score.params?.tempo || 60;
    const stepDuration = (60 / tempo) * 0.25;
    const cycleDuration = n * stepDuration;
    const cyclePhase = (currentTime % cycleDuration) / cycleDuration;
    const currentStep = Math.floor(cyclePhase * n) % n;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    const ringSummary = rings.length > 1
      ? `Polyrhythm (${rings.map(r => `E(${r.pulses},${r.steps})`).join(' + ')})`
      : `E(${k}, ${n}) rot=${r0Rot}`;
    ctx.fillText(`● Bjorklund Euclidean Rhythm — ${ringSummary}`, 16, 26);

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

    // Polygon connecting hits (outer ring)
    const hitCoords = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = wheelCenterX + Math.cos(ang) * radius;
      const py = wheelCenterY + Math.sin(ang) * radius;
      if (r0Pattern[i]) hitCoords.push({ x: px, y: py });
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

    // Draw outer ring (Ring 1) plus any inner polyrhythm rings (Rings 2 & 3)
    const drawRingSet = [
      { steps: n, pulses: k, pattern: r0Pattern, rad: radius, color: RING_COLORS[0] },
      ...rings.slice(1).map((rg, idx) => ({
        steps: rg.steps,
        pulses: rg.pulses,
        pattern: rg.pattern,
        rad: radius * (0.72 - idx * 0.22),
        color: RING_COLORS[(idx + 1) % RING_COLORS.length]
      }))
    ];

    for (let rIdx = 0; rIdx < drawRingSet.length; rIdx++) {
      const rg = drawRingSet[rIdx];
      const rgCycleDur = rg.steps * stepDuration;
      const rgStep = Math.floor(((currentTime % rgCycleDur) / rgCycleDur) * rg.steps) % rg.steps;

      if (rIdx > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(wheelCenterX, wheelCenterY, rg.rad, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (let i = 0; i < rg.steps; i++) {
        const ang = (i / rg.steps) * Math.PI * 2 - Math.PI / 2;
        const px = wheelCenterX + Math.cos(ang) * rg.rad;
        const py = wheelCenterY + Math.sin(ang) * rg.rad;
        const isHit = rg.pattern[i];
        const isCurrent = i === rgStep;
        const isHl = rIdx === 0 && hoveredTarget?.algorithm === 'bjorklund' && (hoveredTarget.step % rg.steps) === i;
        const r = isHit ? (isCurrent ? 9 : 6) : (isCurrent ? 5 : 3.5);

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? (isCurrent ? '#ffffff' : rg.color) : 'rgba(255,255,255,0.18)';
        ctx.fill();

        if (isCurrent || isHl) {
          ctx.strokeStyle = isHl ? '#ffffff' : rg.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, r + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (rIdx === 0) {
          dotBoxes.push({ x: px, y: py, r: 14, step: i });
        }
      }
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
