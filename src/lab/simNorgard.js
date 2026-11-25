/**
 * Nørgård Infinity Series — Lab Simulation
 *
 * Renders three synchronized views inside the Lab canvas:
 *   1. Recursive binary call tree & algebraic expansion for active index k
 *   2. Interactive sequence tiles (k, n(k), note name) with hover hit-testing
 *   3. Pitch-contour graph with half-speed self-similarity overlay
 */

import { norgard } from '../algorithms/norgard.js';
import { degreeToMidi, midiToName } from '../algorithms/scales.js';
import { ALGORITHMS } from '../algorithms/meta.js';

const COLOR = ALGORITHMS.norgard.color;

/**
 * Build algebraic derivation chain for n(k) down to n(0).
 */
function buildDerivationChain(k) {
  const nodes = [];
  let cur = k;
  let guard = 0;
  while (cur >= 0 && guard < 12) {
    const val = norgard(cur);
    const kind = cur === 0 ? 'base' : cur % 2 === 0 ? 'even' : 'odd';
    const next = cur === 0 ? -1 : cur % 2 === 0 ? cur / 2 : (cur - 1) / 2;
    nodes.push({ k: cur, val, kind, next });
    if (cur === 0) break;
    cur = next;
    guard++;
  }
  return nodes;
}

function formatEquation(chain) {
  if (!chain || chain.length === 0) return 'n(0) = 0';
  const parts = [];
  for (let i = 0; i < chain.length; i++) {
    const c = chain[i];
    if (i === 0) {
      parts.push(`n(${c.k})`);
    } else if (chain[i - 1].kind === 'even') {
      parts.push(`-n(${c.k})`);
    } else {
      parts.push(`n(${c.k}) + 1`);
    }
  }
  const finalVal = chain[0].val;
  return `${parts.slice(0, 4).join(' = ')}${parts.length > 4 ? ' = …' : ''} = ${finalVal}`;
}

export function createNorgardSim() {
  let tileBoxes = [];

  function draw(ctx, width, height, { score, currentTime, hoveredTarget, reducedMotion }) {
    tileBoxes = [];
    if (!score) return;

    const melodyEvents = score.events.filter(e => e.voice === 'melody');
    if (melodyEvents.length === 0) return;

    // Find current active melody event index
    let activeIdx = 0;
    for (let i = 0; i < melodyEvents.length; i++) {
      if (melodyEvents[i].time <= currentTime) activeIdx = i;
      else break;
    }

    const activeEvt = melodyEvents[activeIdx];
    const activeK = activeEvt?.meta?.index ?? 0;
    const scale = score.params?.scale || 'pentatonic';
    const rootNote = score.params?.rootNote || 60;

    ctx.clearRect(0, 0, width, height);

    // ─── Section 1: Recursive Tree + Expansion (top 38%) ────────────
    const treeTop = 14;
    const treeH = Math.max(120, height * 0.36);
    const chain = buildDerivationChain(activeK);

    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`◆ Recursive Call Tree for n(${activeK})`, 16, treeTop + 14);

    ctx.fillStyle = COLOR;
    ctx.font = '14px monospace';
    ctx.fillText(formatEquation(chain), 16, treeTop + 36);

    // Draw recursive binary derivation tree horizontally centered
    const depthCount = Math.min(chain.length, 5);
    const rootX = width * 0.5;
    const rootY = treeTop + 64;
    const levelGap = Math.max(24, (treeH - 72) / Math.max(1, depthCount - 1));

    for (let i = 0; i < depthCount; i++) {
      const node = chain[i];
      const y = rootY + i * levelGap;
      const offsetX = i === 0 ? 0 : (chain[i - 1].kind === 'even' ? -68 : 68) / Math.pow(1.35, i - 1);
      const x = rootX + offsetX * (i % 2 === 0 ? -0.6 : 1);

      // Draw sibling hint to emphasize binary branching n(2m) / n(2m+1)
      if (i > 0) {
        const prev = chain[i - 1];
        const prevY = rootY + (i - 1) * levelGap;
        const prevOff = (i - 1) === 0 ? 0 : (chain[i - 2]?.kind === 'even' ? -68 : 68) / Math.pow(1.35, i - 2);
        const prevX = rootX + prevOff * ((i - 1) % 2 === 0 ? -0.6 : 1);

        // Inactive sibling
        const sibX = prevX - (x - prevX);
        ctx.strokeStyle = 'rgba(240, 200, 120, 0.18)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(sibX, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(240, 200, 120, 0.25)';
        ctx.beginPath();
        ctx.arc(sibX, y, 10, 0, Math.PI * 2);
        ctx.fill();

        // Active path edge
        ctx.strokeStyle = COLOR;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Rule label on edge
        ctx.fillStyle = '#c8c0d8';
        ctx.font = '12px monospace';
        const ruleTxt = prev.kind === 'even' ? '2m → -n(m)' : '2m+1 → n(m)+1';
        ctx.fillText(ruleTxt, (prevX + x) * 0.5 + 8, (prevY + y) * 0.5);
      }

      // Active node pill
      ctx.fillStyle = i === 0 ? COLOR : 'rgba(240, 200, 120, 0.22)';
      ctx.strokeStyle = COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 42, y - 14, 84, 26, 13);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = i === 0 ? '#141020' : '#f5eedc';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`n(${node.k})=${node.val}`, x, y + 4);
      ctx.textAlign = 'left';
    }

    // ─── Section 2: Sequence Tiles (middle 24%) ──────────────────────
    const tileY = treeTop + treeH + 14;
    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('Sequence Tiles (hover to highlight branch in Garden)', 16, tileY);

    const tileW = 54;
    const tileH = 54;
    const gap = 8;
    const visibleCount = Math.max(4, Math.floor((width - 32) / (tileW + gap)));
    const startIdx = Math.max(0, Math.min(melodyEvents.length - visibleCount, activeIdx - Math.floor(visibleCount / 2)));
    const endIdx = Math.min(melodyEvents.length, startIdx + visibleCount);

    for (let i = startIdx; i < endIdx; i++) {
      const ev = melodyEvents[i];
      const tx = 16 + (i - startIdx) * (tileW + gap);
      const ty = tileY + 12;
      const isActive = i === activeIdx;
      const isHovered = hoveredTarget?.algorithm === 'norgard' &&
        (hoveredTarget.index % melodyEvents.length) === i;

      ctx.fillStyle = isActive
        ? 'rgba(240, 200, 120, 0.28)'
        : isHovered
          ? 'rgba(240, 200, 120, 0.18)'
          : 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = (isActive || isHovered) ? COLOR : 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = isActive ? 2.5 : isHovered ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tileW, tileH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#9e96b0';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`k=${ev.meta.index}`, tx + tileW / 2, ty + 14);

      ctx.fillStyle = isActive ? COLOR : '#f0eaf8';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${ev.meta.value}`, tx + tileW / 2, ty + 32);

      ctx.fillStyle = '#cfc6dc';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(ev.note, tx + tileW / 2, ty + 48);
      ctx.textAlign = 'left';

      tileBoxes.push({ x: tx, y: ty, w: tileW, h: tileH, index: i, event: ev });
    }

    // ─── Section 3: Pitch-Contour + Half-Speed Self-Similarity ───────
    const graphTop = tileY + 86;
    const graphH = Math.max(90, height - graphTop - 22);
    const graphW = width - 32;

    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('Pitch Contour & Half-Speed Self-Similarity ("melody inside itself")', 16, graphTop);

    // Legend
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = COLOR;
    ctx.fillText('━━ n(k) 1×', width - 210, graphTop);
    ctx.fillStyle = '#ffe9b3';
    ctx.fillText('╌●╌ n(⌊k/2⌋) ½× echo', width - 135, graphTop);

    const plotY = graphTop + 14;
    const plotH = Math.max(54, graphH - 20);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.roundRect(16, plotY, graphW, plotH, 8);
    ctx.fill();

    // Window of 32 samples around activeIdx
    const winLen = Math.min(32, melodyEvents.length);
    const winStart = Math.max(0, Math.min(melodyEvents.length - winLen, activeIdx - Math.floor(winLen / 2)));
    let minV = Infinity, maxV = -Infinity;
    for (let i = winStart; i < winStart + winLen; i++) {
      const v = melodyEvents[i].meta.value;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const span = Math.max(2, maxV - minV);
    const toX = (idx) => 28 + ((idx - winStart) / Math.max(1, winLen - 1)) * (graphW - 24);
    const toY = (val) => plotY + plotH - 12 - ((val - minV) / span) * (plotH - 24);

    // Zero line
    if (minV <= 0 && maxV >= 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, toY(0));
      ctx.lineTo(16 + graphW - 8, toY(0));
      ctx.stroke();
    }

    // Half-speed self-similar overlay: n(floor(k/2))
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 233, 179, 0.65)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let i = winStart; i < winStart + winLen; i++) {
      const halfVal = norgard(Math.floor(i / 2));
      const x = toX(i);
      const y = toY(halfVal);
      if (i === winStart) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Main 1x melody contour
    ctx.strokeStyle = COLOR;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = winStart; i < winStart + winLen; i++) {
      const x = toX(i);
      const y = toY(melodyEvents[i].meta.value);
      if (i === winStart) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Active playhead marker on contour
    if (activeIdx >= winStart && activeIdx < winStart + winLen) {
      const ax = toX(activeIdx);
      const ay = toY(activeEvt.meta.value);
      ctx.fillStyle = COLOR;
      ctx.beginPath();
      ctx.arc(ax, ay, reducedMotion ? 5 : 6, 0, Math.PI * 2);
      ctx.fill();

      const noteLbl = midiToName(degreeToMidi(activeEvt.meta.value, scale, rootNote));
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(noteLbl, Math.min(16 + graphW - 36, ax + 8), Math.max(plotY + 14, ay - 6));
    }
  }

  function hitTest(x, y) {
    for (const box of tileBoxes) {
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        return { algorithm: 'norgard', index: box.index, event: box.event };
      }
    }
    return null;
  }

  return { draw, hitTest };
}
