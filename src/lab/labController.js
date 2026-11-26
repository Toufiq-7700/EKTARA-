/**
 * Algorithm Lab Controller (Role-Based Plugin Architecture)
 *
 * Manages the 4 Role Selector Cards (`melody`, `bass`, `rhythm`, `tree`),
 * each with:
 *   - Consistent role color & shape badge (◆, ▬, ●, ▲)
 *   - Algorithm dropdown switching between registered plugins for that role
 *   - Plain-English description + tiny preview
 *   - On/Off switch and Solo button affecting both audio and Garden visuals
 *   - Collapsible per-algorithm parameters from `paramSchema` + live stats
 *
 * Hosts the active simulation canvas, Lab Step Mode controls, and the
 * "What You Hear" 4-lane piano roll with bidirectional Garden hover highlights.
 */

import { ROLES_META, ROLE_ORDER, formatEventCaption } from '../algorithms/meta.js';
import { getAlgorithmPlugin, getAlgorithmsForRole } from '../algorithms/registry.js';
import { LSYSTEM_PRESETS } from '../algorithms/lsystem.js';
import { normalizeParams } from '../algorithms/params.js';
import { createNorgardSim } from './simNorgard.js';
import { createHanoiSim } from './simHanoi.js';
import { createEuclideanSim } from './simEuclidean.js';
import { createLSystemSim } from './simLSystem.js';
import {
  createThueMorseSim,
  createFibonacciWordSim,
  createGrayCodeSim,
  createCantorSim
} from './simPlugins.js';
import { createTimelineStrip } from './timelineStrip.js';
import { renderAlgorithmFields, bindAlgorithmEditor } from '../ui/paramEditors.js';
import { t, getLang } from '../i18n/index.js';

export function buildAlgorithmLab(container, callbacks) {
  const {
    getScore,
    getParams,
    onDebouncedParamsChange,
    rebuildAndPlay,
    getCurrentTime,
    isAudioPlaying,
    pausePlayback,
    resumePlayback,
    previewEvent,
    setPlaybackSpeed,
    setAlgorithmEnabled,
    setVisualAlgorithmEnabled,
    setExternalVisualTime,
    onHoverTarget
  } = callbacks;

  let isVisible = false;
  let rafId = null;
  let activeRole = 'melody';
  let soloedRole = null;
  let preSoloEnabled = null;
  let stepMode = false;
  let stepCursor = 0;
  let stepTime = 0;
  let hoveredTarget = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const enabledMap = {
    melody: true,
    bass: true,
    rhythm: true,
    tree: true
  };

  // Dedicated Lab simulation per registered plugin id
  const lsystemSim = createLSystemSim();
  const euclidSim = createEuclideanSim();
  const simsByPluginId = {
    'norgard': createNorgardSim(),
    'thue-morse': createThueMorseSim('melody'),
    'fibonacci-word': createFibonacciWordSim(),
    'hanoi': createHanoiSim(),
    'gray-code': createGrayCodeSim(),
    'cantor-bass': createCantorSim('bass'),
    'bjorklund': euclidSim,
    'cantor-rhythm': createCantorSim('rhythm'),
    'thue-morse-rhythm': createThueMorseSim('rhythm'),
    'lsystem': lsystemSim,
    'koch-curve': lsystemSim,
    'sierpinski-triangle': lsystemSim
  };
  const timeline = createTimelineStrip();

  const initParams = normalizeParams(getParams());

  // ─── Render Lab DOM ──────────────────────────────────────────────
  container.innerHTML = `
    <div class="lab-shell" role="region" aria-label="Algorithm Lab">
      <div class="lab-cards" role="tablist" aria-label="Musical roles and recursive algorithms">
        ${ROLE_ORDER.map(role => {
          const rm = ROLES_META[role];
          const chosenId = initParams.roles?.[role];
          const plugin = getAlgorithmPlugin(role, chosenId);
          const choices = getAlgorithmsForRole(role);

          return `
            <div class="lab-card ${role === activeRole ? 'selected' : ''}" data-role="${role}"
                 style="--alg-color: ${rm.color}; --alg-tint: ${rm.bgTint};"
                 tabindex="0" role="tab" aria-selected="${role === activeRole}">
              <div class="lab-card-head">
                <span class="lab-card-title">
                  <span class="alg-shape" aria-hidden="true">${rm.shape}</span>
                  <span data-role-title="${role}">${t(`roles.${role}`)}</span>
                </span>
                <div class="lab-card-actions">
                  <button class="lab-solo-btn" data-role="${role}" aria-pressed="false" title="${t('lab.solo')} ${t(`roles.${role}`)}">${t('lab.solo')}</button>
                  <label class="lab-switch" title="${t(`roles.${role}`)}">
                    <input type="checkbox" class="lab-toggle-input" data-role="${role}" checked aria-label="Enable ${rm.title}" />
                    <span class="lab-switch-track"></span>
                  </label>
                </div>
              </div>

              <label class="lab-alg-picker">
                <span class="sr-label">${t(`roles.${role}`)}</span>
                <select class="lab-alg-select" data-role="${role}" aria-label="Choose algorithm for ${rm.title}">
                  ${choices.map(ch => `<option value="${ch.id}"${ch.id === plugin.id ? ' selected' : ''}>${t(`algorithms.${ch.id}.name`)}</option>`).join('')}
                </select>
              </label>

              <p class="lab-card-desc" data-role-desc="${role}">${t(`algorithms.${plugin.id}.desc`)}</p>
              <div class="lab-card-preview" data-role-preview="${role}">${plugin.preview}</div>

              <details class="lab-card-params-wrap" ${role === activeRole ? 'open' : ''}>
                <summary class="lab-card-params-toggle" data-i18n="lab.parameters">${t('lab.parameters')}</summary>
                <div class="lab-card-params" data-role-editor="${role}"></div>
              </details>
            </div>
          `;
        }).join('')}
      </div>

      <div id="lab-cap-banner" class="lab-cap-banner" role="status" style="display:none;"></div>

      <div class="lab-transport" role="group" aria-label="Lab playback controls">
        <div class="lab-transport-btns">
          <button id="lab-play-btn" class="lab-btn" aria-label="Play or Pause">${t('lab.pause')}</button>
          <button id="lab-step-back" class="lab-btn" aria-label="Step back one recursive event">${t('lab.stepBack')}</button>
          <button id="lab-step-fwd" class="lab-btn" aria-label="Step forward one recursive event">${t('lab.stepFwd')}</button>
          <button id="lab-replay-btn" class="lab-btn" aria-label="Replay from start">${t('lab.replay')}</button>
          <label class="lab-speed-wrap" for="lab-speed-select">
            <span id="lab-speed-label">${t('lab.speed')}</span>
            <select id="lab-speed-select" aria-label="Playback speed">
              <option value="0.25">0.25×</option>
              <option value="0.5">0.5×</option>
              <option value="1" selected>1×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
            </select>
          </label>
        </div>
        <div id="lab-caption" class="lab-caption" role="status" aria-live="polite">
          ${t('lab.captionDefault')}
        </div>
      </div>

      <div id="lab-subcontrols" class="lab-subcontrols"></div>

      <div class="lab-sim-wrap">
        <canvas id="lab-sim-canvas" class="lab-sim-canvas" aria-label="Active recursive algorithm simulation"></canvas>
      </div>

      <div class="lab-timeline-wrap">
        <div class="lab-timeline-header">
          <span id="lab-what-hear-title">${t('lab.whatYouHear')}</span>
          <span id="lab-what-hear-hint" class="lab-timeline-hint">${t('lab.whatYouHearHint')}</span>
        </div>
        <canvas id="lab-timeline-canvas" class="lab-timeline-canvas" aria-label="Four-track musical timeline"></canvas>
      </div>
    </div>
  `;

  const simCanvas = container.querySelector('#lab-sim-canvas');
  const simCtx = simCanvas.getContext('2d');
  const tlCanvas = container.querySelector('#lab-timeline-canvas');
  const tlCtx = tlCanvas.getContext('2d');
  const subControls = container.querySelector('#lab-subcontrols');
  const capBanner = container.querySelector('#lab-cap-banner');
  const captionEl = container.querySelector('#lab-caption');
  const playBtn = container.querySelector('#lab-play-btn');

  function getActivePluginForRole(role) {
    const p = normalizeParams(getParams());
    return getAlgorithmPlugin(role, p.roles?.[role]);
  }

  function renderCardMetaAndEditor(role, forceRender = false) {
    const p = normalizeParams(getParams());
    const plugin = getAlgorithmPlugin(role, p.roles?.[role]);

    const sel = container.querySelector(`.lab-alg-select[data-role="${role}"]`);
    if (sel) sel.value = plugin.id;

    const descEl = container.querySelector(`[data-role-desc="${role}"]`);
    if (descEl) descEl.textContent = t(`algorithms.${plugin.id}.desc`);

    const prevEl = container.querySelector(`[data-role-preview="${role}"]`);
    if (prevEl) prevEl.textContent = plugin.preview;

    const host = container.querySelector(`[data-role-editor="${role}"]`);
    if (!host) return;
    if (!forceRender && host.contains(document.activeElement)) {
      const statsEl = host.querySelector('.alg-stats-line');
      const statsText = getScore()?.stats?.[role];
      if (statsEl && statsText) statsEl.textContent = statsText;
      return;
    }

    host.innerHTML = renderAlgorithmFields(role, p, getScore()?.stats);
    bindAlgorithmEditor(host, role, {
      getParams,
      onImmediatePreview: (nextParams) => {
        if (plugin.id === 'bjorklund') {
          const r0 = nextParams.euclid.rings[0];
          euclidSim.setKN(r0.pulses, r0.steps);
        }
      },
      onUpdateParams: (nextParams, { rerenderSelf }) => {
        onDebouncedParamsChange(nextParams);
        if (rerenderSelf) renderCardMetaAndEditor(role, true);
      }
    });
  }

  function renderAllCards(force = false) {
    for (const role of ROLE_ORDER) {
      renderCardMetaAndEditor(role, force);
    }
    const capMsg = getScore()?.stats?.capNotice;
    if (capBanner) {
      if (capMsg) {
        capBanner.textContent = `⚠ ${capMsg}`;
        capBanner.style.display = 'block';
      } else {
        capBanner.style.display = 'none';
      }
    }
  }

  function applyEnabledState(role, enabled) {
    enabledMap[role] = enabled;
    setAlgorithmEnabled(role, enabled);
    setVisualAlgorithmEnabled(role, enabled);
    const card = container.querySelector(`.lab-card[data-role="${role}"]`);
    const chk = container.querySelector(`.lab-toggle-input[data-role="${role}"]`);
    if (chk) chk.checked = enabled;
    if (card) card.classList.toggle('disabled', !enabled);
  }

  function updateSoloButtons() {
    container.querySelectorAll('.lab-solo-btn').forEach(btn => {
      const isSolo = btn.dataset.role === soloedRole;
      btn.classList.toggle('active', isSolo);
      btn.setAttribute('aria-pressed', String(isSolo));
    });
  }

  function renderSubControls() {
    const params = normalizeParams(getParams());
    const activeTreePlugin = getActivePluginForRole('tree');
    if (activeRole === 'tree') {
      const scoreCfg = getScore()?.lsystemConfig;
      const preset = LSYSTEM_PRESETS[scoreCfg?.preset || params.lsystem?.preset || 'Fern'] || LSYSTEM_PRESETS['Fern'];
      const maxGen = activeTreePlugin.id === 'lsystem'
        ? (params.lsystem?.generations ?? 4)
        : (params.pluginParams?.[activeTreePlugin.id]?.generations ?? Math.min(preset.maxGen || 4, params.depth));
      subControls.style.display = 'flex';
      subControls.innerHTML = `
        <label class="lab-sub-item">
          <span>${t('lab.scrubGen')}: <strong id="lab-gen-val">${maxGen}</strong></span>
          <input type="range" id="lab-gen-slider" min="0" max="${maxGen}" value="${maxGen}" aria-label="Generation scrubber" />
        </label>
      `;
      const gSlider = subControls.querySelector('#lab-gen-slider');
      lsystemSim.setGeneration(maxGen);
      gSlider.addEventListener('input', () => {
        const g = parseInt(gSlider.value, 10);
        subControls.querySelector('#lab-gen-val').textContent = String(g);
        lsystemSim.setGeneration(g);
      });
    } else {
      subControls.style.display = 'none';
      subControls.innerHTML = '';
    }
  }

  function selectRole(role) {
    activeRole = role;
    container.querySelectorAll('.lab-card').forEach(c => {
      const sel = c.dataset.role === role;
      c.classList.toggle('selected', sel);
      c.setAttribute('aria-selected', String(sel));
    });
    if (getActivePluginForRole(role).id !== 'bjorklund') {
      euclidSim.setKN(null, null);
    }
    renderSubControls();
  }

  // ─── Card, Dropdown, On/Off & Solo Events ───────────────────────
  container.querySelectorAll('.lab-card').forEach(card => {
    const role = card.dataset.role;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.lab-card-actions') || e.target.closest('.lab-card-params-wrap') || e.target.closest('.lab-alg-picker')) {
        return;
      }
      selectRole(role);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('.lab-card-actions') || e.target.closest('.lab-card-params-wrap') || e.target.closest('.lab-alg-picker')) {
          return;
        }
        e.preventDefault();
        selectRole(role);
      }
    });
  });

  container.querySelectorAll('.lab-alg-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const role = e.target.dataset.role;
      const nextPluginId = e.target.value;
      const cur = normalizeParams(getParams());
      const nextParams = normalizeParams({
        ...cur,
        roles: { ...cur.roles, [role]: nextPluginId }
      });
      selectRole(role);
      onDebouncedParamsChange(nextParams);
      renderCardMetaAndEditor(role, true);
    });
  });

  container.querySelectorAll('.lab-toggle-input').forEach(chk => {
    chk.addEventListener('change', (e) => {
      soloedRole = null;
      preSoloEnabled = null;
      updateSoloButtons();
      applyEnabledState(e.target.dataset.role, e.target.checked);
    });
  });

  container.querySelectorAll('.lab-solo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.dataset.role;
      if (soloedRole === role) {
        const restore = preSoloEnabled || { melody: true, bass: true, rhythm: true, tree: true };
        soloedRole = null;
        preSoloEnabled = null;
        for (const r of ROLE_ORDER) applyEnabledState(r, restore[r]);
      } else {
        preSoloEnabled = { ...enabledMap };
        soloedRole = role;
        for (const r of ROLE_ORDER) applyEnabledState(r, r === role);
        selectRole(role);
      }
      updateSoloButtons();
    });
  });

  renderAllCards(true);

  // ─── Transport & Step Mode ───────────────────────────────────────
  function updatePlayBtnLabel(playing) {
    playBtn.textContent = playing && !stepMode ? t('lab.pause') : t('lab.play');
  }

  playBtn.addEventListener('click', () => {
    if (stepMode) {
      stepMode = false;
      setExternalVisualTime(null);
      resumePlayback();
      captionEl.textContent = t('lab.captionResumed');
      updatePlayBtnLabel(true);
      return;
    }
    if (isAudioPlaying()) {
      pausePlayback();
      updatePlayBtnLabel(false);
    } else {
      resumePlayback();
      updatePlayBtnLabel(true);
    }
  });

  function stepBy(delta) {
    const score = getScore();
    if (!score || score.events.length === 0) return;

    if (!stepMode) {
      pausePlayback();
      stepMode = true;
      const curT = getCurrentTime();
      stepCursor = Math.max(0, score.events.findIndex(e => e.time >= curT));
      if (stepCursor < 0) stepCursor = 0;
    } else {
      stepCursor = Math.max(0, Math.min(score.events.length - 1, stepCursor + delta));
    }

    const ev = score.events[stepCursor];
    stepTime = ev.time;
    setExternalVisualTime(stepTime);
    previewEvent(ev);
    captionEl.textContent = `[${stepCursor + 1}/${score.events.length}] ${formatEventCaption(ev, getLang())}`;
    updatePlayBtnLabel(false);
  }

  container.querySelector('#lab-step-back').addEventListener('click', () => stepBy(-1));
  container.querySelector('#lab-step-fwd').addEventListener('click', () => stepBy(1));

  container.querySelector('#lab-replay-btn').addEventListener('click', () => {
    stepMode = false;
    stepCursor = 0;
    setExternalVisualTime(null);
    rebuildAndPlay();
    captionEl.textContent = t('lab.captionReplay');
    updatePlayBtnLabel(true);
  });

  container.querySelector('#lab-speed-select').addEventListener('change', (e) => {
    setPlaybackSpeed(parseFloat(e.target.value));
  });

  // ─── Canvas Sizing & Linked Hover ────────────────────────────────
  function sizeCanvas(cvs, ctx) {
    const rect = cvs.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (cvs.width !== targetW || cvs.height !== targetH) {
      cvs.width = targetW;
      cvs.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rect.width, h: rect.height };
  }

  simCanvas.addEventListener('mousemove', (e) => {
    const rect = simCanvas.getBoundingClientRect();
    const plugin = getActivePluginForRole(activeRole);
    const sim = simsByPluginId[plugin.id];
    const hit = sim?.hitTest(e.clientX - rect.left, e.clientY - rect.top);
    onHoverTarget(hit || null);
  });
  simCanvas.addEventListener('mouseleave', () => onHoverTarget(null));

  tlCanvas.addEventListener('mousemove', (e) => {
    const rect = tlCanvas.getBoundingClientRect();
    const hit = timeline.hitTest(e.clientX - rect.left, e.clientY - rect.top);
    onHoverTarget(hit || null);
  });
  tlCanvas.addEventListener('mouseleave', () => onHoverTarget(null));
  tlCanvas.addEventListener('click', (e) => {
    const rect = tlCanvas.getBoundingClientRect();
    const hit = timeline.hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (hit?.event) {
      const score = getScore();
      if (!score) return;
      const idx = score.events.indexOf(hit.event);
      if (idx !== -1) {
        pausePlayback();
        stepMode = true;
        stepCursor = idx;
        stepTime = hit.event.time;
        setExternalVisualTime(stepTime);
        previewEvent(hit.event);
        captionEl.textContent = `[Step ${idx + 1}/${score.events.length}] ${formatEventCaption(hit.event)}`;
        updatePlayBtnLabel(false);
      }
    }
  });

  // ─── Render Loop (only runs when Lab is visible) ─────────────────
  function renderFrame() {
    if (!isVisible) {
      rafId = null;
      return;
    }
    const score = getScore();
    const t = stepMode ? stepTime : getCurrentTime();
    const activePlugin = getActivePluginForRole(activeRole);
    const sim = simsByPluginId[activePlugin.id];

    const simDims = sizeCanvas(simCanvas, simCtx);
    if (simDims && score && sim) {
      sim.draw(simCtx, simDims.w, simDims.h, {
        score,
        currentTime: t,
        hoveredTarget,
        reducedMotion
      });
    }

    const tlDims = sizeCanvas(tlCanvas, tlCtx);
    if (tlDims && score) {
      timeline.draw(tlCtx, tlDims.w, tlDims.h, {
        score,
        currentTime: t,
        enabledMap,
        hoveredTarget
      });
    }

    rafId = requestAnimationFrame(renderFrame);
  }

  function setVisible(visible) {
    isVisible = !!visible;
    if (isVisible) {
      renderSubControls();
      updatePlayBtnLabel(isAudioPlaying());
      if (!rafId) rafId = requestAnimationFrame(renderFrame);
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function setHovered(target) {
    hoveredTarget = target || null;
  }

  function onScoreUpdated() {
    if (getActivePluginForRole('rhythm').id !== 'bjorklund') {
      euclidSim.setKN(null, null);
    }
    renderAllCards(false);
    if (isVisible) renderSubControls();
  }

  function syncAllFromParams(_params, _score) {
    euclidSim.setKN(null, null);
    renderAllCards(true);
    if (isVisible) renderSubControls();
  }

  function syncPlayState(playing) {
    if (!stepMode) updatePlayBtnLabel(playing);
  }

  function applyLanguage() {
    for (const role of ROLE_ORDER) {
      const titleEl = container.querySelector(`[data-role-title="${role}"]`);
      if (titleEl) titleEl.textContent = t(`roles.${role}`);
      const soloBtn = container.querySelector(`.lab-solo-btn[data-role="${role}"]`);
      if (soloBtn) {
        soloBtn.textContent = t('lab.solo');
        soloBtn.title = `${t('lab.solo')} ${t(`roles.${role}`)}`;
      }
      const sel = container.querySelector(`.lab-alg-select[data-role="${role}"]`);
      if (sel) {
        for (const opt of sel.options) {
          opt.textContent = t(`algorithms.${opt.value}.name`);
        }
      }
    }
    container.querySelectorAll('.lab-card-params-toggle').forEach(el => {
      el.textContent = t('lab.parameters');
    });
    updatePlayBtnLabel(isAudioPlaying());
    const sb = container.querySelector('#lab-step-back');
    if (sb) sb.textContent = t('lab.stepBack');
    const sf = container.querySelector('#lab-step-fwd');
    if (sf) sf.textContent = t('lab.stepFwd');
    const rb = container.querySelector('#lab-replay-btn');
    if (rb) rb.textContent = t('lab.replay');
    const sl = container.querySelector('#lab-speed-label');
    if (sl) sl.textContent = t('lab.speed');
    if (!stepMode && captionEl) captionEl.textContent = t('lab.captionDefault');
    const wht = container.querySelector('#lab-what-hear-title');
    if (wht) wht.textContent = t('lab.whatYouHear');
    const whh = container.querySelector('#lab-what-hear-hint');
    if (whh) whh.textContent = t('lab.whatYouHearHint');
    renderAllCards(true);
    if (isVisible) renderSubControls();
  }

  return {
    setVisible,
    setHoveredTarget: setHovered,
    onScoreUpdated,
    syncAllFromParams,
    syncPlayState,
    applyLanguage
  };
}
