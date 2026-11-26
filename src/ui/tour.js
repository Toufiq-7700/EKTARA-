/**
 * First-Visit Tooltip Tour
 *
 * Shows a lightweight, dismissible 3-step tour after entering Split/Garden view:
 *   1. Algorithm Cards
 *   2. Parameter Drawer (☰ Controls)
 *   3. Depth Dial
 * Persists completion in localStorage ('ektara-tour-done').
 */

import { t } from '../i18n/index.js';

const TOUR_STORAGE_KEY = 'ektara-tour-done';

export function maybeStartFirstVisitTour({ uiHandle }) {
  try {
    if (localStorage.getItem(TOUR_STORAGE_KEY) === '1') return;
  } catch (_) { /* ignore */ }

  const steps = [
    {
      getTarget: () => document.querySelector('.lab-cards') || document.querySelector('#view-switcher'),
      titleKey: 'tour.step1Title',
      bodyKey: 'tour.step1Body',
      onEnter: () => {}
    },
    {
      getTarget: () => document.querySelector('#panel-toggle') || document.querySelector('#control-panel'),
      titleKey: 'tour.step2Title',
      bodyKey: 'tour.step2Body',
      onEnter: () => {}
    },
    {
      getTarget: () => document.querySelector('#depth-dial') || document.querySelector('#panel-toggle'),
      titleKey: 'tour.step3Title',
      bodyKey: 'tour.step3Body',
      onEnter: () => uiHandle?.show?.()
    },
    {
      getTarget: () => document.querySelector('#garden-ektara-string'),
      titleKey: 'tour.step4Title',
      bodyKey: 'tour.step4Body',
      onEnter: () => uiHandle?.hide?.()
    }
  ];

  let stepIdx = 0;

  const box = document.createElement('div');
  box.id = 'ektara-tour-tooltip';
  box.className = 'tour-tooltip';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-live', 'polite');
  document.body.appendChild(box);

  function finishTour() {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, '1');
    } catch (_) { /* ignore */ }
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    uiHandle?.hide?.();
    box.remove();
    document.removeEventListener('keydown', onKey);
  }

  function renderStep() {
    const step = steps[stepIdx];
    step.onEnter();
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));

    const target = step.getTarget();
    if (target) target.classList.add('tour-highlight');

    const isLast = stepIdx === steps.length - 1;
    box.innerHTML = `
      <div class="tour-step-badge">${stepIdx + 1} / ${steps.length}</div>
      <h3 class="tour-title">${t(step.titleKey)}</h3>
      <p class="tour-body">${t(step.bodyKey)}</p>
      <div class="tour-actions">
        <button type="button" class="tour-skip-btn">${t('tour.skip')}</button>
        <button type="button" class="tour-next-btn">${isLast ? t('tour.done') : t('tour.next')}</button>
      </div>
    `;

    positionTooltip(target);

    box.querySelector('.tour-skip-btn').addEventListener('click', finishTour);
    box.querySelector('.tour-next-btn').addEventListener('click', () => {
      if (isLast) finishTour();
      else {
        stepIdx++;
        renderStep();
      }
    });
  }

  function positionTooltip(target) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!target) {
      box.style.top = '80px';
      box.style.left = '50%';
      box.style.transform = 'translateX(-50%)';
      return;
    }
    const r = target.getBoundingClientRect();
    box.style.transform = 'none';
    const boxW = Math.min(310, vw - 24);
    const left = Math.max(12, Math.min(vw - boxW - 12, r.left + r.width / 2 - boxW / 2));
    const preferBelow = r.bottom + 170 < vh;
    const top = preferBelow ? r.bottom + 12 : Math.max(12, r.top - 165);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  }

  function onKey(e) {
    if (e.key === 'Escape') finishTour();
  }
  document.addEventListener('keydown', onKey);

  // Small delay so Split View & Lab settle cleanly
  setTimeout(renderStep, 350);
}
