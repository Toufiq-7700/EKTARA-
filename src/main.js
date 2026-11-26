/**
 * EKTARA (একতারা) — Main Entry Point
 * "One string, one rule, infinite music."
 *
 * Landing screen boots immediately with zero Tone.js weight; audio, visual
 * orchestrator, Algorithm Lab, and Control Drawer are lazy-loaded when Begin
 * is clicked.
 */

import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/600.css';
import '@fontsource/hind-siliguri/400.css';
import '@fontsource/hind-siliguri/600.css';

import { initI18n, setLang, getLang, t, onLangChange } from './i18n/index.js';
import { DEFAULT_PARAMS, normalizeParams } from './algorithms/params.js';
import { initLandingExperience } from './ui/landing.js';

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

// Lazy-loaded module handles (populated on Begin)
let audioMod = null;
let exportMod = null;
let visualsMod = null;
let scoreMod = null;

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

const welcomeTagline = document.getElementById('welcome-tagline');
const welcomeHint = document.getElementById('welcome-hint');
const welcomeSoundHint = document.getElementById('welcome-sound-hint');
const howLink = document.getElementById('how-it-works-link');
const howTitle = document.getElementById('how-it-works-title');
const howOneLiner = document.getElementById('how-it-works-oneliner');
const footerBuiltFor = document.getElementById('footer-built-for');
const aboutBtn = document.getElementById('about-name-btn');
const aboutDialog = document.getElementById('about-name-dialog');
const aboutClose = document.getElementById('about-dialog-close');

initI18n();

function applyStaticI18n() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.title = `${t('app.name')} · ${t('app.nativeName')}`;

  if (welcomeTagline) welcomeTagline.textContent = t('app.tagline');
  if (beginBtn && !beginBtn.disabled) beginBtn.textContent = t('welcome.begin');
  if (welcomeHint) welcomeHint.textContent = t('welcome.headphones');
  if (welcomeSoundHint) welcomeSoundHint.textContent = t('welcome.soundHint');
  if (howLink) howLink.textContent = t('welcome.howItWorksLink');
  if (howTitle) howTitle.textContent = t('welcome.howItWorksTitle');
  if (howOneLiner) howOneLiner.textContent = t('welcome.howItWorksOneLiner');

  const cardMap = [
    ['card-norgard-title', 'welcome.cardNorgardTitle'],
    ['card-norgard-desc', 'welcome.cardNorgardDesc'],
    ['card-hanoi-title', 'welcome.cardHanoiTitle'],
    ['card-hanoi-desc', 'welcome.cardHanoiDesc'],
    ['card-euclid-title', 'welcome.cardEuclidTitle'],
    ['card-euclid-desc', 'welcome.cardEuclidDesc'],
    ['card-lsystem-title', 'welcome.cardLsystemTitle'],
    ['card-lsystem-desc', 'welcome.cardLsystemDesc']
  ];
  for (const [id, key] of cardMap) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }

  if (footerBuiltFor) footerBuiltFor.textContent = t('welcome.footerBuiltFor');
  if (aboutBtn) aboutBtn.textContent = t('welcome.aboutNameBtn');
  const aboutTitle = document.getElementById('about-dialog-title');
  const aboutEn = document.getElementById('about-dialog-en');
  const aboutBn = document.getElementById('about-dialog-bn');
  if (aboutTitle) aboutTitle.textContent = t('welcome.aboutNameTitle');
  if (aboutEn) aboutEn.textContent = t('welcome.aboutNameBodyEn');
  if (aboutBn) aboutBn.textContent = t('welcome.aboutNameBodyBn');
  if (aboutClose) aboutClose.textContent = t('welcome.closeBtn');

  if (statusAction) statusAction.textContent = t('status.retryAudio');

  document.querySelectorAll('.view-tab').forEach(btn => {
    const view = btn.dataset.view;
    if (view && t(`views.${view}`)) btn.textContent = t(`views.${view}`);
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    const isActive = btn.dataset.lang === lang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => setLang(btn.dataset.lang));
});

onLangChange(() => {
  applyStaticI18n();
  uiHandle?.applyLanguage?.();
  labHandle?.applyLanguage?.();
});

applyStaticI18n();

// Boot fast landing backdrop & mini-animations (zero audio/Tone.js loaded yet)
let landing = { pluckString: () => {}, destroy: () => {} };
try {
  landing = initLandingExperience();
} catch (err) {
  console.warn('Landing canvas init skipped:', err);
}

// Keyboard focus starts on Begin button first
requestAnimationFrame(() => beginBtn?.focus({ preventScroll: true }));

// Smooth scroll for "How it works"
howLink?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
});

// "About the name" popover
aboutBtn?.addEventListener('click', () => {
  if (aboutDialog?.showModal) aboutDialog.showModal();
  else if (aboutDialog) aboutDialog.setAttribute('open', '');
});
aboutClose?.addEventListener('click', () => {
  if (aboutDialog?.close) aboutDialog.close();
  else if (aboutDialog) aboutDialog.removeAttribute('open');
});
aboutDialog?.addEventListener('click', (e) => {
  if (e.target === aboutDialog) {
    if (aboutDialog.close) aboutDialog.close();
    else aboutDialog.removeAttribute('open');
  }
});

// ─── Status Banner ───────────────────────────────────────────────

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
      if (!audioMod) audioMod = await import('./audio/engine.js');
      await audioMod.initAudio();
      hideStatusBanner();
      if (currentScore) audioMod.playScore(currentScore, onScoreEvent);
    } catch (err) {
      showStatusBanner(t('status.audioRetryFailed'), true);
    }
  });
}

// ─── Begin button: lazy-load Tone.js + workspace & transition ────

beginBtn.addEventListener('click', async () => {
  beginBtn.disabled = true;
  beginBtn.textContent = t('welcome.preparing');
  try {
    landing.pluckString();
  } catch (_) { /* ignore */ }

  try {
    // Load params from URL hash if present
    loadParamsFromHash();

    // Lazy-load score, audio (Tone.js), export, visuals, UI, Lab, scales, and tour
    const [scoreM, audioM, exportM, visualsM, controlsM, labM, tourM, scalesM] = await Promise.all([
      import('./algorithms/score.js'),
      import('./audio/engine.js'),
      import('./audio/export.js'),
      import('./visuals/renderer.js'),
      import('./ui/controls.js'),
      import('./lab/labController.js'),
      import('./ui/tour.js'),
      import('./algorithms/scales.js')
    ]);

    scoreMod = scoreM;
    audioMod = audioM;
    exportMod = exportM;
    visualsMod = visualsM;

    // Build the score
    currentScore = scoreMod.buildScore(currentParams);

    // Initialize audio (requires user gesture)
    let audioReady = false;
    try {
      await audioMod.initAudio({
        ambientType: currentParams.ambient,
        rainIntensity: currentParams.rainIntensity,
        thunderEnabled: currentParams.thunderEnabled,
        timbres: currentParams.timbres,
        seed: currentParams.seed
      });
      audioReady = true;
    } catch (err) {
      console.error('Audio init failed:', err);
      showStatusBanner(t('status.audioBlocked'), true);
    }

    // Reveal workspace underneath while landing fades & slides away over 1.2s
    viewSwitcher.style.display = 'flex';
    workspaceLayout.style.display = 'flex';
    uiOverlay.style.display = 'block';
    welcomeScreen.classList.add('fade-out');

    resizeCanvas();
    window.addEventListener('resize', () => {
      if (currentViewMode === 'split' && window.innerWidth <= 900) {
        setViewMode('lab');
      }
      resizeCanvas();
      visualsMod?.resizeVisuals();
    });

    setTimeout(() => {
      welcomeScreen.style.display = 'none';
      landing.destroy();
    }, 1250);

    // Initialize and start visuals
    const canvasEl = document.getElementById('garden-canvas');
    visualsMod.initVisuals(canvasEl, currentScore, currentParams.theme, audioMod.getCurrentTime);
    visualsMod.setAudioLevelGetter(audioMod.getAudioLevel);
    visualsMod.setVisualRainIntensity(currentParams.rainIntensity);
    visualsMod.startVisuals();

    // Interactive playable virtual Ektara string in the Garden
    const stringEl = document.getElementById('garden-ektara-string');
    if (stringEl) {
      let kbDegree = 0;
      let isDragging = false;
      let lastDragPos = -1;

      const triggerAtNormalized = (u) => {
        const clamped = Math.max(0, Math.min(1, u));
        const scaleName = currentParams.scale || 'pentatonic';
        const scale = scalesM.SCALES[scaleName] || scalesM.SCALES.pentatonic;
        const rootDroneMidi = Math.max(36, (currentParams.rootNote ?? 60) - 12);
        const degree = Math.round(clamped * scale.length);
        kbDegree = degree;
        const midi = scalesM.degreeToMidi(degree, scaleName, rootDroneMidi);
        const freq = scalesM.midiToFreq(midi);
        const noteName = scalesM.midiToName(midi);

        stringEl.setAttribute('aria-valuemax', String(scale.length));
        stringEl.setAttribute('aria-valuenow', String(degree));
        stringEl.setAttribute('aria-valuetext', noteName);

        visualsMod.pluckGardenString(clamped, noteName);
        audioMod.pluckEktaraString(freq, 26);
      };

      const posFromPointer = (clientX, clientY) => {
        const rect = stringEl.getBoundingClientRect();
        if (window.innerWidth <= 640) {
          return (clientX - rect.left) / Math.max(1, rect.width);
        }
        return 1 - (clientY - rect.top) / Math.max(1, rect.height);
      };

      stringEl.addEventListener('pointerdown', (e) => {
        isDragging = true;
        stringEl.setPointerCapture?.(e.pointerId);
        const u = posFromPointer(e.clientX, e.clientY);
        lastDragPos = u;
        triggerAtNormalized(u);
      });
      stringEl.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const u = posFromPointer(e.clientX, e.clientY);
        if (Math.abs(u - lastDragPos) >= 0.14) {
          lastDragPos = u;
          triggerAtNormalized(u);
        }
      });
      const endDrag = () => { isDragging = false; };
      stringEl.addEventListener('pointerup', endDrag);
      stringEl.addEventListener('pointercancel', endDrag);

      stringEl.addEventListener('keydown', (e) => {
        const scaleName = currentParams.scale || 'pentatonic';
        const scale = scalesM.SCALES[scaleName] || scalesM.SCALES.pentatonic;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerAtNormalized(kbDegree / Math.max(1, scale.length));
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          kbDegree = Math.min(scale.length, kbDegree + 1);
          triggerAtNormalized(kbDegree / Math.max(1, scale.length));
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          kbDegree = Math.max(0, kbDegree - 1);
          triggerAtNormalized(kbDegree / Math.max(1, scale.length));
        }
      });
    }

    // Start playback softly
    if (audioReady) {
      audioMod.playScore(currentScore, onScoreEvent);
    }

    // Initialize UI controls
    uiHandle = controlsM.buildUI(uiOverlay, {
      getParams, getScore, setParams,
      onDebouncedParamsChange: scheduleDebouncedParamsUpdate,
      rebuildAndPlay, saveParamsToHash,
      pausePlayback: audioMod.pausePlayback,
      resumePlayback: audioMod.resumePlayback,
      stopPlayback: audioMod.stopPlayback,
      setMasterVolume: audioMod.setMasterVolume,
      setLayerVolume: audioMod.setLayerVolume,
      setLayerMute: audioMod.setLayerMute,
      setSleepTimer: audioMod.setSleepTimer,
      setEvolve: handleSetEvolve,
      setAmbientType: audioMod.setAmbientType,
      setRainIntensityLevel,
      setThunderMode,
      setLayerTimbre: audioMod.setLayerTimbre,
      setCurrentTheme,
      toggleXRay,
      setZoomLevel,
      exportWav,
      exportJson,
      importJsonParams,
      setPlaybackStateListener: (fn) => {
        audioMod.setPlaybackStateListener((st) => {
          fn(st);
          labHandle?.syncPlayState(st.isPlaying);
        });
      }
    });

    // Initialize Algorithm Lab
    labHandle = labM.buildAlgorithmLab(labPanel, {
      getScore,
      getParams,
      onDebouncedParamsChange: scheduleDebouncedParamsUpdate,
      rebuildAndPlay,
      getCurrentTime: audioMod.getCurrentTime,
      isAudioPlaying: () => audioMod.getPlaybackState().isPlaying,
      pausePlayback: audioMod.pausePlayback,
      resumePlayback: audioMod.resumePlayback,
      previewEvent: audioMod.previewEvent,
      setPlaybackSpeed: audioMod.setPlaybackSpeed,
      setAlgorithmEnabled: audioMod.setAlgorithmEnabled,
      setVisualAlgorithmEnabled: visualsMod.setVisualAlgorithmEnabled,
      setExternalVisualTime: visualsMod.setExternalVisualTime,
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
      const hit = visualsMod.hitTestGarden(e.clientX, e.clientY);
      handleLinkedHover(hit);
    });
    canvasEl.addEventListener('mouseleave', () => handleLinkedHover(null));

    // Scroll wheel zooms into the recursive tree
    canvasEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const nextZoom = Math.max(0.5, Math.min(4, visualsMod.getZoom() - e.deltaY * 0.001));
      visualsMod.setZoom(nextZoom);
      uiHandle?.updateZoomDisplay(nextZoom);
    }, { passive: false });

    // First-visit tooltip tour once transition settles
    setTimeout(() => {
      tourM.maybeStartFirstVisitTour({ uiHandle });
    }, 1300);
  } catch (err) {
    console.error('Failed to enter EKTARA:', err);
    beginBtn.disabled = false;
    beginBtn.textContent = t('welcome.begin');
    showStatusBanner('Could not open workspace — please try again.', false);
  }
});

function handleLinkedHover(target) {
  visualsMod?.setHoveredTarget(target);
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
    visualsMod?.startVisuals();
  } else if (mode === 'split') {
    uiHandle?.hide();
    gardenStage.style.display = 'block';
    labPanel.style.display = 'flex';
    labHandle?.setVisible(true);
    visualsMod?.startVisuals();
  } else {
    uiHandle?.hide();
    gardenStage.style.display = 'none';
    labPanel.style.display = 'flex';
    visualsMod?.stopVisuals();
    labHandle?.setVisible(true);
  }

  if (mode !== 'lab') {
    requestAnimationFrame(() => {
      resizeCanvas();
      visualsMod?.resizeVisuals();
    });
  }
}

// ─── Event callback: bridges audio events to visuals ─────────────

function onScoreEvent(event) {
  visualsMod?.onVisualEvent(event);

  if (event.voice === '_loop' && scoreMod && audioMod) {
    currentParams = { ...currentParams, ...event.meta.newParams };
    currentScore = scoreMod.buildScore(currentParams);
    visualsMod?.updateScore(currentScore, currentParams.theme);
    uiHandle?.updateControlsFromParams(currentParams);
    saveParamsToHash();
    audioMod.playScore(currentScore, onScoreEvent, { skipFadeIn: true });
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
  if (!scoreMod) return null;
  currentScore = scoreMod.buildScore(currentParams);
  visualsMod?.updateScore(currentScore, currentParams.theme);
  labHandle?.onScoreUpdated();
  uiHandle?.syncAllFromParams(currentParams, currentScore);
  audioMod?.playScore(currentScore, onScoreEvent, options);
  return currentScore;
}

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
  visualsMod?.setTheme(loaded.theme);
  audioMod?.setAmbientType(loaded.ambient);
  setRainIntensityLevel(loaded.rainIntensity ?? 0);
  setThunderMode(loaded.thunderEnabled ?? true);
  if (loaded.timbres && audioMod) {
    for (const [layer, timbre] of Object.entries(loaded.timbres)) {
      audioMod.setLayerTimbre(layer, timbre);
    }
  }
  rebuildAndPlay({ smoothCrossfade: true });
  saveParamsToHash();
  labHandle?.syncAllFromParams(currentParams, currentScore);
  return currentParams;
}

export function setCurrentTheme(themeName) {
  currentParams.theme = themeName;
  visualsMod?.setTheme(themeName);
}

export function toggleXRay(enabled) {
  visualsMod?.setXRay(enabled);
}

export function setZoomLevel(level) {
  visualsMod?.setZoom(level);
}

export function setRainIntensityLevel(intensity) {
  const clamped = Math.max(0, Math.min(1, Number(intensity) || 0));
  currentParams.rainIntensity = clamped;
  visualsMod?.setVisualRainIntensity(clamped);
  audioMod?.setRainIntensity(clamped);
}

export function setThunderMode(enabled) {
  currentParams.thunderEnabled = !!enabled;
  audioMod?.setThunderEnabled(currentParams.thunderEnabled);
}

export function handleSetEvolve(enabled) {
  evolveEnabled = !!enabled;
  audioMod?.setEvolve(evolveEnabled);
}

export async function exportWav(durationSeconds, onProgress) {
  if (!exportMod) exportMod = await import('./audio/export.js');
  if (!audioMod) audioMod = await import('./audio/engine.js');
  const mixSettings = audioMod.getAudioMixSettings();
  const result = await exportMod.exportScoreToWav(currentParams, {
    durationSeconds,
    mixSettings,
    evolve: evolveEnabled,
    onProgress
  });
  exportMod.triggerBlobDownload(result.blob, result.filename);
  return result;
}

export function exportJson() {
  if (!exportMod) return null;
  const result = exportMod.exportParamsToJson(currentParams);
  exportMod.triggerBlobDownload(result.blob, result.filename);
  return result;
}
