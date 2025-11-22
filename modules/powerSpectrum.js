// modules/powerSpectrum.js

/**
 * 計算並顯示選定區域的 Power Spectrum
 */
export function showPowerSpectrumPopup({
  selection,
  wavesurfer,
  currentSettings = {}
}) {
  if (!wavesurfer || !selection) return;

  const {
    fftSize = 1024,
    windowType = 'hann',
    sampleRate = 256000,
    overlap = 'auto'
  } = currentSettings;

  // 建立 Popup Window
  const popup = createPopupWindow();
  const canvas = popup.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  // 提取選定區域的音頻數據
  const audioData = extractAudioData(wavesurfer, selection, sampleRate);
  if (!audioData) {
    console.error('Failed to extract audio data');
    popup.remove();
    return;
  }

  // 計算 Power Spectrum
  const spectrum = calculatePowerSpectrum(
    audioData,
    sampleRate,
    fftSize,
    windowType
  );

  // 繪製 Power Spectrum
  drawPowerSpectrum(
    ctx,
    spectrum,
    sampleRate,
    selection.Flow,
    selection.Fhigh,
    fftSize
  );
}

/**
 * 建立 500x500 的 Popup Window
 */
function createPopupWindow() {
  const popup = document.createElement('div');
  popup.className = 'power-spectrum-popup';
  popup.style.cssText = `
    position: fixed;
    width: 500px;
    height: 500px;
    background: white;
    border: 2px solid #333;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-family: 'Arial', sans-serif;
  `;

  // 標題欄
  const titleBar = document.createElement('div');
  titleBar.style.cssText = `
    background: #f5f5f5;
    padding: 12px 16px;
    border-bottom: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
    user-select: none;
  `;

  const title = document.createElement('span');
  title.textContent = 'Power Spectrum';
  title.style.cssText = `
    font-weight: bold;
    font-size: 14px;
    color: #333;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 30px;
    height: 30px;
    line-height: 1;
  `;
  closeBtn.addEventListener('click', () => popup.remove());

  titleBar.appendChild(title);
  titleBar.appendChild(closeBtn);

  // Canvas 容器
  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = `
    flex: 1;
    padding: 16px;
    background: #fafafa;
    overflow: hidden;
  `;

  const canvas = document.createElement('canvas');
  canvas.width = 468;
  canvas.height = 420;
  canvas.style.cssText = `
    width: 100%;
    height: 100%;
    background: white;
    border: 1px solid #ddd;
  `;

  canvasContainer.appendChild(canvas);

  popup.appendChild(titleBar);
  popup.appendChild(canvasContainer);
  document.body.appendChild(popup);

  // 拖動功能
  makeDraggable(popup, titleBar);

  return popup;
}

/**
 * 使 popup 可拖動
 */
function makeDraggable(popup, titleBar) {
  let offsetX = 0, offsetY = 0, isDragging = false;

  titleBar.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - popup.offsetLeft;
    offsetY = e.clientY - popup.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    popup.style.left = `${e.clientX - offsetX}px`;
    popup.style.top = `${e.clientY - offsetY}px`;
    popup.style.transform = 'none';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
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
function drawPowerSpectrum(ctx, spectrum, sampleRate, flowKHz, fhighKHz, fftSize) {
  if (!ctx || !spectrum) return;

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const padding = 50;
  const plotWidth = width - padding * 2;
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
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, padding + plotHeight);
  ctx.lineTo(padding + plotWidth, padding + plotHeight);
  ctx.stroke();

  // 繪製頻率軸標籤 (X-axis，Unit: kHz)
  ctx.fillStyle = '#000000';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  const freqSteps = 5;
  for (let i = 0; i <= freqSteps; i++) {
    const freq = flowKHz + (fhighKHz - flowKHz) * (i / freqSteps);
    const x = padding + (plotWidth * i) / freqSteps;
    ctx.beginPath();
    ctx.moveTo(x, padding + plotHeight);
    ctx.lineTo(x, padding + plotHeight + 5);
    ctx.stroke();
    ctx.fillText(freq.toFixed(1), x, padding + plotHeight + 20);
  }

  // 繪製能量軸標籤 (Y-axis，Unit: dB)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const dbSteps = 4;
  for (let i = 0; i <= dbSteps; i++) {
    const db = maxDb - ((maxDb - minDb) * i) / dbSteps;
    const y = padding + (plotHeight * i) / dbSteps;
    ctx.beginPath();
    ctx.moveTo(padding - 5, y);
    ctx.lineTo(padding, y);
    ctx.stroke();
    ctx.fillText(db.toFixed(0), padding - 15, y);
  }

  // 繪製軸標籤
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 12px Arial';
  ctx.fillText('Frequency (kHz)', padding + plotWidth / 2, height - 10);

  ctx.save();
  ctx.translate(15, padding + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Energy (dB)', 0, 0);
  ctx.restore();

  // 繪製 Power Spectrum 曲線
  ctx.strokeStyle = '#0066cc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  let firstPoint = true;
  for (let i = minBin; i <= maxBin; i++) {
    const db = spectrum[i];
    const normalizedDb = Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)));
    const x = padding + ((i - minBin) / (maxBin - minBin)) * plotWidth;
    const y = padding + plotHeight - normalizedDb * plotHeight;

    if (firstPoint) {
      ctx.moveTo(x, y);
      firstPoint = false;
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  // 繪製網格線 (可選)
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < freqSteps; i++) {
    const x = padding + (plotWidth * i) / freqSteps;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, padding + plotHeight);
    ctx.stroke();
  }

  for (let i = 1; i < dbSteps; i++) {
    const y = padding + (plotHeight * i) / dbSteps;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(padding + plotWidth, y);
    ctx.stroke();
  }
}
