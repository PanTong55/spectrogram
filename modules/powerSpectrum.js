// modules/powerSpectrum.js
// Power Spectrum 繪製、計算和互動模塊
// 提供 Power Spectrum 的計算、繪製和用戶交互功能
// 2025 優化：計算邏輯已遷移至 Rust/WASM，此模塊專注於繪製和交互

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
 * 計算 Power Spectrum (使用 WASM FFT，考慮 Overlap)
 * 2025: 完全由 Rust/WASM 實現，JavaScript 僅作為包裝器
 */
export function calculatePowerSpectrumWithOverlap(audioData, sampleRate, fftSize, windowType, overlap = 'auto') {
  if (!audioData || audioData.length === 0) {
    console.warn('[powerSpectrum] calculatePowerSpectrumWithOverlap - No audio data provided');
    return null;
  }

  // 確保 WASM 已加載
  if (!globalThis._spectrogramWasm || !globalThis._spectrogramWasm.compute_power_spectrum) {
    console.error('[powerSpectrum] ❌ WASM module not loaded. Cannot compute power spectrum.');
    console.warn('[powerSpectrum] globalThis._spectrogramWasm:', globalThis._spectrogramWasm);
    return null;
  }

  // 將 overlap 參數轉換為 0-100 的百分比，或 null 表示 auto (75%)
  let overlapPercent = null;
  if (overlap === 'auto' || overlap === '' || overlap === null || overlap === undefined) {
    overlapPercent = 75; // WASM 中的 auto 模式
  } else {
    const parsed = parseInt(overlap, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 99) {
      overlapPercent = parsed;
    } else {
      // 預設 75% overlap
      overlapPercent = 75;
    }
  }

  const startTime = performance.now();
  
  console.log('[powerSpectrum] 📊 Computing Power Spectrum with WASM FFT:');
  console.log(`  Audio samples: ${audioData.length}`);
  console.log(`  Sample rate: ${sampleRate} Hz`);
  console.log(`  FFT size: ${fftSize}`);
  console.log(`  Window type: ${windowType.toLowerCase()}`);
  console.log(`  Overlap: ${overlapPercent}%`);

  try {
    // 調用 WASM 函數計算 Power Spectrum
    const spectrum = globalThis._spectrogramWasm.compute_power_spectrum(
      audioData,
      sampleRate,
      fftSize,
      windowType.toLowerCase(),
      overlapPercent
    );

    const computeTime = (performance.now() - startTime).toFixed(2);
    
    if (spectrum && spectrum.length > 0) {
      const spectrumArray = new Float32Array(spectrum);
      const minDb = Math.min(...spectrumArray).toFixed(2);
      const maxDb = Math.max(...spectrumArray).toFixed(2);
      const meanDb = (spectrumArray.reduce((a, b) => a + b, 0) / spectrumArray.length).toFixed(2);
      
      console.log(`✅ Power Spectrum computed successfully (${computeTime}ms):`);
      console.log(`  Spectrum bins: ${spectrumArray.length}`);
      console.log(`  dB range: ${minDb} to ${maxDb} dB`);
      console.log(`  Mean dB: ${meanDb}`);
      
      return spectrumArray;
    } else {
      console.warn('[powerSpectrum] ⚠️  Empty spectrum returned from WASM');
      return null;
    }
  } catch (err) {
    const computeTime = (performance.now() - startTime).toFixed(2);
    console.error(`[powerSpectrum] ❌ Error computing spectrum via WASM (${computeTime}ms):`, err);
    console.error('[powerSpectrum] Stack trace:', err.stack);
    return null;
  }
}

/**
 * 計算 Power Spectrum (單幀，不使用 Overlap)
 * 2025: 已遷移至 WASM
 */
export function calculatePowerSpectrum(audioData, sampleRate, fftSize, windowType) {
  if (!audioData || audioData.length === 0) {
    console.warn('[powerSpectrum] calculatePowerSpectrum - No audio data provided');
    return null;
  }

  console.log('[powerSpectrum] 📊 Computing single-frame Power Spectrum (no overlap)');
  // 使用 WASM 版本，設 overlap = 0 表示單幀
  return calculatePowerSpectrumWithOverlap(audioData, sampleRate, fftSize, windowType, 0);
}

/**
 * 從 Power Spectrum 頻譜數組中找到峰值頻率 (直接對應顯示的曲線)
 * 2025: 已遷移至 WASM 實現拋物線插值
 */
export function findPeakFrequencyFromSpectrum(spectrum, sampleRate, fftSize, flowKHz, fhighKHz) {
  if (!spectrum || spectrum.length === 0) {
    console.warn('[powerSpectrum] findPeakFrequencyFromSpectrum - No spectrum data provided');
    return null;
  }

  // 確保 WASM 已加載
  if (!globalThis._spectrogramWasm || !globalThis._spectrogramWasm.find_peak_frequency_from_spectrum) {
    console.error('[powerSpectrum] ❌ WASM module not loaded. Cannot find peak frequency.');
    console.warn('[powerSpectrum] globalThis._spectrogramWasm:', globalThis._spectrogramWasm);
    return null;
  }

  const startTime = performance.now();
  
  console.log('[powerSpectrum] 🔍 Finding peak frequency from spectrum:');
  console.log(`  Spectrum bins: ${spectrum.length}`);
  console.log(`  Frequency range: ${flowKHz.toFixed(2)} - ${fhighKHz.toFixed(2)} kHz`);
  console.log(`  Sample rate: ${sampleRate} Hz`);
  console.log(`  FFT size: ${fftSize}`);

  try {
    const flowHz = flowKHz * 1000;
    const fhighHz = fhighKHz * 1000;

    // 調用 WASM 函數找峰值
    const peakFreqHz = globalThis._spectrogramWasm.find_peak_frequency_from_spectrum(
      spectrum,
      sampleRate,
      fftSize,
      flowHz,
      fhighHz
    );

    const searchTime = (performance.now() - startTime).toFixed(2);
    
    if (peakFreqHz > 0) {
      const peakFreqKHz = peakFreqHz / 1000;
      console.log(`✅ Peak frequency found (${searchTime}ms): ${peakFreqKHz.toFixed(3)} kHz`);
      return peakFreqKHz;
    } else {
      console.warn(`[powerSpectrum] ⚠️  No peak frequency found in range [${flowKHz.toFixed(2)}, ${fhighKHz.toFixed(2)}] kHz`);
      return null;
    }
  } catch (err) {
    const searchTime = (performance.now() - startTime).toFixed(2);
    console.error(`[powerSpectrum] ❌ Error finding peak frequency via WASM (${searchTime}ms):`, err);
    console.error('[powerSpectrum] Stack trace:', err.stack);
    return null;
  }
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

// ============================================================
// 2025 優化：以下計算函數已遷移至 Rust/WASM
// ============================================================

// 導出輔助函數供其他模塊使用（現在只作為空保留，以防舊代碼直接調用）
export function getApplyWindowFunction() {
  console.warn('[powerSpectrum] getApplyWindowFunction() is deprecated. Window application is now done in WASM.');
  return null;
}

export function getGoertzelEnergyFunction() {
  console.warn('[powerSpectrum] getGoertzelEnergyFunction() is deprecated. Energy calculation is now done in WASM.');
  return null;
}


