// modules/powerSpectrum.js

import { initDropdown } from './dropdown.js';
import { BatCallDetector } from './batCallDetector.js';

/**
 * 計算並顯示選定區域的 Power Spectrum
 */
export function showPowerSpectrumPopup({
  selection,
  wavesurfer,
  currentSettings = {}
}) {
  if (!wavesurfer || !selection) return null;

  // 確保始終使用最新的全局設置，保證與 Tooltip 一致
  let windowType = window.__spectrogramSettings?.windowType || currentSettings.windowType || 'hann';
  let sampleRate = window.__spectrogramSettings?.sampleRate || currentSettings.sampleRate || 256000;
  let overlap = window.__spectrogramSettings?.overlap || currentSettings.overlap || 'auto';
  
  let fftSize = 1024; // 固定預設為 1024，不從 currentSettings 獲取

  // 建立 Popup Window
  const popup = createPopupWindow();
  const canvas = popup.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  
  // 獲取控制元件
  const typeBtn = popup.querySelector('#powerSpectrumWindowType');
  const fftBtn = popup.querySelector('#powerSpectrumFFTSize');
  const overlapInput = popup.querySelector('#powerSpectrumOverlap');

  // 初始化 Dropdown 控制
  const typeDropdown = initDropdown(typeBtn, [
    { label: 'Blackman', value: 'blackman' },
    { label: 'Gauss', value: 'gauss' },
    { label: 'Hamming', value: 'hamming' },
    { label: 'Hann', value: 'hann' },
    { label: 'Rectangular', value: 'rectangular' },
    { label: 'Triangular', value: 'triangular' }
  ], {
    onChange: () => redrawSpectrum()
  });

  const fftDropdown = initDropdown(fftBtn, [
    { label: '512', value: '512' },
    { label: '1024', value: '1024' },
    { label: '2048', value: '2048' }
  ], {
    onChange: () => redrawSpectrum()
  });

  // 設置初始選項
  const typeIndex = ['blackman', 'gauss', 'hamming', 'hann', 'rectangular', 'triangular'].indexOf(windowType);
  typeDropdown.select(typeIndex >= 0 ? typeIndex : 3, { triggerOnChange: false }); // Default to 'hann'

  const fftIndex = ['512', '1024', '2048'].indexOf(fftSize.toString());
  fftDropdown.select(fftIndex >= 0 ? fftIndex : 1, { triggerOnChange: false }); // Default to '1024'

  // 提取選定區域的音頻數據
  let audioData = extractAudioData(wavesurfer, selection, sampleRate);
  if (!audioData) {
    console.error('Failed to extract audio data');
    popup.remove();
    return null;
  }

  // 用於存儲最後計算的峰值頻率
  let lastPeakFreq = null;
  
  // 初始化 Bat Call Detector
  const detector = new BatCallDetector({
    windowType: windowType,
    fftSize: 2048,  // 高解析度
    hopPercent: 25
  });

  // 繪製函數
  const redrawSpectrum = async (newSelection) => {
    // 如果提供了新的 selection 數據，更新它並重新提取音頻
    if (newSelection) {
      Object.assign(selection, newSelection);
      audioData = extractAudioData(wavesurfer, selection, sampleRate);
      if (!audioData) {
        console.error('Failed to extract audio data after selection update');
        return;
      }
    }
    
    // 從 dropdown 獲取當前值
    const windowTypeItems = ['blackman', 'gauss', 'hamming', 'hann', 'rectangular', 'triangular'];
    windowType = windowTypeItems[typeDropdown.selectedIndex] || 'hann';
    
    const fftSizeItems = ['512', '1024', '2048'];
    fftSize = parseInt(fftSizeItems[fftDropdown.selectedIndex] || '1024', 10);
    let overlapValue = overlap;
    if (overlapInput.value.trim() !== '') {
      overlapValue = parseInt(overlapInput.value, 10);
    }

    // 計算 Power Spectrum (包含 overlap 參數)
    const spectrum = calculatePowerSpectrumWithOverlap(
      audioData,
      sampleRate,
      fftSize,
      windowType,
      overlapValue
    );

    // 計算 Peak Frequency - 直接從頻譜中找到峰值 (與顯示的曲線對應)
    const peakFreq = findPeakFrequencyFromSpectrum(
      spectrum,
      sampleRate,
      fftSize,
      selection.Flow,
      selection.Fhigh
    );
    
    // 使用 Bat Call Detector 檢測並測量參數
    try {
      const calls = await detector.detectCalls(
        audioData,
        sampleRate,
        selection.Flow,
        selection.Fhigh
      );
      
      if (calls.length > 0) {
        const call = calls[0];  // 取第一個偵測到的 call
        updateParametersDisplay(popup, call);
      } else {
        // 如果沒有偵測到 call，但有 peak freq，仍然顯示它
        updateParametersDisplay(popup, null, peakFreq);
      }
    } catch (err) {
      console.error('Bat call detection error:', err);
      updateParametersDisplay(popup, null, peakFreq);
    }

    // 存儲最後計算的峰值
    lastPeakFreq = peakFreq;

    // 向 popup DOM 發射事件，告知外界峰值已更新（便於 tooltip 等其他元件同步）
    try {
      popup.dispatchEvent(new CustomEvent('peakUpdated', {
        detail: { peakFreq }
      }));
    } catch (e) {
      // 若 popup 尚不可用或調度失敗，忽略錯誤
    }

    // 繪製 Power Spectrum
    drawPowerSpectrum(
      ctx,
      spectrum,
      sampleRate,
      selection.Flow,
      selection.Fhigh,
      fftSize,
      peakFreq
    );
  };

  // 初始繪製
  redrawSpectrum();

  // 添加事件監聽器（overlap input）
  overlapInput.addEventListener('change', redrawSpectrum);

  // 返回 popup 對象和更新函數
  return {
    popup,
    update: redrawSpectrum,
    isOpen: () => document.body.contains(popup),
    getPeakFrequency: () => lastPeakFreq
  };
}

/**
 * 建立 500x500 的 Popup Window (使用 MessageBox 樣式)
 */
function createPopupWindow() {
  const popup = document.createElement('div');
  popup.className = 'power-spectrum-popup modal-popup';

  // 建立 Drag Bar (標題欄)
  const dragBar = document.createElement('div');
  dragBar.className = 'popup-drag-bar';
  
  const titleSpan = document.createElement('span');
  titleSpan.className = 'popup-title';
  titleSpan.textContent = 'Power Spectrum';
  dragBar.appendChild(titleSpan);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'popup-close-btn';
  closeBtn.title = 'Close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => popup.remove());
  dragBar.appendChild(closeBtn);

  popup.appendChild(dragBar);

  // 建立 Canvas 容器
  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'power-spectrum-canvas-container';

  const canvas = document.createElement('canvas');
  canvas.width = 488;
  canvas.height = 380;

  canvasContainer.appendChild(canvas);
  popup.appendChild(canvasContainer);

  // 建立控制面板
  const controlPanel = document.createElement('div');
  controlPanel.className = 'power-spectrum-controls';

  // Window Type 控制
  const typeControl = document.createElement('label');
  const typeLabel = document.createElement('span');
  typeLabel.textContent = 'Type:';
  typeControl.appendChild(typeLabel);
  
  const typeBtn = document.createElement('button');
  typeBtn.id = 'powerSpectrumWindowType';
  typeBtn.className = 'dropdown-button';
  typeBtn.textContent = 'Hann';
  typeControl.appendChild(typeBtn);
  controlPanel.appendChild(typeControl);

  // FFT Size 控制
  const fftControl = document.createElement('label');
  const fftLabel = document.createElement('span');
  fftLabel.textContent = 'FFT:';
  fftControl.appendChild(fftLabel);
  
  const fftBtn = document.createElement('button');
  fftBtn.id = 'powerSpectrumFFTSize';
  fftBtn.className = 'dropdown-button';
  fftBtn.textContent = '1024';
  fftControl.appendChild(fftBtn);
  controlPanel.appendChild(fftControl);

  // Overlap 控制
  const overlapControl = document.createElement('label');
  const overlapLabel = document.createElement('span');
  overlapLabel.textContent = 'Overlap:';
  overlapControl.appendChild(overlapLabel);
  
  const overlapInput = document.createElement('input');
  overlapInput.id = 'powerSpectrumOverlap';
  overlapInput.type = 'number';
  overlapInput.placeholder = 'Auto';
  overlapInput.min = '1';
  overlapInput.max = '99';
  overlapInput.step = '1';
  // 不設置初始值，保持空白表示 'auto'
  overlapControl.appendChild(overlapInput);
  controlPanel.appendChild(overlapControl);

  popup.appendChild(controlPanel);

  // 建立參數顯示面板
  const paramPanel = document.createElement('div');
  paramPanel.className = 'bat-call-parameters-panel';
  paramPanel.id = 'batCallParametersPanel';
  
  const paramTable = document.createElement('table');
  paramTable.className = 'bat-call-parameters-table';
  paramTable.innerHTML = `
    <tr>
      <td class="param-label">Type:</td>
      <td class="param-value call-type">-</td>
      <td class="param-unit"></td>
    </tr>
    <tr>
      <td class="param-label">Peak Freq:</td>
      <td class="param-value peak-freq">-</td>
      <td class="param-unit">kHz</td>
    </tr>
    <tr>
      <td class="param-label">Start Freq:</td>
      <td class="param-value start-freq">-</td>
      <td class="param-unit">kHz</td>
    </tr>
    <tr>
      <td class="param-label">End Freq:</td>
      <td class="param-value end-freq">-</td>
      <td class="param-unit">kHz</td>
    </tr>
    <tr>
      <td class="param-label">Char. Freq:</td>
      <td class="param-value char-freq">-</td>
      <td class="param-unit">kHz</td>
    </tr>
    <tr>
      <td class="param-label">Bandwidth:</td>
      <td class="param-value bandwidth">-</td>
      <td class="param-unit">kHz</td>
    </tr>
    <tr>
      <td class="param-label">Duration:</td>
      <td class="param-value duration">-</td>
      <td class="param-unit">ms</td>
    </tr>
  `;
  paramPanel.appendChild(paramTable);
  popup.appendChild(paramPanel);
  
  document.body.appendChild(popup);

  // 拖動功能
  makeDraggable(popup, dragBar);

  return popup;
}

/**
 * 使 popup 可拖動
 */
function makeDraggable(popup, dragBar) {
  let offsetX = 0, offsetY = 0, isDragging = false;

  dragBar.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = popup.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    popup.classList.add('resizing');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    popup.style.position = 'fixed';
    popup.style.left = `${e.clientX - offsetX}px`;
    popup.style.top = `${e.clientY - offsetY}px`;
    popup.style.transform = 'none';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      popup.classList.remove('resizing');
    }
  });
}

/**
 * 從 wavesurfer 提取音頻數據
 */
function extractAudioData(wavesurfer, selection, sampleRate) {
  try {
    const decodedData = wavesurfer.getDecodedData();
    if (!decodedData || !decodedData.getChannelData) return null;

    const { startTime, endTime } = selection;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);

    if (endSample <= startSample) return null;

    // 提取第一個通道
    const channelData = decodedData.getChannelData(0);
    return new Float32Array(channelData.slice(startSample, endSample));
  } catch (err) {
    console.error('Error extracting audio data:', err);
    return null;
  }
}

/**
 * 計算 Power Spectrum (使用 Goertzel 算法，考慮 Overlap)
 */
function calculatePowerSpectrumWithOverlap(audioData, sampleRate, fftSize, windowType, overlap = 'auto') {
  if (!audioData || audioData.length === 0) return null;

  // 如果音頻短於 FFT 大小，直接計算單幀
  if (audioData.length < fftSize) {
    return calculatePowerSpectrum(audioData, sampleRate, fftSize, windowType);
  }

  // 確定 hop size (每幀之間的步長)
  let hopSize;
  if (overlap === 'auto' || overlap === '') {
    // 預設 50% overlap
    hopSize = Math.floor(fftSize / 2);
  } else {
    const overlapPercent = parseInt(overlap, 10);
    if (isNaN(overlapPercent) || overlapPercent < 0 || overlapPercent > 99) {
      hopSize = Math.floor(fftSize / 2);
    } else {
      hopSize = Math.floor(fftSize * (1 - overlapPercent / 100));
    }
  }

  // 確保 hopSize > 0
  hopSize = Math.max(1, hopSize);

  const freqResolution = sampleRate / fftSize;
  const maxFreqToCompute = sampleRate / 2;
  const spectrum = new Float32Array(Math.floor(maxFreqToCompute / freqResolution) + 1);
  let spectrumCount = 0;

  // 對音頻進行分幀處理
  for (let offset = 0; offset + fftSize <= audioData.length; offset += hopSize) {
    const frameData = audioData.slice(offset, offset + fftSize);
    
    // 計算該幀的頻譜
    const windowed = applyWindow(frameData, windowType);

    // 預處理：移除直流分量
    let dcOffset = 0;
    for (let i = 0; i < windowed.length; i++) {
      dcOffset += windowed[i];
    }
    dcOffset /= windowed.length;

    const dcRemovedData = new Float32Array(windowed.length);
    for (let i = 0; i < windowed.length; i++) {
      dcRemovedData[i] = windowed[i] - dcOffset;
    }

    // 計算該幀的能量 (在時域中累加，不在 dB 域)
    for (let binIndex = 0; binIndex < spectrum.length; binIndex++) {
      const freq = binIndex * freqResolution;
      if (freq > maxFreqToCompute) break;

      const energy = goertzelEnergy(dcRemovedData, freq, sampleRate);
      // 累加時域能量值（不轉換為 dB）
      spectrum[binIndex] += energy;
    }

    spectrumCount++;
  }

  // 計算平均能量，然後轉換為 dB
  if (spectrumCount > 0) {
    for (let i = 0; i < spectrum.length; i++) {
      const avgEnergy = spectrum[i] / spectrumCount;
      // RMS 值
      const rms = Math.sqrt(avgEnergy);
      // 計算 Power Spectrum Density (PSD)：歸一化為單位頻率的功率
      // PSD = (RMS^2) / (fftSize)
      // 轉換為 dB：10 * log10(PSD)
      const psd = (rms * rms) / fftSize;
      spectrum[i] = 10 * Math.log10(Math.max(psd, 1e-16));
    }
  }

  return spectrum;
}

/**
 * 計算 Power Spectrum (使用 Goertzel 算法，與 Peak Freq 計算一致)
 */
function calculatePowerSpectrum(audioData, sampleRate, fftSize, windowType) {
  if (!audioData || audioData.length === 0) return null;

  // 應用窗口函數
  const windowed = applyWindow(audioData, windowType);

  // freqMin 和 freqMax 需要計算的頻率範圍
  const freqResolution = sampleRate / fftSize;
  const maxFreqToCompute = sampleRate / 2; // Nyquist 頻率

  // 計算頻譜 - 使用 Goertzel 算法進行逐頻率計算
  const spectrum = new Float32Array(Math.floor(maxFreqToCompute / freqResolution) + 1);

  // 預處理：移除直流分量（DC offset）
  let dcOffset = 0;
  for (let i = 0; i < windowed.length; i++) {
    dcOffset += windowed[i];
  }
  dcOffset /= windowed.length;

  const dcRemovedData = new Float32Array(windowed.length);
  for (let i = 0; i < windowed.length; i++) {
    dcRemovedData[i] = windowed[i] - dcOffset;
  }

  // 計算每個頻率點的功率 (使用 Goertzel 算法)
  for (let binIndex = 0; binIndex < spectrum.length; binIndex++) {
    const freq = binIndex * freqResolution;
    if (freq > maxFreqToCompute) break;

    const energy = goertzelEnergy(dcRemovedData, freq, sampleRate);
    // RMS 值
    const rms = Math.sqrt(energy);
    // 計算 Power Spectrum Density (PSD)
    // PSD = (RMS^2) / (fftSize)
    // 轉換為 dB：10 * log10(PSD)
    const psd = (rms * rms) / fftSize;
    spectrum[binIndex] = 10 * Math.log10(Math.max(psd, 1e-16));
  }

  return spectrum;
}

/**
 * 從 Power Spectrum 頻譜數組中找到峰值頻率 (直接對應顯示的曲線)
 */
function findPeakFrequencyFromSpectrum(spectrum, sampleRate, fftSize, flowKHz, fhighKHz) {
  if (!spectrum || spectrum.length === 0) return null;

  const freqResolution = sampleRate / fftSize;
  const minBinFreq = flowKHz * 1000;
  const maxBinFreq = fhighKHz * 1000;
  const minBin = Math.max(0, Math.floor(minBinFreq / freqResolution));
  const maxBin = Math.min(spectrum.length - 1, Math.floor(maxBinFreq / freqResolution));

  if (minBin >= maxBin) return null;

  // 在頻譜中找到最大值
  let peakBin = minBin;
  let peakDb = spectrum[minBin];

  for (let i = minBin + 1; i <= maxBin; i++) {
    if (spectrum[i] > peakDb) {
      peakDb = spectrum[i];
      peakBin = i;
    }
  }

  // 如果峰值在中間，進行拋物線插值提高精度
  if (peakBin > minBin && peakBin < maxBin) {
    const db0 = spectrum[peakBin - 1];
    const db1 = spectrum[peakBin];
    const db2 = spectrum[peakBin + 1];

    // 拋物線頂點公式
    const a = (db2 - 2 * db1 + db0) / 2;
    if (Math.abs(a) > 1e-10) {
      const binCorrection = (db0 - db2) / (4 * a);
      const refinedBin = peakBin + binCorrection;
      const peakFreqHz = refinedBin * freqResolution;
      return peakFreqHz / 1000; // 轉換為 kHz
    }
  }

  // 沒有進行插值時，直接使用 bin 位置
  const peakFreqHz = peakBin * freqResolution;
  return peakFreqHz / 1000; // 轉換為 kHz
}

/**
 * 從 Power Spectrum 中計算 Peak Frequency (應用窗口函數)
 * 備註：此函數仍保留用於 frequencyHover.js 中的 tooltip 計算
 */
function calculatePeakFrequencyFromSpectrum(audioData, sampleRate, fftSize, windowType, flowKHz, fhighKHz) {
  if (!audioData || audioData.length === 0) return null;

  // 應用相同的窗口函數和預處理
  const windowed = applyWindow(audioData, windowType);

  // 移除直流分量
  let dcOffset = 0;
  for (let i = 0; i < windowed.length; i++) {
    dcOffset += windowed[i];
  }
  dcOffset /= windowed.length;

  const dcRemovedData = new Float32Array(windowed.length);
  for (let i = 0; i < windowed.length; i++) {
    dcRemovedData[i] = windowed[i] - dcOffset;
  }

  const freqResolution = sampleRate / fftSize;
  const freqMinHz = flowKHz * 1000;
  const freqMaxHz = fhighKHz * 1000;
  const nyquistFreq = sampleRate / 2;
  const adjustedMaxHz = Math.min(freqMaxHz, nyquistFreq - 1);

  // 第一階段：粗掃
  let peakFreqCoarse = freqMinHz;
  let peakEnergyCoarse = -Infinity;
  const coarseStep = Math.max(20, (adjustedMaxHz - freqMinHz) / 30);

  for (let freq = freqMinHz; freq <= adjustedMaxHz; freq += coarseStep) {
    const energy = goertzelEnergy(dcRemovedData, freq, sampleRate);
    if (energy > peakEnergyCoarse) {
      peakEnergyCoarse = energy;
      peakFreqCoarse = freq;
    }
  }

  // 第二階段：精掃
  let peakFreqFine = peakFreqCoarse;
  let peakEnergyFine = peakEnergyCoarse;
  const fineRangeHz = coarseStep * 1.5;
  const fineStep = 1;

  const fineMinHz = Math.max(freqMinHz, peakFreqCoarse - fineRangeHz);
  const fineMaxHz = Math.min(adjustedMaxHz, peakFreqCoarse + fineRangeHz);

  for (let freq = fineMinHz; freq <= fineMaxHz; freq += fineStep) {
    const energy = goertzelEnergy(dcRemovedData, freq, sampleRate);
    if (energy > peakEnergyFine) {
      peakEnergyFine = energy;
      peakFreqFine = freq;
    }
  }

  // 第三階段：拋物線補間
  if (peakFreqFine > fineMinHz && peakFreqFine < fineMaxHz) {
    const freq0 = peakFreqFine - fineStep;
    const freq1 = peakFreqFine;
    const freq2 = peakFreqFine + fineStep;

    const energy0 = goertzelEnergy(dcRemovedData, freq0, sampleRate);
    const energy1 = peakEnergyFine;
    const energy2 = goertzelEnergy(dcRemovedData, freq2, sampleRate);

    const a = (energy2 - 2 * energy1 + energy0) / 2;
    if (Math.abs(a) > 1e-10) {
      const correction = (energy0 - energy2) / (4 * a);
      peakFreqFine += correction * fineStep;
    }
  }

  const bestFreqKHz = peakFreqFine / 1000;
  return Math.max(flowKHz, Math.min(fhighKHz, bestFreqKHz));
}

/**
 * Goertzel 算法 - 精確計算特定頻率的能量
 */
function goertzelEnergy(audioData, freq, sampleRate) {
  const w = (2 * Math.PI * freq) / sampleRate;
  const coeff = 2 * Math.cos(w);

  let s0 = 0, s1 = 0, s2 = 0;

  for (let i = 0; i < audioData.length; i++) {
    s0 = audioData[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }

  // 計算複數功率 (實部和虛部)
  const realPart = s1 - s2 * Math.cos(w);
  const imagPart = s2 * Math.sin(w);

  const energy = realPart * realPart + imagPart * imagPart;
  return energy;
}

/**
 * 應用窗口函數
 */
function applyWindow(data, windowType) {
  const n = data.length;
  const windowed = new Float32Array(n);
  let window;

  switch (windowType.toLowerCase()) {
    case 'blackman':
      window = createBlackmanWindow(n);
      break;
    case 'hamming':
      window = createHammingWindow(n);
      break;
    case 'hann':
      window = createHannWindow(n);
      break;
    case 'triangular':
      window = createTriangularWindow(n);
      break;
    case 'rectangular':
      window = createRectangularWindow(n);
      break;
    case 'gauss':
      window = createGaussWindow(n);
      break;
    default:
      window = createHannWindow(n);
  }

  for (let i = 0; i < n; i++) {
    windowed[i] = data[i] * window[i];
  }

  return windowed;
}

/**
 * 窗口函數生成器
 */
function createHannWindow(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return w;
}

function createHammingWindow(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
  }
  return w;
}

function createBlackmanWindow(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (2 * Math.PI * i) / (n - 1);
    w[i] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
  }
  return w;
}

function createTriangularWindow(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 1 - Math.abs((i - (n - 1) / 2) / ((n - 1) / 2));
  }
  return w;
}

function createRectangularWindow(n) {
  return new Float32Array(n).fill(1);
}

function createGaussWindow(n) {
  const w = new Float32Array(n);
  const sigma = (n - 1) / 4;
  for (let i = 0; i < n; i++) {
    const x = i - (n - 1) / 2;
    w[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
  }
  return w;
}

/**
 * 繪製 Power Spectrum 圖表
 */
function drawPowerSpectrum(ctx, spectrum, sampleRate, flowKHz, fhighKHz, fftSize, peakFreq) {
  if (!ctx || !spectrum) return;

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const topPadding = 40;  // 減少上方空白
  const padding = 50;
  const leftPadding = 65;  // 增加左邊 padding 以容納 Y 軸標題
  const plotWidth = width - leftPadding - padding;
  const plotHeight = height - topPadding - padding;

  // 清除背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 計算頻率解析度
  const freqResolution = sampleRate / fftSize;
  const minBinFreq = flowKHz * 1000;
  const maxBinFreq = fhighKHz * 1000;
  const minBin = Math.max(0, Math.floor(minBinFreq / freqResolution));
  const maxBin = Math.min(spectrum.length - 1, Math.floor(maxBinFreq / freqResolution));

  if (minBin >= maxBin) return;

  // 找到 dB 值範圍用於歸一化
  let minDb = Infinity, maxDb = -Infinity;
  for (let i = minBin; i <= maxBin; i++) {
    minDb = Math.min(minDb, spectrum[i]);
    maxDb = Math.max(maxDb, spectrum[i]);
  }
  
  // 調整 dB 範圍以提高視覺效果
  // 注意：由於 dB 值是負數，minDb 會是最負的值（最小），maxDb 會是最接近0的值（最大）
  const dbRange = maxDb - minDb;
  
  // 確保至少 60dB 的動態範圍，minDb 應該更小（更負）
  if (dbRange < 60) {
    minDb = maxDb - 60;
  }
  
  // 在 maxDb 上加 5dB 的間距（向更接近0的方向），防止曲線頂部被 crop 掉
  maxDb = maxDb + 5;
  
  // 重新確保 minDb < maxDb（在實數軸上）
  if (minDb >= maxDb) {
    minDb = maxDb - 60;
  }

  // 繪製坐標軸
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftPadding, topPadding);
  ctx.lineTo(leftPadding, topPadding + plotHeight);
  ctx.lineTo(leftPadding + plotWidth, topPadding + plotHeight);
  ctx.stroke();

  // 繪製頻率軸標籤 (X-axis，Unit: kHz)
  ctx.fillStyle = '#000000';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const freqSteps = 5;
  for (let i = 0; i <= freqSteps; i++) {
    const freq = flowKHz + (fhighKHz - flowKHz) * (i / freqSteps);
    const x = leftPadding + (plotWidth * i) / freqSteps;
    ctx.beginPath();
    ctx.moveTo(x, topPadding + plotHeight);
    ctx.lineTo(x, topPadding + plotHeight + 5);
    ctx.stroke();
    ctx.fillText(freq.toFixed(1), x, topPadding + plotHeight + 15);
  }

  // 繪製能量軸標籤 (Y-axis，Unit: dB)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const dbSteps = 4;
  for (let i = 0; i <= dbSteps; i++) {
    // 從上到下：maxDb（小負數或接近0） 到 minDb（大負數）
    const db = maxDb - ((maxDb - minDb) * i) / dbSteps;
    const y = topPadding + (plotHeight * i) / dbSteps;
    ctx.beginPath();
    ctx.moveTo(leftPadding - 5, y);
    ctx.lineTo(leftPadding, y);
    ctx.stroke();
    // 確保顯示負數格式
    ctx.fillText(db.toFixed(0), leftPadding - 15, y);
  }

  // 繪製軸標籤
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 12px Arial';
  ctx.fillText('Frequency (kHz)', leftPadding + plotWidth / 2, height - 20);

  ctx.save();
  ctx.translate(12, topPadding + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Energy (dB)', 0, 0);
  ctx.restore();

  // 計算 peakFreq 對應的 dB 值（使用拋物線插值）
  let peakDbValue = null;
  if (peakFreq !== null && peakFreq >= flowKHz && peakFreq <= fhighKHz) {
    // peakFreq 在 Hz 單位
    const peakFreqHz = peakFreq * 1000;
    const peakBinExact = (peakFreqHz - minBinFreq) / freqResolution + minBin;
    
    // 找到 peakBinExact 前後的整數 bin
    const peakBinFloor = Math.floor(peakBinExact);
    const peakBinCeil = Math.ceil(peakBinExact);
    const binFraction = peakBinExact - peakBinFloor;
    
    if (peakBinFloor >= minBin && peakBinCeil <= maxBin) {
      // 線性插值計算 peakFreq 位置的 dB 值
      const dbFloor = spectrum[peakBinFloor];
      const dbCeil = spectrum[peakBinCeil];
      peakDbValue = dbFloor + (dbCeil - dbFloor) * binFraction;
    }
  }

  // 繪製 Power Spectrum 曲線（使用剪裁區域防止超出邊界）
  ctx.save();
  // 設定剪裁區域，確保曲線不會超出圖表邊界
  ctx.beginPath();
  ctx.rect(leftPadding, topPadding, plotWidth, plotHeight);
  ctx.clip();

  ctx.strokeStyle = '#0066cc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  let firstPoint = true;
  let pointsToRender = [];
  
  // 收集所有 bin 點
  for (let i = minBin; i <= maxBin; i++) {
    const db = spectrum[i];
    const freqHz = i * freqResolution;
    pointsToRender.push({ bin: i, freqHz, db, isPeakPoint: false });
  }
  
  // 如果 peakFreq 不在 bin 邊界上，插入一個該位置的點以確保曲線通過 peak
  if (peakDbValue !== null && peakFreq !== null) {
    const peakFreqHz = peakFreq * 1000;
    // 找到應該插入的位置
    let insertIndex = 0;
    for (let i = 0; i < pointsToRender.length; i++) {
      if (pointsToRender[i].freqHz < peakFreqHz) {
        insertIndex = i + 1;
      } else {
        break;
      }
    }
    // 檢查是否已經非常接近一個 bin（避免重複）
    const nearbyThreshold = freqResolution * 0.1;
    let shouldInsert = true;
    if (insertIndex > 0 && Math.abs(pointsToRender[insertIndex - 1].freqHz - peakFreqHz) < nearbyThreshold) {
      shouldInsert = false;
    }
    if (insertIndex < pointsToRender.length && Math.abs(pointsToRender[insertIndex].freqHz - peakFreqHz) < nearbyThreshold) {
      shouldInsert = false;
    }
    if (shouldInsert) {
      pointsToRender.splice(insertIndex, 0, { bin: -1, freqHz: peakFreqHz, db: peakDbValue, isPeakPoint: true });
    }
  }
  
  // 繪製曲線，通過所有點
  for (let p = 0; p < pointsToRender.length; p++) {
    const point = pointsToRender[p];
    const db = point.db;
    const normalizedDb = Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)));
    
    // 計算 x 座標（基於頻率百分比）
    const freqPercent = (point.freqHz - minBinFreq) / (maxBinFreq - minBinFreq);
    const x = leftPadding + freqPercent * plotWidth;
    const y = topPadding + plotHeight - normalizedDb * plotHeight;

    if (firstPoint) {
      ctx.moveTo(x, y);
      firstPoint = false;
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
  ctx.restore();

  // 繪製網格線 (可選)
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < freqSteps; i++) {
    const x = leftPadding + (plotWidth * i) / freqSteps;
    ctx.beginPath();
    ctx.moveTo(x, topPadding);
    ctx.lineTo(x, topPadding + plotHeight);
    ctx.stroke();
  }

  for (let i = 1; i < dbSteps; i++) {
    const y = topPadding + (plotHeight * i) / dbSteps;
    ctx.beginPath();
    ctx.moveTo(leftPadding, y);
    ctx.lineTo(leftPadding + plotWidth, y);
    ctx.stroke();
  }

  // 繪製 Peak Frequency 垂直線和標籤 (使用 Power Spectrum 計算出的峰值頻率)
  if (peakFreq !== null && peakFreq >= flowKHz && peakFreq <= fhighKHz) {
    const peakNormalized = (peakFreq - flowKHz) / (fhighKHz - flowKHz);
    const peakX = leftPadding + peakNormalized * plotWidth;

    // 繪製垂直線
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(peakX, topPadding);
    ctx.lineTo(peakX, topPadding + plotHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // 繪製 Peak Frequency 標籤
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Peak: ${peakFreq.toFixed(1)} kHz`, peakX, topPadding - 20);
  }
}

// 導出窗口函數和 Goertzel 工具，供其他模組使用
export function getApplyWindowFunction() {
  return applyWindow;
}

export function getGoertzelEnergyFunction() {
  return goertzelEnergy;
}

// 導出 Power Spectrum 計算函數，供 frequencyHover.js 使用
export function calculateSpectrumWithOverlap(audioData, sampleRate, fftSize, windowType, overlap) {
  return calculatePowerSpectrumWithOverlap(audioData, sampleRate, fftSize, windowType, overlap);
}

export function findPeakFrequency(spectrum, sampleRate, fftSize, flowKHz, fhighKHz) {
  return findPeakFrequencyFromSpectrum(spectrum, sampleRate, fftSize, flowKHz, fhighKHz);
}

/**
 * 更新參數顯示面板
 */
function updateParametersDisplay(popup, batCall, peakFreqFallback = null) {
  const paramPanel = popup.querySelector('#batCallParametersPanel');
  if (!paramPanel) return;
  
  const callTypeEl = paramPanel.querySelector('.call-type');
  const peakFreqEl = paramPanel.querySelector('.peak-freq');
  const startFreqEl = paramPanel.querySelector('.start-freq');
  const endFreqEl = paramPanel.querySelector('.end-freq');
  const charFreqEl = paramPanel.querySelector('.char-freq');
  const bandwidthEl = paramPanel.querySelector('.bandwidth');
  const durationEl = paramPanel.querySelector('.duration');
  
  if (batCall) {
    callTypeEl.textContent = batCall.callType || '-';
    peakFreqEl.textContent = batCall.peakFreq_kHz?.toFixed(2) || '-';
    startFreqEl.textContent = batCall.startFreq_kHz?.toFixed(2) || '-';
    endFreqEl.textContent = batCall.endFreq_kHz?.toFixed(2) || '-';
    charFreqEl.textContent = batCall.characteristicFreq_kHz?.toFixed(2) || '-';
    bandwidthEl.textContent = batCall.bandwidth_kHz?.toFixed(2) || '-';
    durationEl.textContent = batCall.duration_ms?.toFixed(2) || '-';
  } else {
    // 只顯示 peak freq，其他為空
    callTypeEl.textContent = '-';
    peakFreqEl.textContent = peakFreqFallback?.toFixed(2) || '-';
    startFreqEl.textContent = '-';
    endFreqEl.textContent = '-';
    charFreqEl.textContent = '-';
    bandwidthEl.textContent = '-';
    durationEl.textContent = '-';
  }
}

