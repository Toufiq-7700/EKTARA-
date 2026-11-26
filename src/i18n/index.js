/**
 * Lightweight Internationalisation (i18n) Runtime for EKTARA (একতারা)
 *
 * Supports EN and বাংলা (bn), persists language choice in localStorage,
 * updates document.documentElement.lang, and notifies subscribers so
 * every UI component switches language live without reloading.
 */

import en from './en.js';
import bn from './bn.js';

export const DICTIONARIES = { en, bn };
const STORAGE_KEY = 'ektara-lang';

let currentLang = detectInitialLang();
const listeners = new Set();

function detectInitialLang() {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved === 'en' || saved === 'bn') return saved;
  } catch (_) { /* ignore storage errors in restricted contexts */ }
  return 'en';
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  const next = lang === 'bn' ? 'bn' : 'en';
  currentLang = next;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
  } catch (_) { /* ignore */ }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = next;
  }
  for (const fn of listeners) {
    try { fn(next); } catch (_) { /* ignore */ }
  }
  return next;
}

export function initI18n() {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = currentLang;
  }
  return currentLang;
}

export function onLangChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Translate a dot-separated key (e.g. 'welcome.begin') with optional `{var}` interpolation.
 * @param {string} key
 * @param {Object} [vars]
 * @param {string} [langOverride]
 * @returns {string}
 */
export function t(key, vars = {}, langOverride) {
  const lang = langOverride || currentLang;
  const dict = DICTIONARIES[lang] || en;
  const parts = key.split('.');
  let val = dict;
  for (const p of parts) {
    if (val && typeof val === 'object' && p in val) {
      val = val[p];
    } else {
      val = undefined;
      break;
    }
  }

  // Fallback to English if missing
  if (typeof val !== 'string') {
    let fb = en;
    for (const p of parts) {
      if (fb && typeof fb === 'object' && p in fb) fb = fb[p];
      else { fb = key; break; }
    }
    val = typeof fb === 'string' ? fb : key;
  }

  return val.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}
