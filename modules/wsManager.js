// modules/wsManager.js

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';
import Spectrogram from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/spectrogram.esm.js';

let ws = null;
let plugin = null;

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
}) {
  return Spectrogram.create({
    labels: false,
    height,
    fftSamples: 1024,
    frequencyMin: 0,
    frequencyMax: 128000,
    scale: 'linear',
    windowFunc: 'hann',
    colorMap,
  });
}

export function replacePlugin(colorMap, height = 900) {
  if (!ws) throw new Error('Wavesurfer not initialized.');
  if (plugin?.destroy) plugin.destroy();

  plugin = createSpectrogramPlugin({ colorMap, height });
  ws.registerPlugin(plugin);

  return plugin;
}

export function getWavesurfer() {
  return ws;
}

export function getPlugin() {
  return plugin;
}
