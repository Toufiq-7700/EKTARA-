/**
 * Unit tests for WAV export encoding, filenames, and JSON parameter export.
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import { encodeWav, buildExportFilename, exportParamsToJson } from '../src/audio/export.js';

function createMockAudioBuffer(sampleRate, numChannels, frames, fillFn) {
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) {
    const data = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      data[i] = fillFn(ch, i);
    }
    channels.push(data);
  }
  return {
    sampleRate,
    length: frames,
    numberOfChannels: numChannels,
    getChannelData: (ch) => channels[ch]
  };
}

describe('WAV Encoder', () => {
  it('writes a valid 44-byte RIFF/WAVE 16-bit stereo PCM header', () => {
    const sampleRate = 44100;
    const frames = 100;
    const buf = createMockAudioBuffer(sampleRate, 2, frames, (ch, i) =>
      Math.sin((2 * Math.PI * 440 * i) / sampleRate) * (ch === 0 ? 0.5 : -0.5)
    );

    const wav = encodeWav(buf);
    expect(wav.byteLength).toBe(44 + frames * 4);

    const view = new DataView(wav);
    const ascii = (start, len) =>
      String.fromCharCode(...new Uint8Array(wav, start, len));

    expect(ascii(0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + frames * 4);
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(12, 4)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16); // PCM chunk size
    expect(view.getUint16(20, true)).toBe(1);  // PCM format
    expect(view.getUint16(22, true)).toBe(2);  // Stereo
    expect(view.getUint32(24, true)).toBe(sampleRate);
    expect(view.getUint32(28, true)).toBe(sampleRate * 4); // Byte rate
    expect(view.getUint16(32, true)).toBe(4);  // Block align
    expect(view.getUint16(34, true)).toBe(16); // 16-bit
    expect(ascii(36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(frames * 4);
  });

  it('clamps out-of-range samples safely and converts mono to stereo', () => {
    const buf = createMockAudioBuffer(48000, 1, 4, (_ch, i) => [-2, -1, 1, 2][i]);
    const wav = encodeWav(buf);
    const view = new DataView(wav);

    // Frame 0 (-2 clamped to -1 -> -32768)
    expect(view.getInt16(44, true)).toBe(-32768);
    expect(view.getInt16(46, true)).toBe(-32768);
    // Frame 2 (+1 -> 32767)
    expect(view.getInt16(52, true)).toBe(32767);
    expect(view.getInt16(54, true)).toBe(32767);
    // Frame 3 (+2 clamped to +1 -> 32767)
    expect(view.getInt16(56, true)).toBe(32767);
    expect(view.getInt16(58, true)).toBe(32767);
  });

  it('produces identical bytes for identical audio buffers', () => {
    const a = createMockAudioBuffer(44100, 2, 256, (ch, i) => Math.sin(i * 0.1 + ch) * 0.3);
    const b = createMockAudioBuffer(44100, 2, 256, (ch, i) => Math.sin(i * 0.1 + ch) * 0.3);
    const bytesA = new Uint8Array(encodeWav(a));
    const bytesB = new Uint8Array(encodeWav(b));
    expect(bytesA).toEqual(bytesB);
  });
});

describe('Export Filenames & JSON', () => {
  it('formats filenames as ektara-<seed>-<depth>.<ext>', () => {
    expect(buildExportFilename({ seed: 137, depth: 5 }, 'wav')).toBe('ektara-137-5.wav');
    expect(buildExportFilename({ seed: 42, depth: 4 }, 'json')).toBe('ektara-42-4.json');
  });

  it('exports parameters as a valid JSON blob', async () => {
    const params = { seed: 42, depth: 4, scale: 'pentatonic', tempo: 60 };
    const { blob, filename } = exportParamsToJson(params);
    expect(filename).toBe('ektara-42-4.json');
    expect(blob.type).toBe('application/json');
    const parsed = JSON.parse(await blob.text());
    expect(parsed.app).toBe('EKTARA');
    expect(parsed.params).toEqual(params);
  });
});
