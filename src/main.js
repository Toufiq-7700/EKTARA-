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
         setEvolve, setAmbientType, getPlaybackState, getCurrentTime,
         getAudioMixSettings, setPlaybackStateListener } from './audio/engine.js';
import { exportScoreToWav, exportParamsToJson, triggerBlobDownload } from './audio/export.js';
import { initVisuals, startVisuals, stopVisuals, updateScore, resizeVisuals,
         setXRay, setZoom, getZoom, onVisualEvent, setTheme } from './visuals/renderer.js';
import { buildUI } from './ui/controls.js';

// ─── Default parameters (the state) ──────────────────────────────

export const defaultParams = {
  seed: 42,
  depth: 4,
  scale: 'pentatonic',
  rootNote: 60,
  tempo: 60,
  branchAngle: 25,
  densityEuclid: 1.0,
  lsystemPreset: 'Fern',
  theme: 'Dusk',
  ambient: 'wind'
};

// Current mutable state
let currentParams = { ...defaultParams };
let currentScore = null;
let evolveEnabled = false;
let uiHandle = null;

// ─── DOM References ──────────────────────────────────────────────

const beginBtn = document.getElementById('begin-btn');
const welcomeScreen = document.getElementById('welcome-screen');
const canvas = document.getElementById('garden-canvas');
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
    await initAudio();
    audioReady = true;
  } catch (err) {
    console.error('Audio init failed:', err);
    showStatusBanner('Audio was blocked by your browser. Visuals are running.', true);
  }

  // Fade out welcome screen
  welcomeScreen.classList.add('fade-out');
  canvas.style.display = 'block';
  uiOverlay.style.display = 'block';

  // Resize canvas
  resizeCanvas();
  window.addEventListener('resize', () => {
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
  startVisuals();

  // Start playback with visual event callback
  if (audioReady) {
    playScore(currentScore, onScoreEvent);
  }

  // Initialize UI controls
  uiHandle = buildUI(uiOverlay, {
    getParams, setParams, rebuildAndPlay, saveParamsToHash,
    pausePlayback, resumePlayback, stopPlayback,
    setMasterVolume, setLayerVolume, setLayerMute,
    setSleepTimer, setEvolve: handleSetEvolve, setAmbientType,
    setCurrentTheme, toggleXRay, setZoomLevel,
    exportWav, exportJson, setPlaybackStateListener
  });

  // Scroll wheel zooms into the recursive tree
  canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const nextZoom = Math.max(0.5, Math.min(4, getZoom() - e.deltaY * 0.001));
    setZoom(nextZoom);
    uiHandle?.updateZoomDisplay(nextZoom);
  }, { passive: false });
});

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
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─── URL hash parameter encoding ─────────────────────────────────

function loadParamsFromHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  try {
    const decoded = JSON.parse(decodeURIComponent(hash));
    currentParams = { ...defaultParams, ...decoded };
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
  return { ...currentParams };
}

export function setParams(newParams) {
  currentParams = { ...currentParams, ...newParams };
}

export function getScore() {
  return currentScore;
}

export function rebuildAndPlay() {
  currentScore = buildScore(currentParams);
  updateScore(currentScore, currentParams.theme);
  playScore(currentScore, onScoreEvent);
  return currentScore;
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
