// modules/fileLoader.js

import Spectrogram from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/spectrogram.esm.js';

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
  }

  fileInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files).filter(f => f.name.endsWith('.wav'));
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
  
    fileList = files.sort((a, b) =>
      a.webkitRelativePath.localeCompare(b.webkitRelativePath)
    );
  
    currentIndex = fileList.findIndex(f =>
      f.webkitRelativePath === selectedFile.webkitRelativePath
    );
  
    await loadFile(fileList[currentIndex]);
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
