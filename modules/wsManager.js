// modules/wsManager.js

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';
import Spectrogram from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/spectrogram.esm.js';

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
    height: 900,
    fftSamples: 1024,
    frequencyMin,
    frequencyMax,
    scale: 'linear',
    windowFunc: 'hann',
    colorMap,
  });
}

export function replacePlugin(colorMap, height = 900, frequencyMin = 0, frequencyMax = 128000) {
  if (!ws) throw new Error('Wavesurfer not initialized.');
  if (plugin?.destroy) plugin.destroy();

  if (height <= 0) {
    console.warn('❌ Spectrogram height is 0. Abort plugin replacement.');
    return;
  }

  currentColorMap = colorMap;

  plugin = createSpectrogramPlugin({ colorMap, height, frequencyMin, frequencyMax });
  ws.registerPlugin(plugin);

  setTimeout(() => {
    if (plugin && height > 0) {
      plugin.render();
    }
  }, 50);
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
