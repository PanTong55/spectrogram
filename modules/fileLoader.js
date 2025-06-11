// modules/fileLoader.js

import { extractGuanoMetadata, parseGuanoMetadata } from './guanoReader.js';
import { addFilesToList, getFileList, getCurrentIndex, setCurrentIndex, removeFilesByName, setFileMetadata } from './fileState.js';

let lastObjectUrl = null;

export function initFileLoader({
  fileInputId,
  wavesurfer,
  spectrogramHeight,
  colorMap,
  onPluginReplaced,
  onFileLoaded,
  onBeforeLoad,
  onAfterLoad
}) {
  const fileInput = document.getElementById(fileInputId);
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const fileNameElem = document.getElementById('fileNameText');
  const guanoOutput = document.getElementById('guano-output');
  const spectrogramSettings = document.getElementById('spectrogram-settings');  

  async function loadFile(file) {
    if (!file) return;

    if (typeof onBeforeLoad === 'function') {
      onBeforeLoad();
    }
    
    if (typeof onFileLoaded === 'function') {
      onFileLoaded(file);
    }
    
    if (fileNameElem) {
      fileNameElem.textContent = file.name;
    }

    try {
      const result = await extractGuanoMetadata(file);
      guanoOutput.textContent = result || '(No GUANO metadata found)';
      const meta = parseGuanoMetadata(result);
      const idx = getCurrentIndex();
      setFileMetadata(idx, meta);
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
    if (spectrogramSettings) {
      spectrogramSettings.textContent =
        `Sampling rate: ${sampleRate / 1000}kHz, FFT size: 1024, Overlap size: Auto, Hanning window`;
    }

    if (typeof onAfterLoad === 'function') {
      onAfterLoad();
    }    
    
  }

  fileInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    const selectedFile = files[0];
    if (!selectedFile) return;

    if (typeof onBeforeLoad === 'function') {
      onBeforeLoad();
    }

    const sameDirFiles = files.filter(f => f.name.endsWith('.wav'));

    const sortedList = sameDirFiles.sort((a, b) => a.name.localeCompare(b.name));
    const index = sortedList.findIndex(f => f.name === selectedFile.name);

    removeFilesByName('demo_recording.wav');
    const startIdx = getFileList().length;
    addFilesToList(sortedList, index);
    for (let i = 0; i < sortedList.length; i++) {
      try {
        const txt = await extractGuanoMetadata(sortedList[i]);
        const meta = parseGuanoMetadata(txt);
        setFileMetadata(startIdx + i, meta);
      } catch (err) {
        setFileMetadata(startIdx + i, { date: '', time: '', latitude: '', longitude: '' });
      }
    }
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
    if (e.key === 'ArrowUp') {
      prevBtn.click();
    } else if (e.key === 'ArrowDown') {
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
