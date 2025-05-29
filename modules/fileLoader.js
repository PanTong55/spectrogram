// modules/fileLoader.js

import Spectrogram from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/spectrogram.esm.js';
import { extractGuanoMetadata } from './guanoReader.js';

let fileList = [];
let currentIndex = -1;
let lastObjectUrl = null;
let currentPlugin = null;

export function initFileLoader({
  fileInputId,
  wavesurfer,
  spectrogramHeight,
  colorMap,
  onPluginReplaced,
}) {
  const fileInput = document.getElementById(fileInputId);
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  async function loadFile(file) {
    if (!file) return;
    
    const guanoOutput = document.getElementById('guano-output');
    try {
      const result = await extractGuanoMetadata(file);
      guanoOutput.textContent = result || '(No GUANO metadata found)';
    } catch (err) {
      guanoOutput.textContent = '(Error reading GUANO metadata)';
    }
    
    const fileUrl = URL.createObjectURL(file);
    if (currentPlugin?.destroy) currentPlugin.destroy();
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = fileUrl;

    await wavesurfer.load(fileUrl);

    wavesurfer.once('ready', () => {
      const spectrogramSettings = document.getElementById('spectrogram-settings');
      const fftSize = 1024;
      const overlapInput = document.getElementById('overlapInput');
      const overlapVal = overlapInput.value === 'auto' ? 'auto' : `${overlapInput.value}%`;
      const windowFunc = 'Hanning';
    
      const audioContext = wavesurfer.backend.ac;
      const sampleRate = audioContext?.sampleRate || 256000;
    
      spectrogramSettings.textContent =
        `Sampling rate: ${Math.round(sampleRate / 1000)}kHz, ` +
        `FFT size: ${fftSize}, ` +
        `Overlap size: ${overlapVal}, ` +
        `${windowFunc} window`;
    });
    
    currentPlugin = Spectrogram.create({
      labels: false,
      height: spectrogramHeight,
      fftSamples: 1024,
      frequencyMin: 0,
      frequencyMax: 128000,
      scale: 'linear',
      windowFunc: 'hann',
      colorMap,
    });

    wavesurfer.registerPlugin(currentPlugin);

    if (typeof onPluginReplaced === 'function') {
      onPluginReplaced(currentPlugin);
    }
  }

  fileInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    const selectedFile = files[0];
    if (!selectedFile) return;

    const sameDirFiles = files.filter(f => f.name.endsWith('.wav'));
    fileList = sameDirFiles.sort((a, b) => a.name.localeCompare(b.name));
    currentIndex = fileList.findIndex(f => f.name === selectedFile.name);

    await loadFile(selectedFile);
  });

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      loadFile(fileList[currentIndex]);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentIndex < fileList.length - 1) {
      currentIndex++;
      loadFile(fileList[currentIndex]);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      prevBtn.click();
    } else if (e.key === 'ArrowRight') {
      nextBtn.click();
    }
  });
}
