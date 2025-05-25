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
  height = 900,
  frequencyMin = 0,
  frequencyMax = 128000,
}) {
  return Spectrogram.create({
    labels: false,
    height,
    fftSamples: 1024,
    frequencyMin,
    frequencyMax,
    scale: 'linear',
    windowFunc: 'hann',
    colorMap,
  });
}

// 🆕 更穩定的 render 條件檢查：等 plugin.canvas 有高度
function waitUntilCanvasReady(plugin, maxRetries = 10, delay = 50) {
  return new Promise((resolve, reject) => {
    let retries = 0;

    function check() {
      const canvas = plugin?.renderer?.canvas;
      if (canvas && canvas.height > 0) {
        resolve();
      } else if (retries < maxRetries) {
        retries++;
        setTimeout(check, delay);
      } else {
        reject(new Error('Plugin canvas height still 0 after retries'));
      }
    }

    check();
  });
}

export function replacePlugin(colorMap, height = 900, frequencyMin = 0, frequencyMax = 128000) {
  if (!ws) throw new Error('Wavesurfer not initialized.');
  if (plugin?.destroy) plugin.destroy();

  currentColorMap = colorMap;

  plugin = createSpectrogramPlugin({ colorMap, height, frequencyMin, frequencyMax });
  ws.registerPlugin(plugin);

  waitUntilCanvasReady(plugin)
    .then(() => {
      plugin.render();  // ✅ 真正 canvas 高度準備好才 render
    })
    .catch((err) => {
      console.warn('⚠️ Spectrogram render failed due to canvas not ready:', err);
    });
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
