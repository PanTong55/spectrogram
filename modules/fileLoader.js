// modules/fileLoader.js

import Spectrogram from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/spectrogram.esm.js';
import { extractGuanoMetadata } from './guanoReader.js';
import { setFileList, getFileList, getCurrentIndex, setCurrentIndex } from './fileState.js';

let lastObjectUrl = null;
let currentPlugin = null;

export function initFileLoader({
  fileInputId,
  wavesurfer,
  spectrogramHeight,
  colorMap,
  onPluginReplaced,
  onFileLoaded
}) {
  const fileInput = document.getElementById(fileInputId);
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  async function loadFile(file) {
    if (!file) return;

    if (typeof onFileLoaded === 'function') {
      onFileLoaded(file);
    }
    
    const fileNameElem = document.getElementById('fileNameText');
    if (fileNameElem) {
      fileNameElem.textContent = file.name;
    }  

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

  fileInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    const selectedFile = files[0];
    if (!selectedFile) return;

    const sameDirFiles = files.filter(f => f.name.endsWith('.wav'));

    const sortedList = sameDirFiles.sort((a, b) => a.name.localeCompare(b.name));
    const index = sortedList.findIndex(f => f.name === selectedFile.name);

    setFileList(sortedList, index);
    await loadFile(selectedFile);
  });

  prevBtn.addEventListener('click', () => {
    const index = getCurrentIndex();
    if (index > 0) {
      setCurrentIndex(index - 1);
      const file = getFileList()[index - 1];
      loadFile(file);
    }
  });

  nextBtn.addEventListener('click', () => {
    const index = getCurrentIndex();
    const files = getFileList();
    if (index < files.length - 1) {
      setCurrentIndex(index + 1);
      const file = files[index + 1];
      loadFile(file);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      prevBtn.click();
    } else if (e.key === 'ArrowRight') {
      nextBtn.click();
    }
  });

  return {
    loadFileAtIndex: async (index) => {
      const files = getFileList();
      if (index >= 0 && index < files.length) {
        setCurrentIndex(index);
        await loadFile(files[index]);
      }
    }
  };  
}
