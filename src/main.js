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
         setEvolve, setAmbientType, getPlaybackState } from './audio/engine.js';

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
let visualsRunning = false;

// ─── DOM References ──────────────────────────────────────────────

const beginBtn = document.getElementById('begin-btn');
const welcomeScreen = document.getElementById('welcome-screen');
const canvas = document.getElementById('garden-canvas');
const uiOverlay = document.getElementById('ui-overlay');

// ─── Begin button: start the experience ──────────────────────────

beginBtn.addEventListener('click', async () => {
  // Fade out welcome screen
  welcomeScreen.classList.add('fade-out');
  canvas.style.display = 'block';
  uiOverlay.style.display = 'block';

  // Resize canvas
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Remove welcome screen after transition
  setTimeout(() => {
    welcomeScreen.style.display = 'none';
  }, 1000);

  // Load params from URL hash if present
  loadParamsFromHash();

  // Build the score
  currentScore = buildScore(currentParams);
  console.log(`🎵 Score built: ${currentScore.events.length} events, ${currentScore.duration.toFixed(1)}s`);

  // Initialize audio (requires user gesture)
  try {
    await initAudio();
  } catch (err) {
    console.error('Audio init failed:', err);
    // Show a message but continue with visuals
  }

  // Start playback with visual event callback
  playScore(currentScore, onScoreEvent);

  // TODO: Start visuals (Prompt 3)
  // TODO: Initialize UI controls (Prompt 4)

  console.log('🌳 Recursive Garden started');
});

// ─── Event callback: bridges audio events to visuals ─────────────

function onScoreEvent(event, time) {
  // Will be used by the visual renderer to sync animations
  // e.g., flash a branch when a melody note plays
  if (event.voice === '_loop') {
    // Evolve: rebuild with new params
    currentParams = { ...currentParams, ...event.meta.newParams };
    currentScore = buildScore(currentParams);
    playScore(currentScore, onScoreEvent);
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
  ctx.scale(dpr, dpr);
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
  playScore(currentScore, onScoreEvent);
  return currentScore;
}

export { 
  pausePlayback, resumePlayback, stopPlayback, 
  setMasterVolume, setLayerVolume, setLayerMute, 
  setSleepTimer, setEvolve, setAmbientType, getPlaybackState 
};
