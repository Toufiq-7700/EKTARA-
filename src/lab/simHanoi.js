/**
 * Tower of Hanoi — Lab Simulation
 *
 * Left pane: Large 3-peg animation with discs gliding in smooth arcs
 * (or instant step transitions for prefers-reduced-motion), move counter,
 * smallest-disc rule reminder, and live pitch/duration mapping badge.
 *
 * Right pane: Recursive call tree hanoi(n) -> hanoi(n-1) + move + hanoi(n-1)
 * with the active call highlighted.
 */

import { ALGORITHMS } from '../algorithms/meta.js';

const COLOR = ALGORITHMS.hanoi.color;
const DISC_COLORS = ['#f0a060', '#e08070', '#d060a0', '#a060d0', '#78c8f0', '#60c0a0'];

function buildCallTreeNodes(n, from = 'A', to = 'C', via = 'B', depth = 0, stepRef = { val: 0 }, out = []) {
  if (n <= 0) return out;
  if (depth < 3) {
    out.push({ kind: 'call', n, from, to, via, depth, startStep: stepRef.val, endStep: stepRef.val + ((1 << n) - 1) - 1 });
  }
  buildCallTreeNodes(n - 1, from, via, to, depth + 1, stepRef, out);
  const myStep = stepRef.val++;
  if (depth < 3) {
    out.push({ kind: 'move', disc: n, from, to, depth: depth + 1, step: myStep });
  }
  buildCallTreeNodes(n - 1, via, to, from, depth + 1, stepRef, out);
  return out;
}

export function createHanoiSim() {
  let discBoxes = [];

  function draw(ctx, width, height, { score, currentTime, hoveredTarget, reducedMotion }) {
    discBoxes = [];
    if (!score) return;

    const bassEvents = score.events.filter(e => e.voice === 'bass' && e.meta?.algorithm === 'hanoi');
    const hCfg = score.params?.hanoi || {};
    const n = hCfg.discs ?? Math.min(score.params?.depth || 4, 6);
    const startPeg = hCfg.startPeg || 'A';
    const targetPeg = hCfg.targetPeg || 'C';
    const pegIntervals = hCfg.pegIntervals || { A: 0, B: 7, C: 12 };
    const totalPossible = Math.pow(2, n) - 1;
    const totalMoves = bassEvents.length;

    ctx.clearRect(0, 0, width, height);

    // Determine active move and animation progress
    let activeMoveIdx = -1;
    let moveProgress = 1;
    for (let i = 0; i < bassEvents.length; i++) {
      if (bassEvents[i].time <= currentTime) {
        activeMoveIdx = i;
      } else {
        break;
      }
    }

    if (activeMoveIdx >= 0) {
      const evt = bassEvents[activeMoveIdx];
      const nextTime = activeMoveIdx + 1 < bassEvents.length ? bassEvents[activeMoveIdx + 1].time : evt.time + 1.5;
      const moveWindow = Math.min(1.1, Math.max(0.35, (nextTime - evt.time) * 0.65));
      moveProgress = reducedMotion ? 1 : Math.min(1, (currentTime - evt.time) / moveWindow);
    }

    // Reconstruct peg stacks cleanly from initial startPeg up to activeMoveIdx
    const pegs = { A: [], B: [], C: [] };
    for (let d = n; d >= 1; d--) pegs[startPeg].push(d);

    let animatingDisc = null;
    for (let i = 0; i <= activeMoveIdx; i++) {
      const m = bassEvents[i].meta;
      const fromPeg = pegs[m.from];
      const idx = fromPeg.indexOf(m.disc);
      if (idx !== -1) fromPeg.splice(idx, 1);

      if (i === activeMoveIdx && moveProgress < 0.99) {
        animatingDisc = { ...m, progress: moveProgress, event: bassEvents[i] };
      } else {
        pegs[m.to].push(m.disc);
      }
    }

    // ─── Header & Rule Info ─────────────────────────────────────────
    const moveLabel = activeMoveIdx >= 0
      ? `Move ${activeMoveIdx + 1} of ${totalMoves}${totalMoves < totalPossible ? ` (2^${n}-1 = ${totalPossible})` : ''}`
      : `Ready (0 of ${totalMoves})`;
    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`▬ Tower of Hanoi (${startPeg}→${targetPeg}) — ${moveLabel}`, 16, 26);

    ctx.fillStyle = '#b4acc8';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Rule: disc 1 moves every 2nd step; larger discs play longer, lower bass notes.', 16, 48);

    // Musical mapping badge for active move
    if (activeMoveIdx >= 0) {
      const activeEvt = bassEvents[activeMoveIdx];
      const m = activeEvt.meta;
      const iv = pegIntervals[m.to] ?? 0;
      const pegRole = iv === 0 ? 'Root' : `+${iv}st`;
      ctx.fillStyle = 'rgba(120, 200, 240, 0.16)';
      ctx.strokeStyle = COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(16, 60, Math.min(width - 32, 420), 30, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLOR;
      ctx.font = 'bold 14px monospace';
      ctx.fillText(
        `disc ${m.disc} ${m.from}→${m.to} (${pegRole}) → ${activeEvt.note} (${activeEvt.duration.toFixed(1)}s)`,
        26,
        80
      );
    }

    // Layout split: left 58% pegs, right 42% recursive call tree
    const splitX = width > 560 ? width * 0.58 : width;
    const pegsTop = 108;
    const groundY = width > 560 ? height - 48 : height * 0.55;
    const pegH = Math.max(80, groundY - pegsTop - 20);
    const pegSpacing = Math.max(75, (splitX - 60) / 3);
    const pegXs = {
      A: splitX * 0.5 - pegSpacing,
      B: splitX * 0.5,
      C: splitX * 0.5 + pegSpacing
    };
    const discH = Math.min(20, Math.max(12, (pegH - 12) / Math.max(3, n + 1)));
    const maxDiscW = Math.min(pegSpacing * 0.44, 54);

    // Ground bar
    ctx.fillStyle = 'rgba(120, 200, 240, 0.25)';
    ctx.fillRect(20, groundY, splitX - 40, 3);

    const ivName = (iv) => (iv === 0 ? 'Root' : iv === 7 ? '5th' : iv === 12 ? 'Octave' : `+${iv}st`);
    const pegLabels = {
      A: `A · ${ivName(pegIntervals.A ?? 0)}`,
      B: `B · ${ivName(pegIntervals.B ?? 7)}`,
      C: `C · ${ivName(pegIntervals.C ?? 12)}`
    };
    for (const pegName of ['A', 'B', 'C']) {
      const px = pegXs[pegName];

      // Peg pole
      ctx.fillStyle = 'rgba(120, 200, 240, 0.55)';
      ctx.beginPath();
      ctx.roundRect(px - 4, groundY - pegH, 8, pegH, 4);
      ctx.fill();

      // Peg label
      ctx.fillStyle = '#dcd5ea';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pegLabels[pegName], px, groundY + 22);
      ctx.textAlign = 'left';

      // Discs on peg
      const stack = pegs[pegName];
      for (let i = 0; i < stack.length; i++) {
        const disc = stack[i];
        const dw = (0.35 + 0.65 * (disc / n)) * maxDiscW;
        const dy = groundY - (i + 1) * discH;
        const color = DISC_COLORS[(disc - 1) % DISC_COLORS.length];
        const isHl = hoveredTarget?.algorithm === 'hanoi' && hoveredTarget.disc === disc;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(px - dw, dy, dw * 2, discH - 3, 5);
        ctx.fill();

        if (isHl) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        ctx.fillStyle = '#120f1c';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${disc}`, px, dy + discH - 6);
        ctx.textAlign = 'left';

        discBoxes.push({ x: px - dw, y: dy, w: dw * 2, h: discH, disc, peg: pegName });
      }
    }

    // Animating disc arc
    if (animatingDisc) {
      const { disc, from, to, progress } = animatingDisc;
      const fx = pegXs[from];
      const tx = pegXs[to];
      const x = fx + (tx - fx) * progress;
      const arcH = pegH + 22;
      const y = groundY - discH - arcH * Math.sin(progress * Math.PI);
      const dw = (0.35 + 0.65 * (disc / n)) * maxDiscW;
      const color = DISC_COLORS[(disc - 1) % DISC_COLORS.length];

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x - dw, y, dw * 2, discH - 3, 5);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#120f1c';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${disc}`, x, y + discH - 6);
      ctx.textAlign = 'left';

      discBoxes.push({ x: x - dw, y, w: dw * 2, h: discH, disc, peg: to });
    }

    // ─── Right Pane: Recursive Call Tree ────────────────────────────
    const callX = width > 560 ? splitX + 12 : 16;
    const callY = width > 560 ? 64 : groundY + 42;
    const callW = width > 560 ? width - splitX - 24 : width - 32;
    const callH = height - callY - 16;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.roundRect(callX, callY, callW, Math.max(80, callH), 8);
    ctx.fill();

    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`Recursive Calls (n=${n})`, callX + 12, callY + 22);

    const nodes = buildCallTreeNodes(Math.min(n, 6), startPeg, targetPeg);
    const maxRows = Math.max(4, Math.floor((callH - 36) / 22));
    // Scroll window to keep active step visible
    let focusRow = 0;
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      if (nd.kind === 'move' && nd.step === activeMoveIdx) {
        focusRow = i;
        break;
      }
      if (nd.kind === 'call' && activeMoveIdx >= nd.startStep && activeMoveIdx <= nd.endStep) {
        focusRow = i;
      }
    }
    const winStart = Math.max(0, Math.min(nodes.length - maxRows, focusRow - Math.floor(maxRows / 2)));
    const winEnd = Math.min(nodes.length, winStart + maxRows);

    for (let i = winStart; i < winEnd; i++) {
      const nd = nodes[i];
      const ry = callY + 44 + (i - winStart) * 22;
      const indent = nd.depth * 14;
      const isCallActive = nd.kind === 'call' && activeMoveIdx >= nd.startStep && activeMoveIdx <= nd.endStep;
      const isMoveActive = nd.kind === 'move' && nd.step === activeMoveIdx;

      if (isMoveActive || isCallActive) {
        ctx.fillStyle = isMoveActive ? 'rgba(120, 200, 240, 0.25)' : 'rgba(120, 200, 240, 0.1)';
        ctx.fillRect(callX + 6, ry - 14, callW - 12, 20);
      }

      ctx.fillStyle = isMoveActive ? COLOR : isCallActive ? '#d8eefc' : '#9c94b0';
      ctx.font = isMoveActive ? 'bold 13px monospace' : '13px monospace';
      const txt = nd.kind === 'call'
        ? `hanoi(${nd.n}, ${nd.from}→${nd.to}, via ${nd.via})`
        : `↳ move disc ${nd.disc}: ${nd.from}→${nd.to}`;
      ctx.fillText(txt, callX + 12 + indent, ry);
    }
  }

  function hitTest(x, y) {
    for (const box of discBoxes) {
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        return { algorithm: 'hanoi', disc: box.disc, peg: box.peg };
      }
    }
    return null;
  }

  return { draw, hitTest };
}
