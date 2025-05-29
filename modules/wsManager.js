// modules/wsManager.js

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';
import Spectrogram from 'https://unpkg.com/wavesurfer.js@7.9.5/dist/plugins/spectrogram.esm.js';

let ws = null;
let plugin = null;
let currentColorMap = null;
let lastUsedNoverlap = null; // ✅ 追蹤實際使用的 noverlap

export function initWavesurfer({
  container,
  url,
  sampleRate = 256000,
}) {
  ws = WaveSurfer.create({
    container,
    height: 0,
    interact: false,
    cursorWidth: 0,
    url,
    sampleRate,
  });

  return ws;
}

export function createSpectrogramPlugin({
  colorMap,
  height = 800,
  frequencyMin = 0,
  frequencyMax = 128000,
  noverlap = null,
}) {
  const baseOptions = {
    labels: false,
    height,
    fftSamples: 1024,
    frequencyMin: frequencyMin * 1000,
    frequencyMax: frequencyMax * 1000,
    scale: 'linear',
    windowFunc: 'hann',
    colorMap,
  };

  if (noverlap !== null) {
    baseOptions.noverlap = noverlap;
    lastUsedNoverlap = noverlap; // ✅ 記錄實際使用
  } else {
    lastUsedNoverlap = null;
  }

  return Spectrogram.create(baseOptions);
}

export function replacePlugin(
  colorMap,
  height = 800,
  frequencyMin = 0,
  frequencyMax = 128,
  overlapPercent = null,
  onRendered = null
) {
  if (!ws) throw new Error('Wavesurfer not initialized.');
  const container = document.getElementById("spectrogram-only");

  const oldCanvas = container.querySelector("canvas");
  if (oldCanvas) oldCanvas.remove();

  if (plugin?.destroy) plugin.destroy();

  currentColorMap = colorMap;

  const fftSamples = 1024;
  const noverlap = overlapPercent !== null
    ? Math.floor(fftSamples * (overlapPercent / 100))
    : null;

  plugin = createSpectrogramPlugin({
    colorMap,
    height,
    frequencyMin,
    frequencyMax,
    noverlap,
  });

  ws.registerPlugin(plugin);

  try {
    plugin.render();
    requestAnimationFrame(() => {
      if (typeof onRendered === 'function') onRendered();
    });
  } catch (err) {
    console.warn('⚠️ Spectrogram render failed:', err);
  }
}

export function getWavesurfer() {
  return ws;
}

export function getPlugin() {
  return plugin;
}

export function getCurrentColorMap() {
  return currentColorMap;
}

// ✅ 提供外部存取實際使用的 noverlap（以百分比形式回傳）
export function getActualOverlapPercent() {
  const fftSamples = 1024;
  if (lastUsedNoverlap === null) return null;

  const percent = (lastUsedNoverlap / fftSamples) * 100;
  return Math.round(percent * 10) / 10;
}
