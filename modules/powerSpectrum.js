// modules/powerSpectrum.js
// Power Spectrum 繪製、計算和互動模塊
// 提供 Power Spectrum 的計算、繪製和用戶交互功能

/**
 * 尋找最優的 overlap 值
 * Auto mode 時直接返回 75%
 * @param {Float32Array} audioData - 音頻數據
 * @param {number} sampleRate - 採樣率
 * @param {number} fftSize - FFT 大小
 * @param {string} windowType - 窗口類型
 * @returns {number} 最優的 overlap 百分比 (固定 75%)
 */
export function findOptimalOverlap(audioData, sampleRate, fftSize, windowType) {
  // Auto mode 時直接使用 75% overlap
  return 75;
}

/**
 * 計算 Power Spectrum (使用 Goertzel 算法，考慮 Overlap)
 */
export function calculatePowerSpectrumWithOverlap(audioData, sampleRate, fftSize, windowType, overlap = 'auto') {
  if (!audioData || audioData.length === 0) return null;

  // 如果音頻短於 FFT 大小，直接計算單幀
  if (audioData.length < fftSize) {
    return calculatePowerSpectrum(audioData, sampleRate, fftSize, windowType);
  }

  // 確定 hop size (每幀之間的步長)
  let hopSize;
  if (overlap === 'auto' || overlap === '') {
    // Auto mode：使用 75% overlap
    hopSize = Math.floor(fftSize * (1 - 0.75));
  } else {
    const overlapPercent = parseInt(overlap, 10);
    if (isNaN(overlapPercent) || overlapPercent < 0 || overlapPercent > 99) {
      // 預設 75% overlap
      hopSize = Math.floor(fftSize * (1 - 0.75));
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
export function calculatePowerSpectrum(audioData, sampleRate, fftSize, windowType) {
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
export function findPeakFrequencyFromSpectrum(spectrum, sampleRate, fftSize, flowKHz, fhighKHz) {
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
 * 繪製 Power Spectrum 圖表 (SVG 版本 - 2025 優化)
 * 使用 SVG 而非 Canvas，支持動態更新和 CSS 樣式
 */
export function drawPowerSpectrumSVG(svg, spectrum, sampleRate, flowKHz, fhighKHz, fftSize, peakFreq) {
  if (!svg || !spectrum) return;

  // 清空 SVG（移除舊的圖表元素，但保留定義）
  const existingGroups = svg.querySelectorAll('g.spectrum-chart');
  existingGroups.forEach(g => g.remove());

  const width = 438;
  const height = 438;
  const topPadding = 30;
  const padding = 45;
  const leftPadding = 60;
  const plotWidth = width - leftPadding - padding;
  const plotHeight = height - topPadding - padding;

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
  
  const dbRange = maxDb - minDb;
  if (dbRange < 60) {
    minDb = maxDb - 60;
  }
  maxDb = maxDb + 5;
  if (minDb >= maxDb) {
    minDb = maxDb - 60;
  }

  // 建立主圖表組
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('class', 'spectrum-chart');

  // ============================================================
  // 繪製背景
  // ============================================================
  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('width', width);
  background.setAttribute('height', height);
  background.setAttribute('fill', '#ffffff');
  chartGroup.appendChild(background);

  // ============================================================
  // 繪製網格線
  // ============================================================
  const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gridGroup.setAttribute('class', 'spectrum-grid');
  gridGroup.setAttribute('stroke', '#e0e0e0');
  gridGroup.setAttribute('stroke-width', '0.5');

  const freqSteps = 5;
  for (let i = 1; i < freqSteps; i++) {
    const x = leftPadding + (plotWidth * i) / freqSteps;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', topPadding);
    line.setAttribute('x2', x);
    line.setAttribute('y2', topPadding + plotHeight);
    gridGroup.appendChild(line);
  }

  const dbSteps = 4;
  for (let i = 1; i < dbSteps; i++) {
    const y = topPadding + (plotHeight * i) / dbSteps;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', leftPadding);
    line.setAttribute('y1', y);
    line.setAttribute('x2', leftPadding + plotWidth);
    line.setAttribute('y2', y);
    gridGroup.appendChild(line);
  }

  chartGroup.appendChild(gridGroup);

  // ============================================================
  // 繪製坐標軸
  // ============================================================
  const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  axisGroup.setAttribute('class', 'spectrum-axes');
  axisGroup.setAttribute('stroke', '#000000');
  axisGroup.setAttribute('stroke-width', '2');

  // Y 軸
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', leftPadding);
  yAxis.setAttribute('y1', topPadding);
  yAxis.setAttribute('x2', leftPadding);
  yAxis.setAttribute('y2', topPadding + plotHeight);
  axisGroup.appendChild(yAxis);

  // X 軸
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', leftPadding);
  xAxis.setAttribute('y1', topPadding + plotHeight);
  xAxis.setAttribute('x2', leftPadding + plotWidth);
  xAxis.setAttribute('y2', topPadding + plotHeight);
  axisGroup.appendChild(xAxis);

  chartGroup.appendChild(axisGroup);

  // ============================================================
  // 繪製坐標軸刻度和標籤
  // ============================================================
  const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  labelsGroup.setAttribute('class', 'spectrum-labels');
  labelsGroup.setAttribute('fill', '#000000');
  labelsGroup.setAttribute('font-family', 'Arial');
  labelsGroup.setAttribute('font-size', '12');

  // X 軸標籤（頻率）
  for (let i = 0; i <= freqSteps; i++) {
    const freq = flowKHz + (fhighKHz - flowKHz) * (i / freqSteps);
    const x = leftPadding + (plotWidth * i) / freqSteps;
    
    // 刻度線
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', x);
    tick.setAttribute('y1', topPadding + plotHeight);
    tick.setAttribute('x2', x);
    tick.setAttribute('y2', topPadding + plotHeight + 5);
    tick.setAttribute('stroke', '#000000');
    tick.setAttribute('stroke-width', '1');
    labelsGroup.appendChild(tick);

    // 標籤文字
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', topPadding + plotHeight + 25);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = freq.toFixed(1);
    labelsGroup.appendChild(text);
  }

  // Y 軸標籤（能量 dB）
  for (let i = 0; i <= dbSteps; i++) {
    const db = maxDb - ((maxDb - minDb) * i) / dbSteps;
    const y = topPadding + (plotHeight * i) / dbSteps;

    // 刻度線
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', leftPadding - 5);
    tick.setAttribute('y1', y);
    tick.setAttribute('x2', leftPadding);
    tick.setAttribute('y2', y);
    tick.setAttribute('stroke', '#000000');
    tick.setAttribute('stroke-width', '1');
    labelsGroup.appendChild(tick);

    // 標籤文字
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', leftPadding - 10);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', 'end');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = db.toFixed(0);
    labelsGroup.appendChild(text);
  }

  // X 軸標籤
  const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  xLabel.setAttribute('x', leftPadding + plotWidth / 2);
  xLabel.setAttribute('y', height + 7);
  xLabel.setAttribute('text-anchor', 'middle');
  xLabel.setAttribute('font-weight', 'bold');
  xLabel.setAttribute('font-family', "'Noto Sans HK'", 'sans-serif');
  xLabel.textContent = 'Frequency (kHz)';
  labelsGroup.appendChild(xLabel);

  // Y 軸標籤（旋轉）
  const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yLabel.setAttribute('x', '17');
  yLabel.setAttribute('y', topPadding + plotHeight / 2);
  yLabel.setAttribute('text-anchor', 'middle');
  yLabel.setAttribute('font-weight', 'bold');
  yLabel.setAttribute('font-family', "'Noto Sans HK'", 'sans-serif');
  yLabel.setAttribute('transform', `rotate(-90 17 ${topPadding + plotHeight / 2})`);
  yLabel.textContent = 'Energy (dB)';
  labelsGroup.appendChild(yLabel);

  chartGroup.appendChild(labelsGroup);

  // ============================================================
  // 繪製 Power Spectrum 曲線
  // ============================================================
  
  // 計算 peakFreq 對應的 dB 值
  let peakDbValue = null;
  if (peakFreq !== null && peakFreq >= flowKHz && peakFreq <= fhighKHz) {
    const peakFreqHz = peakFreq * 1000;
    const peakBinExact = (peakFreqHz - minBinFreq) / freqResolution + minBin;
    
    const peakBinFloor = Math.floor(peakBinExact);
    const peakBinCeil = Math.ceil(peakBinExact);
    const binFraction = peakBinExact - peakBinFloor;
    
    if (peakBinFloor >= minBin && peakBinCeil <= maxBin) {
      const dbFloor = spectrum[peakBinFloor];
      const dbCeil = spectrum[peakBinCeil];
      peakDbValue = dbFloor + (dbCeil - dbFloor) * binFraction;
    }
  }

  // 收集所有點進行繪製
  let pointsToRender = [];
  for (let i = minBin; i <= maxBin; i++) {
    const db = spectrum[i];
    const freqHz = i * freqResolution;
    pointsToRender.push({ bin: i, freqHz, db, isPeakPoint: false });
  }

  // 如果 peakFreq 不在 bin 邊界上，插入一個該位置的點
  if (peakDbValue !== null && peakFreq !== null) {
    const peakFreqHz = peakFreq * 1000;
    let insertIndex = 0;
    for (let i = 0; i < pointsToRender.length; i++) {
      if (pointsToRender[i].freqHz < peakFreqHz) {
        insertIndex = i + 1;
      } else {
        break;
      }
    }

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

  // 建立 SVG 路徑數據
  let pathData = '';
  for (let p = 0; p < pointsToRender.length; p++) {
    const point = pointsToRender[p];
    const db = point.db;
    const normalizedDb = Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)));
    
    const freqPercent = (point.freqHz - minBinFreq) / (maxBinFreq - minBinFreq);
    const x = leftPadding + freqPercent * plotWidth;
    const y = topPadding + plotHeight - normalizedDb * plotHeight;

    if (p === 0) {
      pathData += `M ${x} ${y}`;
    } else {
      pathData += ` L ${x} ${y}`;
    }
  }

  // 繪製曲線
  const curve = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  curve.setAttribute('d', pathData);
  curve.setAttribute('fill', 'none');
  curve.setAttribute('stroke', '#0066cc');
  curve.setAttribute('stroke-width', '1.5');
  curve.setAttribute('stroke-linecap', 'round');
  curve.setAttribute('stroke-linejoin', 'round');
  curve.setAttribute('class', 'spectrum-curve');

  // 添加剪裁路徑防止超出邊界
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  clipPath.setAttribute('id', 'spectrum-clip-path');
  const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  clipRect.setAttribute('x', leftPadding);
  clipRect.setAttribute('y', topPadding);
  clipRect.setAttribute('width', plotWidth);
  clipRect.setAttribute('height', plotHeight);
  clipPath.appendChild(clipRect);
  defs.appendChild(clipPath);
  svg.appendChild(defs);

  curve.setAttribute('clip-path', 'url(#spectrum-clip-path)');

  const curveGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  curveGroup.setAttribute('class', 'spectrum-curve-group');
  curveGroup.appendChild(curve);
  chartGroup.appendChild(curveGroup);

  // ============================================================
  // 添加交互層 - 透明的點用於滑鼠懸停交互
  // ============================================================
  const interactiveGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  interactiveGroup.setAttribute('class', 'spectrum-interactive');
  
  // 儲存所有交互點的資訊用於查詢
  const interactivePoints = [];
  
  // 為每個數據點創建透明的交互點
  for (let p = 0; p < pointsToRender.length; p++) {
    const point = pointsToRender[p];
    const db = point.db;
    const normalizedDb = Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)));
    
    const freqPercent = (point.freqHz - minBinFreq) / (maxBinFreq - minBinFreq);
    const x = leftPadding + freqPercent * plotWidth;
    const y = topPadding + plotHeight - normalizedDb * plotHeight;

    // 創建透明圓點用於交互（半徑 6px）
    const interactivePoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    interactivePoint.setAttribute('cx', x);
    interactivePoint.setAttribute('cy', y);
    interactivePoint.setAttribute('r', '6');
    interactivePoint.setAttribute('fill', 'transparent');
    interactivePoint.setAttribute('stroke', 'none');
    interactivePoint.setAttribute('class', 'spectrum-interactive-point');
    
    // 儲存點的資訊
    const pointData = {
      freqHz: point.freqHz,
      freqKHz: point.freqHz / 1000,
      db: db,
      x: x,
      y: y,
      element: interactivePoint
    };
    interactivePoints.push(pointData);
    
    interactiveGroup.appendChild(interactivePoint);
  }
  
  chartGroup.appendChild(interactiveGroup);

  // ============================================================
  // 添加輔助線和提示框層
  // ============================================================
  const helperGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  helperGroup.setAttribute('class', 'spectrum-helper-lines');
  chartGroup.appendChild(helperGroup);

  // 添加 SVG 背景層用於捕捉滑鼠事件
  const interactiveBackground = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  interactiveBackground.setAttribute('x', leftPadding);
  interactiveBackground.setAttribute('y', topPadding);
  interactiveBackground.setAttribute('width', plotWidth);
  interactiveBackground.setAttribute('height', plotHeight);
  interactiveBackground.setAttribute('fill', 'transparent');
  interactiveBackground.setAttribute('stroke', 'none');
  interactiveBackground.setAttribute('class', 'spectrum-interactive-bg');
  chartGroup.appendChild(interactiveBackground);

  svg.appendChild(chartGroup);

  // ============================================================
  // 設置基於 X 座標的自動檢測交互 (支持鎖定功能)
  // ============================================================
  
  // 狀態管理：鎖定點的資訊
  let lockedPoint = null;
  let isLocked = false;
  
  // 添加整個 SVG 容器的滑鼠移動監聽
  svg.addEventListener('mousemove', (event) => {
    // 如果已鎖定，跳過自動檢測交互
    if (isLocked) return;
    // 獲取滑鼠在 SVG 中的位置
    const rect = svg.getBoundingClientRect();
    const svgX = event.clientX - rect.left;
    const svgY = event.clientY - rect.top;
    
    // 檢查滑鼠是否在圖表區域內
    if (svgX < leftPadding || svgX > leftPadding + plotWidth || 
        svgY < topPadding || svgY > topPadding + plotHeight) {
      // 滑鼠不在圖表區域，清空
      while (helperGroup.firstChild) {
        helperGroup.removeChild(helperGroup.firstChild);
      }
      return;
    }
    
    // 根據 X 座標找到最接近的交互點
    let closestPoint = null;
    let minDistance = Infinity;
    
    for (const point of interactivePoints) {
      const distance = Math.abs(point.x - svgX);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }
    
    // 如果找到了接近的點，繪製輔助線和提示框
    if (closestPoint && minDistance < 15) {  // 檢測範圍 15px
      // 清空舊的輔助線
      while (helperGroup.firstChild) {
        helperGroup.removeChild(helperGroup.firstChild);
      }
      
      // 繪製垂直線（連接到 X 軸）
      const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      vLine.setAttribute('x1', closestPoint.x);
      vLine.setAttribute('y1', closestPoint.y);
      vLine.setAttribute('x2', closestPoint.x);
      vLine.setAttribute('y2', topPadding + plotHeight);
      vLine.setAttribute('stroke', '#999999');
      vLine.setAttribute('stroke-width', '1');
      vLine.setAttribute('stroke-dasharray', '3,3');
      vLine.setAttribute('class', 'spectrum-guide-line');
      helperGroup.appendChild(vLine);
      
      // 繪製水平線（連接到 Y 軸）
      const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hLine.setAttribute('x1', leftPadding);
      hLine.setAttribute('y1', closestPoint.y);
      hLine.setAttribute('x2', closestPoint.x);
      hLine.setAttribute('y2', closestPoint.y);
      hLine.setAttribute('stroke', '#999999');
      hLine.setAttribute('stroke-width', '1');
      hLine.setAttribute('stroke-dasharray', '3,3');
      hLine.setAttribute('class', 'spectrum-guide-line');
      helperGroup.appendChild(hLine);
      
      // 繪製交互點圓形（透明圓點）
      const interactiveCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      interactiveCircle.setAttribute('cx', closestPoint.x);
      interactiveCircle.setAttribute('cy', closestPoint.y);
      interactiveCircle.setAttribute('r', '4');
      // 根據鎖定狀態設置顏色
      if (isLocked) {
        interactiveCircle.setAttribute('fill', 'rgba(255, 0, 0, 0.3)');
        interactiveCircle.setAttribute('stroke', '#ff0000');
      } else {
        interactiveCircle.setAttribute('fill', 'rgba(0, 102, 204, 0.3)');
        interactiveCircle.setAttribute('stroke', '#0066cc');
      }
      interactiveCircle.setAttribute('stroke-width', '1');
      interactiveCircle.setAttribute('class', 'spectrum-highlight-point');
      helperGroup.appendChild(interactiveCircle);
      
      // 創建提示框文字（頻率）- 放在懸停點正上方 15px
      const tooltipFreq = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tooltipFreq.setAttribute('x', closestPoint.x);
      tooltipFreq.setAttribute('y', closestPoint.y - 25);
      tooltipFreq.setAttribute('text-anchor', 'middle');
      tooltipFreq.setAttribute('dominant-baseline', 'middle');
      tooltipFreq.setAttribute('font-family', "'Noto Sans HK'", 'sans-serif');
      tooltipFreq.setAttribute('font-size', '12');
      tooltipFreq.setAttribute('font-weight', 'bold');
      tooltipFreq.setAttribute('fill', '#000000');
      tooltipFreq.setAttribute('class', 'spectrum-tooltip-text-freq');
      tooltipFreq.textContent = closestPoint.freqKHz.toFixed(2) + ' kHz';
      helperGroup.appendChild(tooltipFreq);
      
      // 創建提示框文字（dB）
      const tooltipDb = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tooltipDb.setAttribute('x', closestPoint.x);
      tooltipDb.setAttribute('y', closestPoint.y - 10);
      tooltipDb.setAttribute('text-anchor', 'middle');
      tooltipDb.setAttribute('dominant-baseline', 'middle');
      tooltipDb.setAttribute('font-family', "'Noto Sans HK'", 'sans-serif');
      tooltipDb.setAttribute('font-size', '12');
      tooltipDb.setAttribute('font-weight', 'bold');
      tooltipDb.setAttribute('fill', '#0066cc');
      tooltipDb.setAttribute('class', 'spectrum-tooltip-text-db');
      tooltipDb.textContent = closestPoint.db.toFixed(1) + ' dB';
      helperGroup.appendChild(tooltipDb);
    } else {
      // 沒有接近的點，清空顯示
      while (helperGroup.firstChild) {
        helperGroup.removeChild(helperGroup.firstChild);
      }
    }
  });
  
  // 滑鼠離開 SVG 時清空
  svg.addEventListener('mouseleave', () => {
    // 如果未鎖定，則清空顯示；如果已鎖定，保持顯示
    if (!isLocked) {
      while (helperGroup.firstChild) {
        helperGroup.removeChild(helperGroup.firstChild);
      }
    }
  });

  // ============================================================
  // 添加左鍵點擊事件監聽 - 用於鎖定/解除鎖定
  // ============================================================
  svg.addEventListener('click', (event) => {
    const rect = svg.getBoundingClientRect();
    const svgX = event.clientX - rect.left;
    const svgY = event.clientY - rect.top;
    
    // 檢查滑鼠是否在圖表區域內
    if (svgX < leftPadding || svgX > leftPadding + plotWidth || 
        svgY < topPadding || svgY > topPadding + plotHeight) {
      // 滑鼠不在圖表區域，如果已鎖定則解除鎖定
      if (isLocked) {
        isLocked = false;
        lockedPoint = null;
        while (helperGroup.firstChild) {
          helperGroup.removeChild(helperGroup.firstChild);
        }
      }
      return;
    }
    
    if (!isLocked) {
      // 當前未鎖定，尋找最接近的點進行鎖定
      let closestPoint = null;
      let minDistance = Infinity;
      
      for (const point of interactivePoints) {
        const distance = Math.abs(point.x - svgX);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = point;
        }
      }
      
      // 如果找到了接近的點，進行鎖定
      if (closestPoint && minDistance < 15) {
        isLocked = true;
        lockedPoint = closestPoint;
        
        // 清空舊的輔助線
        while (helperGroup.firstChild) {
          helperGroup.removeChild(helperGroup.firstChild);
        }
        
        // 繪製垂直線（連接到 X 軸）
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', closestPoint.x);
        vLine.setAttribute('y1', closestPoint.y);
        vLine.setAttribute('x2', closestPoint.x);
        vLine.setAttribute('y2', topPadding + plotHeight);
        vLine.setAttribute('stroke', '#999999');
        vLine.setAttribute('stroke-width', '1');
        vLine.setAttribute('stroke-dasharray', '3,3');
        vLine.setAttribute('class', 'spectrum-guide-line');
        helperGroup.appendChild(vLine);
        
        // 繪製水平線（連接到 Y 軸）
        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', leftPadding);
        hLine.setAttribute('y1', closestPoint.y);
        hLine.setAttribute('x2', closestPoint.x);
        hLine.setAttribute('y2', closestPoint.y);
        hLine.setAttribute('stroke', '#999999');
        hLine.setAttribute('stroke-width', '1');
        hLine.setAttribute('stroke-dasharray', '3,3');
        hLine.setAttribute('class', 'spectrum-guide-line');
        helperGroup.appendChild(hLine);
        
        // 繪製交互點圓形（透明圓點） - 紅色
        const interactiveCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        interactiveCircle.setAttribute('cx', closestPoint.x);
        interactiveCircle.setAttribute('cy', closestPoint.y);
        interactiveCircle.setAttribute('r', '4');
        interactiveCircle.setAttribute('fill', 'rgba(255, 0, 0, 0.3)');
        interactiveCircle.setAttribute('stroke', '#ff0000');
        interactiveCircle.setAttribute('stroke-width', '1');
        interactiveCircle.setAttribute('class', 'spectrum-highlight-point');
        helperGroup.appendChild(interactiveCircle);
        
        // 創建提示框文字（頻率）- 放在懸停點正上方 15px
        const tooltipFreq = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tooltipFreq.setAttribute('x', closestPoint.x);
        tooltipFreq.setAttribute('y', closestPoint.y - 25);
        tooltipFreq.setAttribute('text-anchor', 'middle');
        tooltipFreq.setAttribute('dominant-baseline', 'middle');
        tooltipFreq.setAttribute('font-family', "'Noto Sans HK'", 'sans-serif');
        tooltipFreq.setAttribute('font-size', '12');
        tooltipFreq.setAttribute('font-weight', 'bold');
        tooltipFreq.setAttribute('fill', '#000000');
        tooltipFreq.setAttribute('class', 'spectrum-tooltip-text-freq');
        tooltipFreq.textContent = closestPoint.freqKHz.toFixed(2) + ' kHz';
        helperGroup.appendChild(tooltipFreq);
        
        // 創建提示框文字（dB）
        const tooltipDb = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tooltipDb.setAttribute('x', closestPoint.x);
        tooltipDb.setAttribute('y', closestPoint.y - 10);
        tooltipDb.setAttribute('text-anchor', 'middle');
        tooltipDb.setAttribute('dominant-baseline', 'middle');
        tooltipDb.setAttribute('font-family', "'Noto Sans HK'", 'sans-serif');
        tooltipDb.setAttribute('font-size', '12');
        tooltipDb.setAttribute('font-weight', 'bold');
        tooltipDb.setAttribute('fill', '#0066cc');
        tooltipDb.setAttribute('class', 'spectrum-tooltip-text-db');
        tooltipDb.textContent = closestPoint.db.toFixed(1) + ' dB';
        helperGroup.appendChild(tooltipDb);
      }
    } else {
      // 當前已鎖定，解除鎖定
      isLocked = false;
      lockedPoint = null;
      while (helperGroup.firstChild) {
        helperGroup.removeChild(helperGroup.firstChild);
      }
    }
  });
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

// 導出輔助函數供其他模塊使用
export function getApplyWindowFunction() {
  return applyWindow;
}

export function getGoertzelEnergyFunction() {
  return goertzelEnergy;
}

