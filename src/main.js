/**
 * Recursive Garden — Main Entry Point
 * 
 * Bootstraps the application: handles the welcome screen,
 * initializes audio context on user gesture, and starts
 * the garden experience.
 */

const beginBtn = document.getElementById('begin-btn');
const welcomeScreen = document.getElementById('welcome-screen');
const canvas = document.getElementById('garden-canvas');
const uiOverlay = document.getElementById('ui-overlay');

beginBtn.addEventListener('click', async () => {
  // Fade out welcome screen
  welcomeScreen.classList.add('fade-out');

  // Show canvas and UI
  canvas.style.display = 'block';
  uiOverlay.style.display = 'block';

  // Resize canvas to full window
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Remove welcome screen after transition
  setTimeout(() => {
    welcomeScreen.style.display = 'none';
  }, 1000);

  // TODO: Initialize audio engine (Prompt 2)
  // TODO: Build score from algorithms (Prompt 1)
  // TODO: Start visuals (Prompt 3)
  // TODO: Initialize UI controls (Prompt 4)

  console.log('🌳 Recursive Garden started');
});

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
}
