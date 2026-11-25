/**
 * Algorithm Lab Controller
 *
 * Manages the 4 Algorithm Selector Cards (On/Off + Solo), the active large
 * recursive simulation canvas, Lab playback controls (Play/Pause, Step Back/Fwd,
 * Speed 0.25x-2x, Replay, plain-English step captions), the "What You Hear"
 * 4-lane timeline strip, and bidirectional linked highlighting with the Garden.
 *
 * Performance: Lab canvases only render when visible (`setVisible(true)`).
 */

import { ALGORITHMS, ALGORITHM_ORDER, formatEventCaption } from '../algorithms/meta.js';
import { LSYSTEM_PRESETS } from '../algorithms/lsystem.js';
import { createNorgardSim } from './simNorgard.js';
import { createHanoiSim } from './simHanoi.js';
import { createEuclideanSim } from './simEuclidean.js';
import { createLSystemSim } from './simLSystem.js';
import { createTimelineStrip } from './timelineStrip.js';

export function buildAlgorithmLab(container, callbacks) {
  const {
    getScore,
    getParams,
    setParams,
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
  let activeAlg = 'norgard';
  let soloedAlg = null;
  let preSoloEnabled = null;
  let stepMode = false;
  let stepCursor = 0;
  let stepTime = 0;
  let hoveredTarget = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const enabledMap = {
    norgard: true,
    hanoi: true,
    bjorklund: true,
    lsystem: true
  };

  const sims = {
    norgard: createNorgardSim(),
    hanoi: createHanoiSim(),
    bjorklund: createEuclideanSim(),
    lsystem: createLSystemSim()
  };
  const timeline = createTimelineStrip();

  // ─── Render Lab DOM ──────────────────────────────────────────────
  container.innerHTML = `
    <div class="lab-shell" role="region" aria-label="Algorithm Lab">
      <!-- 4 Algorithm Selector Cards -->
      <div class="lab-cards" role="tablist" aria-label="Recursive algorithms">
        ${ALGORITHM_ORDER.map(id => {
          const m = ALGORITHMS[id];
          return `
            <div class="lab-card ${id === activeAlg ? 'selected' : ''}" data-alg="${id}"
                 style="--alg-color: ${m.color}; --alg-tint: ${m.bgTint};"
                 tabindex="0" role="tab" aria-selected="${id === activeAlg}">
              <div class="lab-card-head">
                <span class="lab-card-title">
                  <span class="alg-shape" aria-hidden="true">${m.shape}</span>
                  ${m.title}
                </span>
                <div class="lab-card-actions">
                  <button class="lab-solo-btn" data-alg="${id}" aria-pressed="false" title="Solo ${m.shortName}">Solo</button>
                  <label class="lab-switch" title="Enable/Disable ${m.shortName}">
                    <input type="checkbox" class="lab-toggle-input" data-alg="${id}" checked aria-label="Enable ${m.title}" />
                    <span class="lab-switch-track"></span>
                  </label>
                </div>
              </div>
              <p class="lab-card-desc">${m.description}</p>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Lab Playback & Step Controls -->
      <div class="lab-transport" role="group" aria-label="Lab playback controls">
        <div class="lab-transport-btns">
          <button id="lab-play-btn" class="lab-btn" aria-label="Play or Pause">⏸ Pause</button>
          <button id="lab-step-back" class="lab-btn" aria-label="Step back one recursive event">⏮ Step</button>
          <button id="lab-step-fwd" class="lab-btn" aria-label="Step forward one recursive event">⏭ Step</button>
          <button id="lab-replay-btn" class="lab-btn" aria-label="Replay from start">↺ Replay</button>
          <label class="lab-speed-wrap" for="lab-speed-select">
            <span>Speed</span>
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
          Live playback — select any card or click Step to inspect events one by one.
        </div>
      </div>

      <!-- Context-sensitive sliders for Euclidean (k, n) or L-System (Gen) -->
      <div id="lab-subcontrols" class="lab-subcontrols"></div>

      <!-- Main Live Simulation Canvas -->
      <div class="lab-sim-wrap">
        <canvas id="lab-sim-canvas" class="lab-sim-canvas" aria-label="Active recursive algorithm simulation"></canvas>
      </div>

      <!-- "What You Hear" 4-Track Piano Roll -->
      <div class="lab-timeline-wrap">
        <div class="lab-timeline-header">
          <span>What You Hear — Combined Recursive Layers</span>
          <span class="lab-timeline-hint">Hover to highlight in Garden · Click to step to event</span>
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
  const captionEl = container.querySelector('#lab-caption');
  const playBtn = container.querySelector('#lab-play-btn');

  // ─── Helper: Sync On/Off & Solo States ───────────────────────────
  function applyEnabledState(id, enabled) {
    enabledMap[id] = enabled;
    setAlgorithmEnabled(id, enabled);
    setVisualAlgorithmEnabled(id, enabled);
    const card = container.querySelector(`.lab-card[data-alg="${id}"]`);
    const chk = container.querySelector(`.lab-toggle-input[data-alg="${id}"]`);
    if (chk) chk.checked = enabled;
    if (card) card.classList.toggle('disabled', !enabled);
  }

  function updateSoloButtons() {
    container.querySelectorAll('.lab-solo-btn').forEach(btn => {
      const isSolo = btn.dataset.alg === soloedAlg;
      btn.classList.toggle('active', isSolo);
      btn.setAttribute('aria-pressed', String(isSolo));
    });
  }

  function renderSubControls() {
    const params = getParams();
    if (activeAlg === 'bjorklund') {
      const depth = params.depth || 4;
      const nDefault = 8 + depth * 2;
      const kDefault = Math.min(nDefault, Math.max(1, Math.round((2 + depth) * (params.densityEuclid || 1))));
      subControls.style.display = 'flex';
      subControls.innerHTML = `
        <label class="lab-sub-item">
          <span>Hits (k): <strong id="lab-k-val">${kDefault}</strong></span>
          <input type="range" id="lab-k-slider" min="1" max="${nDefault}" value="${kDefault}" aria-label="Euclidean hits k" />
        </label>
        <label class="lab-sub-item">
          <span>Steps (n): <strong id="lab-n-val">${nDefault}</strong></span>
          <input type="range" id="lab-n-slider" min="4" max="24" value="${nDefault}" aria-label="Euclidean steps n" />
        </label>
      `;
      const kSlider = subControls.querySelector('#lab-k-slider');
      const nSlider = subControls.querySelector('#lab-n-slider');
      const syncEuclid = (commitScore) => {
        const n = parseInt(nSlider.value, 10);
        kSlider.max = String(n);
        const k = Math.min(n, parseInt(kSlider.value, 10));
        kSlider.value = String(k);
        subControls.querySelector('#lab-k-val').textContent = String(k);
        subControls.querySelector('#lab-n-val').textContent = String(n);
        sims.bjorklund.setKN(k, n);
        if (commitScore) {
          const density = k / (2 + (getParams().depth || 4));
          setParams({ densityEuclid: Math.max(0.3, Math.min(2, density)) });
          rebuildAndPlay();
        }
      };
      kSlider.addEventListener('input', () => syncEuclid(false));
      nSlider.addEventListener('input', () => syncEuclid(false));
      kSlider.addEventListener('change', () => syncEuclid(true));
      nSlider.addEventListener('change', () => syncEuclid(true));
    } else if (activeAlg === 'lsystem') {
      const preset = LSYSTEM_PRESETS[params.lsystemPreset || 'Fern'] || LSYSTEM_PRESETS['Fern'];
      const maxGen = Math.min(params.depth || 4, preset.maxGen || 5);
      subControls.style.display = 'flex';
      subControls.innerHTML = `
        <label class="lab-sub-item">
          <span>Scrub Generation: <strong id="lab-gen-val">${maxGen}</strong></span>
          <input type="range" id="lab-gen-slider" min="0" max="${maxGen}" value="${maxGen}" aria-label="L-system generation scrubber" />
        </label>
      `;
      const gSlider = subControls.querySelector('#lab-gen-slider');
      sims.lsystem.setGeneration(maxGen);
      gSlider.addEventListener('input', () => {
        const g = parseInt(gSlider.value, 10);
        subControls.querySelector('#lab-gen-val').textContent = String(g);
        sims.lsystem.setGeneration(g);
      });
    } else {
      subControls.style.display = 'none';
      subControls.innerHTML = '';
    }
  }

  function selectAlgorithm(id) {
    activeAlg = id;
    container.querySelectorAll('.lab-card').forEach(c => {
      const sel = c.dataset.alg === id;
      c.classList.toggle('selected', sel);
      c.setAttribute('aria-selected', String(sel));
    });
    if (id !== 'bjorklund') sims.bjorklund.setKN(null, null);
    renderSubControls();
  }

  // ─── Card Events ─────────────────────────────────────────────────
  container.querySelectorAll('.lab-card').forEach(card => {
    const id = card.dataset.alg;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.lab-card-actions')) return;
      selectAlgorithm(id);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('.lab-card-actions')) return;
        e.preventDefault();
        selectAlgorithm(id);
      }
    });
  });

  container.querySelectorAll('.lab-toggle-input').forEach(chk => {
    chk.addEventListener('change', (e) => {
      soloedAlg = null;
      preSoloEnabled = null;
      updateSoloButtons();
      applyEnabledState(e.target.dataset.alg, e.target.checked);
    });
  });

  container.querySelectorAll('.lab-solo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.alg;
      if (soloedAlg === id) {
        // Restore previous states
        const restore = preSoloEnabled || { norgard: true, hanoi: true, bjorklund: true, lsystem: true };
        soloedAlg = null;
        preSoloEnabled = null;
        for (const alg of ALGORITHM_ORDER) applyEnabledState(alg, restore[alg]);
      } else {
        preSoloEnabled = { ...enabledMap };
        soloedAlg = id;
        for (const alg of ALGORITHM_ORDER) applyEnabledState(alg, alg === id);
        selectAlgorithm(id);
      }
      updateSoloButtons();
    });
  });

  // ─── Transport & Step Mode ───────────────────────────────────────
  function updatePlayBtnLabel(playing) {
    playBtn.textContent = playing && !stepMode ? '⏸ Pause' : '▶ Play';
  }

  playBtn.addEventListener('click', () => {
    if (stepMode) {
      stepMode = false;
      setExternalVisualTime(null);
      resumePlayback();
      captionEl.textContent = 'Live playback resumed.';
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
    captionEl.textContent = `[Step ${stepCursor + 1}/${score.events.length}] ${formatEventCaption(ev)}`;
    updatePlayBtnLabel(false);
  }

  container.querySelector('#lab-step-back').addEventListener('click', () => stepBy(-1));
  container.querySelector('#lab-step-fwd').addEventListener('click', () => stepBy(1));

  container.querySelector('#lab-replay-btn').addEventListener('click', () => {
    stepMode = false;
    stepCursor = 0;
    setExternalVisualTime(null);
    rebuildAndPlay();
    captionEl.textContent = 'Replaying from start.';
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
    const hit = sims[activeAlg]?.hitTest(e.clientX - rect.left, e.clientY - rect.top);
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

    const simDims = sizeCanvas(simCanvas, simCtx);
    if (simDims && score) {
      sims[activeAlg].draw(simCtx, simDims.w, simDims.h, {
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
      if (!rafId) {
        rafId = requestAnimationFrame(renderFrame);
      }
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function setHovered(target) {
    hoveredTarget = target || null;
  }

  function onScoreUpdated() {
    if (activeAlg !== 'bjorklund') sims.bjorklund.setKN(null, null);
    if (isVisible) renderSubControls();
  }

  function syncPlayState(playing) {
    if (!stepMode) updatePlayBtnLabel(playing);
  }

  return {
    setVisible,
    setHoveredTarget: setHovered,
    onScoreUpdated,
    syncPlayState
  };
}
