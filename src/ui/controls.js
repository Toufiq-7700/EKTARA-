/**
 * UI Controls — Collapsible Side Panel
 * 
 * Full-screen canvas with a translucent control panel that auto-hides
 * when idle. All controls are keyboard-accessible with ARIA labels.
 * 
 * Controls: Depth Dial, seed, scale, root note, tempo, branch angle,
 * Euclidean density, L-system preset, theme, ambient, layer volumes,
 * X-ray toggle, play/pause, stop, volume, sleep timer, Evolve, presets.
 */

import { LSYSTEM_PRESETS } from '../algorithms/lsystem.js';
import { SCALES } from '../algorithms/scales.js';
import { THEMES } from '../visuals/themes.js';
import { createPRNG } from '../algorithms/prng.js';
import { TIMBRE_OPTIONS, DEFAULT_TIMBRES } from '../audio/instruments.js';
import { ALGORITHMS, ALGORITHM_ORDER, ROLES_META, ROLE_ORDER } from '../algorithms/meta.js';
import { getAlgorithmsForRole, getAlgorithmPlugin } from '../algorithms/registry.js';
import { GARDEN_PRESETS, applyDepthToParams, normalizeParams } from '../algorithms/params.js';
import { renderAlgorithmFields, bindAlgorithmEditor } from './paramEditors.js';
import { t } from '../i18n/index.js';

const PRESETS = GARDEN_PRESETS;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Build the UI panel and attach event handlers.
 * 
 * @param {HTMLElement} container - The UI overlay container
 * @param {Object} callbacks - { getParams, setParams, rebuildAndPlay, ... }
 * @returns {Object} UI API: { show, hide, updateDisplay }
 */
export function buildUI(container, callbacks) {
  const {
    getParams, getScore, setParams, onDebouncedParamsChange, rebuildAndPlay, saveParamsToHash,
    pausePlayback, resumePlayback, stopPlayback,
    setMasterVolume, setLayerVolume, setLayerMute,
    setSleepTimer, setEvolve, setAmbientType,
    setRainIntensityLevel, setThunderMode, setLayerTimbre,
    setCurrentTheme, toggleXRay, setZoomLevel,
    exportWav, exportJson, importJsonParams, setPlaybackStateListener
  } = callbacks;

  let panelVisible = false;
  let hideTimer = null;
  let isPlayingState = true;

  // ─── Build HTML ──────────────────────────────────────────

  container.innerHTML = `
    <button id="panel-toggle" class="panel-toggle" aria-label="Open controls panel" title="Open controls (H)">
      ${t('views.controlsOpen')}
    </button>

    <div id="control-panel" class="control-panel" role="complementary" aria-label="Controls">
      <div id="panel-content" class="panel-content">
        <div class="panel-header">
          <h2 class="panel-title" id="panel-title">${t('controls.panelTitle')}</h2>
          <button id="panel-close-btn" class="panel-close-btn" aria-label="${t('controls.closePanel')}" title="${t('controls.closePanel')} (Esc / H)">
            ✕
          </button>
        </div>
        
        <!-- Transport controls -->
        <div class="control-group transport" role="group" aria-label="Playback controls">
          <button id="play-pause-btn" class="transport-btn" aria-label="Pause" title="Play/Pause">⏸</button>
          <button id="stop-btn" class="transport-btn" aria-label="Stop" title="Stop">⏹</button>
          <div class="slider-row">
            <label for="master-vol" class="sr-label">Volume</label>
            <span class="slider-icon">🔊</span>
            <input type="range" id="master-vol" min="0" max="100" value="80" aria-label="Master volume" />
            <span id="master-vol-val" class="slider-val">80%</span>
          </div>
        </div>

        <!-- Depth Dial (the star control) -->
        <div class="control-group depth-group" role="group" aria-label="Recursion depth">
          <label for="depth-dial" data-i18n="controls.depthLabel">${t('controls.depthLabel')}</label>
          <p class="control-hint" data-i18n="controls.depthHint">${t('controls.depthHint')}</p>
          <input type="range" id="depth-dial" min="1" max="8" value="4" class="depth-dial" 
                 aria-label="Recursion depth from 1 to 8" />
          <span id="depth-val" class="slider-val depth-val-display">4</span>
        </div>

        <!-- Seed -->
        <div class="control-group" role="group" aria-label="Seed">
          <label for="seed-input" data-i18n="controls.seedLabel">${t('controls.seedLabel')}</label>
          <p class="control-hint" data-i18n="controls.seedHint">${t('controls.seedHint')}</p>
          <div class="seed-row">
            <input type="number" id="seed-input" min="0" max="99999" value="42" aria-label="Seed value" />
            <button id="random-seed" class="dice-btn" aria-label="Random seed" title="${t('controls.randomSeedTitle')}">🎲</button>
          </div>
        </div>

        <!-- Scale/Mood -->
        <div class="control-group" role="group" aria-label="Scale">
          <label for="scale-select" data-i18n="controls.scaleLabel">${t('controls.scaleLabel')}</label>
          <p class="control-hint" data-i18n="controls.scaleHint">${t('controls.scaleHint')}</p>
          <select id="scale-select" aria-label="Musical scale">
            ${Object.keys(SCALES).map(s => 
              `<option value="${s}"${s === 'pentatonic' ? ' selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Root Note -->
        <div class="control-group" role="group" aria-label="Root note">
          <label for="root-note" data-i18n="controls.rootNoteLabel">${t('controls.rootNoteLabel')}</label>
          <select id="root-note" aria-label="Root note">
            ${[48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72].map(midi => {
              const name = NOTE_NAMES[midi % 12] + Math.floor(midi / 12 - 1);
              return `<option value="${midi}"${midi === 60 ? ' selected' : ''}>${name}</option>`;
            }).join('')}
          </select>
        </div>

        <!-- Tempo -->
        <div class="control-group" role="group" aria-label="Tempo">
          <label for="tempo-slider" data-i18n="controls.tempoLabel">${t('controls.tempoLabel')}</label>
          <p class="control-hint" data-i18n="controls.tempoHint">${t('controls.tempoHint')}</p>
          <div class="slider-row">
            <input type="range" id="tempo-slider" min="40" max="90" value="60" aria-label="Tempo BPM" />
            <span id="tempo-val" class="slider-val">60 BPM</span>
          </div>
        </div>

        <!-- Branch Angle -->
        <div class="control-group" role="group" aria-label="Branch angle">
          <label for="angle-slider" data-i18n="controls.angleLabel">${t('controls.angleLabel')}</label>
          <p class="control-hint" data-i18n="controls.angleHint">${t('controls.angleHint')}</p>
          <div class="slider-row">
            <input type="range" id="angle-slider" min="10" max="45" value="25" aria-label="Branch angle degrees" />
            <span id="angle-val" class="slider-val">25°</span>
          </div>
        </div>

        <!-- Euclidean Density -->
        <div class="control-group" role="group" aria-label="Rhythm density">
          <label for="density-slider" data-i18n="controls.densityLabel">${t('controls.densityLabel')}</label>
          <p class="control-hint" data-i18n="controls.densityHint">${t('controls.densityHint')}</p>
          <div class="slider-row">
            <input type="range" id="density-slider" min="30" max="200" value="100" aria-label="Euclidean density" />
            <span id="density-val" class="slider-val">1.0×</span>
          </div>
        </div>

        <!-- L-system Preset -->
        <div class="control-group" role="group" aria-label="Tree shape">
          <label for="lsystem-select" data-i18n="controls.treeShapeLabel">${t('controls.treeShapeLabel')}</label>
          <select id="lsystem-select" aria-label="L-system preset">
            ${Object.keys(LSYSTEM_PRESETS).map(name => 
              `<option value="${name}"${name === 'Fern' ? ' selected' : ''}>${name}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Theme -->
        <div class="control-group" role="group" aria-label="Color theme">
          <label for="theme-select" data-i18n="controls.themeLabel">${t('controls.themeLabel')}</label>
          <select id="theme-select" aria-label="Color theme">
            ${Object.keys(THEMES).map(name => 
              `<option value="${name}"${name === 'Dusk' ? ' selected' : ''}>${name}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Ambient -->
        <div class="control-group" role="group" aria-label="Ambient sound">
          <label for="ambient-select" data-i18n="controls.ambientLabel">${t('controls.ambientLabel')}</label>
          <select id="ambient-select" aria-label="Ambient sound type">
            <option value="wind" data-i18n="controls.ambientWind" selected>${t('controls.ambientWind')}</option>
            <option value="rain" data-i18n="controls.ambientRain">${t('controls.ambientRain')}</option>
            <option value="none" data-i18n="controls.ambientNone">${t('controls.ambientNone')}</option>
          </select>
        </div>

        <!-- Rain Intensity & Thunder -->
        <div class="control-group" role="group" aria-label="Rain controls">
          <label for="rain-intensity-slider" data-i18n="controls.rainIntensityLabel">${t('controls.rainIntensityLabel')}</label>
          <p class="control-hint" data-i18n="controls.rainIntensityHint">${t('controls.rainIntensityHint')}</p>
          <div class="slider-row">
            <input type="range" id="rain-intensity-slider" min="0" max="1" step="0.01" value="0.35"
                   aria-label="Rain intensity from 0 to 1" />
            <span id="rain-intensity-val" class="slider-val">35%</span>
          </div>
          <label class="toggle-row" style="margin-top:6px;">
            <input type="checkbox" id="thunder-toggle" checked aria-label="Soft distant thunder" />
            <span data-i18n="controls.thunderLabel">${t('controls.thunderLabel')}</span>
            <span class="control-hint inline" data-i18n="controls.thunderHint">${t('controls.thunderHint')}</span>
          </label>
        </div>

        <!-- Recursion Parameters (mirrored with Algorithm Lab) -->
        <details class="control-group recursion-params-panel" open aria-label="Recursion Parameters">
          <summary data-i18n="controls.recursionParamsTitle">${t('controls.recursionParamsTitle')}</summary>
          <p class="control-hint" data-i18n="controls.recursionParamsHint">${t('controls.recursionParamsHint')}</p>
          <p id="drawer-cap-notice" class="alg-cap-warning" role="status" style="display:none;"></p>
          ${ROLE_ORDER.map(role => {
            const m = ROLES_META[role];
            const choices = getAlgorithmsForRole(role);
            return `
              <details class="drawer-alg-section" ${role === 'melody' ? 'open' : ''}>
                <summary style="color:${m.color};" data-drawer-role="${role}">${m.shape} ${t(`roles.${role}`)}</summary>
                <div class="drawer-role-picker">
                  <select class="drawer-alg-select" data-role="${role}" aria-label="Choose ${m.title} algorithm">
                    ${choices.map(ch => `<option value="${ch.id}">${t(`algorithms.${ch.id}.name`)}</option>`).join('')}
                  </select>
                </div>
                <div class="drawer-alg-editor" data-drawer-editor="${role}"></div>
              </details>
            `;
          }).join('')}
        </details>

        <!-- Sound Panel (Timbre selector per layer) -->
        <details class="control-group sound-panel" open aria-label="Sound timbres">
          <summary data-i18n="controls.soundPanelTitle">${t('controls.soundPanelTitle')}</summary>
          <p class="control-hint" data-i18n="controls.soundPanelHint">${t('controls.soundPanelHint')}</p>
          ${[
            ['melody', 'controls.layerMelody'],
            ['canon', 'controls.layerCanon'],
            ['bass', 'controls.layerBass'],
            ['percussion', 'controls.layerPercussion'],
            ['ambient', 'controls.layerAmbient']
          ].map(([layer, key]) => `
            <div class="sound-row">
              <label for="timbre-${layer}" class="sound-label" data-i18n="${key}">${t(key)}</label>
              <select id="timbre-${layer}" class="timbre-select" data-layer="${layer}" aria-label="${t(key)} timbre">
                ${TIMBRE_OPTIONS[layer].map(opt =>
                  `<option value="${opt}"${opt === DEFAULT_TIMBRES[layer] ? ' selected' : ''}>${opt}</option>`
                ).join('')}
              </select>
            </div>
          `).join('')}
        </details>

        <!-- Layer Volumes -->
        <details class="control-group layers-group">
          <summary data-i18n="controls.layerVolumesTitle">${t('controls.layerVolumesTitle')}</summary>
          ${[
            ['melody', 'controls.layerMelody'],
            ['canon', 'controls.layerCanon'],
            ['bass', 'controls.layerBass'],
            ['percussion', 'controls.layerPercussion'],
            ['ambient', 'controls.layerAmbient'],
            ['drone', 'controls.layerDrone']
          ].map(([layer, key]) => `
            <div class="slider-row layer-row">
              <label for="vol-${layer}" class="layer-label" data-i18n="${key}">${t(key)}</label>
              <input type="range" id="vol-${layer}" min="0" max="100" value="${layer === 'ambient' ? 50 : layer === 'drone' ? 45 : 70}" 
                     class="layer-slider" data-layer="${layer}" aria-label="${layer} volume" />
              <button class="mute-btn" data-layer="${layer}" aria-label="Mute ${layer}">🔈</button>
            </div>
          `).join('')}
        </details>

        <!-- Toggles -->
        <div class="control-group toggles" role="group" aria-label="Toggles">
          <label class="toggle-row">
            <input type="checkbox" id="xray-toggle" aria-label="Recursion X-ray mode" />
            <span data-i18n="controls.xrayLabel">${t('controls.xrayLabel')}</span>
            <span class="control-hint inline" data-i18n="controls.xrayHint">${t('controls.xrayHint')}</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" id="evolve-toggle" aria-label="Evolve mode" />
            <span data-i18n="controls.evolveLabel">${t('controls.evolveLabel')}</span>
            <span class="control-hint inline" data-i18n="controls.evolveHint">${t('controls.evolveHint')}</span>
          </label>
        </div>

        <!-- Sleep Timer -->
        <div class="control-group" role="group" aria-label="Sleep timer">
          <label for="sleep-select" data-i18n="controls.sleepLabel">${t('controls.sleepLabel')}</label>
          <select id="sleep-select" aria-label="Sleep timer duration">
            <option value="0" data-i18n="controls.sleepOff" selected>${t('controls.sleepOff')}</option>
            <option value="5" data-i18n="controls.sleep5">${t('controls.sleep5')}</option>
            <option value="15" data-i18n="controls.sleep15">${t('controls.sleep15')}</option>
            <option value="30" data-i18n="controls.sleep30">${t('controls.sleep30')}</option>
          </select>
        </div>

        <!-- Zoom / Depth -->
        <div class="control-group" role="group" aria-label="Zoom">
          <label for="zoom-slider" data-i18n="controls.zoomLabel">${t('controls.zoomLabel')}</label>
          <div class="slider-row">
            <input type="range" id="zoom-slider" min="50" max="400" value="100" aria-label="Zoom level" />
            <span id="zoom-val" class="slider-val">1.0×</span>
          </div>
        </div>

        <!-- Presets -->
        <div class="control-group presets-group" role="group" aria-label="Quick presets">
          <label data-i18n="controls.presetsLabel">${t('controls.presetsLabel')}</label>
          <div class="preset-buttons">
            ${Object.keys(PRESETS).map(name => 
              `<button class="preset-btn" data-preset="${name}" aria-label="Load preset: ${name}">${t(`presets.${name}`)}</button>`
            ).join('')}
          </div>
        </div>

        <!-- Share link -->
        <div class="control-group" role="group" aria-label="Share">
          <button id="share-btn" class="share-btn" aria-label="Copy share link">${t('controls.shareBtn')}</button>
        </div>

        <!-- Algorithm explainer -->
        <details class="control-group explainer">
          <summary data-i18n="controls.explainerTitle">${t('controls.explainerTitle')}</summary>
          <div class="explainer-content">
            <p>🎵 <span data-i18n="controls.explainerNorgard">${t('controls.explainerNorgard')}</span></p>
            <p>🗼 <span data-i18n="controls.explainerHanoi">${t('controls.explainerHanoi')}</span></p>
            <p>⭕ <span data-i18n="controls.explainerEuclid">${t('controls.explainerEuclid')}</span></p>
            <p>🌿 <span data-i18n="controls.explainerLsystem">${t('controls.explainerLsystem')}</span></p>
            <p>🪕 <span data-i18n="controls.explainerEktara">${t('controls.explainerEktara')}</span></p>
          </div>
        </details>

        <!-- Download WAV & Parameters JSON -->
        <div class="control-group" id="export-group" role="group" aria-label="Export">
          <label for="export-duration" data-i18n="controls.exportTitle">${t('controls.exportTitle')}</label>
          <select id="export-duration" aria-label="Export duration">
            <option value="30" data-i18n="controls.export30">${t('controls.export30')}</option>
            <option value="60" data-i18n="controls.export60" selected>${t('controls.export60')}</option>
            <option value="180" data-i18n="controls.export180">${t('controls.export180')}</option>
          </select>
          <div class="export-actions">
            <button id="download-btn" class="download-btn" aria-label="Download WAV audio" data-i18n="controls.downloadWav">${t('controls.downloadWav')}</button>
            <button id="download-json-btn" class="download-btn secondary" aria-label="Export parameters JSON" title="${t('controls.exportJson')}" data-i18n="controls.exportJson">${t('controls.exportJson')}</button>
            <button id="load-json-btn" class="download-btn secondary" aria-label="Load parameters JSON" title="${t('controls.loadJson')}" data-i18n="controls.loadJson">${t('controls.loadJson')}</button>
            <input type="file" id="load-json-input" accept=".json,application/json" style="display:none;" aria-label="Choose JSON parameter file" />
          </div>
          <div id="export-progress" class="export-progress" style="display:none;" role="status" aria-live="polite">
            <div id="export-bar" class="export-bar"></div>
            <span id="export-text">Rendering...</span>
          </div>
          <p id="export-status" class="export-status" role="status" aria-live="polite"></p>
        </div>
      </div>
    </div>
  `;

  // ─── Event Handlers ──────────────────────────────────────

  const panel = container.querySelector('#control-panel');
  const panelContent = container.querySelector('#panel-content');
  const panelToggle = container.querySelector('#panel-toggle');
  const panelCloseBtn = container.querySelector('#panel-close-btn');

  // Panel open/close (toggle button floats outside drawer when closed; close button sits in sticky drawer header)
  function setPanelOpen(open) {
    panelVisible = !!open;
    panel.style.display = panelVisible ? 'block' : 'none';
    panel.classList.toggle('collapsed', !panelVisible);
    panelToggle.style.display = panelVisible ? 'none' : 'inline-flex';
    panelToggle.setAttribute('aria-expanded', String(panelVisible));
  }

  panelToggle.addEventListener('click', () => setPanelOpen(true));
  panelCloseBtn.addEventListener('click', () => setPanelOpen(false));

  // Auto-hide on idle
  function resetHideTimer() {
    if (hideTimer) clearTimeout(hideTimer);
    panel.classList.remove('auto-hidden');
    hideTimer = setTimeout(() => {
      if (!panel.matches(':hover')) {
        panel.classList.add('auto-hidden');
      }
    }, 8000);
  }
  document.addEventListener('mousemove', resetHideTimer);
  document.addEventListener('touchstart', resetHideTimer);
  panel.addEventListener('mouseenter', () => panel.classList.remove('auto-hidden'));

  // Helper to rebuild
  function applyAndRebuild() {
    rebuildAndPlay();
    saveParamsToHash();
    resetHideTimer();
  }

  // Play/Pause
  container.querySelector('#play-pause-btn').addEventListener('click', () => {
    isPlayingState = !isPlayingState;
    if (isPlayingState) {
      resumePlayback();
      container.querySelector('#play-pause-btn').textContent = '⏸';
      container.querySelector('#play-pause-btn').setAttribute('aria-label', 'Pause');
    } else {
      pausePlayback();
      container.querySelector('#play-pause-btn').textContent = '▶';
      container.querySelector('#play-pause-btn').setAttribute('aria-label', 'Play');
    }
  });

  // Stop
  container.querySelector('#stop-btn').addEventListener('click', () => {
    stopPlayback();
    isPlayingState = false;
    container.querySelector('#play-pause-btn').textContent = '▶';
  });

  // Master volume
  const masterVolSlider = container.querySelector('#master-vol');
  masterVolSlider.addEventListener('input', () => {
    const val = masterVolSlider.value / 100;
    setMasterVolume(val);
    container.querySelector('#master-vol-val').textContent = masterVolSlider.value + '%';
  });

  // Depth Dial — scales coupled depth defaults across all 4 algorithms smoothly
  const depthDial = container.querySelector('#depth-dial');
  depthDial.addEventListener('input', () => {
    const newDepth = parseInt(depthDial.value, 10);
    container.querySelector('#depth-val').textContent = String(newDepth);
    const updated = applyDepthToParams(getParams(), newDepth);
    onDebouncedParamsChange(updated);
  });

  // Seed
  const seedInput = container.querySelector('#seed-input');
  seedInput.addEventListener('change', () => {
    setParams({ seed: parseInt(seedInput.value) || 0 });
    applyAndRebuild();
  });
  container.querySelector('#random-seed').addEventListener('click', () => {
    const curSeed = parseInt(seedInput.value, 10) || 42;
    const rng = createPRNG(curSeed ^ (Date.now() & 0xffff));
    const newSeed = Math.floor(rng() * 99999);
    seedInput.value = newSeed;
    setParams({ seed: newSeed });
    applyAndRebuild();
  });

  // Scale
  container.querySelector('#scale-select').addEventListener('change', (e) => {
    setParams({ scale: e.target.value });
    applyAndRebuild();
  });

  // Root note
  container.querySelector('#root-note').addEventListener('change', (e) => {
    setParams({ rootNote: parseInt(e.target.value) });
    applyAndRebuild();
  });

  // Tempo
  const tempoSlider = container.querySelector('#tempo-slider');
  tempoSlider.addEventListener('input', () => {
    container.querySelector('#tempo-val').textContent = tempoSlider.value + ' BPM';
  });
  tempoSlider.addEventListener('change', () => {
    setParams({ tempo: parseInt(tempoSlider.value) });
    applyAndRebuild();
  });

  // Branch angle
  const angleSlider = container.querySelector('#angle-slider');
  angleSlider.addEventListener('input', () => {
    const val = Number(angleSlider.value);
    container.querySelector('#angle-val').textContent = val + '°';
    const cur = getParams();
    onDebouncedParamsChange({
      ...cur,
      branchAngle: val,
      lsystem: { ...cur.lsystem, turnAngle: val }
    });
  });

  // Euclidean density
  const densitySlider = container.querySelector('#density-slider');
  densitySlider.addEventListener('input', () => {
    const density = densitySlider.value / 100;
    container.querySelector('#density-val').textContent = density.toFixed(1) + '×';
    const cur = getParams();
    const r0 = cur.euclid.rings[0];
    const pulses = Math.max(1, Math.min(r0.steps, Math.round((2 + cur.depth) * density)));
    const nextRings = cur.euclid.rings.map((r, i) => (i === 0 ? { ...r, pulses } : r));
    onDebouncedParamsChange({
      ...cur,
      densityEuclid: density,
      euclid: { ...cur.euclid, rings: nextRings }
    });
  });

  // L-system preset
  container.querySelector('#lsystem-select').addEventListener('change', (e) => {
    const presetName = e.target.value;
    const pr = LSYSTEM_PRESETS[presetName];
    if (!pr) return;
    const cur = getParams();
    onDebouncedParamsChange({
      ...cur,
      lsystemPreset: presetName,
      branchAngle: pr.angle,
      lsystem: {
        ...cur.lsystem,
        preset: presetName,
        axiom: pr.axiom,
        rules: { ...pr.rules },
        turnAngle: pr.angle,
        generations: Math.min(pr.maxGen || 5, cur.lsystem.generations)
      }
    });
  });

  // Theme
  container.querySelector('#theme-select').addEventListener('change', (e) => {
    setCurrentTheme(e.target.value);
    setParams({ theme: e.target.value });
  });

  // Ambient
  const rainSlider = container.querySelector('#rain-intensity-slider');
  const rainValLabel = container.querySelector('#rain-intensity-val');
  const thunderToggle = container.querySelector('#thunder-toggle');

  function formatRainLabel(v) {
    return v <= 0.005 ? t('controls.rainOff') : `${Math.round(v * 100)}%`;
  }

  container.querySelector('#ambient-select').addEventListener('change', (e) => {
    const val = e.target.value;
    setAmbientType(val);
    setParams({ ambient: val });
    if (val === 'rain' && parseFloat(rainSlider.value) <= 0.01) {
      rainSlider.value = '0.45';
      rainValLabel.textContent = formatRainLabel(0.45);
      setRainIntensityLevel?.(0.45);
    } else if (val === 'none') {
      rainSlider.value = '0';
      rainValLabel.textContent = formatRainLabel(0);
      setRainIntensityLevel?.(0);
    }
    saveParamsToHash();
  });

  rainSlider.addEventListener('input', () => {
    const val = parseFloat(rainSlider.value);
    rainValLabel.textContent = formatRainLabel(val);
    setRainIntensityLevel?.(val);
  });
  rainSlider.addEventListener('change', saveParamsToHash);

  thunderToggle.addEventListener('change', (e) => {
    setThunderMode?.(e.target.checked);
    saveParamsToHash();
  });

  // Sound panel timbre dropdowns
  container.querySelectorAll('.timbre-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const layer = e.target.dataset.layer;
      const val = e.target.value;
      const curTimbres = { ...DEFAULT_TIMBRES, ...(getParams().timbres || {}) };
      curTimbres[layer] = val;
      setParams({ timbres: curTimbres });
      setLayerTimbre?.(layer, val);
      saveParamsToHash();
    });
  });

  // Layer volumes
  container.querySelectorAll('.layer-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const layer = slider.dataset.layer;
      setLayerVolume(layer, slider.value / 100);
    });
  });

  // Mute buttons
  container.querySelectorAll('.mute-btn').forEach(btn => {
    let muted = false;
    btn.addEventListener('click', () => {
      muted = !muted;
      setLayerMute(btn.dataset.layer, muted);
      btn.textContent = muted ? '🔇' : '🔈';
      btn.classList.toggle('muted', muted);
    });
  });

  // X-ray toggle
  container.querySelector('#xray-toggle').addEventListener('change', (e) => {
    toggleXRay(e.target.checked);
  });

  // Evolve toggle
  container.querySelector('#evolve-toggle').addEventListener('change', (e) => {
    setEvolve(e.target.checked);
  });

  // Sleep timer
  container.querySelector('#sleep-select').addEventListener('change', (e) => {
    setSleepTimer(parseInt(e.target.value));
  });

  // Zoom
  const zoomSlider = container.querySelector('#zoom-slider');
  zoomSlider.addEventListener('input', () => {
    const val = (zoomSlider.value / 100).toFixed(1);
    container.querySelector('#zoom-val').textContent = val + '×';
    setZoomLevel(zoomSlider.value / 100);
  });

  // Presets
  container.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetName = btn.dataset.preset;
      const preset = PRESETS[presetName];
      if (!preset) return;

      const normalized = normalizeParams(preset);
      setParams(normalized);
      updateControlsFromParams(normalized);
      setCurrentTheme(normalized.theme);
      setAmbientType(normalized.ambient);
      setRainIntensityLevel?.(normalized.rainIntensity ?? 0);
      setThunderMode?.(normalized.thunderEnabled ?? true);
      if (normalized.timbres) {
        for (const [layer, timbre] of Object.entries(normalized.timbres)) {
          setLayerTimbre?.(layer, timbre);
        }
      }
      applyAndRebuild();
      renderAllDrawerEditors(true);
    });
  });

  // Share link
  container.querySelector('#share-btn').addEventListener('click', () => {
    saveParamsToHash();
    navigator.clipboard.writeText(window.location.href).then(() => {
      const btn = container.querySelector('#share-btn');
      btn.textContent = t('controls.shareCopied');
      setTimeout(() => { btn.textContent = t('controls.shareBtn'); }, 2000);
    }).catch(() => {
      // Fallback: select the URL
      const url = window.location.href;
      prompt('Share this link:', url);
    });
  });

  // ─── WAV & JSON Export ────────────────────────────────────
  const downloadBtn = container.querySelector('#download-btn');
  const downloadJsonBtn = container.querySelector('#download-json-btn');
  const exportDuration = container.querySelector('#export-duration');
  const exportProgress = container.querySelector('#export-progress');
  const exportBar = container.querySelector('#export-bar');
  const exportText = container.querySelector('#export-text');
  const exportStatus = container.querySelector('#export-status');

  if (downloadBtn && exportWav) {
    downloadBtn.addEventListener('click', async () => {
      const durationSeconds = parseInt(exportDuration.value, 10) || 60;
      downloadBtn.disabled = true;
      exportDuration.disabled = true;
      exportStatus.textContent = '';
      exportStatus.classList.remove('error');
      exportProgress.style.display = 'block';
      exportBar.style.width = '5%';
      exportText.textContent = t('controls.exportStarting');

      try {
        const result = await exportWav(durationSeconds, (pct, msg) => {
          exportBar.style.width = `${pct}%`;
          exportText.textContent = `${msg} (${pct}%)`;
        });
        exportStatus.textContent = t('controls.exportSaved', { filename: result.filename });
        setTimeout(() => {
          exportProgress.style.display = 'none';
        }, 1200);
      } catch (err) {
        console.error('WAV export failed:', err);
        exportProgress.style.display = 'none';
        exportStatus.textContent = t('controls.exportFailed');
        exportStatus.classList.add('error');
      } finally {
        downloadBtn.disabled = false;
        exportDuration.disabled = false;
      }
    });
  }

  if (downloadJsonBtn && exportJson) {
    downloadJsonBtn.addEventListener('click', () => {
      try {
        const res = exportJson();
        exportStatus.classList.remove('error');
        exportStatus.textContent = t('controls.exportSaved', { filename: res.filename });
      } catch (err) {
        exportStatus.textContent = t('controls.exportJsonError');
        exportStatus.classList.add('error');
      }
    });
  }

  const loadJsonBtn = container.querySelector('#load-json-btn');
  const loadJsonInput = container.querySelector('#load-json-input');
  if (loadJsonBtn && loadJsonInput && importJsonParams) {
    loadJsonBtn.addEventListener('click', () => loadJsonInput.click());
    loadJsonInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const loaded = importJsonParams(parsed.params || parsed);
        updateControlsFromParams(loaded);
        renderAllDrawerEditors(true);
        exportStatus.classList.remove('error');
        exportStatus.textContent = t('controls.loadJsonSuccess', { filename: file.name });
      } catch (err) {
        exportStatus.classList.add('error');
        exportStatus.textContent = t('controls.loadJsonError');
      } finally {
        loadJsonInput.value = '';
      }
    });
  }

  // ─── Mirrored Recursion Parameter Editors in Drawer ─────
  container.querySelectorAll('.drawer-alg-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const role = e.target.dataset.role;
      const cur = normalizeParams(getParams());
      const next = normalizeParams({
        ...cur,
        roles: { ...cur.roles, [role]: e.target.value }
      });
      onDebouncedParamsChange(next);
      renderDrawerEditor(role, true);
    });
  });

  function renderDrawerEditor(role, force = false) {
    const p = normalizeParams(getParams());
    const sel = container.querySelector(`.drawer-alg-select[data-role="${role}"]`);
    const plugin = getAlgorithmPlugin(role, p.roles?.[role]);
    if (sel) sel.value = plugin.id;

    const host = container.querySelector(`[data-drawer-editor="${role}"]`);
    if (!host) return;
    if (!force && host.contains(document.activeElement)) {
      const statsEl = host.querySelector('.alg-stats-line');
      const statsText = getScore?.()?.stats?.[role];
      if (statsEl && statsText) statsEl.textContent = statsText;
      return;
    }
    host.innerHTML = renderAlgorithmFields(role, p, getScore?.()?.stats);
    bindAlgorithmEditor(host, role, {
      getParams,
      onUpdateParams: (nextParams, { rerenderSelf }) => {
        onDebouncedParamsChange(nextParams);
        if (rerenderSelf) renderDrawerEditor(role, true);
      }
    });
  }

  function renderAllDrawerEditors(force = false) {
    for (const role of ROLE_ORDER) {
      renderDrawerEditor(role, force);
    }
    const notice = container.querySelector('#drawer-cap-notice');
    const capMsg = getScore?.()?.stats?.capNotice;
    if (notice) {
      if (capMsg) {
        notice.textContent = `⚠ ${capMsg}`;
        notice.style.display = 'block';
      } else {
        notice.style.display = 'none';
      }
    }
  }
  renderAllDrawerEditors(true);

  // Keep play/pause button synced if sleep timer or stop changes state externally
  if (setPlaybackStateListener) {
    setPlaybackStateListener((state) => {
      isPlayingState = state.isPlaying;
      const playPauseBtn = container.querySelector('#play-pause-btn');
      if (playPauseBtn) {
        playPauseBtn.textContent = isPlayingState ? '⏸' : '▶';
        playPauseBtn.setAttribute('aria-label', isPlayingState ? 'Pause' : 'Play');
      }
    });
  }

  // ─── Keyboard shortcuts ──────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    
    switch (e.key) {
      case ' ':
        e.preventDefault();
        container.querySelector('#play-pause-btn').click();
        break;
      case 'x':
      case 'X':
        const xrayToggle = container.querySelector('#xray-toggle');
        xrayToggle.checked = !xrayToggle.checked;
        xrayToggle.dispatchEvent(new Event('change'));
        break;
      case 'ArrowUp':
        e.preventDefault();
        depthDial.value = Math.min(8, parseInt(depthDial.value) + 1);
        depthDial.dispatchEvent(new Event('input'));
        depthDial.dispatchEvent(new Event('change'));
        break;
      case 'ArrowDown':
        e.preventDefault();
        depthDial.value = Math.max(1, parseInt(depthDial.value) - 1);
        depthDial.dispatchEvent(new Event('input'));
        depthDial.dispatchEvent(new Event('change'));
        break;
      case 'h':
      case 'H':
        setPanelOpen(!panelVisible);
        break;
      case 'Escape':
        if (panelVisible) setPanelOpen(false);
        break;
    }
  });

  // ─── Update controls from params ─────────────────────────

  function updateControlsFromParams(params) {
    depthDial.value = params.depth || 4;
    container.querySelector('#depth-val').textContent = params.depth || 4;
    seedInput.value = params.seed || 42;
    container.querySelector('#scale-select').value = params.scale || 'pentatonic';
    container.querySelector('#root-note').value = params.rootNote || 60;
    tempoSlider.value = params.tempo || 60;
    container.querySelector('#tempo-val').textContent = (params.tempo || 60) + ' BPM';
    angleSlider.value = params.branchAngle || 25;
    container.querySelector('#angle-val').textContent = (params.branchAngle || 25) + '°';
    densitySlider.value = Math.round((params.densityEuclid || 1) * 100);
    container.querySelector('#density-val').textContent = (params.densityEuclid || 1).toFixed(1) + '×';
    const lPreset = params.lsystem?.preset || params.lsystemPreset || 'Fern';
    const lsSelect = container.querySelector('#lsystem-select');
    lsSelect.value = LSYSTEM_PRESETS[lPreset] ? lPreset : 'Fern';
    container.querySelector('#theme-select').value = params.theme || 'Dusk';
    container.querySelector('#ambient-select').value = params.ambient || 'wind';
    const rainVal = params.rainIntensity ?? 0.35;
    rainSlider.value = rainVal;
    rainValLabel.textContent = formatRainLabel(rainVal);
    thunderToggle.checked = params.thunderEnabled ?? true;
    const timbres = { ...DEFAULT_TIMBRES, ...(params.timbres || {}) };
    container.querySelectorAll('.timbre-select').forEach(sel => {
      sel.value = timbres[sel.dataset.layer] || DEFAULT_TIMBRES[sel.dataset.layer];
    });
  }

  // Initialize from current params
  const params = getParams();
  updateControlsFromParams(params);

  // Start with panel closed
  setPanelOpen(false);

  function updateZoomDisplay(level) {
    const pct = Math.round(Math.max(50, Math.min(400, level * 100)));
    zoomSlider.value = pct;
    container.querySelector('#zoom-val').textContent = (pct / 100).toFixed(1) + '×';
  }

  function applyLanguage() {
    panelToggle.textContent = t('views.controlsOpen');
    const pt = container.querySelector('#panel-title');
    if (pt) pt.textContent = t('controls.panelTitle');
    panelCloseBtn.setAttribute('aria-label', t('controls.closePanel'));
    panelCloseBtn.title = `${t('controls.closePanel')} (Esc / H)`;

    container.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });

    const randomBtn = container.querySelector('#random-seed');
    if (randomBtn) randomBtn.title = t('controls.randomSeedTitle');

    for (const role of ROLE_ORDER) {
      const m = ROLES_META[role];
      const sum = container.querySelector(`[data-drawer-role="${role}"]`);
      if (sum) sum.textContent = `${m.shape} ${t(`roles.${role}`)}`;
      const sel = container.querySelector(`.drawer-alg-select[data-role="${role}"]`);
      if (sel) {
        for (const opt of sel.options) {
          opt.textContent = t(`algorithms.${opt.value}.name`);
        }
      }
    }

    container.querySelectorAll('.preset-btn').forEach(btn => {
      const name = btn.dataset.preset;
      if (name) btn.textContent = t(`presets.${name}`);
    });

    const shareBtnEl = container.querySelector('#share-btn');
    if (shareBtnEl) shareBtnEl.textContent = t('controls.shareBtn');

    rainValLabel.textContent = formatRainLabel(parseFloat(rainSlider.value));
    renderAllDrawerEditors(true);
  }

  return {
    updateControlsFromParams,
    syncAllFromParams: (p, _score) => {
      updateControlsFromParams(p);
      renderAllDrawerEditors(false);
    },
    updateZoomDisplay,
    applyLanguage,
    show: () => setPanelOpen(true),
    hide: () => setPanelOpen(false)
  };
}
