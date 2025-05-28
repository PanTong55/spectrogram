// modules/wsManager.js

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';
import Spectrogram from 'https://unpkg.com/wavesurfer.js@7.9.5/dist/plugins/spectrogram.esm.js';

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
  let noverlap;
  
  if (overlapPercent !== null) {
    // 使用者指定 % overlap
    noverlap = Math.floor(fftSamples * (overlapPercent / 100));
  } else {
    // Auto 模式下：根據 canvas width 與 duration 自動推算合理的 step / overlap
    const durationSec = ws.getDuration(); // 單位為秒
    const sampleRate = ws.options.sampleRate ?? 256000;
    const totalSamples = durationSec * sampleRate;
  
    const canvas = document.getElementById("spectrogram-only");
    const desiredSteps = canvas.clientWidth;
  
    // 假設我們希望 totalSteps ≧ canvas width：
    const minStep = Math.floor((totalSamples - fftSamples) / desiredSteps);
    const safeStep = Math.max(1, Math.min(minStep, fftSamples - 1)); // 限制 step 範圍在合理值
  
    noverlap = fftSamples - safeStep;
  }

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
    // ✅ 等待下一幀再執行 callback，確保 render 完成
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
