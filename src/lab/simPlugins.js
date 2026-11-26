/**
 * Dedicated Lab Simulations for Plugin Algorithms
 *
 * Provides step-by-step recursive visualizations for:
 *   - Thue-Morse (melody & rhythm)
 *   - Fibonacci Word (melody)
 *   - Recursive Gray Code (bass)
 *   - Cantor Set (bass & rhythm)
 */

import { thueMorse } from '../algorithms/thueMorse.js';
import { ROLES_META, formatEventCaption } from '../algorithms/meta.js';
import { getAlgorithmPlugin } from '../algorithms/registry.js';

// ─── Thue-Morse Simulation (Melody or Rhythm) ─────────────────────────────────

export function createThueMorseSim(role = 'melody') {
  const roleMeta = ROLES_META[role];
  const COLOR = roleMeta.color;
  let boxes = [];

  function buildParityChain(n) {
    const chain = [];
    let cur = n;
    let guard = 0;
    while (cur >= 0 && guard < 12) {
      chain.push({ n: cur, bit: thueMorse(cur), kind: cur === 0 ? 'base' : cur % 2 === 0 ? 'even' : 'odd' });
      if (cur === 0) break;
      cur = cur % 2 === 0 ? cur / 2 : (cur - 1) / 2;
      guard++;
    }
    return chain;
  }

  function draw(ctx, width, height, { score, currentTime, hoveredTarget }) {
    boxes = [];
    if (!score) return;

    const plugin = getAlgorithmPlugin(role, role === 'melody' ? 'thue-morse' : 'thue-morse-rhythm');
    const trace = plugin.trace({ params: score.params });
    const bits = trace.bits || [0, 1, 1, 0];
    const offset = trace.offset || 0;

    const voiceFilter = role === 'melody' ? 'melody' : 'percussion';
    const roleEvents = score.events.filter(e => e.voice === voiceFilter);
    let activeEvtIdx = 0;
    for (let i = 0; i < roleEvents.length; i++) {
      if (roleEvents[i].time <= currentTime) activeEvtIdx = i;
      else break;
    }
    const activeEvt = roleEvents[activeEvtIdx];
    const activeStep = (activeEvt?.meta?.localIndex ?? activeEvt?.meta?.step ?? 0) % bits.length;
    const activeN = offset + activeStep;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`${roleMeta.shape} Thue-Morse Parity Tree — t(${activeN}) = ${thueMorse(activeN)}`, 16, 26);

    const chain = buildParityChain(activeN);
    const expr = chain.map((c, idx) => idx === 0
      ? `t(${c.n})`
      : chain[idx - 1].kind === 'even' ? `t(${c.n})` : `1 − t(${c.n})`
    ).slice(0, 4).join(' = ') + ` = ${chain[0].bit}`;
    ctx.fillStyle = COLOR;
    ctx.font = '14px monospace';
    ctx.fillText(expr, 16, 48);

    // Draw recursive chain nodes horizontally
    const nodeGap = Math.min(115, (width - 64) / Math.max(1, chain.length));
    for (let i = 0; i < Math.min(chain.length, 6); i++) {
      const c = chain[i];
      const nx = 44 + i * nodeGap;
      const ny = 86;
      if (i > 0) {
        ctx.strokeStyle = COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(nx - nodeGap + 34, ny);
        ctx.lineTo(nx - 34, ny);
        ctx.stroke();
      }
      ctx.fillStyle = i === 0 ? COLOR : 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(nx - 34, ny - 15, 68, 30, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = i === 0 ? '#141020' : '#f2edf8';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`t(${c.n})=${c.bit}`, nx, ny + 5);
      ctx.textAlign = 'left';
    }

    // Sequence tiles
    const tileY = 140;
    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('Self-Similar Bit Sequence (t(2n)=t(n), t(2n+1)=1−t(n)):', 16, tileY);

    const tileW = 46;
    const tileH = 48;
    const gap = 6;
    const perRow = Math.max(6, Math.floor((width - 32) / (tileW + gap)));
    const showCount = Math.min(bits.length, perRow * 2);

    for (let i = 0; i < showCount; i++) {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const tx = 16 + col * (tileW + gap);
      const ty = tileY + 12 + row * (tileH + 8);
      const isAct = i === activeStep;
      const isHl = hoveredTarget && hoveredTarget.role === role &&
        ((hoveredTarget.index ?? hoveredTarget.step ?? -1) % bits.length) === i;

      ctx.fillStyle = isAct ? roleMeta.bgTint : 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = (isAct || isHl) ? COLOR : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = isAct ? 2.5 : isHl ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tileW, tileH, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#9e96b0';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${offset + i}`, tx + tileW / 2, ty + 14);
      ctx.fillStyle = bits[i] === 1 ? COLOR : '#d4cce4';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`${bits[i]}`, tx + tileW / 2, ty + 36);
      ctx.textAlign = 'left';

      boxes.push({ x: tx, y: ty, w: tileW, h: tileH, index: i });
    }

    // Musical mapping caption at bottom
    const capY = Math.min(height - 16, tileY + 132);
    ctx.fillStyle = COLOR;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(formatEventCaption(activeEvt), 16, capY);
  }

  function hitTest(x, y) {
    for (const b of boxes) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return role === 'melody'
          ? { role: 'melody', algorithm: 'thue-morse', index: b.index }
          : { role: 'rhythm', algorithm: 'thue-morse-rhythm', step: b.index };
      }
    }
    return null;
  }

  return { draw, hitTest };
}

// ─── Fibonacci Word Simulation (Melody) ───────────────────────────────────────

export function createFibonacciWordSim() {
  const COLOR = ROLES_META.melody.color;
  let boxes = [];

  function draw(ctx, width, height, { score, currentTime, hoveredTarget }) {
    boxes = [];
    if (!score) return;

    const plugin = getAlgorithmPlugin('melody', 'fibonacci-word');
    const trace = plugin.trace({ params: score.params });
    const steps = trace.steps || ['0', '01'];
    const word = trace.word || '0100101001001';

    const melEvts = score.events.filter(e => e.voice === 'melody');
    let activeIdx = 0;
    for (let i = 0; i < melEvts.length; i++) {
      if (melEvts[i].time <= currentTime) activeIdx = i;
      else break;
    }
    const activeEvt = melEvts[activeIdx];
    const activeCharIdx = (activeEvt?.meta?.index ?? 0) % word.length;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`◆ Fibonacci Word — S_n = S_(n−1) + S_(n−2) (Gen ${trace.generation})`, 16, 26);

    // Show recursive concatenation generations S_0 .. S_n
    let y = 52;
    const maxShow = Math.min(steps.length, 6);
    const startGen = steps.length - maxShow;
    for (let g = startGen; g < steps.length; g++) {
      const s = steps[g];
      const trimmed = s.length > 44 ? s.slice(0, 44) + '…' : s;
      ctx.fillStyle = g === steps.length - 1 ? COLOR : '#b8b0cc';
      ctx.font = g === steps.length - 1 ? 'bold 14px monospace' : '13px monospace';
      ctx.fillText(`S_${g}: ${trimmed}`, 16, y);
      y += 22;
    }

    // Character tiles
    const tileY = y + 12;
    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('Active Word Stream ("1" rises +2 steps, "0" steps -1, "00" rests):', 16, tileY);

    const tileW = 36;
    const tileH = 42;
    const gap = 5;
    const visibleCount = Math.max(6, Math.floor((width - 32) / (tileW + gap)));
    const start = Math.max(0, Math.min(word.length - visibleCount, activeCharIdx - Math.floor(visibleCount / 2)));
    const end = Math.min(word.length, start + visibleCount);

    for (let i = start; i < end; i++) {
      const tx = 16 + (i - start) * (tileW + gap);
      const ty = tileY + 12;
      const ch = word[i];
      const isAct = i === activeCharIdx;
      const isHl = hoveredTarget?.role === 'melody' && (hoveredTarget.index % word.length) === i;

      ctx.fillStyle = isAct ? ROLES_META.melody.bgTint : 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = (isAct || isHl) ? COLOR : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = isAct ? 2.5 : 1;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tileW, tileH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#9e96b0';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${i}`, tx + tileW / 2, ty + 12);
      ctx.fillStyle = ch === '1' ? COLOR : '#d4cce4';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(ch, tx + tileW / 2, ty + 33);
      ctx.textAlign = 'left';

      boxes.push({ x: tx, y: ty, w: tileW, h: tileH, index: i });
    }

    ctx.fillStyle = COLOR;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(formatEventCaption(activeEvt), 16, Math.min(height - 14, tileY + 82));
  }

  function hitTest(x, y) {
    for (const b of boxes) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return { role: 'melody', algorithm: 'fibonacci-word', index: b.index };
      }
    }
    return null;
  }

  return { draw, hitTest };
}

// ─── Recursive Gray Code Simulation (Bass) ────────────────────────────────────

export function createGrayCodeSim() {
  const COLOR = ROLES_META.bass.color;
  let boxes = [];

  function draw(ctx, width, height, { score, currentTime, hoveredTarget }) {
    boxes = [];
    if (!score) return;

    const plugin = getAlgorithmPlugin('bass', 'gray-code');
    const trace = plugin.trace({ params: score.params });
    const levels = trace.levels || [['0', '1']];
    const transitions = trace.transitions || [];

    const bassEvts = score.events.filter(e => e.voice === 'bass');
    let activeIdx = 0;
    for (let i = 0; i < bassEvts.length; i++) {
      if (bassEvts[i].time <= currentTime) activeIdx = i;
      else break;
    }
    const activeEvt = bassEvts[activeIdx];
    const activeTrIdx = activeIdx % Math.max(1, transitions.length);
    const activeTr = transitions[activeTrIdx];

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`▬ Recursive Gray Code (${trace.bits}-bit reflect & prefix, 1 bit flips per note)`, 16, 26);

    // Left: recursive reflect-and-prefix levels
    const splitX = width > 540 ? width * 0.45 : width;
    let ly = 54;
    for (let lv = 0; lv < levels.length; lv++) {
      const arr = levels[lv];
      const preview = arr.slice(0, 8).join(', ') + (arr.length > 8 ? ', …' : '');
      ctx.fillStyle = lv === levels.length - 1 ? COLOR : '#b4acc8';
      ctx.font = '13px monospace';
      ctx.fillText(`${lv + 1}-bit: [${preview}]`, 16, ly);
      ly += 22;
    }

    // Sequence grid of transitions
    const gridX = width > 540 ? splitX + 12 : 16;
    const gridY = width > 540 ? 52 : ly + 12;
    const cellW = 72;
    const cellH = 44;
    const gap = 6;
    const cols = Math.max(2, Math.floor((width - gridX - 16) / (cellW + gap)));

    for (let i = 0; i < Math.min(transitions.length, 16); i++) {
      const tr = transitions[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = gridX + col * (cellW + gap);
      const cy = gridY + row * (cellH + gap);
      const isAct = i === activeTrIdx;
      const isHl = hoveredTarget?.role === 'bass' && hoveredTarget.disc === (tr.flippedBit + 1);

      ctx.fillStyle = isAct ? ROLES_META.bass.bgTint : 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = (isAct || isHl) ? COLOR : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = isAct ? 2.5 : 1;
      ctx.beginPath();
      ctx.roundRect(cx, cy, cellW, cellH, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isAct ? COLOR : '#f0eaf8';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tr.code, cx + cellW / 2, cy + 20);
      ctx.fillStyle = '#a49cb8';
      ctx.font = '11px monospace';
      ctx.fillText(`flip b${tr.flippedBit}`, cx + cellW / 2, cy + 36);
      ctx.textAlign = 'left';

      boxes.push({ x: cx, y: cy, w: cellW, h: cellH, disc: tr.flippedBit + 1 });
    }

    // Active explanation
    if (activeTr) {
      ctx.fillStyle = COLOR;
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(formatEventCaption(activeEvt), 16, height - 16);
    }
  }

  function hitTest(x, y) {
    for (const b of boxes) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return { role: 'bass', algorithm: 'gray-code', disc: b.disc };
      }
    }
    return null;
  }

  return { draw, hitTest };
}

// ─── Cantor Set Simulation (Bass or Rhythm) ───────────────────────────────────

export function createCantorSim(role = 'rhythm') {
  const roleMeta = ROLES_META[role];
  const COLOR = roleMeta.color;
  let boxes = [];

  function draw(ctx, width, height, { score, currentTime, hoveredTarget }) {
    boxes = [];
    if (!score) return;

    const algId = role === 'bass' ? 'cantor-bass' : 'cantor-rhythm';
    const plugin = getAlgorithmPlugin(role, algId);
    const trace = plugin.trace({ params: score.params });
    const levels = trace.levels || [[true]];
    const finalPat = levels[levels.length - 1];

    const voiceFilter = role === 'bass' ? 'bass' : 'percussion';
    const evts = score.events.filter(e => e.voice === voiceFilter);
    let activeEvtIdx = 0;
    for (let i = 0; i < evts.length; i++) {
      if (evts[i].time <= currentTime) activeEvtIdx = i;
      else break;
    }
    const activeEvt = evts[activeEvtIdx];
    const activeStep = (activeEvt?.meta?.index ?? activeEvt?.meta?.step ?? 0) % finalPat.length;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`${roleMeta.shape} Cantor Set (Remove Middle Third) — Depth ${trace.depth} (${finalPat.length} segments)`, 16, 26);

    // Draw fractal Cantor bar ladder
    const barW = width - 48;
    const barH = 26;
    let y = 52;
    for (let lv = 0; lv < levels.length; lv++) {
      const pat = levels[lv];
      const segW = barW / pat.length;
      const isLast = lv === levels.length - 1;

      ctx.fillStyle = '#b4acc8';
      ctx.font = '12px monospace';
      ctx.fillText(`d=${lv}`, 12, y + 17);

      for (let i = 0; i < pat.length; i++) {
        const sx = 40 + i * segW;
        const isAct = isLast && i === activeStep;
        const isHl = isLast && hoveredTarget?.role === role &&
          ((hoveredTarget.step ?? hoveredTarget.disc ?? -1) % pat.length) === i;

        if (pat[i]) {
          ctx.fillStyle = isAct ? '#ffffff' : COLOR;
          ctx.globalAlpha = isLast ? (isAct ? 1 : 0.85) : 0.55;
          ctx.fillRect(sx + 0.5, y, Math.max(2, segW - 1), barH);
          ctx.globalAlpha = 1;
          if (isHl) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(sx + 0.5, y, Math.max(2, segW - 1), barH);
          }
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(sx + 0.5, y + barH * 0.4, Math.max(2, segW - 1), 4);
        }

        if (isLast) {
          boxes.push({ x: sx, y, w: Math.max(6, segW), h: barH, index: i });
        }
      }
      y += barH + 14;
    }

    // Active caption
    ctx.fillStyle = COLOR;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(formatEventCaption(activeEvt), 16, Math.min(height - 16, y + 26));
  }

  function hitTest(x, y) {
    for (const b of boxes) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return role === 'bass'
          ? { role: 'bass', algorithm: 'cantor-bass', disc: (b.index % 3) + 1 }
          : { role: 'rhythm', algorithm: 'cantor-rhythm', step: b.index };
      }
    }
    return null;
  }

  return { draw, hitTest };
}
