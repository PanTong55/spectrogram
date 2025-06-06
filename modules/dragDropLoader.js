// modules/dragDropLoader.js

import { extractGuanoMetadata } from './guanoReader.js';
import Spectrogram from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/spectrogram.esm.js';
import { setFileList } from './fileLoader.js';  // ✅ 讀取 fileLoader 的 setter

export function initDragDropLoader({
  targetElementId,
  wavesurfer,
  spectrogramHeight,
  colorMap,
  onPluginReplaced
}) {
  const dropArea = document.getElementById(targetElementId);
  const overlay = document.getElementById('drop-overlay');
  let lastObjectUrl = null;
  let currentPlugin = null;

  function showOverlay() {
    overlay.style.display = 'flex';
  }

  function hideOverlay() {
    overlay.style.display = 'none';
  }

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

    const sampleRate = wavesurfer?.options?.sampleRate || 256000;
    document.getElementById('spectrogram-settings').textContent =
      `Sampling rate: ${sampleRate / 1000}kHz, FFT size: 1024, Overlap size: Auto, Hanning window`;    
  }

  async function handleFiles(files) {
    const validFiles = Array.from(files).filter(file => file.type === 'audio/wav' || file.name.endsWith('.wav'));

    if (validFiles.length === 0) {
      alert('Only .wav files are supported.');
      return;
    }

    // ✅ 更新全局 fileList & index
    const sortedList = validFiles.sort((a, b) => a.name.localeCompare(b.name));
    setFileList(sortedList, 0);

    await loadFile(sortedList[0]); // 預設先 load 第一個
  }

  dropArea.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    showOverlay();
  });

  dropArea.addEventListener('dragleave', e => {
    e.preventDefault();
    hideOverlay();
  });

  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    hideOverlay();
    handleFiles(e.dataTransfer.files);
  });
}
