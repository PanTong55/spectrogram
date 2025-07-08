// modules/fileLoader.js

import { extractGuanoMetadata, parseGuanoMetadata } from './guanoReader.js';
import { addFilesToList, getFileList, getCurrentIndex, setCurrentIndex, removeFilesByName, setFileMetadata } from './fileState.js';

export async function getWavSampleRate(file) {
  if (!file) return 256000;
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  let pos = 12;
  while (pos < view.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(pos),
      view.getUint8(pos + 1),
      view.getUint8(pos + 2),
      view.getUint8(pos + 3)
    );
    const chunkSize = view.getUint32(pos + 4, true);
    if (chunkId === 'fmt ') {
      return view.getUint32(pos + 12, true);
    }
    pos += 8 + chunkSize;
    if (chunkSize % 2 === 1) pos += 1; // word alignment
  }
  return 256000;
}

let lastObjectUrl = null;

export function initFileLoader({
  fileInputId,
  wavesurfer,
  spectrogramHeight,
  colorMap,
  onPluginReplaced,
  onFileLoaded,
  onBeforeLoad,
  onAfterLoad,
  onSampleRateDetected
}) {
  const fileInput = document.getElementById(fileInputId);
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const fileNameElem = document.getElementById('fileNameText');
  const guanoOutput = document.getElementById('guano-output');
  const spectrogramSettings = document.getElementById('spectrogram-settings');
  const uploadOverlay = document.getElementById('upload-overlay');
  const uploadProgressBar = document.getElementById('upload-progress-bar');
  const uploadProgressText = document.getElementById('upload-progress-text');

  function showUploadOverlay(total) {
    if (!uploadOverlay) return;
    document.dispatchEvent(new Event('drop-overlay-hide'));
    if (uploadProgressBar) uploadProgressBar.style.width = '0%';
    if (uploadProgressText) uploadProgressText.textContent = `0/${total}`;
    uploadOverlay.style.display = 'flex';
  }

  function updateUploadOverlay(count, total) {
    if (uploadProgressBar) {
      const pct = total > 0 ? (count / total) * 100 : 0;
      uploadProgressBar.style.width = `${pct}%`;
    }
    if (uploadProgressText) {
      uploadProgressText.textContent = `${count}/${total}`;
    }
  }

  function hideUploadOverlay() {
    if (uploadOverlay) uploadOverlay.style.display = 'none';
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

    if (typeof onSampleRateDetected === 'function') {
      await onSampleRateDetected(detectedSampleRate, true);
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

    if (spectrogramSettings) {
      spectrogramSettings.textContent =
        `Sampling rate: ${sampleRate / 1000}kHz`;
    }

    if (typeof onAfterLoad === 'function') {
      onAfterLoad();
    }
    document.dispatchEvent(new Event('file-loaded'));
    
  }

  fileInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    const selectedFile = files[0];
    if (!selectedFile) return;

    const sameDirFiles = files.filter(f => f.name.endsWith('.wav'));
    showUploadOverlay(sameDirFiles.length);

    if (typeof onBeforeLoad === 'function') {
      onBeforeLoad();
    }

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
      updateUploadOverlay(i + 1, sortedList.length);
    }
    hideUploadOverlay();
    await loadFile(selectedFile);
    // reset value so that selecting the same file again triggers change
    fileInput.value = '';
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
    if (e.ctrlKey) return; // avoid conflict with zoom shortcuts
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      prevBtn.click();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
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
