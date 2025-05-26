// modules/fileLoader.js

import Spectrogram from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/spectrogram.esm.js';

let fileList = [];
let currentIndex = -1;
let currentPlugin = null;
let lastObjectUrl = null;

async function loadFile(file, wavesurfer, spectrogramHeight, colorMap, onPluginReplaced) {
  const fileUrl = URL.createObjectURL(file);
  if (currentPlugin?.destroy) currentPlugin.destroy();
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastObjectUrl = fileUrl;

  await wavesurfer.load(fileUrl);

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
  updateButtons();
}

function updateButtons() {
  document.getElementById('prevBtn').disabled = (currentIndex <= 0);
  document.getElementById('nextBtn').disabled = (currentIndex >= fileList.length - 1);
}

export function initFileLoader({ wavesurfer, spectrogramHeight, colorMap, onPluginReplaced }) {
  document.getElementById('fileInputSingle').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileList = [file];
    currentIndex = 0;
    await loadFile(file, wavesurfer, spectrogramHeight, colorMap, onPluginReplaced);
  });

  document.getElementById('fileInputFolder').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).filter(f => f.name.endsWith('.wav'));
    fileList = files.sort((a, b) =>
      a.webkitRelativePath.localeCompare(b.webkitRelativePath)
    );
    currentIndex = 0;
    await loadFile(fileList[currentIndex], wavesurfer, spectrogramHeight, colorMap, onPluginReplaced);
  });

  document.getElementById('prevBtn').addEventListener('click', async () => {
    if (currentIndex > 0) {
      currentIndex--;
      await loadFile(fileList[currentIndex], wavesurfer, spectrogramHeight, colorMap, onPluginReplaced);
    }
  });

  document.getElementById('nextBtn').addEventListener('click', async () => {
    if (currentIndex < fileList.length - 1) {
      currentIndex++;
      await loadFile(fileList[currentIndex], wavesurfer, spectrogramHeight, colorMap, onPluginReplaced);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') document.getElementById('prevBtn').click();
    if (e.key === 'ArrowRight') document.getElementById('nextBtn').click();
  });
}

