// modules/dragDropLoader.js

import { extractGuanoMetadata, parseGuanoMetadata } from './guanoReader.js';
import { getWavSampleRate } from './fileLoader.js';
import { addFilesToList, removeFilesByName, setFileMetadata, getCurrentIndex, getFileList } from './fileState.js';

export function initDragDropLoader({
  targetElementId,
  wavesurfer,
  spectrogramHeight,
  colorMap,
  onPluginReplaced,
  onFileLoaded,
  onBeforeLoad,
  onAfterLoad,
  onSampleRateDetected
}) {
  const dropArea = document.getElementById(targetElementId);
  const overlay = document.getElementById('drop-overlay');
  const fileNameElem = document.getElementById('fileNameText');
  const guanoOutput = document.getElementById('guano-output');
  const spectrogramSettings = document.getElementById('spectrogram-settings');  
  let lastObjectUrl = null;

  function showOverlay() {
    overlay.style.display = 'flex';
    document.dispatchEvent(new Event('drop-overlay-show'));
  }

  function hideOverlay() {
    overlay.style.display = 'none';
    document.dispatchEvent(new Event('drop-overlay-hide'));
  }

  async function loadFile(file) {
    if (!file) return;

    const detectedSampleRate = await getWavSampleRate(file);
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

      const sampleRate = detectedSampleRate || wavesurfer?.options?.sampleRate || 256000;

    if (typeof onSampleRateDetected === 'function') {
      await onSampleRateDetected(sampleRate);
    }

    if (spectrogramSettings) {
      spectrogramSettings.textContent =
        `Sampling rate: ${sampleRate / 1000}kHz`;
    }

    if (typeof onAfterLoad === 'function') {
      onAfterLoad();
    }
    document.dispatchEvent(new Event('file-loaded'));
  }

  async function handleFiles(files) {
    const validFiles = Array.from(files).filter(file => file.type === 'audio/wav' || file.name.endsWith('.wav'));
    if (validFiles.length === 0) {
      alert('Only .wav files are supported.');
      return;
    }

    if (typeof onBeforeLoad === 'function') {
      onBeforeLoad();
    }

    const sortedList = validFiles.sort((a, b) => a.name.localeCompare(b.name));
    removeFilesByName('demo_recording.wav');
    const startIdx = getFileList().length;
    addFilesToList(sortedList, 0);
    for (let i = 0; i < sortedList.length; i++) {
      try {
        const txt = await extractGuanoMetadata(sortedList[i]);
        const meta = parseGuanoMetadata(txt);
        setFileMetadata(startIdx + i, meta);
      } catch (err) {
        setFileMetadata(startIdx + i, { date: '', time: '', latitude: '', longitude: '' });
      }
    }
    await loadFile(sortedList[0]);
  }

  let dragCounter = 0;

  dropArea.addEventListener('dragenter', e => {
    e.preventDefault();
    dragCounter++;
    showOverlay();
  });

  dropArea.addEventListener('dragleave', e => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      hideOverlay();
    }
  });

  dropArea.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  async function getFilesFromDataTransfer(dt) {
    if (!dt.items) return Array.from(dt.files);

    const traverse = async (entry) => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file(f => resolve([f]), () => resolve([]));
        });
      }
      if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = [];
        const readEntries = () => new Promise((resolve) => {
          reader.readEntries(async (results) => {
            if (!results.length) {
              const children = await Promise.all(entries.map(traverse));
              resolve(children.flat());
            } else {
              entries.push(...results);
              resolve(await readEntries());
            }
          }, () => resolve([]));
        });
        return readEntries();
      }
      return [];
    };

    const entries = Array.from(dt.items)
      .map(item => item.webkitGetAsEntry && item.webkitGetAsEntry())
      .filter(Boolean);

    if (!entries.length) return Array.from(dt.files);

    const fileArrays = await Promise.all(entries.map(traverse));
    return fileArrays.flat();
  }

  dropArea.addEventListener('drop', async e => {
    e.preventDefault();
    dragCounter = 0;
    hideOverlay();
    const files = await getFilesFromDataTransfer(e.dataTransfer);
    handleFiles(files);
  });
}
