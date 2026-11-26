/**
 * L-System — Lab Simulation
 *
 * Left pane: Generation-by-generation rewriting string (Gen 0, 1, 2, ...)
 *   with color + symbol legend and the active turtle symbol highlighted.
 * Right pane: Step-by-step turtle drawing using Nørgård branch angles,
 *   showing the turtle cursor at the active drawing point.
 */

import { lsystemSafe, LSYSTEM_PRESETS, parseLSystemToCommands } from '../algorithms/lsystem.js';
import { computeTreeBranches } from '../visuals/tree.js';
import { ALGORITHMS } from '../algorithms/meta.js';

const COLOR = ALGORITHMS.lsystem.color;

const SYMBOL_COLORS = {
  'F': '#f078c8',
  'X': '#a8d5a2',
  '+': '#f0c878',
  '-': '#78c8f0',
  '[': '#c8a8f0',
  ']': '#c8a8f0'
};

export function createLSystemSim() {
  let branchBoxes = [];
  let selectedGen = null;

  function setGeneration(gen) {
    selectedGen = gen;
  }

  function draw(ctx, width, height, { score, currentTime, hoveredTarget, reducedMotion }) {
    branchBoxes = [];
    if (!score) return;

    const lCfg = score.lsystemConfig || score.params?.lsystem || {};
    const presetName = lCfg.preset || score.params?.lsystemPreset || 'Fern';
    const preset = LSYSTEM_PRESETS[presetName] || LSYSTEM_PRESETS['Fern'];
    const axiom = lCfg.axiom || preset.axiom;
    const rules = lCfg.rules || preset.rules;
    const maxGen = lCfg.generations ?? Math.min(score.params?.depth || 4, preset.maxGen || 5);
    const gen = selectedGen !== null ? Math.min(maxGen, Math.max(0, selectedGen)) : maxGen;

    const safeOut = lsystemSafe(axiom, rules, gen);
    const str = safeOut.result;
    const commands = parseLSystemToCommands(str);
    const baseAngle = lCfg.turnAngle ?? score.params?.branchAngle ?? preset.angle;
    const lengthRatio = lCfg.lengthRatio ?? 0.72;
    const lineThickness = lCfg.lineThickness ?? 6;

    // Progress through commands smoothly synced with currentTime
    const totalCmds = Math.max(1, commands.length);
    const cycleSec = Math.max(6, Math.min(18, totalCmds * 0.03));
    const progress = reducedMotion ? 1 : ((currentTime % cycleSec) / cycleSec);
    const activeCmdIdx = Math.max(0, Math.min(totalCmds - 1, Math.floor(progress * totalCmds)));

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`▲ L-System (${presetName}) — Generation ${gen} (${str.length} symbols)`, 16, 26);

    // Symbol legend
    ctx.font = '13px monospace';
    ctx.fillStyle = '#c8c0d8';
    ctx.fillText('F=draw  +=right  -=left  [=save  ]=restore', 16, 48);

    const splitX = width > 560 ? width * 0.46 : width;

    // ─── Left Pane: Rewriting Generations & Symbol Stream ────────────
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.roundRect(16, 62, splitX - 24, height - 78, 8);
    ctx.fill();

    // Show gen 0..gen preview lines
    let gy = 86;
    for (let g = 0; g <= Math.min(gen, 3); g++) {
      const gStr = lsystemSafe(axiom, rules, g).result;
      const preview = gStr.length > 34 ? gStr.slice(0, 34) + '…' : gStr;
      ctx.fillStyle = g === gen ? COLOR : '#9e96b0';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`Gen ${g}: ${preview}`, 26, gy);
      gy += 22;
    }

    // Current symbol stream window around activeCmdIdx
    gy += 10;
    ctx.fillStyle = '#e8e2f0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`Turtle Stream (step ${activeCmdIdx + 1}/${totalCmds}):`, 26, gy);
    gy += 20;

    const charsPerRow = Math.max(12, Math.floor((splitX - 52) / 14));
    const maxChars = charsPerRow * Math.max(3, Math.floor((height - gy - 26) / 22));
    const winStart = Math.max(0, Math.min(str.length - maxChars, activeCmdIdx - Math.floor(maxChars / 2)));
    const winEnd = Math.min(str.length, winStart + maxChars);

    for (let i = winStart; i < winEnd; i++) {
      const rel = i - winStart;
      const col = rel % charsPerRow;
      const row = Math.floor(rel / charsPerRow);
      const sx = 26 + col * 14;
      const sy = gy + row * 22;
      const ch = str[i];

      if (i === activeCmdIdx) {
        ctx.fillStyle = COLOR;
        ctx.fillRect(sx - 2, sy - 14, 13, 18);
        ctx.fillStyle = '#141020';
      } else {
        ctx.fillStyle = SYMBOL_COLORS[ch] || '#c0b8d0';
      }
      ctx.font = i === activeCmdIdx ? 'bold 14px monospace' : '14px monospace';
      ctx.fillText(ch, sx, sy);
    }

    // ─── Right Pane: Step-by-Step Turtle Canvas ─────────────────────
    const treePaneX = width > 560 ? splitX + 4 : 16;
    const treePaneW = width > 560 ? width - splitX - 20 : width - 32;
    const treePaneY = width > 560 ? 62 : Math.max(gy + 54, height * 0.55);
    const treePaneH = height - treePaneY - 16;

    const treeX = treePaneX + treePaneW * 0.5;
    const treeGroundY = treePaneY + treePaneH - 18;
    const treeH = Math.max(70, treePaneH - 36);

    const visibleCommands = commands.slice(0, activeCmdIdx + 1);
    const branches = computeTreeBranches(
      visibleCommands,
      score.branchAngles || [baseAngle],
      baseAngle,
      treeX,
      treeGroundY,
      treeH,
      999,
      lengthRatio
    );

    for (const b of branches) {
      const isHl = hoveredTarget?.algorithm === 'lsystem' && hoveredTarget.index === b.index;
      ctx.strokeStyle = isHl ? '#ffffff' : b.depth === 0 ? '#9c7a64' : COLOR;
      ctx.lineWidth = isHl ? 3.5 : Math.max(0.8, (lineThickness * 0.65) - b.depth * 0.6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      branchBoxes.push({ mx: (b.x1 + b.x2) * 0.5, my: (b.y1 + b.y2) * 0.5, index: b.index });
    }

    // Turtle cursor at last branch tip
    if (branches.length > 0) {
      const last = branches[branches.length - 1];
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(last.x2, last.y2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function hitTest(x, y) {
    let best = null;
    let bestD = 144;
    for (const b of branchBoxes) {
      const d2 = (x - b.mx) * (x - b.mx) + (y - b.my) * (y - b.my);
      if (d2 < bestD) {
        bestD = d2;
        best = b;
      }
    }
    return best ? { algorithm: 'lsystem', index: best.index } : null;
  }

  return { draw, hitTest, setGeneration };
}
