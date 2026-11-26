/**
 * Unit tests verifying i18n dictionary parity between EN (en.js) and বাংলা (bn.js),
 * interpolation, and language switching.
 */

import { describe, it, expect } from 'vitest';
import en from '../src/i18n/en.js';
import bn from '../src/i18n/bn.js';
import { t, setLang, getLang } from '../src/i18n/index.js';

function collectKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys.sort();
}

describe('i18n Dictionaries (EN & বাংলা)', () => {
  it('en.js and bn.js have the exact same translation keys', () => {
    const enKeys = collectKeys(en);
    const bnKeys = collectKeys(bn);
    expect(bnKeys).toEqual(enKeys);
  });

  it('every translation value in en.js and bn.js is a non-empty string', () => {
    for (const key of collectKeys(en)) {
      expect(t(key, {}, 'en').trim().length).toBeGreaterThan(0);
      expect(t(key, {}, 'bn').trim().length).toBeGreaterThan(0);
    }
  });

  it('interpolates variables and switches active language cleanly', () => {
    const prev = getLang();
    setLang('bn');
    expect(getLang()).toBe('bn');
    expect(t('controls.exportSaved', { filename: 'ektara-42-4.wav' })).toContain('ektara-42-4.wav');
    setLang(prev);
  });
});
