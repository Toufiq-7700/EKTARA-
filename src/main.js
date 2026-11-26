/**
 * Recursive Garden — Main Entry Point
 * 
 * Bootstraps the application: handles the welcome screen,
 * initializes audio context on user gesture, builds the score
 * from the four recursive algorithms, and starts playback + visuals.
 */

import { buildScore } from './algorithms/score.js';
import { initAudio, playScore, pausePlayback, resumePlayback, stopPlayback, 
         setMasterVolume, setLayerVolume, setLayerMute, setSleepTimer,
         setEvolve, setAmbientType, setRainIntensity as setAudioRainIntensity,
         setThunderEnabled as setAudioThunderEnabled, getPlaybackState, getCurrentTime,
         getAudioMixSettings, setPlaybackStateListener,
         setAlgorithmEnabled, setPlaybackSpeed, previewEvent, setLayerTimbre } from './audio/engine.js';
import { DEFAULT_TIMBRES } from './audio/instruments.js';
import { DEFAULT_PARAMS, normalizeParams } from './algorithms/params.js';
import { exportScoreToWav, exportParamsToJson, triggerBlobDownload } from './audio/export.js';
import { initVisuals, startVisuals, stopVisuals, updateScore, resizeVisuals,
         setXRay, setZoom, getZoom, onVisualEvent, setTheme,
         setVisualRainIntensity, setVisualAlgorithmEnabled,
         setExternalVisualTime, setHoveredTarget, hitTestGarden } from './visuals/renderer.js';
import { buildUI } from './ui/controls.js';
import { buildAlgorithmLab } from './lab/labController.js';

// ─── Default parameters (the state) ──────────────────────────────

export const defaultParams = DEFAULT_PARAMS;

// Current mutable state
let currentParams = normalizeParams(defaultParams);
let currentScore = null;
let evolveEnabled = false;
let uiHandle = null;
let labHandle = null;
let currentViewMode = 'garden';
let rebuildDebounceTimer = null;

// ─── DOM References ──────────────────────────────────────────────

const beginBtn = document.getElementById('begin-btn');
const welcomeScreen = document.getElementById('welcome-screen');
const viewSwitcher = document.getElementById('view-switcher');
const workspaceLayout = document.getElementById('workspace-layout');
const gardenStage = document.getElementById('garden-stage');
const canvas = document.getElementById('garden-canvas');
const labPanel = document.getElementById('lab-panel');
const uiOverlay = document.getElementById('ui-overlay');
const statusBanner = document.getElementById('status-banner');
const statusMessage = document.getElementById('status-message');
const statusAction = document.getElementById('status-action');

function showStatusBanner(message, withRetry = false) {
  if (!statusBanner) return;
  statusMessage.textContent = message;
  statusAction.style.display = withRetry ? 'inline-block' : 'none';
  statusBanner.style.display = 'flex';
}

function hideStatusBanner() {
  if (statusBanner) statusBanner.style.display = 'none';
}

if (statusAction) {
  statusAction.addEventListener('click', async () => {
    try {
      await initAudio();
      hideStatusBanner();
      if (currentScore) playScore(currentScore, onScoreEvent);
    } catch (err) {
      showStatusBanner('Audio is still blocked by your browser — check site sound permissions.', true);
    }
  });
}

// ─── Begin button: start the experience ──────────────────────────

beginBtn.addEventListener('click', async () => {
  beginBtn.disabled = true;
  beginBtn.textContent = 'Preparing...';

  // Load params from URL hash if present
  loadParamsFromHash();

  // Build the score
  currentScore = buildScore(currentParams);

  // Initialize audio (requires user gesture)
  let audioReady = false;
  try {
    await initAudio({
      ambientType: currentParams.ambient,
      rainIntensity: currentParams.rainIntensity,
      thunderEnabled: currentParams.thunderEnabled,
      timbres: currentParams.timbres,
      seed: currentParams.seed
    });
    audioReady = true;
  } catch (err) {
    console.error('Audio init failed:', err);
    showStatusBanner('Audio was blocked by your browser. Visuals are running.', true);
  }

  // Fade out welcome screen
  welcomeScreen.classList.add('fade-out');
  viewSwitcher.style.display = 'flex';
  workspaceLayout.style.display = 'flex';
  uiOverlay.style.display = 'block';

  // Resize canvas
  resizeCanvas();
  window.addEventListener('resize', () => {
    if (currentViewMode === 'split' && window.innerWidth <= 900) {
      setViewMode('lab');
    }
    resizeCanvas();
    resizeVisuals();
  });

  // Remove welcome screen after transition
  setTimeout(() => {
    welcomeScreen.style.display = 'none';
  }, 1000);

  // Initialize and start visuals
  const canvasEl = document.getElementById('garden-canvas');
  initVisuals(canvasEl, currentScore, currentParams.theme, getCurrentTime);
  setVisualRainIntensity(currentParams.rainIntensity);
  startVisuals();

  // Start playback with visual event callback
  if (audioReady) {
    playScore(currentScore, onScoreEvent);
  }

  // Initialize UI controls
  uiHandle = buildUI(uiOverlay, {
    getParams, getScore, setParams,
    onDebouncedParamsChange: scheduleDebouncedParamsUpdate,
    rebuildAndPlay, saveParamsToHash,
    pausePlayback, resumePlayback, stopPlayback,
    setMasterVolume, setLayerVolume, setLayerMute,
    setSleepTimer, setEvolve: handleSetEvolve, setAmbientType,
    setRainIntensityLevel, setThunderMode, setLayerTimbre,
    setCurrentTheme, toggleXRay, setZoomLevel,
    exportWav, exportJson, importJsonParams, setPlaybackStateListener: (fn) => {
      setPlaybackStateListener((st) => {
        fn(st);
        labHandle?.syncPlayState(st.isPlaying);
      });
    }
  });

  // Initialize Algorithm Lab
  labHandle = buildAlgorithmLab(labPanel, {
    getScore,
    getParams,
    onDebouncedParamsChange: scheduleDebouncedParamsUpdate,
    rebuildAndPlay,
    getCurrentTime,
    isAudioPlaying: () => getPlaybackState().isPlaying,
    pausePlayback,
    resumePlayback,
    previewEvent,
    setPlaybackSpeed,
    setAlgorithmEnabled,
    setVisualAlgorithmEnabled,
    setExternalVisualTime,
    onHoverTarget: handleLinkedHover
  });

  // View Switcher (Garden / Split / Lab) — default to Split view on wide screens
  viewSwitcher.querySelectorAll('.view-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      setViewMode(btn.dataset.view);
    });
  });
  setViewMode(window.innerWidth > 900 ? 'split' : 'garden');

  // Linked highlighting from Garden hover -> Lab
  canvasEl.addEventListener('mousemove', (e) => {
    const hit = hitTestGarden(e.clientX, e.clientY);
    handleLinkedHover(hit);
  });
  canvasEl.addEventListener('mouseleave', () => handleLinkedHover(null));

  // Scroll wheel zooms into the recursive tree
  canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const nextZoom = Math.max(0.5, Math.min(4, getZoom() - e.deltaY * 0.001));
    setZoom(nextZoom);
    uiHandle?.updateZoomDisplay(nextZoom);
  }, { passive: false });
});

function handleLinkedHover(target) {
  setHoveredTarget(target);
  labHandle?.setHoveredTarget(target);
}

function setViewMode(mode) {
  currentViewMode = mode;
  workspaceLayout.classList.remove('view-garden', 'view-split', 'view-lab');
  workspaceLayout.classList.add(`view-${mode}`);

  viewSwitcher.querySelectorAll('.view-tab').forEach(btn => {
    const active = btn.dataset.view === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  if (mode === 'garden') {
    gardenStage.style.display = 'block';
    labPanel.style.display = 'none';
    labHandle?.setVisible(false);
    startVisuals();
  } else if (mode === 'split') {
    uiHandle?.hide();
    gardenStage.style.display = 'block';
    labPanel.style.display = 'flex';
    labHandle?.setVisible(true);
    startVisuals();
  } else {
    uiHandle?.hide();
    gardenStage.style.display = 'none';
    labPanel.style.display = 'flex';
    stopVisuals();
    labHandle?.setVisible(true);
  }

  if (mode !== 'lab') {
    requestAnimationFrame(() => {
      resizeCanvas();
      resizeVisuals();
    });
  }
}

// ─── Event callback: bridges audio events to visuals ─────────────

function onScoreEvent(event, time) {
  // Bridge audio events to visuals
  onVisualEvent(event);
  
  if (event.voice === '_loop') {
    // Evolve: rebuild with new params and sync UI + visuals
    currentParams = { ...currentParams, ...event.meta.newParams };
    currentScore = buildScore(currentParams);
    updateScore(currentScore, currentParams.theme);
    uiHandle?.updateControlsFromParams(currentParams);
    saveParamsToHash();
    playScore(currentScore, onScoreEvent, { skipFadeIn: true });
    return;
  }
}

// ─── Canvas sizing ───────────────────────────────────────────────

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = gardenStage?.clientWidth || window.innerWidth;
  const h = gardenStage?.clientHeight || window.innerHeight;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─── URL hash parameter encoding ─────────────────────────────────

function loadParamsFromHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  try {
    const decoded = JSON.parse(decodeURIComponent(hash));
    currentParams = normalizeParams(decoded);
  } catch (e) {
    console.warn('Invalid URL hash params');
  }
}

export function saveParamsToHash() {
  const hash = encodeURIComponent(JSON.stringify(currentParams));
  window.location.hash = hash;
}

// ─── Public API for UI ───────────────────────────────────────────

export function getParams() {
  return normalizeParams(currentParams);
}

export function setParams(newParams) {
  currentParams = normalizeParams({ ...currentParams, ...newParams });
}

export function getScore() {
  return currentScore;
}

export function rebuildAndPlay(options = {}) {
  currentScore = buildScore(currentParams);
  updateScore(currentScore, currentParams.theme);
  labHandle?.onScoreUpdated();
  uiHandle?.syncAllFromParams(currentParams, currentScore);
  playScore(currentScore, onScoreEvent, options);
  return currentScore;
}

/**
 * Debounced (150ms) live update across score, Garden, Lab, URL hash, and audio
 * with smooth audio crossfade and visual transition.
 */
export function scheduleDebouncedParamsUpdate(nextParams) {
  currentParams = normalizeParams(nextParams);
  if (rebuildDebounceTimer) clearTimeout(rebuildDebounceTimer);
  rebuildDebounceTimer = setTimeout(() => {
    rebuildDebounceTimer = null;
    rebuildAndPlay({ smoothCrossfade: true });
    saveParamsToHash();
  }, 150);
}

export function importJsonParams(rawObj) {
  const loaded = normalizeParams(rawObj);
  currentParams = loaded;
  setTheme(loaded.theme);
  setAmbientType(loaded.ambient);
  setRainIntensityLevel(loaded.rainIntensity ?? 0);
  setThunderMode(loaded.thunderEnabled ?? true);
  if (loaded.timbres) {
    for (const [layer, timbre] of Object.entries(loaded.timbres)) {
      setLayerTimbre(layer, timbre);
    }
  }
  rebuildAndPlay({ smoothCrossfade: true });
  saveParamsToHash();
  labHandle?.syncAllFromParams(currentParams, currentScore);
  return currentParams;
}

export function setCurrentTheme(themeName) {
  currentParams.theme = themeName;
  setTheme(themeName);
}

export function toggleXRay(enabled) {
  setXRay(enabled);
}

export function setZoomLevel(level) {
  setZoom(level);
}

export function setRainIntensityLevel(intensity) {
  const clamped = Math.max(0, Math.min(1, Number(intensity) || 0));
  currentParams.rainIntensity = clamped;
  setVisualRainIntensity(clamped);
  setAudioRainIntensity(clamped);
}

export function setThunderMode(enabled) {
  currentParams.thunderEnabled = !!enabled;
  setAudioThunderEnabled(currentParams.thunderEnabled);
}

export function handleSetEvolve(enabled) {
  evolveEnabled = !!enabled;
  setEvolve(evolveEnabled);
}

export async function exportWav(durationSeconds, onProgress) {
  const mixSettings = getAudioMixSettings();
  const result = await exportScoreToWav(currentParams, {
    durationSeconds,
    mixSettings,
    evolve: evolveEnabled,
    onProgress
  });
  triggerBlobDownload(result.blob, result.filename);
  return result;
}

export function exportJson() {
  const result = exportParamsToJson(currentParams);
  triggerBlobDownload(result.blob, result.filename);
  return result;
}

export { 
  pausePlayback, resumePlayback, stopPlayback, 
  setMasterVolume, setLayerVolume, setLayerMute, 
  setSleepTimer, setEvolve, setAmbientType, getPlaybackState,
  startVisuals, stopVisuals
};
