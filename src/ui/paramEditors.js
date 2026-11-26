/**
 * Shared Per-Algorithm Parameter Editor (Lab Cards + Control Drawer)
 *
 * Builds accessible, plain-English controls (>= 14px) with tooltips, live
 * readouts, inline validation (Euclidean k <= n, L-system symbol validation),
 * live command/move estimates, safety cap notices, Reset, and seeded Randomise.
 */

import { LSYSTEM_PRESETS, validateLSystem, lsystemSafe } from '../algorithms/lsystem.js';
import { validateEuclideanParams } from '../algorithms/bjorklund.js';
import { hanoiMoveCount } from '../algorithms/hanoi.js';
import { createPRNG } from '../algorithms/prng.js';
import { getAlgorithmPlugin } from '../algorithms/registry.js';
import {
  PEG_INTERVAL_CHOICES,
  normalizeParams,
  resetAlgorithmParams,
  randomiseAlgorithmParams
} from '../algorithms/params.js';

let randomSalt = 1;

function resolvePluginAndKey(roleOrId, params) {
  if (['melody', 'bass', 'rhythm', 'tree'].includes(roleOrId)) {
    const plugin = getAlgorithmPlugin(roleOrId, params.roles?.[roleOrId]);
    return { role: roleOrId, plugin, effectiveId: plugin.id };
  }
  const roleMap = { norgard: 'melody', hanoi: 'bass', bjorklund: 'rhythm', lsystem: 'tree' };
  const role = roleMap[roleOrId] || 'melody';
  const plugin = getAlgorithmPlugin(role, roleOrId);
  return { role, plugin, effectiveId: plugin.id };
}

/**
 * Render HTML controls for a role or plugin (`norgard`, `thue-morse`, `fibonacci-word`, etc.).
 */
export function renderAlgorithmFields(roleOrId, rawParams, scoreStats) {
  const p = normalizeParams(rawParams);
  const { role, plugin, effectiveId: algId } = resolvePluginAndKey(roleOrId, p);

  // Generic schema-driven editor for newly plugged algorithms
  if (!['norgard', 'hanoi', 'bjorklund', 'lsystem'].includes(algId) && plugin?.paramSchema) {
    const curVals = { ...plugin.defaultParams, ...(p.pluginParams?.[algId] || {}) };
    const statLine = scoreStats?.[role] || `${plugin.name}: ready`;
    return `
      <div class="alg-stats-line">${statLine}</div>
      <div class="alg-field-grid">
        ${plugin.paramSchema.map(f => {
          const val = curVals[f.key] ?? f.min;
          if (f.type === 'select') {
            return `
              <label class="alg-field" title="${escapeAttr(f.tooltip || f.label)}">
                <span>${f.label}</span>
                <select data-path="pluginParams.${algId}.${f.key}" aria-label="${escapeAttr(f.label)}">
                  ${(f.options || []).map(o => `<option value="${o.value}"${val === o.value ? ' selected' : ''}>${o.label}</option>`).join('')}
                </select>
              </label>
            `;
          }
          return `
            <label class="alg-field" title="${escapeAttr(f.tooltip || f.label)}">
              <span>${f.label}: <strong class="val-out" data-val="pluginParams.${algId}.${f.key}">${val}</strong></span>
              <input type="range" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${val}"
                     data-path="pluginParams.${algId}.${f.key}" aria-label="${escapeAttr(f.label)}" />
            </label>
          `;
        }).join('')}
      </div>
      ${renderFooterButtons(algId)}
    `;
  }

  if (algId === 'norgard') {
    const n = p.norgard;
    return `
      <div class="alg-stats-line">${scoreStats?.norgard || `Nørgård: ${n.length} notes, d=${n.intervalStep}`}</div>
      <div class="alg-field-grid">
        <label class="alg-field" title="How many notes to generate in the melody cycle">
          <span>Length: <strong class="val-out" data-val="norgard.length">${n.length}</strong></span>
          <input type="range" min="8" max="256" step="4" value="${n.length}"
                 data-path="norgard.length" aria-label="Norgard sequence length" />
        </label>
        <label class="alg-field" title="Where in the infinite Norgard series to begin">
          <span>Start Offset: <strong class="val-out" data-val="norgard.offset">${n.offset}</strong></span>
          <input type="range" min="0" max="512" step="1" value="${n.offset}"
                 data-path="norgard.offset" aria-label="Norgard start index offset" />
        </label>
        <label class="alg-field" title="Generalised step d in n(2k+1) = n(k) + d (1 = classic)">
          <span>Interval Step d: <strong class="val-out" data-val="norgard.intervalStep">${n.intervalStep}</strong></span>
          <input type="range" min="1" max="3" step="1" value="${n.intervalStep}"
                 data-path="norgard.intervalStep" aria-label="Norgard interval step d" />
        </label>
        <label class="alg-field" title="How many octave-up self-similar canon copies play">
          <span>Canon Layers: <strong class="val-out" data-val="norgard.canonLayers">${n.canonLayers}</strong></span>
          <input type="range" min="0" max="3" step="1" value="${n.canonLayers}"
                 data-path="norgard.canonLayers" aria-label="Norgard canon layers" />
        </label>
        <label class="alg-field" title="Speed multiplier between successive canon layers">
          <span>Canon Speed</span>
          <select data-path="norgard.speedRatio" aria-label="Canon speed ratio">
            <option value="2"${n.speedRatio === 2 ? ' selected' : ''}>2× faster</option>
            <option value="3"${n.speedRatio === 3 ? ' selected' : ''}>3× faster</option>
          </select>
        </label>
        <div class="alg-field-pair">
          <label class="alg-field" title="Lowest octave allowed for melody notes">
            <span>Low Oct: <strong class="val-out" data-val="norgard.lowOctave">${n.lowOctave}</strong></span>
            <input type="range" min="2" max="5" step="1" value="${n.lowOctave}"
                   data-path="norgard.lowOctave" aria-label="Melody low octave" />
          </label>
          <label class="alg-field" title="Highest octave allowed for melody notes">
            <span>High Oct: <strong class="val-out" data-val="norgard.highOctave">${n.highOctave}</strong></span>
            <input type="range" min="3" max="7" step="1" value="${n.highOctave}"
                   data-path="norgard.highOctave" aria-label="Melody high octave" />
          </label>
        </div>
      </div>
      ${renderFooterButtons('norgard')}
    `;
  }

  if (algId === 'hanoi') {
    const h = p.hanoi;
    const totalMoves = hanoiMoveCount(h.discs);
    return `
      <div class="alg-stats-line">${scoreStats?.hanoi || `Hanoi: ${h.discs} discs, ${totalMoves} moves`}</div>
      <div class="alg-field-grid">
        <label class="alg-field" title="Number of discs: total recursive moves equals 2^n - 1">
          <span>Discs: <strong class="val-out" data-val="hanoi.discs">${h.discs}</strong> (2^${h.discs}−1 = ${totalMoves} moves)</span>
          <input type="range" min="2" max="8" step="1" value="${h.discs}"
                 data-path="hanoi.discs" aria-label="Hanoi number of discs" />
        </label>
        <label class="alg-field" title="Cap moves per cycle so 7–8 discs stay relaxing">
          <span>Move Limit / Loop: <strong class="val-out" data-val="hanoi.moveLimit">${h.moveLimit}</strong></span>
          <input type="range" min="3" max="255" step="1" value="${h.moveLimit}"
                 data-path="hanoi.moveLimit" aria-label="Hanoi move limit per loop" />
        </label>
        <div class="alg-field-pair">
          <label class="alg-field" title="Peg where all discs begin">
            <span>Start Peg</span>
            <select data-path="hanoi.startPeg" aria-label="Hanoi start peg">
              ${['A', 'B', 'C'].map(peg => `<option value="${peg}"${h.startPeg === peg ? ' selected' : ''}>Peg ${peg}</option>`).join('')}
            </select>
          </label>
          <label class="alg-field" title="Destination peg for the tower">
            <span>Target Peg</span>
            <select data-path="hanoi.targetPeg" aria-label="Hanoi target peg">
              ${['A', 'B', 'C'].map(peg => `<option value="${peg}"${h.targetPeg === peg ? ' selected' : ''}>Peg ${peg}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="alg-field-triple">
          ${['A', 'B', 'C'].map(peg => `
            <label class="alg-field" title="Musical interval played when a disc lands on Peg ${peg}">
              <span>Peg ${peg} Note</span>
              <select data-path="hanoi.pegIntervals.${peg}" aria-label="Peg ${peg} musical interval">
                ${PEG_INTERVAL_CHOICES.map(ch =>
                  `<option value="${ch.value}"${(h.pegIntervals[peg] ?? 0) === ch.value ? ' selected' : ''}>${ch.label}</option>`
                ).join('')}
              </select>
            </label>
          `).join('')}
        </div>
      </div>
      ${renderFooterButtons('hanoi')}
    `;
  }

  if (algId === 'bjorklund') {
    const e = p.euclid;
    return `
      <div class="alg-stats-line">${scoreStats?.euclid || `Euclidean: ${e.rings[0].pulses} of ${e.rings[0].steps}`}</div>
      <div class="alg-field-grid">
        <div class="alg-field-pair">
          <label class="alg-field" title="Layer 1 to 3 Euclidean rings for polyrhythms">
            <span>Rings: <strong class="val-out" data-val="euclid.ringsCount">${e.ringsCount}</strong></span>
            <input type="range" min="1" max="3" step="1" value="${e.ringsCount}"
                   data-path="euclid.ringsCount" aria-label="Number of Euclidean rings" />
          </label>
          <label class="alg-field" title="Emphasize every Nth percussion hit softly">
            <span>Accent Every: <strong class="val-out" data-val="euclid.accentEvery">${e.accentEvery}</strong></span>
            <input type="range" min="1" max="8" step="1" value="${e.accentEvery}"
                   data-path="euclid.accentEvery" aria-label="Accent every Nth hit" />
          </label>
        </div>
        ${e.rings.slice(0, e.ringsCount).map((rg, idx) => `
          <div class="alg-subring" data-ring="${idx}">
            <div class="alg-subring-title">Ring ${idx + 1}: E(${rg.pulses}, ${rg.steps}) rot ${rg.rotation}</div>
            <div class="alg-field-triple">
              <label class="alg-field" title="Number of hits k (1 to 16, must be <= steps n)">
                <span>Pulses k: <strong class="val-out" data-val="euclid.rings.${idx}.pulses">${rg.pulses}</strong></span>
                <input type="range" min="1" max="16" step="1" value="${rg.pulses}"
                       data-path="euclid.rings.${idx}.pulses" aria-label="Ring ${idx + 1} pulses k" />
              </label>
              <label class="alg-field" title="Total steps n in cycle (2 to 32)">
                <span>Steps n: <strong class="val-out" data-val="euclid.rings.${idx}.steps">${rg.steps}</strong></span>
                <input type="range" min="2" max="32" step="1" value="${rg.steps}"
                       data-path="euclid.rings.${idx}.steps" aria-label="Ring ${idx + 1} steps n" />
              </label>
              <label class="alg-field" title="Rotate downbeat position (0 to n-1)">
                <span>Rot: <strong class="val-out" data-val="euclid.rings.${idx}.rotation">${rg.rotation}</strong></span>
                <input type="range" min="0" max="${Math.max(0, rg.steps - 1)}" step="1" value="${rg.rotation}"
                       data-path="euclid.rings.${idx}.rotation" aria-label="Ring ${idx + 1} rotation" />
              </label>
            </div>
          </div>
        `).join('')}
        <p class="alg-inline-error" data-err="euclid" role="alert" style="display:none;"></p>
      </div>
      ${renderFooterButtons('bjorklund')}
    `;
  }

  if (algId === 'lsystem') {
    const l = p.lsystem;
    const est = lsystemSafe(l.axiom, l.rules, l.generations);
    const ruleEntries = Object.entries(l.rules);
    return `
      <div class="alg-stats-line">${scoreStats?.lsystem || `L-System: gen ${l.generations}, ${est.estimatedCommands.toLocaleString()} commands`}</div>
      <div class="alg-field-grid">
        <div class="alg-field-pair">
          <label class="alg-field" title="Starting preset template (editable below)">
            <span>Preset</span>
            <select data-path="lsystem.preset" aria-label="L-system preset template">
              ${Object.keys(LSYSTEM_PRESETS).map(name =>
                `<option value="${name}"${l.preset === name ? ' selected' : ''}>${name}</option>`
              ).join('')}
              ${l.preset === 'Custom' ? '<option value="Custom" selected>Custom</option>' : ''}
            </select>
          </label>
          <label class="alg-field" title="Initial string before rewriting (allowed: F, +, -, [, ], X, Y)">
            <span>Axiom</span>
            <input type="text" value="${escapeAttr(l.axiom)}" data-path="lsystem.axiom"
                   aria-label="L-system axiom" maxlength="32" />
          </label>
        </div>

        <div class="lsystem-rules-box">
          <div class="lsystem-rules-head">
            <span>Production Rules (F, +, -, [, ], X, Y)</span>
            <button type="button" class="alg-mini-btn" data-action="add-rule" aria-label="Add production rule">+ Rule</button>
          </div>
          ${ruleEntries.map(([lhs, rhs]) => `
            <div class="lsystem-rule-row" data-rule-key="${escapeAttr(lhs)}">
              <input type="text" class="rule-lhs" value="${escapeAttr(lhs)}" maxlength="1"
                     aria-label="Rule symbol" title="Symbol to replace (1 character)" />
              <span aria-hidden="true">→</span>
              <input type="text" class="rule-rhs" value="${escapeAttr(rhs)}"
                     aria-label="Replacement for ${escapeAttr(lhs)}" title="Replacement string" />
              <button type="button" class="alg-mini-btn danger" data-action="del-rule" data-key="${escapeAttr(lhs)}"
                      aria-label="Delete rule ${escapeAttr(lhs)}" ${ruleEntries.length <= 1 ? 'disabled' : ''}>✕</button>
            </div>
          `).join('')}
          <p class="alg-inline-error" data-err="lsystem" role="alert" style="display:none;"></p>
        </div>

        <label class="alg-field" title="Recursive rewriting depth (1 to 8, capped automatically if huge)">
          <span>Generations: <strong class="val-out" data-val="lsystem.generations">${l.generations}</strong> (~${est.estimatedCommands.toLocaleString()} cmds)</span>
          <input type="range" min="1" max="8" step="1" value="${l.generations}"
                 data-path="lsystem.generations" aria-label="L-system generations" />
        </label>
        ${est.warning ? `<p class="alg-cap-warning" role="status">⚠ ${est.warning}</p>` : ''}

        <div class="alg-field-pair">
          <label class="alg-field" title="Base branch turn angle in degrees">
            <span>Angle: <strong class="val-out" data-val="lsystem.turnAngle">${l.turnAngle}°</strong></span>
            <input type="range" min="10" max="45" step="0.5" value="${l.turnAngle}"
                   data-path="lsystem.turnAngle" aria-label="L-system turn angle" />
          </label>
          <label class="alg-field" title="Branch length multiplier per generation">
            <span>Length Ratio: <strong class="val-out" data-val="lsystem.lengthRatio">${l.lengthRatio}</strong></span>
            <input type="range" min="0.5" max="0.9" step="0.02" value="${l.lengthRatio}"
                   data-path="lsystem.lengthRatio" aria-label="Branch length ratio" />
          </label>
        </div>
        <div class="alg-field-pair">
          <label class="alg-field" title="Trunk thickness in pixels">
            <span>Thickness: <strong class="val-out" data-val="lsystem.lineThickness">${l.lineThickness}px</strong></span>
            <input type="range" min="2" max="10" step="1" value="${l.lineThickness}"
                   data-path="lsystem.lineThickness" aria-label="Line thickness" />
          </label>
          <label class="alg-field" title="Fraction of branch tips showing leaves and falling petals">
            <span>Leaves: <strong class="val-out" data-val="lsystem.leafDensity">${Math.round(l.leafDensity * 100)}%</strong></span>
            <input type="range" min="0" max="1" step="0.05" value="${l.leafDensity}"
                   data-path="lsystem.leafDensity" aria-label="Leaf density" />
          </label>
        </div>
      </div>
      ${renderFooterButtons('lsystem')}
    `;
  }

  return '';
}

function renderFooterButtons(algId) {
  return `
    <div class="alg-footer-btns">
      <button type="button" class="alg-mini-btn" data-alg-reset="${algId}" aria-label="Reset ${algId} to default">↺ Reset</button>
      <button type="button" class="alg-mini-btn" data-alg-random="${algId}" aria-label="Randomise ${algId} deterministically">🎲 Randomise</button>
    </div>
  `;
}

/**
 * Attach change/input/rule-editor listeners inside a container hosting `renderAlgorithmFields`.
 *
 * @param {HTMLElement} rootEl
 * @param {string} algId
 * @param {{ getParams, onUpdateParams, onImmediatePreview }} handlers
 */
export function bindAlgorithmEditor(rootEl, roleOrId, handlers) {
  const { getParams, onUpdateParams, onImmediatePreview } = handlers;
  const { role, plugin, effectiveId: algId } = resolvePluginAndKey(roleOrId, normalizeParams(getParams()));

  const setNested = (obj, path, value) => {
    const keys = path.split('.');
    const clone = structuredCloneSafe(obj);
    let cur = clone;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    return clone;
  };

  // Generic path inputs (sliders, selects, axiom text)
  rootEl.querySelectorAll('[data-path]').forEach(el => {
    const path = el.dataset.path;

    const handleChange = (isCommit) => {
      const curParams = normalizeParams(getParams());
      let rawVal = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'range' || el.type === 'number' || path === 'norgard.speedRatio' || path.startsWith('hanoi.pegIntervals.') || path.startsWith('pluginParams.')) {
        rawVal = Number(rawVal);
      }

      // Special case: L-system preset fills axiom, rules, and angle
      if (path === 'lsystem.preset' && LSYSTEM_PRESETS[rawVal]) {
        const pr = LSYSTEM_PRESETS[rawVal];
        const updated = normalizeParams({
          ...curParams,
          branchAngle: pr.angle,
          lsystemPreset: rawVal,
          lsystem: {
            ...curParams.lsystem,
            preset: rawVal,
            axiom: pr.axiom,
            rules: { ...pr.rules },
            turnAngle: pr.angle,
            generations: Math.min(pr.maxGen || 5, curParams.lsystem.generations)
          }
        });
        onUpdateParams(updated, { rerenderSelf: true, commit: true });
        return;
      }

      // Special case: validate Euclidean k <= n live
      if (algId === 'bjorklund' && path.startsWith('euclid.rings.')) {
        const errEl = rootEl.querySelector('[data-err="euclid"]');
        let draft = setNested(curParams, path, rawVal);
        const ringIdx = parseInt(path.split('.')[2], 10);
        const rg = draft.euclid.rings[ringIdx];
        const check = validateEuclideanParams(rg.pulses, rg.steps);
        if (!check.valid) {
          if (errEl) {
            errEl.textContent = check.error;
            errEl.style.display = 'block';
          }
          // Auto-clamp k <= n cleanly on input
          if (rg.pulses > rg.steps) {
            rg.pulses = rg.steps;
            rg.rotation = Math.min(rg.rotation, rg.steps - 1);
            const kInput = rootEl.querySelector(`[data-path="euclid.rings.${ringIdx}.pulses"]`);
            if (kInput) kInput.value = String(rg.pulses);
          }
        } else if (errEl) {
          errEl.style.display = 'none';
        }
      }

      // Special case: validate L-system axiom live
      if (path === 'lsystem.axiom') {
        const errEl = rootEl.querySelector('[data-err="lsystem"]');
        const check = validateLSystem(rawVal, curParams.lsystem.rules);
        if (!check.valid) {
          if (errEl) {
            errEl.textContent = check.errors[0];
            errEl.style.display = 'block';
          }
          return;
        }
        if (errEl) errEl.style.display = 'none';
      }

      let updated = setNested(curParams, path, rawVal);
      if (path === 'lsystem.axiom') updated.lsystem.preset = 'Custom';
      if (path === 'lsystem.turnAngle') updated.branchAngle = Number(rawVal);

      // Keep Start != Target peg in Hanoi
      if (path === 'hanoi.startPeg' && updated.hanoi.startPeg === updated.hanoi.targetPeg) {
        updated.hanoi.targetPeg = updated.hanoi.startPeg === 'C' ? 'A' : 'C';
      } else if (path === 'hanoi.targetPeg' && updated.hanoi.startPeg === updated.hanoi.targetPeg) {
        updated.hanoi.startPeg = updated.hanoi.targetPeg === 'A' ? 'C' : 'A';
      }

      // Update live value readout immediately
      const out = rootEl.querySelector(`[data-val="${path}"]`);
      if (out) {
        if (path === 'lsystem.turnAngle') out.textContent = `${rawVal}°`;
        else if (path === 'lsystem.lengthRatio') out.textContent = String(rawVal);
        else if (path === 'lsystem.lineThickness') out.textContent = `${rawVal}px`;
        else if (path === 'lsystem.leafDensity') out.textContent = `${Math.round(Number(rawVal) * 100)}%`;
        else out.textContent = String(rawVal);
      }

      const normalized = normalizeParams(updated);
      onImmediatePreview?.(normalized);
      onUpdateParams(normalized, {
        rerenderSelf: path === 'euclid.ringsCount' || path === 'hanoi.startPeg' || path === 'hanoi.targetPeg',
        commit: isCommit
      });
    };

    el.addEventListener('input', () => handleChange(false));
    el.addEventListener('change', () => handleChange(true));
  });

  // L-system rule editing, add, and delete
  if (algId === 'lsystem') {
    const syncRulesFromDOM = (commit) => {
      const cur = normalizeParams(getParams());
      const newRules = {};
      const rows = rootEl.querySelectorAll('.lsystem-rule-row');
      for (const row of rows) {
        const lhs = row.querySelector('.rule-lhs').value.trim();
        const rhs = row.querySelector('.rule-rhs').value.trim();
        if (lhs) newRules[lhs] = rhs;
      }
      const errEl = rootEl.querySelector('[data-err="lsystem"]');
      const check = validateLSystem(cur.lsystem.axiom, newRules);
      if (!check.valid) {
        if (errEl) {
          errEl.textContent = check.errors[0];
          errEl.style.display = 'block';
        }
        return;
      }
      if (errEl) errEl.style.display = 'none';
      const next = normalizeParams({
        ...cur,
        lsystem: { ...cur.lsystem, preset: 'Custom', rules: newRules }
      });
      onUpdateParams(next, { rerenderSelf: false, commit });
    };

    rootEl.querySelectorAll('.lsystem-rule-row input').forEach(inp => {
      inp.addEventListener('input', () => syncRulesFromDOM(false));
      inp.addEventListener('change', () => syncRulesFromDOM(true));
    });

    const addBtn = rootEl.querySelector('[data-action="add-rule"]');
    addBtn?.addEventListener('click', () => {
      const cur = normalizeParams(getParams());
      const candidates = ['Y', 'X', 'F'];
      const nextKey = candidates.find(k => !cur.lsystem.rules[k]);
      if (!nextKey) return;
      const nextRules = { ...cur.lsystem.rules, [nextKey]: 'F[+F][-F]' };
      const next = normalizeParams({
        ...cur,
        lsystem: { ...cur.lsystem, preset: 'Custom', rules: nextRules }
      });
      onUpdateParams(next, { rerenderSelf: true, commit: true });
    });

    rootEl.querySelectorAll('[data-action="del-rule"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cur = normalizeParams(getParams());
        const key = btn.dataset.key;
        const nextRules = { ...cur.lsystem.rules };
        delete nextRules[key];
        if (Object.keys(nextRules).length === 0) return;
        const next = normalizeParams({
          ...cur,
          lsystem: { ...cur.lsystem, preset: 'Custom', rules: nextRules }
        });
        onUpdateParams(next, { rerenderSelf: true, commit: true });
      });
    });
  }

  // Per-algorithm Reset & Seeded Randomise buttons
  const resetBtn = rootEl.querySelector(`[data-alg-reset="${algId}"]`);
  resetBtn?.addEventListener('click', () => {
    if (['norgard', 'hanoi', 'bjorklund', 'lsystem'].includes(algId)) {
      const next = resetAlgorithmParams(getParams(), algId);
      onUpdateParams(next, { rerenderSelf: true, commit: true });
      return;
    }
    const cur = normalizeParams(getParams());
    const nextPluginParams = { ...(cur.pluginParams || {}), [algId]: { ...plugin.defaultParams } };
    onUpdateParams(normalizeParams({ ...cur, pluginParams: nextPluginParams }), { rerenderSelf: true, commit: true });
  });

  const rndBtn = rootEl.querySelector(`[data-alg-random="${algId}"]`);
  rndBtn?.addEventListener('click', () => {
    randomSalt++;
    if (['norgard', 'hanoi', 'bjorklund', 'lsystem'].includes(algId)) {
      const next = randomiseAlgorithmParams(getParams(), algId, randomSalt);
      onUpdateParams(next, { rerenderSelf: true, commit: true });
      return;
    }
    const cur = normalizeParams(getParams());
    const rng = createPRNG((cur.seed + 1) * 2654435761 ^ (randomSalt + algId.length * 131));
    const sampled = { ...plugin.defaultParams };
    for (const f of plugin.paramSchema || []) {
      if (f.type === 'range') {
        const step = f.step || 1;
        const stepsCount = Math.max(1, Math.round((f.max - f.min) / step));
        sampled[f.key] = Number((f.min + Math.floor(rng() * (stepsCount + 1)) * step).toFixed(2));
      } else if (f.type === 'select' && f.options?.length) {
        sampled[f.key] = f.options[Math.floor(rng() * f.options.length)].value;
      }
    }
    const nextPluginParams = { ...(cur.pluginParams || {}), [algId]: sampled };
    onUpdateParams(normalizeParams({ ...cur, pluginParams: nextPluginParams }), { rerenderSelf: true, commit: true });
  });
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}
