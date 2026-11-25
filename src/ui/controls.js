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

// ─── Preset configurations ──────────────────────────────────────

const PRESETS = {
  'Quiet Forest': {
    seed: 42, depth: 3, scale: 'pentatonic', rootNote: 60,
    tempo: 50, branchAngle: 25, densityEuclid: 0.7,
    lsystemPreset: 'Fern', theme: 'Moss', ambient: 'wind'
  },
  'Moonlit Pond': {
    seed: 137, depth: 5, scale: 'lydian', rootNote: 67,
    tempo: 45, branchAngle: 22, densityEuclid: 0.5,
    lsystemPreset: 'Wispy Bush', theme: 'Moonlight', ambient: 'rain'
  },
  'Deep Dream': {
    seed: 256, depth: 7, scale: 'dorian', rootNote: 55,
    tempo: 40, branchAngle: 30, densityEuclid: 1.5,
    lsystemPreset: 'Canopy', theme: 'Dusk', ambient: 'wind'
  },
  'Morning Light': {
    seed: 88, depth: 4, scale: 'pentatonic', rootNote: 72,
    tempo: 65, branchAngle: 20, densityEuclid: 1.0,
    lsystemPreset: 'Binary Tree', theme: 'Ember', ambient: 'none'
  }
};

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
    getParams, setParams, rebuildAndPlay, saveParamsToHash,
    pausePlayback, resumePlayback, stopPlayback,
    setMasterVolume, setLayerVolume, setLayerMute,
    setSleepTimer, setEvolve, setAmbientType,
    setCurrentTheme, toggleXRay, setZoomLevel,
    exportWav, exportJson, setPlaybackStateListener
  } = callbacks;

  let panelVisible = true;
  let hideTimer = null;
  let isPlayingState = true;

  // ─── Build HTML ──────────────────────────────────────────

  container.innerHTML = `
    <div id="control-panel" class="control-panel" role="complementary" aria-label="Controls">
      <button id="panel-toggle" class="panel-toggle" aria-label="Toggle control panel" title="Toggle controls">
        ☰
      </button>
      
      <div id="panel-content" class="panel-content">
        <h2 class="panel-title">🌳 Recursive Garden</h2>
        
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
          <label for="depth-dial">Recursion Depth</label>
          <p class="control-hint">How many layers of recursion — deeper = richer and more complex</p>
          <input type="range" id="depth-dial" min="1" max="8" value="4" class="depth-dial" 
                 aria-label="Recursion depth from 1 to 8" />
          <span id="depth-val" class="slider-val depth-val-display">4</span>
        </div>

        <!-- Seed -->
        <div class="control-group" role="group" aria-label="Seed">
          <label for="seed-input">Seed</label>
          <p class="control-hint">The starting number that makes each composition unique</p>
          <div class="seed-row">
            <input type="number" id="seed-input" min="0" max="99999" value="42" aria-label="Seed value" />
            <button id="random-seed" class="dice-btn" aria-label="Random seed" title="Surprise me!">🎲</button>
          </div>
        </div>

        <!-- Scale/Mood -->
        <div class="control-group" role="group" aria-label="Scale">
          <label for="scale-select">Scale / Mood</label>
          <p class="control-hint">The set of notes — pentatonic is peaceful, lydian is dreamy</p>
          <select id="scale-select" aria-label="Musical scale">
            ${Object.keys(SCALES).map(s => 
              `<option value="${s}"${s === 'pentatonic' ? ' selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Root Note -->
        <div class="control-group" role="group" aria-label="Root note">
          <label for="root-note">Root Note</label>
          <select id="root-note" aria-label="Root note">
            ${[48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72].map(midi => {
              const name = NOTE_NAMES[midi % 12] + Math.floor(midi / 12 - 1);
              return `<option value="${midi}"${midi === 60 ? ' selected' : ''}>${name}</option>`;
            }).join('')}
          </select>
        </div>

        <!-- Tempo -->
        <div class="control-group" role="group" aria-label="Tempo">
          <label for="tempo-slider">Tempo</label>
          <p class="control-hint">Speed of the music (BPM)</p>
          <div class="slider-row">
            <input type="range" id="tempo-slider" min="40" max="90" value="60" aria-label="Tempo BPM" />
            <span id="tempo-val" class="slider-val">60 BPM</span>
          </div>
        </div>

        <!-- Branch Angle -->
        <div class="control-group" role="group" aria-label="Branch angle">
          <label for="angle-slider">Branch Angle</label>
          <p class="control-hint">How wide the tree's branches spread</p>
          <div class="slider-row">
            <input type="range" id="angle-slider" min="10" max="45" value="25" aria-label="Branch angle degrees" />
            <span id="angle-val" class="slider-val">25°</span>
          </div>
        </div>

        <!-- Euclidean Density -->
        <div class="control-group" role="group" aria-label="Rhythm density">
          <label for="density-slider">Rhythm Density</label>
          <p class="control-hint">How many percussion hits in each cycle</p>
          <div class="slider-row">
            <input type="range" id="density-slider" min="30" max="200" value="100" aria-label="Euclidean density" />
            <span id="density-val" class="slider-val">1.0×</span>
          </div>
        </div>

        <!-- L-system Preset -->
        <div class="control-group" role="group" aria-label="Tree shape">
          <label for="lsystem-select">Tree Shape</label>
          <select id="lsystem-select" aria-label="L-system preset">
            ${Object.keys(LSYSTEM_PRESETS).map(name => 
              `<option value="${name}"${name === 'Fern' ? ' selected' : ''}>${name}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Theme -->
        <div class="control-group" role="group" aria-label="Color theme">
          <label for="theme-select">Theme</label>
          <select id="theme-select" aria-label="Color theme">
            ${Object.keys(THEMES).map(name => 
              `<option value="${name}"${name === 'Dusk' ? ' selected' : ''}>${name}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Ambient -->
        <div class="control-group" role="group" aria-label="Ambient sound">
          <label for="ambient-select">Ambient Sound</label>
          <select id="ambient-select" aria-label="Ambient sound type">
            <option value="wind" selected>Wind</option>
            <option value="rain">Rain</option>
            <option value="none">None</option>
          </select>
        </div>

        <!-- Layer Volumes -->
        <details class="control-group layers-group">
          <summary>Layer Volumes</summary>
          ${['melody', 'canon', 'bass', 'percussion', 'ambient'].map(layer => `
            <div class="slider-row layer-row">
              <label for="vol-${layer}" class="layer-label">${layer.charAt(0).toUpperCase() + layer.slice(1)}</label>
              <input type="range" id="vol-${layer}" min="0" max="100" value="${layer === 'ambient' ? 50 : 70}" 
                     class="layer-slider" data-layer="${layer}" aria-label="${layer} volume" />
              <button class="mute-btn" data-layer="${layer}" aria-label="Mute ${layer}">🔈</button>
            </div>
          `).join('')}
        </details>

        <!-- Toggles -->
        <div class="control-group toggles" role="group" aria-label="Toggles">
          <label class="toggle-row">
            <input type="checkbox" id="xray-toggle" aria-label="Recursion X-ray mode" />
            <span>X-Ray Mode</span>
            <span class="control-hint inline">(show recursion details)</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" id="evolve-toggle" aria-label="Evolve mode" />
            <span>Evolve</span>
            <span class="control-hint inline">(seed changes each loop)</span>
          </label>
        </div>

        <!-- Sleep Timer -->
        <div class="control-group" role="group" aria-label="Sleep timer">
          <label for="sleep-select">Sleep Timer</label>
          <select id="sleep-select" aria-label="Sleep timer duration">
            <option value="0" selected>Off</option>
            <option value="5">5 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
          </select>
        </div>

        <!-- Zoom / Depth -->
        <div class="control-group" role="group" aria-label="Zoom">
          <label for="zoom-slider">Zoom into Tree</label>
          <div class="slider-row">
            <input type="range" id="zoom-slider" min="50" max="400" value="100" aria-label="Zoom level" />
            <span id="zoom-val" class="slider-val">1.0×</span>
          </div>
        </div>

        <!-- Presets -->
        <div class="control-group presets-group" role="group" aria-label="Quick presets">
          <label>Presets</label>
          <div class="preset-buttons">
            ${Object.keys(PRESETS).map(name => 
              `<button class="preset-btn" data-preset="${name}" aria-label="Load preset: ${name}">${name}</button>`
            ).join('')}
          </div>
        </div>

        <!-- Share link -->
        <div class="control-group" role="group" aria-label="Share">
          <button id="share-btn" class="share-btn" aria-label="Copy share link">🔗 Copy Share Link</button>
        </div>

        <!-- Algorithm explainer -->
        <details class="control-group explainer">
          <summary>What You're Seeing & Hearing</summary>
          <div class="explainer-content">
            <p><strong>🎵 Nørgård Infinity Series</strong> → melody. A self-similar sequence where
              every value contains smaller copies of itself, creating a fractal melody.</p>
            <p><strong>🗼 Tower of Hanoi</strong> → bass. Discs move between pegs — big disc = slow low notes,
              small disc = quick high notes.</p>
            <p><strong>⭕ Euclidean Rhythm</strong> → percussion. Distributes beats as evenly as possible
              in a cycle, like rhythms found in world music.</p>
            <p><strong>🌿 L-System</strong> → the tree. Rewriting rules grow branches recursively,
              with angles from the melody, so the tree's shape IS the music.</p>
          </div>
        </details>

        <!-- Download WAV & Parameters JSON -->
        <div class="control-group" id="export-group" role="group" aria-label="Export">
          <label for="export-duration">Export Composition</label>
          <select id="export-duration" aria-label="Export duration">
            <option value="30">30 seconds (+6s tail)</option>
            <option value="60" selected>1 minute (+6s tail)</option>
            <option value="180">3 minutes (+6s tail)</option>
          </select>
          <div class="export-actions">
            <button id="download-btn" class="download-btn" aria-label="Download WAV audio">⬇ Download WAV</button>
            <button id="download-json-btn" class="download-btn secondary" aria-label="Export parameters JSON" title="Download parameters as JSON">📄 JSON</button>
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

  // Panel toggle
  panelToggle.addEventListener('click', () => {
    panelVisible = !panelVisible;
    panelContent.style.display = panelVisible ? 'block' : 'none';
    panelToggle.textContent = panelVisible ? '✕' : '☰';
  });

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

  // Depth Dial
  const depthDial = container.querySelector('#depth-dial');
  depthDial.addEventListener('input', () => {
    setParams({ depth: parseInt(depthDial.value) });
    container.querySelector('#depth-val').textContent = depthDial.value;
  });
  depthDial.addEventListener('change', applyAndRebuild);

  // Seed
  const seedInput = container.querySelector('#seed-input');
  seedInput.addEventListener('change', () => {
    setParams({ seed: parseInt(seedInput.value) || 0 });
    applyAndRebuild();
  });
  container.querySelector('#random-seed').addEventListener('click', () => {
    const newSeed = Math.floor(Math.random() * 99999);
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
    container.querySelector('#angle-val').textContent = angleSlider.value + '°';
  });
  angleSlider.addEventListener('change', () => {
    setParams({ branchAngle: parseInt(angleSlider.value) });
    applyAndRebuild();
  });

  // Euclidean density
  const densitySlider = container.querySelector('#density-slider');
  densitySlider.addEventListener('input', () => {
    const val = (densitySlider.value / 100).toFixed(1);
    container.querySelector('#density-val').textContent = val + '×';
  });
  densitySlider.addEventListener('change', () => {
    setParams({ densityEuclid: densitySlider.value / 100 });
    applyAndRebuild();
  });

  // L-system preset
  container.querySelector('#lsystem-select').addEventListener('change', (e) => {
    setParams({ lsystemPreset: e.target.value });
    applyAndRebuild();
  });

  // Theme
  container.querySelector('#theme-select').addEventListener('change', (e) => {
    setCurrentTheme(e.target.value);
    setParams({ theme: e.target.value });
  });

  // Ambient
  container.querySelector('#ambient-select').addEventListener('change', (e) => {
    setAmbientType(e.target.value);
    setParams({ ambient: e.target.value });
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

      setParams(preset);
      updateControlsFromParams(preset);
      setCurrentTheme(preset.theme);
      setAmbientType(preset.ambient);
      applyAndRebuild();
    });
  });

  // Share link
  container.querySelector('#share-btn').addEventListener('click', () => {
    saveParamsToHash();
    navigator.clipboard.writeText(window.location.href).then(() => {
      const btn = container.querySelector('#share-btn');
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = '🔗 Copy Share Link'; }, 2000);
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
      exportText.textContent = 'Starting offline render...';

      try {
        const result = await exportWav(durationSeconds, (pct, msg) => {
          exportBar.style.width = `${pct}%`;
          exportText.textContent = `${msg} (${pct}%)`;
        });
        exportStatus.textContent = `Saved ${result.filename}`;
        setTimeout(() => {
          exportProgress.style.display = 'none';
        }, 1200);
      } catch (err) {
        console.error('WAV export failed:', err);
        exportProgress.style.display = 'none';
        exportStatus.textContent = 'Export failed — please try a shorter duration or reload.';
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
        exportStatus.textContent = `Saved ${res.filename}`;
      } catch (err) {
        exportStatus.textContent = 'Could not export parameters JSON.';
        exportStatus.classList.add('error');
      }
    });
  }

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
        panelToggle.click();
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
    container.querySelector('#lsystem-select').value = params.lsystemPreset || 'Fern';
    container.querySelector('#theme-select').value = params.theme || 'Dusk';
    container.querySelector('#ambient-select').value = params.ambient || 'wind';
  }

  // Initialize from current params
  const params = getParams();
  updateControlsFromParams(params);

  return {
    updateControlsFromParams,
    show: () => { panelContent.style.display = 'block'; panelVisible = true; },
    hide: () => { panelContent.style.display = 'none'; panelVisible = false; }
  };
}
