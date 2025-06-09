// modules/wsManager.js

import { WaveSurfer } from './wavesurfer.esm.js';
import { Spectrogram } from './spectrogram.esm.js';

let ws = null;
let plugin = null;
let currentColorMap = null;

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
  }

  return Spectrogram.create(baseOptions);
}

export function replacePlugin(
  colorMap,
  height = 800,
  frequencyMin = 0,
  frequencyMax = 128,
  overlapPercent = null,
  onRendered = null  // ✅ 傳入 callback
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
