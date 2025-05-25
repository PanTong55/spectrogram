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
    height: 0, // ✅ 僅關於 waveform，不影響 spectrogram
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

function waitUntilHeightReady(container, maxRetries = 10, delay = 50) {
  return new Promise((resolve, reject) => {
    let retries = 0;

    function check() {
      const h = container.clientHeight;
      if (h > 0) {
        resolve();
      } else if (retries < maxRetries) {
        retries++;
        setTimeout(check, delay);
      } else {
        reject(new Error('Container height still 0 after retries'));
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

  const container = document.getElementById("spectrogram-only");

  waitUntilHeightReady(container)
    .then(() => {
      plugin.render();  // ✅ 確保高度沒問題才 render
    })
    .catch((err) => {
      console.warn('⚠️ Failed to render plugin due to container height issue:', err);
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
