// modules/powerSpectrum.js

import { initDropdown } from './dropdown.js';
import { BatCallDetector } from './batCallDetector.js';

/**
 * 全局存儲 bat-call-controls 的配置值
 * 用於在新窗口中記憶之前設置的參數
 * 
 * 2025 Anti-Rebounce Parameters:
 * - enableBackwardEndFreqScan: 從後往前掃描 -24 dB 輪廓
 * - maxFrequencyDropThreshold_kHz: 最大頻率下降規則（鎖定）
 * - protectionWindowAfterPeak_ms: 峰值後的保護窗（10 ms）
 */
window.__batCallControlsMemory = window.__batCallControlsMemory || {
  callThreshold_dB: -24,
  highFreqThreshold_dB: -24,  // Threshold for calculating High Frequency (optimal value range: -24 to -70)
  highFreqThreshold_dB_isAuto: true,  // Auto mode for High Frequency threshold detection
  characteristicFreq_percentEnd: 20,
  minCallDuration_ms: 2,
  fftSize: '1024',
  hopPercent: 3.125,
  // 2025 Anti-Rebounce
  enableBackwardEndFreqScan: true,
  maxFrequencyDropThreshold_kHz: 10,
  protectionWindowAfterPeak_ms: 10
};

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
  
  // ========================================================
  // 獨立的配置管理
  // ========================================================
  // Power Spectrum 配置：控制頻譜圖的計算和顯示
  let powerSpectrumConfig = {
    windowType: windowType,
    fftSize: 1024,  // 固定預設為 1024
    hopPercent: 25
  };

  // Bat Call Detection 配置：控制蝙蝠叫聲檢測的參數
  // 使用記憶的值作為預設值
  const memory = window.__batCallControlsMemory;
  let batCallConfig = {
    windowType: windowType,
    callThreshold_dB: memory.callThreshold_dB,
    highFreqThreshold_dB: memory.highFreqThreshold_dB,
    highFreqThreshold_dB_isAuto: memory.highFreqThreshold_dB_isAuto !== false,  // Auto mode (default true)
    characteristicFreq_percentEnd: memory.characteristicFreq_percentEnd,
    minCallDuration_ms: memory.minCallDuration_ms,
    fftSize: parseInt(memory.fftSize) || 1024,
    hopPercent: memory.hopPercent,
    maxGapBridge_ms: 0,
    freqResolution_Hz: 1,
    callType: 'auto',
    cfRegionThreshold_dB: -30,
    // 2025 Anti-Rebounce Parameters
    enableBackwardEndFreqScan: memory.enableBackwardEndFreqScan !== false,
    maxFrequencyDropThreshold_kHz: memory.maxFrequencyDropThreshold_kHz || 10,
    protectionWindowAfterPeak_ms: memory.protectionWindowAfterPeak_ms || 10
  };

  // 建立 Popup Window
  const popup = createPopupWindow();
  const svgContainer = popup.querySelector('.power-spectrum-svg-container');
  const svg = svgContainer.querySelector('svg');
  
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
    onChange: () => {
      // 只更新 Power Spectrum 配置，不影響 Bat Call Detection
      const fftSizeItems = ['512', '1024', '2048'];
      const newFftSize = parseInt(fftSizeItems[fftDropdown.selectedIndex] || '1024', 10);
      powerSpectrumConfig.fftSize = newFftSize;
      redrawSpectrum();
    }
  });

  // 設置初始選項
  const typeIndex = ['blackman', 'gauss', 'hamming', 'hann', 'rectangular', 'triangular'].indexOf(windowType);
  typeDropdown.select(typeIndex >= 0 ? typeIndex : 3, { triggerOnChange: false }); // Default to 'hann'

  const fftIndex = ['512', '1024', '2048'].indexOf(powerSpectrumConfig.fftSize.toString());
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
  
  // 初始化 Bat Call Detector（用於檢測 Bat Call 參數）
  const detector = new BatCallDetector(batCallConfig);

  // 繪製函數（只用 Power Spectrum 配置，不涉及 Bat Call 檢測）
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
    
    // 只使用 Power Spectrum 配置
    const windowTypeItems = ['blackman', 'gauss', 'hamming', 'hann', 'rectangular', 'triangular'];
    powerSpectrumConfig.windowType = windowTypeItems[typeDropdown.selectedIndex] || 'hann';
    
    let overlapValue = overlap;
    if (overlapInput.value.trim() !== '') {
      overlapValue = parseInt(overlapInput.value, 10);
    }

    // 計算 Power Spectrum（使用 Power Spectrum 配置）
    const spectrum = calculatePowerSpectrumWithOverlap(
      audioData,
      sampleRate,
      powerSpectrumConfig.fftSize,
      powerSpectrumConfig.windowType,
      overlapValue
    );

    // 計算 Peak Frequency - 直接從頻譜中找到峰值 (與顯示的曲線對應)
    const peakFreq = findPeakFrequencyFromSpectrum(
      spectrum,
      sampleRate,
      powerSpectrumConfig.fftSize,
      selection.Flow,
      selection.Fhigh
    );
    
    // 分離的 Bat Call 檢測（獨立使用 batCallConfig）
    await updateBatCallAnalysis(peakFreq);

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
    drawPowerSpectrumSVG(
      svg,
      spectrum,
      sampleRate,
      selection.Flow,
      selection.Fhigh,
      powerSpectrumConfig.fftSize,
      peakFreq
    );
  };

  // 獨立的 Bat Call 檢測分析函數（只更新參數顯示，不重新計算 Power Spectrum）
  const updateBatCallAnalysis = async (peakFreq) => {
    try {
      const calls = await detector.detectCalls(
        audioData,
        sampleRate,
        selection.Flow,
        selection.Fhigh
      );
      
      // 更新 UI 以反映實際使用的 highFreqThreshold 值（用於 High Frequency 計算）
      // Auto mode 時：清空 value，在 placeholder 中顯示 "Auto (-24)" 格式，灰色樣式
      // Manual mode 時：顯示用戶設定的值
      if (batCallHighThresholdInput) {
        if (detector.config.highFreqThreshold_dB_isAuto === true) {
          // Auto 模式：清空 value，在 placeholder 中顯示計算值，並設定灰色樣式
          const calculatedValue = detector.config.highFreqThreshold_dB;
          batCallHighThresholdInput.value = '';  // 清空 value
          batCallHighThresholdInput.placeholder = `Auto (${calculatedValue})`;  // 更新 placeholder
          batCallHighThresholdInput.style.color = '#999';  // 灰色
        } else {
          // Manual 模式：保持用戶輸入的值，黑色文字
          batCallHighThresholdInput.value = detector.config.highFreqThreshold_dB.toString();
          batCallHighThresholdInput.placeholder = 'Auto';  // 恢復預設 placeholder
          batCallHighThresholdInput.style.color = '#000';  // 黑色
        }
      }
      
      if (calls.length > 0) {
        const call = calls[0];  // 取第一個偵測到的 call
        updateParametersDisplay(popup, call);
      } else {
        // 如果沒有偵測到 call，所有參數顯示 '-'（包括 peak freq）
        updateParametersDisplay(popup, null);
      }
    } catch (err) {
      console.error('Bat call detection error:', err);
      updateParametersDisplay(popup, null);
    }
  };

  // 初始繪製
  redrawSpectrum();

  // 添加事件監聽器（overlap input）
  overlapInput.addEventListener('change', redrawSpectrum);

  // ========================================================
  // 初始化 Bat Call Controls 事件監聽器
  // ========================================================
  const batCallThresholdInput = popup.querySelector('#callThreshold_dB');
  const batCallHighThresholdInput = popup.querySelector('#highThreshold_dB');
  const batCallCharFreqPercentInput = popup.querySelector('#characteristicFreq_percentEnd');
  const batCallMinDurationInput = popup.querySelector('#minCallDuration_ms');
  const batCallHopPercentInput = popup.querySelector('#hopPercent');
  const batCallFFTSizeBtn = popup.querySelector('#batCallFFTSize');
  
  // 2025 Anti-Rebounce Controls
  const antiRebounceCheckboxForListeners = popup.querySelector('#enableBackwardEndFreqScan');
  const maxFreqDropInputForListeners = popup.querySelector('#maxFrequencyDropThreshold_kHz');
  const protectionWindowInputForListeners = popup.querySelector('#protectionWindowAfterPeak_ms');

  // 初始化 FFT Size Dropdown
  const batCallFFTDropdown = initDropdown(batCallFFTSizeBtn, [
    { label: '512', value: '512' },
    { label: '1024', value: '1024' },
    { label: '2048', value: '2048' }
  ], {
    onChange: async () => {
      // 只更新 Bat Call 配置，不影響 Power Spectrum
      const fftSizeItems = ['512', '1024', '2048'];
      batCallConfig.fftSize = parseInt(fftSizeItems[batCallFFTDropdown.selectedIndex] || '1024', 10);
      detector.config = { ...batCallConfig };
      await updateBatCallAnalysis(lastPeakFreq);
    }
  });

  // 設置初始選項
  batCallFFTDropdown.select(1, { triggerOnChange: false }); // Default to '1024'

  // 通用函數：更新所有 Bat Call 配置
  const updateBatCallConfig = async () => {
    batCallConfig.callThreshold_dB = parseFloat(batCallThresholdInput.value) || -24;
    
    // 處理 High Frequency Threshold 的 Auto/Manual 模式
    // 新 UI 格式：
    // - Auto 模式：value 為空（placeholder 顯示 "Auto (-24)"）→ 設定 isAuto = true
    // - Manual 模式：value 顯示具體數值 "-24" → 設定 isAuto = false
    const highFreqThresholdValue = batCallHighThresholdInput.value.trim();
    
    if (highFreqThresholdValue === '') {
      // Auto 模式：value 為空字符串
      batCallConfig.highFreqThreshold_dB_isAuto = true;
      batCallConfig.highFreqThreshold_dB = -24;  // 預設值，會被 findOptimalHighFrequencyThreshold 覆蓋
      // Auto 模式不修改顯示，由 updateBatCallAnalysis 更新
    } else {
      // Manual 模式：嘗試解析為數字
      const numValue = parseFloat(highFreqThresholdValue);
      if (!isNaN(numValue)) {
        batCallConfig.highFreqThreshold_dB_isAuto = false;
        batCallConfig.highFreqThreshold_dB = numValue;
      } else {
        // 無效輸入，回退到 Auto
        batCallConfig.highFreqThreshold_dB_isAuto = true;
        batCallConfig.highFreqThreshold_dB = -24;
      }
    }
    
    batCallConfig.characteristicFreq_percentEnd = parseInt(batCallCharFreqPercentInput.value) || 20;
    batCallConfig.minCallDuration_ms = parseInt(batCallMinDurationInput.value) || 2;
    batCallConfig.hopPercent = parseInt(batCallHopPercentInput.value) || 3.125;
    
    // 2025 Anti-Rebounce 參數
    // 注意：每次都重新查詢元素，確保獲取最新的 DOM 節點
    let antiRebounceCheckbox = antiRebounceCheckboxForListeners || popup.querySelector('#enableBackwardEndFreqScan');
    let maxFreqDropInput = maxFreqDropInputForListeners || popup.querySelector('#maxFrequencyDropThreshold_kHz');
    let protectionWindowInput = protectionWindowInputForListeners || popup.querySelector('#protectionWindowAfterPeak_ms');
    
    if (antiRebounceCheckbox) {
      batCallConfig.enableBackwardEndFreqScan = antiRebounceCheckbox.checked;
    }
    if (maxFreqDropInput) {
      batCallConfig.maxFrequencyDropThreshold_kHz = parseFloat(maxFreqDropInput.value) || 10;
    }
    if (protectionWindowInput) {
      batCallConfig.protectionWindowAfterPeak_ms = parseFloat(protectionWindowInput.value) || 10;
    }
    
    // 保存到全局記憶中
    window.__batCallControlsMemory = {
      callThreshold_dB: batCallConfig.callThreshold_dB,
      highFreqThreshold_dB: batCallConfig.highFreqThreshold_dB,
      highFreqThreshold_dB_isAuto: batCallConfig.highFreqThreshold_dB_isAuto,
      characteristicFreq_percentEnd: batCallConfig.characteristicFreq_percentEnd,
      minCallDuration_ms: batCallConfig.minCallDuration_ms,
      fftSize: batCallConfig.fftSize.toString(),
      hopPercent: batCallConfig.hopPercent,
      // 2025 Anti-Rebounce
      enableBackwardEndFreqScan: batCallConfig.enableBackwardEndFreqScan,
      maxFrequencyDropThreshold_kHz: batCallConfig.maxFrequencyDropThreshold_kHz,
      protectionWindowAfterPeak_ms: batCallConfig.protectionWindowAfterPeak_ms
    };
    
    // 更新 detector 配置
    detector.config = { ...batCallConfig };
    
    // 只進行 Bat Call 分析，不重新計算 Power Spectrum
    await updateBatCallAnalysis(lastPeakFreq);
  };

  /**
   * 為 type="number" 的 input 添加上下鍵支持
   */
  const addNumberInputKeyboardSupport = (inputElement) => {
    inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // 設置全局標誌，禁止文件切換
        window.__isAdjustingNumberInput = true;
        
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          
          // 特殊處理 highThreshold input
          // 支持格式：空白 / "auto" / "Auto (值)" / 純數值
          if (inputElement.id === 'highThreshold_dB') {
            const currentValue = inputElement.value.trim().toLowerCase();
            
            // 檢查是否是 Auto 模式（空白、"auto" 或 "auto (-40)" 格式）
            if (currentValue === '' || 
                currentValue === 'auto' ||
                currentValue.startsWith('auto')) {
              // 從 Auto 切換到 -24
              inputElement.value = '-24';
              inputElement.style.color = '#000';
              inputElement.style.fontStyle = 'normal';
            } else {
              // 數值增加
              const numValue = parseFloat(currentValue);
              if (!isNaN(numValue)) {
                const newValue = numValue + 1;
                inputElement.value = newValue.toString();
              }
            }
          } else {
            // 普通數值 input
            const step = parseFloat(inputElement.step) || 1;
            const currentValue = parseFloat(inputElement.value) || 0;
            const max = inputElement.max ? parseFloat(inputElement.max) : Infinity;
            const newValue = Math.min(currentValue + step, max);
            inputElement.value = newValue;
          }
          
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          
          // 特殊處理 highThreshold input
          // 支持格式：空白 / "auto" / "Auto (值)" / 純數值
          if (inputElement.id === 'highThreshold_dB') {
            const currentValue = inputElement.value.trim().toLowerCase();
            
            // 檢查是否是 Auto 模式（空白、"auto" 或 "auto (-40)" 格式）
            if (currentValue === '' || 
                currentValue === 'auto' ||
                currentValue.startsWith('auto')) {
              // 從 Auto 切換到 -50
              inputElement.value = '-50';
              inputElement.style.color = '#000';
              inputElement.style.fontStyle = 'normal';
            } else {
              // 數值減少
              const numValue = parseFloat(currentValue);
              if (!isNaN(numValue)) {
                const newValue = numValue - 1;
                inputElement.value = newValue.toString();
              }
            }
          } else {
            // 普通數值 input
            const step = parseFloat(inputElement.step) || 1;
            const currentValue = parseFloat(inputElement.value) || 0;
            const min = inputElement.min ? parseFloat(inputElement.min) : -Infinity;
            const newValue = Math.max(currentValue - step, min);
            inputElement.value = newValue;
          }
          
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    
    // 當焦點離開時，清除標誌
    inputElement.addEventListener('blur', () => {
      window.__isAdjustingNumberInput = false;
    });
  };

  // 為所有輸入框添加事件監聽器
  batCallThresholdInput.addEventListener('change', updateBatCallConfig);
  batCallThresholdInput.addEventListener('input', () => {
    clearTimeout(batCallThresholdInput._updateTimeout);
    batCallThresholdInput._updateTimeout = setTimeout(updateBatCallConfig, 30);
  });
  addNumberInputKeyboardSupport(batCallThresholdInput);

  batCallHighThresholdInput.addEventListener('change', updateBatCallConfig);
  batCallHighThresholdInput.addEventListener('input', () => {
    clearTimeout(batCallHighThresholdInput._updateTimeout);
    batCallHighThresholdInput._updateTimeout = setTimeout(updateBatCallConfig, 30);
  });
  addNumberInputKeyboardSupport(batCallHighThresholdInput);

  batCallCharFreqPercentInput.addEventListener('change', updateBatCallConfig);
  batCallCharFreqPercentInput.addEventListener('input', () => {
    clearTimeout(batCallCharFreqPercentInput._updateTimeout);
    batCallCharFreqPercentInput._updateTimeout = setTimeout(updateBatCallConfig, 30);
  });
  addNumberInputKeyboardSupport(batCallCharFreqPercentInput);

  batCallMinDurationInput.addEventListener('change', updateBatCallConfig);
  batCallMinDurationInput.addEventListener('input', () => {
    clearTimeout(batCallMinDurationInput._updateTimeout);
    batCallMinDurationInput._updateTimeout = setTimeout(updateBatCallConfig, 30);
  });
  addNumberInputKeyboardSupport(batCallMinDurationInput);

  batCallHopPercentInput.addEventListener('change', updateBatCallConfig);
  batCallHopPercentInput.addEventListener('input', () => {
    clearTimeout(batCallHopPercentInput._updateTimeout);
    batCallHopPercentInput._updateTimeout = setTimeout(updateBatCallConfig, 30);
  });
  addNumberInputKeyboardSupport(batCallHopPercentInput);

  // 2025 Anti-Rebounce Control Listeners
  
  // Anti-Rebounce Checkbox
  if (antiRebounceCheckboxForListeners) {
    antiRebounceCheckboxForListeners.addEventListener('change', updateBatCallConfig);
  }

  // Max Frequency Drop Input
  if (maxFreqDropInputForListeners) {
    maxFreqDropInputForListeners.addEventListener('change', updateBatCallConfig);
    maxFreqDropInputForListeners.addEventListener('input', () => {
      clearTimeout(maxFreqDropInputForListeners._updateTimeout);
      maxFreqDropInputForListeners._updateTimeout = setTimeout(updateBatCallConfig, 30);
    });
    addNumberInputKeyboardSupport(maxFreqDropInputForListeners);
  }

  // Protection Window Input
  if (protectionWindowInputForListeners) {
    protectionWindowInputForListeners.addEventListener('change', updateBatCallConfig);
    protectionWindowInputForListeners.addEventListener('input', () => {
      clearTimeout(protectionWindowInputForListeners._updateTimeout);
      protectionWindowInputForListeners._updateTimeout = setTimeout(updateBatCallConfig, 30);
    });
    addNumberInputKeyboardSupport(protectionWindowInputForListeners);
  }

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
  titleSpan.textContent = 'Call analysis';
  dragBar.appendChild(titleSpan);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'popup-close-btn';
  closeBtn.title = 'Close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => popup.remove());
  dragBar.appendChild(closeBtn);

  popup.appendChild(dragBar);

  // 建立 SVG 容器（用 SVG 代替 Canvas 以支持動態更新）
  const svgContainer = document.createElement('div');
  svgContainer.className = 'power-spectrum-svg-container';
  svgContainer.style.width = '438px';
  svgContainer.style.height = '438px';
  svgContainer.style.position = 'relative';
  svgContainer.style.backgroundColor = '#ffffff';
  svgContainer.style.border = '1px solid #ccc';
  svgContainer.style.margin = '5px 5px 0px 5px';
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '438');
  svg.setAttribute('height', '438');
  svg.setAttribute('viewBox', '0 10 430 450');
  svg.style.width = '100%';
  svg.style.height = '100%';
  
  svgContainer.appendChild(svg);
  popup.appendChild(svgContainer);

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
      <td class="param-label">Start Freq:</td>
      <td class="param-value start-freq">-</td>
      <td class="param-unit">kHz</td>
      <td class="param-label">End Freq:</td>
      <td class="param-value end-freq">-</td>
      <td class="param-unit">kHz</td>
    </tr>
    <tr>
      <td class="param-label">High Freq:</td>
      <td class="param-value-container high-freq-container" style="text-align: right; align-items: center;">
        <i class="fa-solid fa-triangle-exclamation high-freq-warning" style="display: none; color: #ffc107; margin-right: 6px; cursor: help;" title="Selection area did not cover high enough frequencies.&#10;Consider extending the frequency range."></i>
        <span class="param-value high-freq">-</span>
      </td>
      <td class="param-unit">kHz</td>
      <td class="param-label">Low Freq:</td>
      <td class="param-value low-freq">-</td>
      <td class="param-unit">kHz</td>
    </tr>    
    <tr>
      <td class="param-label">Peak Freq:</td>
      <td class="param-value peak-freq">-</td>
      <td class="param-unit">kHz</td>
      <td class="param-label">Char. Freq:</td>
      <td class="param-value char-freq">-</td>
      <td class="param-unit">kHz</td>
    </tr>
    <tr>
      <td class="param-label">Knee Freq:</td>
      <td class="param-value knee-freq">-</td>
      <td class="param-unit">kHz</td>      
      <td class="param-label">Knee Time:</td>
      <td class="param-value knee-time">-</td>
      <td class="param-unit">ms</td>
    </tr>
    <tr>
      <td class="param-label">Bandwidth:</td>
      <td class="param-value bandwidth">-</td>
      <td class="param-unit">kHz</td>
      <td class="param-label">Duration:</td>
      <td class="param-value duration">-</td>
      <td class="param-unit">ms</td>
    </tr>
    <tr>
      <td class="param-label">SNR:</td>
      <td class="param-value snr">-</td>
      <td class="param-unit">dB</td>
      <td class="param-label">Signal Quality:</td>
      <td class="param-value quality" colspan="2">-</td>
    </tr>
  `;
  paramPanel.appendChild(paramTable);
  popup.appendChild(paramPanel);

  // 建立 Bat Call 檢測參數控制面板
  const batCallControlPanel = document.createElement('div');
  batCallControlPanel.className = 'bat-call-controls';
  batCallControlPanel.id = 'batCallControlsPanel';

  // callThreshold_dB 控制
  const callThresholdControl = document.createElement('label');
  const callThresholdLabel = document.createElement('span');
  callThresholdLabel.textContent = 'Call Thresh:';
  callThresholdControl.appendChild(callThresholdLabel);
  
  const callThresholdInput = document.createElement('input');
  callThresholdInput.id = 'callThreshold_dB';
  callThresholdInput.type = 'number';
  callThresholdInput.value = window.__batCallControlsMemory.callThreshold_dB.toString();
  callThresholdInput.step = '1';
  callThresholdInput.title = 'Energy threshold (dB)';
  callThresholdControl.appendChild(callThresholdInput);
  batCallControlPanel.appendChild(callThresholdControl);

  // highFreqThreshold_dB 控制 (Auto 和 Manual 模式)
  // 用於 High Frequency 邊界計算，獨立於 End/Low Frequency 的固定 -27dB 閾值
  const highThresholdControl = document.createElement('label');
  const highThresholdLabel = document.createElement('span');
  highThresholdLabel.textContent = 'High Freq Thresh:';
  highThresholdControl.appendChild(highThresholdLabel);
  
  // Input field (可顯示 Auto 或具體數值)
  const highThresholdInput = document.createElement('input');
  highThresholdInput.id = 'highThreshold_dB';
  highThresholdInput.type = 'number';
  highThresholdInput.placeholder = 'Auto';
  highThresholdInput.title = 'Auto or Manual High Frequency threshold (-24 to -70)';
  highThresholdInput.style.width = '65px';
  highThresholdInput.min = '-70';
  highThresholdInput.max = '-24';
  highThresholdInput.step = '1';
  
  // 根據模式初始化顯示
  const isAutoMode = window.__batCallControlsMemory.highFreqThreshold_dB_isAuto !== false;
  if (isAutoMode) {
    // Auto 模式：顯示 "Auto" 格式，灰色樣式
    highThresholdInput.value = '';  // 初始時為空白，等待第一次計算
    highThresholdInput.style.color = '#999';
  } else {
    // Manual 模式：顯示具體值，黑色樣式
    highThresholdInput.value = window.__batCallControlsMemory.highFreqThreshold_dB.toString();
    highThresholdInput.style.color = '#000';
  }
  
  highThresholdControl.appendChild(highThresholdInput);
  batCallControlPanel.appendChild(highThresholdControl);

  // characteristicFreq_percentEnd 控制
  const charFreqPercentControl = document.createElement('label');
  const charFreqPercentLabel = document.createElement('span');
  charFreqPercentLabel.textContent = 'Char Freq %:';
  charFreqPercentControl.appendChild(charFreqPercentLabel);
  
  const charFreqPercentInput = document.createElement('input');
  charFreqPercentInput.id = 'characteristicFreq_percentEnd';
  charFreqPercentInput.type = 'number';
  charFreqPercentInput.value = window.__batCallControlsMemory.characteristicFreq_percentEnd.toString();
  charFreqPercentInput.min = '1';
  charFreqPercentInput.max = '100';
  charFreqPercentInput.step = '1';
  charFreqPercentInput.title = 'Characteristic frequency percentage end';
  charFreqPercentControl.appendChild(charFreqPercentInput);
  batCallControlPanel.appendChild(charFreqPercentControl);

  // minCallDuration_ms 控制
  const minDurationControl = document.createElement('label');
  const minDurationLabel = document.createElement('span');
  minDurationLabel.textContent = 'Min Duration:';
  minDurationControl.appendChild(minDurationLabel);
  
  const minDurationInput = document.createElement('input');
  minDurationInput.id = 'minCallDuration_ms';
  minDurationInput.type = 'number';
  minDurationInput.value = window.__batCallControlsMemory.minCallDuration_ms.toString();
  minDurationInput.min = '1';
  minDurationInput.step = '0.5';
  minDurationInput.title = 'Minimum call duration (ms)';
  minDurationControl.appendChild(minDurationInput);
  batCallControlPanel.appendChild(minDurationControl);

  // fftSize 控制 (Dropdown)
  const fftSizeControl = document.createElement('label');
  const fftSizeLabel = document.createElement('span');
  fftSizeLabel.textContent = 'FFT Size:';
  fftSizeControl.appendChild(fftSizeLabel);
  
  const fftSizeBtn = document.createElement('button');
  fftSizeBtn.id = 'batCallFFTSize';
  fftSizeBtn.className = 'dropdown-button';
  fftSizeBtn.textContent = window.__batCallControlsMemory.fftSize;
  fftSizeControl.appendChild(fftSizeBtn);
  batCallControlPanel.appendChild(fftSizeControl);

  // hopPercent 控制
  const hopPercentControl = document.createElement('label');
  const hopPercentLabel = document.createElement('span');
  hopPercentLabel.textContent = 'Hop %:';
  hopPercentControl.appendChild(hopPercentLabel);
  
  const hopPercentInput = document.createElement('input');
  hopPercentInput.id = 'hopPercent';
  hopPercentInput.type = 'number';
  hopPercentInput.value = window.__batCallControlsMemory.hopPercent.toString();
  hopPercentInput.min = '1';
  hopPercentInput.max = '99';
  hopPercentInput.step = '0.125';
  hopPercentInput.title = 'Hop size percentage (overlap = 100 - hopPercent)';
  hopPercentControl.appendChild(hopPercentInput);
  batCallControlPanel.appendChild(hopPercentControl);

  // ============================================================
  // 2025 ANTI-REBOUNCE CONTROLS
  // ============================================================
  
  // enableBackwardEndFreqScan (Checkbox)
  const antiRebounceControl = document.createElement('label');
  const antiRebounceCheckbox = document.createElement('input');
  antiRebounceCheckbox.id = 'enableBackwardEndFreqScan';
  antiRebounceCheckbox.type = 'checkbox';
  antiRebounceCheckbox.checked = window.__batCallControlsMemory.enableBackwardEndFreqScan !== false;
  antiRebounceCheckbox.title = 'Anti-rebounce: Backward scan from end to find clean cutoff';
  antiRebounceControl.appendChild(antiRebounceCheckbox);
  
  const antiRebounceLabel = document.createElement('span');
  antiRebounceLabel.textContent = 'Anti-Rebounce:';
  antiRebounceControl.appendChild(antiRebounceLabel);
  batCallControlPanel.appendChild(antiRebounceControl);

  // maxFrequencyDropThreshold_kHz (Number input)
  const maxFreqDropControl = document.createElement('label');
  const maxFreqDropLabel = document.createElement('span');
  maxFreqDropLabel.textContent = 'Max Freq Drop:';
  maxFreqDropControl.appendChild(maxFreqDropLabel);
  
  const maxFreqDropInput = document.createElement('input');
  maxFreqDropInput.id = 'maxFrequencyDropThreshold_kHz';
  maxFreqDropInput.type = 'number';
  maxFreqDropInput.value = window.__batCallControlsMemory.maxFrequencyDropThreshold_kHz.toString();
  maxFreqDropInput.min = '1';
  maxFreqDropInput.max = '50';
  maxFreqDropInput.step = '0.5';
  maxFreqDropInput.title = 'Maximum frequency drop threshold (kHz) - triggers lock';
  maxFreqDropControl.appendChild(maxFreqDropInput);
  
  const maxFreqDropUnit = document.createElement('span');
  maxFreqDropUnit.textContent = 'kHz';
  maxFreqDropControl.appendChild(maxFreqDropUnit);
  batCallControlPanel.appendChild(maxFreqDropControl);

  // protectionWindowAfterPeak_ms (Number input)
  const protectionWindowControl = document.createElement('label');
  const protectionWindowLabel = document.createElement('span');
  protectionWindowLabel.textContent = 'Protect Window:';
  protectionWindowControl.appendChild(protectionWindowLabel);
  
  const protectionWindowInput = document.createElement('input');
  protectionWindowInput.id = 'protectionWindowAfterPeak_ms';
  protectionWindowInput.type = 'number';
  protectionWindowInput.value = window.__batCallControlsMemory.protectionWindowAfterPeak_ms.toString();
  protectionWindowInput.min = '1';
  protectionWindowInput.max = '100';
  protectionWindowInput.step = '1';
  protectionWindowInput.title = 'Protection window after peak energy (ms)';
  protectionWindowControl.appendChild(protectionWindowInput);
  
  const protectionWindowUnit = document.createElement('span');
  protectionWindowUnit.textContent = 'ms';
  protectionWindowControl.appendChild(protectionWindowUnit);
  batCallControlPanel.appendChild(protectionWindowControl);

  popup.appendChild(batCallControlPanel);

  document.body.appendChild(popup);

  // 拖動功能
  makeDraggable(popup, dragBar);

  // 返回 popup 和 bat-call-controls 的輸入框對象
  // 便於外層函數訪問這些輸入框
  popup.batCallInputs = {
    callThresholdInput,
    highThresholdInput,
    charFreqPercentInput,
    minDurationInput,
    hopPercentInput,
    fftSizeBtn
  };

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
 * 繪製 Power Spectrum 圖表 (SVG 版本 - 2025 優化)
 * 使用 SVG 而非 Canvas，支持動態更新和 CSS 樣式
 */
function drawPowerSpectrumSVG(svg, spectrum, sampleRate, flowKHz, fhighKHz, fftSize, peakFreq) {
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
  xLabel.textContent = 'Frequency (kHz)';
  labelsGroup.appendChild(xLabel);

  // Y 軸標籤（旋轉）
  const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  yLabel.setAttribute('x', '17');
  yLabel.setAttribute('y', topPadding + plotHeight / 2);
  yLabel.setAttribute('text-anchor', 'middle');
  yLabel.setAttribute('font-weight', 'bold');
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
  // 設置基於 X 座標的自動檢測交互
  // ============================================================
  
  // 添加整個 SVG 容器的滑鼠移動監聽
  svg.addEventListener('mousemove', (event) => {
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
      interactiveCircle.setAttribute('fill', 'rgba(0, 102, 204, 0.3)');
      interactiveCircle.setAttribute('stroke', '#0066cc');
      interactiveCircle.setAttribute('stroke-width', '1');
      interactiveCircle.setAttribute('class', 'spectrum-highlight-point');
      helperGroup.appendChild(interactiveCircle);
      
      // 創建提示框文字（頻率）- 放在懸停點正上方 15px
      const tooltipFreq = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tooltipFreq.setAttribute('x', closestPoint.x);
      tooltipFreq.setAttribute('y', closestPoint.y - 25);
      tooltipFreq.setAttribute('text-anchor', 'middle');
      tooltipFreq.setAttribute('dominant-baseline', 'middle');
      tooltipFreq.setAttribute('font-family', 'Arial');
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
      tooltipDb.setAttribute('font-family', 'Arial');
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
    while (helperGroup.firstChild) {
      helperGroup.removeChild(helperGroup.firstChild);
    }
  });
  
}

/**
 * 繪製 Power Spectrum 圖表 (Canvas 版本 - 保留以備用)
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
  
  const peakFreqEl = paramPanel.querySelector('.peak-freq');
  const startFreqEl = paramPanel.querySelector('.start-freq');
  const endFreqEl = paramPanel.querySelector('.end-freq');
  const lowFreqEl = paramPanel.querySelector('.low-freq');
  const highFreqEl = paramPanel.querySelector('.high-freq');
  const highFreqWarningIcon = paramPanel.querySelector('.high-freq-warning');
  const kneeFreqEl = paramPanel.querySelector('.knee-freq');
  const charFreqEl = paramPanel.querySelector('.char-freq');
  const bandwidthEl = paramPanel.querySelector('.bandwidth');
  const durationEl = paramPanel.querySelector('.duration');
  const kneeTimeEl = paramPanel.querySelector('.knee-time');
  const snrEl = paramPanel.querySelector('.snr');
  const qualityEl = paramPanel.querySelector('.quality');
  
  if (batCall) {
    peakFreqEl.textContent = batCall.peakFreq_kHz?.toFixed(2) || '-';
    // Display startFreq_kHz calculated from -24dB threshold (Rule a/b applied)
    startFreqEl.textContent = batCall.startFreq_kHz?.toFixed(2) || '-';
    // Display endFreq_kHz calculated from last frame using -27dB threshold
    endFreqEl.textContent = batCall.endFreq_kHz?.toFixed(2) || '-';
    // Display lowFreq_kHz (may be optimized to use Start Frequency if lower)
    lowFreqEl.textContent = batCall.lowFreq_kHz?.toFixed(2) || '-';
    
    // Display High Freq with warning icon and color if detection warning is set
    highFreqEl.textContent = batCall.highFreq_kHz?.toFixed(2) || '-';
    if (batCall.highFreqDetectionWarning === true) {
      // Show warning icon and change text color to red
      if (highFreqWarningIcon) {
        highFreqWarningIcon.style.display = 'inline';
      }
      highFreqEl.style.color = '#dc3545';  // Red color for warning
    } else {
      // Hide warning icon and use blue color for normal value
      if (highFreqWarningIcon) {
        highFreqWarningIcon.style.display = 'none';
      }
      highFreqEl.style.color = '#0066cc';  // Blue color for normal value
    }
    
    kneeFreqEl.textContent = batCall.kneeFreq_kHz?.toFixed(2) || '-';
    charFreqEl.textContent = batCall.characteristicFreq_kHz?.toFixed(2) || '-';
    bandwidthEl.textContent = batCall.bandwidth_kHz?.toFixed(2) || '-';
    durationEl.textContent = batCall.duration_ms?.toFixed(2) || '-';
    kneeTimeEl.textContent = batCall.kneeTime_ms?.toFixed(2) || '-';
    
    // Display SNR value with + prefix if positive
    if (batCall.snr_dB !== null && batCall.snr_dB !== undefined) {
      snrEl.textContent = batCall.snr_dB > 0 ? `+${batCall.snr_dB.toFixed(1)}` : batCall.snr_dB.toFixed(1);
      snrEl.className = 'param-value snr';
    } else {
      snrEl.textContent = '-';
      snrEl.className = 'param-value snr';
    }
    
    // Display quality with appropriate color
    if (batCall.quality !== null && batCall.quality !== undefined) {
      qualityEl.textContent = batCall.quality;
      qualityEl.className = 'param-value quality quality-' + batCall.quality.toLowerCase().replace(/\s+/g, '-');
    } else {
      qualityEl.textContent = '-';
      qualityEl.className = 'param-value quality';
    }
  } else {
    // 只顯示 peak freq，其他為空
    peakFreqEl.textContent = peakFreqFallback?.toFixed(2) || '-';
    startFreqEl.textContent = '-';
    endFreqEl.textContent = '-';
    lowFreqEl.textContent = '-';
    highFreqEl.textContent = '-';
    // Reset warning icon and color
    if (highFreqWarningIcon) {
      highFreqWarningIcon.style.display = 'none';
    }
    highFreqEl.style.color = '#0066cc';  // Blue color for normal state
    kneeFreqEl.textContent = '-';
    charFreqEl.textContent = '-';
    bandwidthEl.textContent = '-';
    durationEl.textContent = '-';
    kneeTimeEl.textContent = '-';
    snrEl.textContent = '-';
    snrEl.className = 'param-value snr';
    qualityEl.textContent = '-';
    qualityEl.className = 'param-value quality';
  }
}

