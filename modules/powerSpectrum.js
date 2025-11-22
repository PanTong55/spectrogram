// modules/powerSpectrum.js

/**
 * 計算並顯示選定區域的 Power Spectrum
 */
export function showPowerSpectrumPopup({
  selection,
  wavesurfer,
  currentSettings = {}
}) {
  if (!wavesurfer || !selection) return null;

  let {
    fftSize = 1024,
    windowType = 'hann',
    sampleRate = 256000,
    overlap = 'auto'
  } = currentSettings;

  // 建立 Popup Window
  const popup = createPopupWindow();
  const canvas = popup.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  
  // 獲取控制元件
  const typeSelect = popup.querySelector('#powerSpectrumWindowType');
  const fftSelect = popup.querySelector('#powerSpectrumFFTSize');
  const overlapInput = popup.querySelector('#powerSpectrumOverlap');

  // 提取選定區域的音頻數據
  let audioData = extractAudioData(wavesurfer, selection, sampleRate);
  if (!audioData) {
    console.error('Failed to extract audio data');
    popup.remove();
    return null;
  }

  // 繪製函數
  const redrawSpectrum = (newSelection) => {
    // 如果提供了新的 selection 數據，更新它並重新提取音頻
    if (newSelection) {
      Object.assign(selection, newSelection);
      audioData = extractAudioData(wavesurfer, selection, sampleRate);
      if (!audioData) {
        console.error('Failed to extract audio data after selection update');
        return;
      }
    }
    
    windowType = typeSelect.value;
    fftSize = parseInt(fftSelect.value, 10);
    
    // 獲取 overlap 值 (從控制面板)
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

  // 添加事件監聽器
  typeSelect.addEventListener('change', redrawSpectrum);
  fftSelect.addEventListener('change', redrawSpectrum);
  overlapInput.addEventListener('change', redrawSpectrum);

  // 返回 popup 對象和更新函數
  return {
    popup,
    update: redrawSpectrum,
    isOpen: () => document.body.contains(popup)
  };
}

/**
 * 建立 500x500 的 Popup Window (使用 MessageBox 樣式)
 */
function createPopupWindow() {
  const popup = document.createElement('div');
  popup.className = 'map-popup modal-popup';
  popup.style.width = '500px';
  popup.style.height = '500px';

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
  canvasContainer.style.cssText = `
    flex: 1;
    padding: 6px 16px 16px 16px;
    background: #fafafa;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;

  const canvas = document.createElement('canvas');
  canvas.width = 468;
  canvas.height = 380;
  canvas.style.cssText = `
    width: 100%;
    height: 100%;
    background: white;
    border: 1px solid #ddd;
  `;

  canvasContainer.appendChild(canvas);
  popup.appendChild(canvasContainer);

  // 建立控制面板
  const controlPanel = document.createElement('div');
  controlPanel.className = 'power-spectrum-controls';
  controlPanel.style.cssText = `
    padding: 12px 16px;
    background: #f5f5f5;
    border-top: 1px solid #ddd;
    display: flex;
    gap: 20px;
    align-items: center;
    font-size: 13px;
  `;

  // Window Type 控制
  const typeControl = document.createElement('label');
  typeControl.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  const typeLabel = document.createElement('span');
  typeLabel.textContent = 'Type:';
  typeLabel.style.fontWeight = 'normal';
  typeControl.appendChild(typeLabel);
  
  const typeSelect = document.createElement('select');
  typeSelect.id = 'powerSpectrumWindowType';
  typeSelect.style.cssText = `
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
  `;
  typeSelect.innerHTML = `
    <option value="blackman">Blackman</option>
    <option value="gauss">Gauss</option>
    <option value="hamming">Hamming</option>
    <option value="hann" selected>Hann</option>
    <option value="rectangular">Rectangular</option>
    <option value="triangular">Triangular</option>
  `;
  typeControl.appendChild(typeSelect);
  controlPanel.appendChild(typeControl);

  // FFT Size 控制
  const fftControl = document.createElement('label');
  fftControl.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  const fftLabel = document.createElement('span');
  fftLabel.textContent = 'FFT:';
  fftLabel.style.fontWeight = 'normal';
  fftControl.appendChild(fftLabel);
  
  const fftSelect = document.createElement('select');
  fftSelect.id = 'powerSpectrumFFTSize';
  fftSelect.style.cssText = `
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
  `;
  fftSelect.innerHTML = `
    <option value="1024" selected>1024</option>
    <option value="2048">2048</option>
  `;
  fftControl.appendChild(fftSelect);
  controlPanel.appendChild(fftControl);

  // Overlap 控制
  const overlapControl = document.createElement('label');
  overlapControl.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  const overlapLabel = document.createElement('span');
  overlapLabel.textContent = 'Overlap:';
  overlapLabel.style.fontWeight = 'normal';
  overlapControl.appendChild(overlapLabel);
  
  const overlapInput = document.createElement('input');
  overlapInput.id = 'powerSpectrumOverlap';
  overlapInput.type = 'number';
  overlapInput.placeholder = 'Auto';
  overlapInput.min = '1';
  overlapInput.max = '99';
  overlapInput.step = '1';
  overlapInput.style.cssText = `
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 12px;
    width: 60px;
  `;
  overlapControl.appendChild(overlapInput);
  controlPanel.appendChild(overlapControl);

  popup.appendChild(controlPanel);
  
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

    // 計算該幀的功率
    for (let binIndex = 0; binIndex < spectrum.length; binIndex++) {
      const freq = binIndex * freqResolution;
      if (freq > maxFreqToCompute) break;

      const energy = goertzelEnergy(dcRemovedData, freq, sampleRate);
      const db = 20 * Math.log10(Math.sqrt(energy) + 1e-10);
      
      if (spectrumCount === 0) {
        spectrum[binIndex] = db;
      } else {
        // 累加功率值用於後期平均
        spectrum[binIndex] += db;
      }
    }

    spectrumCount++;
  }

  // 如果有多個幀，計算平均頻譜
  if (spectrumCount > 1) {
    for (let i = 0; i < spectrum.length; i++) {
      spectrum[i] /= spectrumCount;
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
    // 轉換為 dB
    spectrum[binIndex] = 20 * Math.log10(Math.sqrt(energy) + 1e-10);
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
  const padding = 50;
  const leftPadding = 65;  // 增加左邊 padding 以容納 Y 軸標題
  const plotWidth = width - leftPadding - padding;
  const plotHeight = height - padding * 2;

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
  const dbRange = maxDb - minDb;
  minDb = maxDb - Math.max(dbRange, 60); // 至少 60dB 的動態範圍
  maxDb = Math.max(maxDb, minDb + 1);

  // 繪製坐標軸
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftPadding, padding);
  ctx.lineTo(leftPadding, padding + plotHeight);
  ctx.lineTo(leftPadding + plotWidth, padding + plotHeight);
  ctx.stroke();

  // 繪製頻率軸標籤 (X-axis，Unit: kHz)
  ctx.fillStyle = '#000000';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  const freqSteps = 5;
  for (let i = 0; i <= freqSteps; i++) {
    const freq = flowKHz + (fhighKHz - flowKHz) * (i / freqSteps);
    const x = leftPadding + (plotWidth * i) / freqSteps;
    ctx.beginPath();
    ctx.moveTo(x, padding + plotHeight);
    ctx.lineTo(x, padding + plotHeight + 5);
    ctx.stroke();
    ctx.fillText(freq.toFixed(1), x, height - 25);  // 使用固定的高度位置
  }

  // 繪製能量軸標籤 (Y-axis，Unit: dB)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const dbSteps = 4;
  for (let i = 0; i <= dbSteps; i++) {
    const db = maxDb - ((maxDb - minDb) * i) / dbSteps;
    const y = padding + (plotHeight * i) / dbSteps;
    ctx.beginPath();
    ctx.moveTo(leftPadding - 5, y);
    ctx.lineTo(leftPadding, y);
    ctx.stroke();
    ctx.fillText(db.toFixed(0), leftPadding - 15, y);
  }

  // 繪製軸標籤
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 12px Arial';
  ctx.fillText('Frequency (kHz)', leftPadding + plotWidth / 2, height - 20);

  ctx.save();
  ctx.translate(12, padding + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Energy (dB)', 0, 0);
  ctx.restore();

  // 繪製 Power Spectrum 曲線
  ctx.strokeStyle = '#0066cc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  let firstPoint = true;
  let peakYValue = -Infinity;  // 追蹤歸一化後的最高視覺點
  let peakFreqForLine = flowKHz;  // 用於紅線的頻率
  
  for (let i = minBin; i <= maxBin; i++) {
    const db = spectrum[i];
    const normalizedDb = Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)));
    const x = leftPadding + ((i - minBin) / (maxBin - minBin)) * plotWidth;
    const y = padding + plotHeight - normalizedDb * plotHeight;

    // 追蹤視覺上的最高點 (最小的y值，因為y軸反向)
    if (y < peakYValue || peakYValue === -Infinity) {
      peakYValue = y;
      peakFreqForLine = flowKHz + (fhighKHz - flowKHz) * ((i - minBin) / (maxBin - minBin));
    }

    if (firstPoint) {
      ctx.moveTo(x, y);
      firstPoint = false;
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
  
  // 使用視覺上的最高峰頻率用於紅線
  const actualPeakFreq = peakFreqForLine;

  // 繪製網格線 (可選)
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < freqSteps; i++) {
    const x = leftPadding + (plotWidth * i) / freqSteps;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, padding + plotHeight);
    ctx.stroke();
  }

  for (let i = 1; i < dbSteps; i++) {
    const y = padding + (plotHeight * i) / dbSteps;
    ctx.beginPath();
    ctx.moveTo(leftPadding, y);
    ctx.lineTo(leftPadding + plotWidth, y);
    ctx.stroke();
  }

  // 繪製 Peak Frequency 垂直線和標籤 (使用實際繪製的最高峰)
  if (actualPeakFreq !== null && actualPeakFreq >= flowKHz && actualPeakFreq <= fhighKHz) {
    const peakNormalized = (actualPeakFreq - flowKHz) / (fhighKHz - flowKHz);
    const peakX = leftPadding + peakNormalized * plotWidth;

    // 繪製垂直線
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(peakX, padding);
    ctx.lineTo(peakX, padding + plotHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // 繪製 Peak Frequency 標籤
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Peak: ${actualPeakFreq.toFixed(1)} kHz`, peakX, padding - 15);
  }
}

// 導出窗口函數和 Goertzel 工具，供其他模組使用
export function getApplyWindowFunction() {
  return applyWindow;
}

export function getGoertzelEnergyFunction() {
  return goertzelEnergy;
}
