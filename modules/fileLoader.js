// modules/fileLoader.js

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';
import Spectrogram from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/spectrogram.esm.js';
import { extractGuanoMetadata } from './guanoReader.js';
import { setWavesurfer } from './wsManager.js';

let fileList = [];
let currentIndex = -1;
let lastObjectUrl = null;
let currentPlugin = null;

function getWavSampleRate(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (event) {
      const buffer = event.target.result;
      const dataView = new DataView(buffer);
      const sampleRate = dataView.getUint32(24, true); // little-endian
      resolve(sampleRate);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(0, 44));
  });
}

export function initFileLoader({
  fileInputId,
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

    const sampleRate = await getWavSampleRate(file);
    const fileUrl = URL.createObjectURL(file);
    if (currentPlugin?.destroy) currentPlugin.destroy();
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = fileUrl;

    // 🔄 建立新的 WaveSurfer 實例
    const newWs = WaveSurfer.create({
      container: document.getElementById('spectrogram-only'),
      height: 0,
      interact: false,
      cursorWidth: 0,
      url: fileUrl,
      sampleRate,
    });

    setWavesurfer(newWs); // ✅ 更新全域 wavesurfer 實例

    await newWs.load(fileUrl);

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

    newWs.registerPlugin(currentPlugin);

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
