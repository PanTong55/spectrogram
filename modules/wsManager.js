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
    frequencyMin: frequencyMin * 1000,
    frequencyMax: frequencyMax * 1000,
    scale: 'linear',
    windowFunc: 'hann',
    colorMap,
  });
}

function waitUntilCanvasReadyFromDOM(container, maxRetries = 15, delay = 100) {
  return new Promise((resolve, reject) => {
    let retries = 0;

    function check() {
      const canvas = container.querySelector("canvas");
      const h = canvas?.clientHeight || 0;

      if (canvas && h > 0) {
        resolve();
      } else if (retries < maxRetries) {
        retries++;
        setTimeout(check, delay);
      } else {
        reject(new Error('Canvas element still missing or height = 0 after retries'));
      }
    }

    check();
  });
}

export function replacePlugin(colorMap, height = 900, frequencyMin = 0, frequencyMax = 128000) {
  if (!ws) throw new Error('Wavesurfer not initialized.');

  const container = document.getElementById("spectrogram-only");

  // ✅ 清除舊 canvas
  const oldCanvas = container.querySelector("canvas");
  if (oldCanvas) oldCanvas.remove();

  if (plugin?.destroy) plugin.destroy();

  currentColorMap = colorMap;

  plugin = createSpectrogramPlugin({
    colorMap,
    height,
    frequencyMin,
    frequencyMax
  });

  ws.registerPlugin(plugin);

  // ✅ 延後 render 到 browser 完成 plugin canvas 插入後
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        plugin.render();
      } catch (err) {
        console.warn('⚠️ Spectrogram render failed (delayed render):', err);
      }
    }, 100); // 可依機器調整（較慢機可能需 150ms）
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
