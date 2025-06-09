// modules/dragDropLoader.js

import { extractGuanoMetadata } from './guanoReader.js';
import { setFileList } from './fileState.js';

export function initDragDropLoader({
  targetElementId,
  wavesurfer,
  spectrogramHeight,
  colorMap,
  onPluginReplaced,
  onFileLoaded,
  onBeforeLoad,
  onAfterLoad
}) {
  const dropArea = document.getElementById(targetElementId);
  const overlay = document.getElementById('drop-overlay');
  let lastObjectUrl = null;

  function showOverlay() {
    overlay.style.display = 'flex';
  }

  function hideOverlay() {
    overlay.style.display = 'none';
  }

  async function loadFile(file) {
    if (!file) return;

    if (typeof onBeforeLoad === 'function') {
      onBeforeLoad();
    }    

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
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = fileUrl;

    await wavesurfer.load(fileUrl);

    if (typeof onPluginReplaced === 'function') {
      onPluginReplaced();
    }

    const sampleRate = wavesurfer?.options?.sampleRate || 256000;
    document.getElementById('spectrogram-settings').textContent =
      `Sampling rate: ${sampleRate / 1000}kHz, FFT size: 1024, Overlap size: Auto, Hanning window`;

    if (typeof onAfterLoad === 'function') {
      onAfterLoad();
    }    
  }

  async function handleFiles(files) {
    const validFiles = Array.from(files).filter(file => file.type === 'audio/wav' || file.name.endsWith('.wav'));
    if (validFiles.length === 0) {
      alert('Only .wav files are supported.');
      return;
    }

    const sortedList = validFiles.sort((a, b) => a.name.localeCompare(b.name));
    setFileList(sortedList, 0);
    await loadFile(sortedList[0]);
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
