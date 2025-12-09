// modules/callAnalysisPopup.js
// 蝙蝠叫聲分析彈窗
// 提供 Power Spectrum 計算、展示和蝙蝠叫聲參數分析功能

import { initDropdown } from './dropdown.js';
import { BatCallDetector } from './batCallDetector.js';
import { 
    calculatePowerSpectrumWithOverlap, 
    findPeakFrequencyFromSpectrum, 
    drawPowerSpectrumSVG, 
    findOptimalOverlap 
} from './powerSpectrum.js';

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
  lowFreqThreshold_dB: -27,   // Threshold for calculating Low Frequency (optimal value range: -24 to -70)
  lowFreqThreshold_dB_isAuto: true,   // Auto mode for Low Frequency threshold detection
  characteristicFreq_percentEnd: 20,
  minCallDuration_ms: 2,
  fftSize: '1024',
  hopPercent: 3.125,
  enableBackwardEndFreqScan: true,
  maxFrequencyDropThreshold_kHz: 10,
  protectionWindowAfterPeak_ms: 10,
  enableHighpassFilter: true,            // Highpass filter enable/disable
  highpassFilterFreq_kHz: 40,            // Highpass filter frequency (kHz)
  highpassFilterFreq_kHz_isAuto: true,   // Auto mode for Highpass filter frequency detection
  highpassFilterOrder: 4                 // Highpass filter order (1-8, step 1)
};

/**
 * 顯示蝙蝠叫聲分析彈窗
 * 包含 Power Spectrum 顯示和蝙蝠叫聲參數分析
 */
export function showCallAnalysisPopup({
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
    fftSize: 1024,
    hopPercent: 25
  };

  // 用於追蹤 Auto mode 下計算出的最優 overlap 值
  let computedOptimalOverlap = 50;  // 預設值

  // Bat Call Detection 配置：控制蝙蝠叫聲檢測的參數
  // 使用記憶的值作為預設值
  const memory = window.__batCallControlsMemory;
  let batCallConfig = {
    windowType: windowType,
    callThreshold_dB: memory.callThreshold_dB,
    highFreqThreshold_dB: memory.highFreqThreshold_dB,
    highFreqThreshold_dB_isAuto: memory.highFreqThreshold_dB_isAuto !== false,  // Auto mode (default true)
    lowFreqThreshold_dB: memory.lowFreqThreshold_dB,
    lowFreqThreshold_dB_isAuto: memory.lowFreqThreshold_dB_isAuto !== false,    // Auto mode (default true)
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
    protectionWindowAfterPeak_ms: memory.protectionWindowAfterPeak_ms || 10,
    // Highpass Filter Parameters
    enableHighpassFilter: memory.enableHighpassFilter !== false,
    highpassFilterFreq_kHz: memory.highpassFilterFreq_kHz || 40,
    highpassFilterFreq_kHz_isAuto: memory.highpassFilterFreq_kHz_isAuto !== false,  // Auto mode (default true)
    highpassFilterOrder: memory.highpassFilterOrder || 4
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
  
  // 驗證提取的音頻數據有效性
  const selectionDurationMs = (selection.endTime - selection.startTime) * 1000;
  const extractedDurationMs = (audioData.length / sampleRate) * 1000;
  if (extractedDurationMs < selectionDurationMs - 1) {  // 允許 1ms 的浮點誤差
    console.warn(
      `⚠️ Audio data mismatch: Selection duration ${selectionDurationMs.toFixed(1)}ms ` +
      `but extracted only ${extractedDurationMs.toFixed(1)}ms. ` +
      `The selection may exceed the available audio. ` +
      `Try selecting a shorter range or expanding the frequency range.`
    );
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

    // 計算實際使用的 overlap 百分比並更新 placeholder
    let actualOverlapPercent;
    if (overlapValue === 'auto' || overlapValue === '') {
      // Auto mode: 計算最優 overlap 值
      actualOverlapPercent = findOptimalOverlap(
        audioData,
        sampleRate,
        powerSpectrumConfig.fftSize,
        powerSpectrumConfig.windowType
      );
      // 存儲計算出的最優值，供後續使用
      computedOptimalOverlap = actualOverlapPercent;
      // 轉換為實際的 overlap 值供計算使用
      overlapValue = actualOverlapPercent;
    } else {
      actualOverlapPercent = parseInt(overlapValue, 10);
    }
    
    // 當 input box 為空（Auto mode）時，更新 placeholder 顯示實際的 overlap %
    if (overlapInput.value.trim() === '') {
      overlapInput.placeholder = `Auto (${actualOverlapPercent}%)`;
    }

    // 計算 Power Spectrum（使用 Power Spectrum 配置）
    console.log('[callAnalysisPopup] 📈 Starting Power Spectrum calculation...');
    console.log(`  Configuration:`, {
      fftSize: powerSpectrumConfig.fftSize,
      windowType: powerSpectrumConfig.windowType,
      overlap: overlapValue
    });
    
    const spectrum = calculatePowerSpectrumWithOverlap(
      audioData,
      sampleRate,
      powerSpectrumConfig.fftSize,
      powerSpectrumConfig.windowType,
      overlapValue
    );

    // 計算 Peak Frequency - 直接從頻譜中找到峰值 (與顯示的曲線對應)
    console.log('[callAnalysisPopup] 🔍 Searching for peak frequency...');
    
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
      
      // 2025: 發射事件告知 selection rect 更新 warning 圖標（基於最新的 bat call 偵測結果）
      popup.dispatchEvent(new CustomEvent('batCallDetectionCompleted', {
        detail: { call: popup.__latestDetectedCall }
      }));
    } catch (e) {
    }

    // 繪製 Power Spectrum
    console.log('[callAnalysisPopup] 🎨 Drawing Power Spectrum SVG:');
    console.log(`  SVG container: ${svg ? 'Valid' : 'Invalid'}`);
    console.log(`  Spectrum data: ${spectrum ? `${spectrum.length} bins` : 'None'}`);
    console.log(`  Peak frequency: ${peakFreq ? peakFreq.toFixed(3) + ' kHz' : 'Not found'}`);
    
    drawPowerSpectrumSVG(
      svg,
      spectrum,
      sampleRate,
      selection.Flow,
      selection.Fhigh,
      powerSpectrumConfig.fftSize,
      peakFreq
    );
    
    console.log('✅ Power Spectrum visualization complete');
  };

  // 根據 peakFreq 計算最佳的高通濾波器頻率（Auto Mode 使用）
  const calculateAutoHighpassFilterFreq = (peakFreq_kHz) => {
    // 根據峰值頻率選擇合適的高通濾波器頻率
    // 閾值：40, 35, 30 kHz
    if (peakFreq_kHz >= 40) return 30;
    if (peakFreq_kHz >= 35) return 25;
    if (peakFreq_kHz >= 30) return 20;
    return 0;  // 預設最低值
  };

  // 獨立的 Bat Call 檢測分析函數（只更新參數顯示，不重新計算 Power Spectrum）
  const updateBatCallAnalysis = async (peakFreq) => {
    try {
      // 2025 FIX: 首次初始化時，根據highpassFilterFreqInput.value同步batCallConfig的isAuto狀態
      // 這對於redrawSpectrum首次調用時特別重要，因為此時updateBatCallConfig可能還沒被調用過
      let highpassFilterFreqInput = popup.querySelector('#highpassFilterFreq_kHz');
      if (highpassFilterFreqInput) {
        const currentValue = highpassFilterFreqInput.value.trim();
        // 如果highpassFilterFreqInput為空，則isAuto應該為true；否則為false
        const shouldBeAuto = (currentValue === '');
        batCallConfig.highpassFilterFreq_kHz_isAuto = shouldBeAuto;
      }
      
      // 2025: Auto Mode 時，根據peakFreq計算自動高通濾波器頻率
      // 使用原始spectrum的peakFreq（未濾波）
      if (batCallConfig.highpassFilterFreq_kHz_isAuto === true && peakFreq) {
        batCallConfig.highpassFilterFreq_kHz = calculateAutoHighpassFilterFreq(peakFreq);
      }
      
      // 同步detector.config以確保使用最新的batCallConfig值
      detector.config = { ...batCallConfig };
      
      // 獲取要進行偵測的音頻數據
      let audioDataForDetection = audioData;

      // 如果啟用 Highpass Filter，在進行 call measurement 之前應用濾波
      if (batCallConfig.enableHighpassFilter) {
        const highpassFreq_Hz = batCallConfig.highpassFilterFreq_kHz * 1000;
        audioDataForDetection = applyButterworthHighpassFilter(audioDataForDetection, highpassFreq_Hz, sampleRate, batCallConfig.highpassFilterOrder);
      }

      // 為了確保 SNR 計算正確，需要使用原始（未濾波）的音頻數據
      // 2025 REVISED SNR CALCULATION:
      // SNR = 20 × log₁₀ (Signal RMS / Noise RMS)
      // Signal Region: call 的頻率和時間範圍
      // Noise Region: selection area 除去 signal region 外的區域
      // 
      // NOTE: SNR is now calculated in BatCallDetector.detectCalls() using RMS-based method
      // with proper frequency and time range (highFreqFrameIdx to lowFreqFrameIdx)
      
      // 先用濾波後的數據進行主要檢測
      const calls = await detector.detectCalls(
        audioDataForDetection,
        sampleRate,
        selection.Flow,
        selection.Fhigh
      );
      
      // 如果濾波被啟用且有偵測到 call，重新用原始音頻計算 call
      // 使用原始音頻的 SNR 更準確
      if (batCallConfig.enableHighpassFilter && calls.length > 0) {
        const originalDetector = new (detector.constructor)(batCallConfig);
        const originalCalls = await originalDetector.detectCalls(
          audioData,  // 使用原始未濾波的音頻來計算更準確的 SNR
          sampleRate,
          selection.Flow,
          selection.Fhigh
        );
        
        // 如果原始檢測也找到 call，將 SNR 和機制信息從原始檢測複製到濾波後的 call
        if (originalCalls.length > 0) {
          calls[0].snr_dB = originalCalls[0].snr_dB;
          calls[0].snrMechanism = originalCalls[0].snrMechanism;
          calls[0].snrDetails = originalCalls[0].snrDetails;
          calls[0].quality = originalCalls[0].quality;
        }
      }
      
      // 更新 UI 以反映實際使用的 highFreqThreshold 值（用於 High Frequency 計算）
      // Auto mode 時：清空 value，在 placeholder 中顯示 "Auto (24)" 格式（絕對值），灰色樣式
      // Manual mode 時：顯示用戶設定的絕對值
      if (batCallHighThresholdInput) {
        if (detector.config.highFreqThreshold_dB_isAuto === true) {
          // Auto 模式：清空 value，在 placeholder 中顯示計算值（絕對值），並設定灰色樣式
          // 2025: 使用實際檢測到的 call 使用的 threshold 值（而不是 config 中的值）
          // 這樣可以正確反映該 call 實際使用的 threshold，特別是在防呆檢查後可能達到 -70dB 時
          let displayValue = Math.abs(detector.config.highFreqThreshold_dB);  // 轉換為絕對值
          
          if (calls.length > 0) {
            const firstCall = calls[0];
            if (firstCall.highFreqThreshold_dB_used !== null && firstCall.highFreqThreshold_dB_used !== undefined) {
              // 使用實際檢測到的 call 使用的 threshold 值（轉換為絕對值）
              displayValue = Math.abs(firstCall.highFreqThreshold_dB_used);
            }
          }
          
          batCallHighThresholdInput.value = '';  // 清空 value
          batCallHighThresholdInput.placeholder = `Auto (${displayValue})`;  // 更新 placeholder，顯示絕對值
          batCallHighThresholdInput.style.color = '#999';  // 灰色
        } else {
          // Manual 模式：保持用戶輸入的值（已經是絕對值），黑色文字
          batCallHighThresholdInput.value = Math.abs(detector.config.highFreqThreshold_dB).toString();
          batCallHighThresholdInput.placeholder = 'Auto';  // 恢復預設 placeholder
          batCallHighThresholdInput.style.color = '#000';  // 黑色
        }
      }
      
      // 更新 UI 以反映實際使用的 lowFreqThreshold 值（用於 Low Frequency 計算）
      // Auto mode 時：清空 value，在 placeholder 中顯示 "Auto (27)" 格式（絕對值），灰色樣式
      // Manual mode 時：顯示用戶設定的絕對值
      if (batCallLowThresholdInput) {
        if (detector.config.lowFreqThreshold_dB_isAuto === true) {
          // Auto 模式：清空 value，在 placeholder 中顯示計算值（絕對值），並設定灰色樣式
          let displayValue = Math.abs(detector.config.lowFreqThreshold_dB);  // 轉換為絕對值
          
          if (calls.length > 0) {
            const firstCall = calls[0];
            if (firstCall.lowFreqThreshold_dB_used !== null && firstCall.lowFreqThreshold_dB_used !== undefined) {
              // 使用實際檢測到的 call 使用的 threshold 值（轉換為絕對值）
              displayValue = Math.abs(firstCall.lowFreqThreshold_dB_used);
            }
          }
          
          batCallLowThresholdInput.value = '';  // 清空 value
          batCallLowThresholdInput.placeholder = `Auto (${displayValue})`;  // 更新 placeholder，顯示絕對值
          batCallLowThresholdInput.style.color = '#999';  // 灰色
        } else {
          // Manual 模式：保持用戶輸入的值（已經是絕對值），黑色文字
          batCallLowThresholdInput.value = Math.abs(detector.config.lowFreqThreshold_dB).toString();
          batCallLowThresholdInput.placeholder = 'Auto';  // 恢復預設 placeholder
          batCallLowThresholdInput.style.color = '#000';  // 黑色
        }
      }
      
      // 更新 UI 以反映實際使用的 highpassFilterFreq 值
      // Auto mode 時：清空 value，在 placeholder 中顯示 "Auto (40)" 格式，灰色樣式
      // Manual mode 時：顯示用戶設定的值
      if (!highpassFilterFreqInput) {
        highpassFilterFreqInput = popup.querySelector('#highpassFilterFreq_kHz');
      }
      if (highpassFilterFreqInput) {
        if (detector.config.highpassFilterFreq_kHz_isAuto === true) {
          // Auto 模式：清空 value，在 placeholder 中顯示計算值，並設定灰色樣式
          const displayValue = detector.config.highpassFilterFreq_kHz;  // 已在 updateBatCallAnalysis 開始時計算
          
          highpassFilterFreqInput.value = '';  // 清空 value
          highpassFilterFreqInput.placeholder = `Auto (${displayValue})`;  // 更新 placeholder，顯示計算值
          highpassFilterFreqInput.style.color = '#999';  // 灰色
        } else {
          // Manual 模式：顯示用戶設定的值，黑色文字
          highpassFilterFreqInput.value = detector.config.highpassFilterFreq_kHz.toString();
          highpassFilterFreqInput.placeholder = 'Auto';  // 恢復預設 placeholder
          highpassFilterFreqInput.style.color = '#000';  // 黑色
        }
      }
      
      if (calls.length > 0) {
        const call = calls[0];  // 取第一個偵測到的 call
        
        // 2025 NEW: Log SNR calculation mechanism and details
        console.log('[SNR Calculation] Detection completed');
        if (call.snrMechanism) {
          console.log(`[SNR Mechanism] ${call.snrMechanism}`);
        }
        if (call.snrDetails) {
          console.log(
            `[SNR Range] Frequency: ${call.snrDetails.frequencyRange_kHz?.lowFreq?.toFixed(1) || '-'} ` +
            `to ${call.snrDetails.frequencyRange_kHz?.highFreq?.toFixed(1) || '-'} kHz, ` +
            `Time frames: ${call.snrDetails.timeRange_frames?.start || '-'} ` +
            `to ${call.snrDetails.timeRange_frames?.end || '-'} ` +
            `(${call.snrDetails.timeRange_frames?.duration || '-'} frames)`
          );
          console.log(
            `[SNR Values] Signal power: ${call.snrDetails.signalPowerMean_dB?.toFixed(1) || '-'} dB (${call.snrDetails.signalCount || '-'} bins), ` +
            `Noise power: ${call.snrDetails.noisePowerMean_dB?.toFixed(1) || '-'} dB (${call.snrDetails.noiseCount || '-'} bins)`
          );
        }
        console.log(`[SNR Result] SNR = ${call.snr_dB?.toFixed(2) || '-'} dB, Quality: ${call.quality || '-'}`);
        
        // 2025: 存儲最新檢測到的 call 對象到 popup 上，供 selection rect warning 圖標使用
        popup.__latestDetectedCall = call;
        updateParametersDisplay(popup, call);
      } else {
        // 如果沒有偵測到 call，所有參數顯示 '-'（包括 peak freq）
        popup.__latestDetectedCall = null;
        updateParametersDisplay(popup, null);
      }
    } catch (err) {
      console.error('Bat call detection error:', err);
      popup.__latestDetectedCall = null;
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
  const batCallLowThresholdInput = popup.querySelector('#lowThreshold_dB');
  const batCallCharFreqPercentInput = popup.querySelector('#characteristicFreq_percentEnd');
  const batCallMinDurationInput = popup.querySelector('#minCallDuration_ms');
  const batCallHopPercentInput = popup.querySelector('#hopPercent');
  const batCallFFTSizeBtn = popup.querySelector('#batCallFFTSize');
  
  // 2025 Anti-Rebounce Controls
  const antiRebounceCheckboxForListeners = popup.querySelector('#enableBackwardEndFreqScan');
  const maxFreqDropInputForListeners = popup.querySelector('#maxFrequencyDropThreshold_kHz');
  const protectionWindowInputForListeners = popup.querySelector('#protectionWindowAfterPeak_ms');
  // 2025 Highpass Filter Controls
  const highpassFilterCheckboxForListeners = popup.querySelector('#enableHighpassFilter');
  const highpassFilterFreqInputForListeners = popup.querySelector('#highpassFilterFreq_kHz');
  const highpassFilterOrderInputForListeners = popup.querySelector('#highpassFilterOrder');

  // 初始化 FFT Size Dropdown
  const batCallFFTDropdown = initDropdown(batCallFFTSizeBtn, [
    { label: '512', value: '512' },
    { label: '1024', value: '1024' },
    { label: '2048', value: '2048' }
  ], {
    onChange: async () => {
      // 更新 Bat Call 配置和全局記憶
      const fftSizeItems = ['512', '1024', '2048'];
      const newFftSize = parseInt(fftSizeItems[batCallFFTDropdown.selectedIndex] || '1024', 10);
      batCallConfig.fftSize = newFftSize;
      
      // 保存到全局記憶
      window.__batCallControlsMemory.fftSize = newFftSize.toString();
      
      // 更新 UI 按鈕文本
      batCallFFTSizeBtn.textContent = newFftSize.toString();
      
      // 更新 detector 配置
      detector.config = { ...batCallConfig };
      await updateBatCallAnalysis(lastPeakFreq);
    }
  });

  // 設置初始選項：根據記憶中的 FFT size 值
  const fftSizeItems = ['512', '1024', '2048'];
  const fftSizeIndex = fftSizeItems.indexOf(batCallConfig.fftSize.toString());
  batCallFFTDropdown.select(fftSizeIndex >= 0 ? fftSizeIndex : 1, { triggerOnChange: false }); // Default to '1024'

  // 2025: 追蹤前一個 mode 狀態，用於檢測 mode 改變
  let lastHighFreqAutoMode = window.__batCallControlsMemory.highFreqThreshold_dB_isAuto !== false;
  let lastLowFreqAutoMode = window.__batCallControlsMemory.lowFreqThreshold_dB_isAuto !== false;

  // 通用函數：更新所有 Bat Call 配置
  const updateBatCallConfig = async () => {
    // 2025: 保存舊的 mode 狀態用於檢測改變
    const oldHighFreqAutoMode = lastHighFreqAutoMode;
    const oldLowFreqAutoMode = lastLowFreqAutoMode;
    
    // callThreshold_dB: 用戶輸入絕對值，轉換為負值用於計算
    const callThreshValue = parseFloat(batCallThresholdInput.value) || 24;
    batCallConfig.callThreshold_dB = -callThreshValue;  // 轉換為負值
    
    // 處理 High Frequency Threshold 的 Auto/Manual 模式
    // 新 UI 格式：
    // 處理 High Frequency Threshold 的 Auto/Manual 模式
    // 新 UI 格式：
    // - Auto 模式：value 為空（placeholder 顯示 "Auto (24)"）→ 設定 isAuto = true
    // - Manual 模式：value 顯示用戶輸入的絕對值 "24" → 轉換為 -24 設定 isAuto = false
    const highFreqThresholdValue = batCallHighThresholdInput.value.trim();
    
    if (highFreqThresholdValue === '') {
      // Auto 模式：value 為空字符串
      batCallConfig.highFreqThreshold_dB_isAuto = true;
      batCallConfig.highFreqThreshold_dB = -24;  // 預設值，會被 findOptimalHighFrequencyThreshold 覆蓋
      // Auto 模式不修改顯示，由 updateBatCallAnalysis 更新
      
      // 2025: 如果從 manual 切換到 auto，需要清除舊的 call 數據
      // 因為舊的 call 對象可能保存了 manual mode 計算的 threshold 值
      if (oldHighFreqAutoMode === false) {
        // 從 manual 切換到 auto：清空 input value 並強制重新檢測
        // 這樣新的 call 對象會有正確的 auto mode threshold 值
        batCallHighThresholdInput.value = '';
      }
    } else {
      // Manual 模式：嘗試解析為數字（絕對值），轉換為負值
      const numValue = parseFloat(highFreqThresholdValue);
      if (!isNaN(numValue)) {
        batCallConfig.highFreqThreshold_dB_isAuto = false;
        batCallConfig.highFreqThreshold_dB = -numValue;  // 轉換為負值
      } else {
        // 無效輸入，回退到 Auto
        batCallConfig.highFreqThreshold_dB_isAuto = true;
        batCallConfig.highFreqThreshold_dB = -24;
      }
    }
    
    batCallConfig.characteristicFreq_percentEnd = parseInt(batCallCharFreqPercentInput.value) || 20;
    batCallConfig.minCallDuration_ms = parseInt(batCallMinDurationInput.value) || 2;
    batCallConfig.hopPercent = parseInt(batCallHopPercentInput.value) || 3.125;
    
    // 處理 Low Frequency Threshold 的 Auto/Manual 模式
    // 新 UI 格式：
    // - Auto 模式：value 為空（placeholder 顯示 "Auto (27)"）→ 設定 isAuto = true
    // - Manual 模式：value 顯示用戶輸入的絕對值 "27" → 轉換為 -27 設定 isAuto = false
    const lowFreqThresholdValue = batCallLowThresholdInput.value.trim();
    
    if (lowFreqThresholdValue === '') {
      // Auto 模式：value 為空字符串
      batCallConfig.lowFreqThreshold_dB_isAuto = true;
      batCallConfig.lowFreqThreshold_dB = -27;  // 預設值，會被 findOptimalLowFrequencyThreshold 覆蓋
      // Auto 模式不修改顯示，由 updateBatCallAnalysis 更新
      
      // 2025: 如果從 manual 切換到 auto，需要清除舊的 call 數據
      // 因為舊的 call 對象可能保存了 manual mode 計算的 threshold 值
      if (oldLowFreqAutoMode === false) {
        // 從 manual 切換到 auto：清空 input value 並強制重新檢測
        // 這樣新的 call 對象會有正確的 auto mode threshold 值
        batCallLowThresholdInput.value = '';
      }
    } else {
      // Manual 模式：嘗試解析為數字（絕對值），轉換為負值
      const numValue = parseFloat(lowFreqThresholdValue);
      if (!isNaN(numValue)) {
        batCallConfig.lowFreqThreshold_dB_isAuto = false;
        batCallConfig.lowFreqThreshold_dB = -numValue;  // 轉換為負值
      } else {
        // 無效輸入，回退到 Auto
        batCallConfig.lowFreqThreshold_dB_isAuto = true;
        batCallConfig.lowFreqThreshold_dB = -27;
      }
    }
    
    // 2025 Anti-Rebounce 參數
    // 注意：每次都重新查詢元素，確保獲取最新的 DOM 節點
    let antiRebounceCheckbox = antiRebounceCheckboxForListeners || popup.querySelector('#enableBackwardEndFreqScan');
    let maxFreqDropInput = maxFreqDropInputForListeners || popup.querySelector('#maxFrequencyDropThreshold_kHz');
    let protectionWindowInput = protectionWindowInputForListeners || popup.querySelector('#protectionWindowAfterPeak_ms');
    // 2025 Highpass Filter Controls
    let highpassFilterCheckbox = highpassFilterCheckboxForListeners || popup.querySelector('#enableHighpassFilter');
    let highpassFilterFreqInput = highpassFilterFreqInputForListeners || popup.querySelector('#highpassFilterFreq_kHz');
    let highpassFilterOrderInput = highpassFilterOrderInputForListeners || popup.querySelector('#highpassFilterOrder');
    
    if (antiRebounceCheckbox) {
      batCallConfig.enableBackwardEndFreqScan = antiRebounceCheckbox.checked;
    }
    if (maxFreqDropInput) {
      batCallConfig.maxFrequencyDropThreshold_kHz = parseFloat(maxFreqDropInput.value) || 10;
    }
    if (protectionWindowInput) {
      batCallConfig.protectionWindowAfterPeak_ms = parseFloat(protectionWindowInput.value) || 10;
    }
    // 2025 Highpass Filter Config Update
    if (highpassFilterCheckbox) {
      batCallConfig.enableHighpassFilter = highpassFilterCheckbox.checked;
    }
    if (highpassFilterFreqInput) {
      // 處理 Highpass Filter Frequency 的 Auto/Manual 模式
      // - Auto 模式：value 為空（placeholder 顯示 "Auto (40)"）→ 設定 isAuto = true
      // - Manual 模式：value 顯示用戶輸入的數值 "40" → 設定 isAuto = false
      const highpassFreqValue = highpassFilterFreqInput.value.trim();
      
      if (highpassFreqValue === '') {
        // Auto 模式：value 為空字符串
        batCallConfig.highpassFilterFreq_kHz_isAuto = true;
        batCallConfig.highpassFilterFreq_kHz = 40;  // 預設值，會被 updateBatCallAnalysis 計算覆蓋
      } else {
        // Manual 模式：嘗試解析為數字
        const numValue = parseFloat(highpassFreqValue);
        if (!isNaN(numValue)) {
          batCallConfig.highpassFilterFreq_kHz_isAuto = false;
          batCallConfig.highpassFilterFreq_kHz = numValue;
        } else {
          // 無效輸入，回退到 Auto
          batCallConfig.highpassFilterFreq_kHz_isAuto = true;
          batCallConfig.highpassFilterFreq_kHz = 40;
        }
      }
    }
    if (highpassFilterOrderInput) {
      batCallConfig.highpassFilterOrder = parseInt(highpassFilterOrderInput.value) || 4;
    }
    
    // 保存到全局記憶中
    window.__batCallControlsMemory = {
      callThreshold_dB: batCallConfig.callThreshold_dB,
      highFreqThreshold_dB: batCallConfig.highFreqThreshold_dB,
      highFreqThreshold_dB_isAuto: batCallConfig.highFreqThreshold_dB_isAuto,
      lowFreqThreshold_dB: batCallConfig.lowFreqThreshold_dB,
      lowFreqThreshold_dB_isAuto: batCallConfig.lowFreqThreshold_dB_isAuto,
      characteristicFreq_percentEnd: batCallConfig.characteristicFreq_percentEnd,
      minCallDuration_ms: batCallConfig.minCallDuration_ms,
      fftSize: batCallConfig.fftSize.toString(),
      hopPercent: batCallConfig.hopPercent,
      // 2025 Anti-Rebounce
      enableBackwardEndFreqScan: batCallConfig.enableBackwardEndFreqScan,
      maxFrequencyDropThreshold_kHz: batCallConfig.maxFrequencyDropThreshold_kHz,
      protectionWindowAfterPeak_ms: batCallConfig.protectionWindowAfterPeak_ms,
      // 2025 Highpass Filter
      enableHighpassFilter: batCallConfig.enableHighpassFilter,
      highpassFilterFreq_kHz: batCallConfig.highpassFilterFreq_kHz,
      highpassFilterFreq_kHz_isAuto: batCallConfig.highpassFilterFreq_kHz_isAuto,
      highpassFilterOrder: batCallConfig.highpassFilterOrder
    };
    
    // 2025 CRITICAL FIX: 檢測 mode 是否改變
    // 如果從 manual 切換到 auto mode，需要清除舊的 call 數據強制重新檢測
    // 因為舊的 call 對象保存的是 manual mode 的 threshold 值
    const highFreqModeChanged = (lastHighFreqAutoMode !== batCallConfig.highFreqThreshold_dB_isAuto);
    const lowFreqModeChanged = (lastLowFreqAutoMode !== batCallConfig.lowFreqThreshold_dB_isAuto);
    
    // 更新 mode 狀態以供下一次比較
    lastHighFreqAutoMode = batCallConfig.highFreqThreshold_dB_isAuto;
    lastLowFreqAutoMode = batCallConfig.lowFreqThreshold_dB_isAuto;
    
    if (highFreqModeChanged || lowFreqModeChanged) {
      // Mode 改變時，強制重新檢測以獲得正確的 threshold 值
      // （input value 已在上面的邏輯中被清空）
    }
    
    // 2025: Auto Mode 時，根據原始 spectrum 的 peakFreq 計算自動高通濾波器頻率
    // 這與 SNR 計算邏輯一致，都使用原始（未濾波）音頻的峰值頻率
    if (batCallConfig.highpassFilterFreq_kHz_isAuto === true && lastPeakFreq) {
      batCallConfig.highpassFilterFreq_kHz = calculateAutoHighpassFilterFreq(lastPeakFreq);
    }
    
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
          
          // 特殊處理 highThreshold 和 lowThreshold input
          // 支持格式：空白 / "auto" / 純數值（絕對值）
          if (inputElement.id === 'highThreshold_dB' || inputElement.id === 'lowThreshold_dB') {
            const currentValue = inputElement.value.trim().toLowerCase();
            
            // 檢查是否是 Auto 模式（空白或"auto"）
            if (currentValue === '' || currentValue === 'auto') {
              // 從 Auto 切換到 24 (絕對值)
              inputElement.value = '24';
              inputElement.style.color = '#000';
              inputElement.style.fontStyle = 'normal';
            } else {
              // 數值增加，使用 step 值（0.5）
              const step = parseFloat(inputElement.step) || 1;
              const numValue = parseFloat(currentValue);
              if (!isNaN(numValue)) {
                const newValue = numValue + step;
                const max = inputElement.max ? parseFloat(inputElement.max) : Infinity;
                inputElement.value = Math.min(newValue, max).toString();
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
          
          // 特殊處理 highThreshold 和 lowThreshold input
          // 支持格式：空白 / "auto" / 純數值（絕對值）
          if (inputElement.id === 'highThreshold_dB' || inputElement.id === 'lowThreshold_dB') {
            const currentValue = inputElement.value.trim().toLowerCase();
            
            // 檢查是否是 Auto 模式（空白或"auto"）
            if (currentValue === '' || currentValue === 'auto') {
              // 從 Auto 切換到 70 (絕對值)
              inputElement.value = '70';
              inputElement.style.color = '#000';
              inputElement.style.fontStyle = 'normal';
            } else {
              // 數值減少，使用 step 值（0.5）
              const step = parseFloat(inputElement.step) || 1;
              const numValue = parseFloat(currentValue);
              if (!isNaN(numValue)) {
                const newValue = numValue - step;
                const min = inputElement.min ? parseFloat(inputElement.min) : -Infinity;
                inputElement.value = Math.max(newValue, min).toString();
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
    
    // 支持小數點輸入 - 允許數字、小數點和負號
    inputElement.addEventListener('keypress', (e) => {
      const char = e.key;
      const currentValue = inputElement.value;
      
      // 允許的字符：0-9, '.', '-'
      const isDigit = /[0-9]/.test(char);
      const isDot = char === '.';
      const isMinus = char === '-';
      
      if (!isDigit && !isDot && !isMinus) {
        e.preventDefault();
        return;
      }
      
      // 防止多個小數點
      if (isDot && currentValue.includes('.')) {
        e.preventDefault();
        return;
      }
      
      // 防止負號不在最開頭
      if (isMinus && currentValue !== '') {
        e.preventDefault();
        return;
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

  batCallLowThresholdInput.addEventListener('change', updateBatCallConfig);
  batCallLowThresholdInput.addEventListener('input', () => {
    clearTimeout(batCallLowThresholdInput._updateTimeout);
    batCallLowThresholdInput._updateTimeout = setTimeout(updateBatCallConfig, 30);
  });
  addNumberInputKeyboardSupport(batCallLowThresholdInput);

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

  // 2025 Highpass Filter Checkbox
  if (highpassFilterCheckboxForListeners) {
    highpassFilterCheckboxForListeners.addEventListener('change', updateBatCallConfig);
  }

  // 2025 Highpass Filter Frequency Input
  if (highpassFilterFreqInputForListeners) {
    highpassFilterFreqInputForListeners.addEventListener('change', updateBatCallConfig);
    highpassFilterFreqInputForListeners.addEventListener('input', () => {
      clearTimeout(highpassFilterFreqInputForListeners._updateTimeout);
      highpassFilterFreqInputForListeners._updateTimeout = setTimeout(updateBatCallConfig, 30);
    });
    addNumberInputKeyboardSupport(highpassFilterFreqInputForListeners);
  }

  // 2025 Highpass Filter Order Input
  if (highpassFilterOrderInputForListeners) {
    highpassFilterOrderInputForListeners.addEventListener('change', updateBatCallConfig);
    highpassFilterOrderInputForListeners.addEventListener('input', () => {
      clearTimeout(highpassFilterOrderInputForListeners._updateTimeout);
      highpassFilterOrderInputForListeners._updateTimeout = setTimeout(updateBatCallConfig, 30);
    });
    addNumberInputKeyboardSupport(highpassFilterOrderInputForListeners);
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
  
  // 添加 Setting 按鈕
  // 2025: Generate unique ID for each popup's settings button to allow independent control
  const settingBtn = document.createElement('button');
  settingBtn.className = 'power-spectrum-settings-btn';
  const uniqueSettingsId = `powerSpectrumSettingsBtn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  settingBtn.id = uniqueSettingsId;
  settingBtn.innerHTML = '<i class="fa-solid fa-sliders"></i>';
  settingBtn.title = 'Settings';
  svgContainer.appendChild(settingBtn);
  
  // 2025: Store reference to settings button in popup for later access
  popup.settingsButton = settingBtn;
  popup.settingsButtonId = uniqueSettingsId;
  
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
  controlPanel.style.display = 'none';  // 預設隱藏

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
        <span class="param-value high-freq">-</span>
      </td>      
      <td class="param-unit">kHz</td>
      <td class="param-label">Low Freq:</td>
      <td class="param-value-container low-freq-container" style="text-align: right; align-items: center;">
        <span class="param-value low-freq">-</span>
      </td>
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
      <td class="param-label">Bandwidth:</td>
      <td class="param-value bandwidth">-</td>
      <td class="param-unit">kHz</td>
    </tr>    
    <tr>
      <td class="param-label">Start Time:</td>
      <td class="param-value startfreq-time">-</td>
      <td class="param-unit">ms</td>
      <td class="param-label">End Time:</td>
      <td class="param-value endfreq-time">-</td>
      <td class="param-unit">ms</td>
    </tr>
    <tr>
      <td class="param-label">High Time:</td>
      <td class="param-value highfreq-time">-</td>
      <td class="param-unit">ms</td>
      <td class="param-label">Low Time:</td>
      <td class="param-value lowfreq-time">-</td>
      <td class="param-unit">ms</td>
    </tr>
    <tr>
      <td class="param-label">Peak Time:</td>
      <td class="param-value peakfreq-time">-</td>
      <td class="param-unit">ms</td>
      <td class="param-label">Char Time:</td>
      <td class="param-value charfreq-time">-</td>
      <td class="param-unit">ms</td>
    </tr>
    <tr>
      <td class="param-label">Knee Time:</td>
      <td class="param-value knee-time">-</td>
      <td class="param-unit">ms</td>    
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
  batCallControlPanel.style.display = 'none';  // 預設隱藏

  // callThreshold_dB 控制
  const callThresholdControl = document.createElement('label');
  const callThresholdLabel = document.createElement('span');
  callThresholdLabel.textContent = 'Call Thresh:';
  callThresholdControl.appendChild(callThresholdLabel);
  
  const callThresholdInput = document.createElement('input');
  callThresholdInput.id = 'callThreshold_dB';
  callThresholdInput.type = 'number';
  // 顯示絕對值 (正數)
  callThresholdInput.value = Math.abs(window.__batCallControlsMemory.callThreshold_dB).toString();
  callThresholdInput.step = '1';
  callThresholdInput.title = 'Energy threshold (dB) - display absolute value';
  callThresholdControl.appendChild(callThresholdInput);
  batCallControlPanel.appendChild(callThresholdControl);

  // highFreqThreshold_dB 控制 (Auto 和 Manual 模式)
  // 用於 High Frequency 邊界計算，獨立於 End/Low Frequency 的固定 -27dB 閾值
  const highThresholdControl = document.createElement('label');
  const highThresholdLabel = document.createElement('span');
  highThresholdLabel.textContent = 'High Thresh:';
  highThresholdControl.appendChild(highThresholdLabel);
  
  // Input field (可顯示 Auto 或具體數值)
  const highThresholdInput = document.createElement('input');
  highThresholdInput.id = 'highThreshold_dB';
  highThresholdInput.type = 'number';
  highThresholdInput.placeholder = 'Auto';
  highThresholdInput.title = 'Auto or Manual High Frequency threshold (-24 to -70)';
  highThresholdInput.style.width = '69px';
  highThresholdInput.min = '24';
  highThresholdInput.max = '70';
  highThresholdInput.step = '0.5';
  
  // 根據模式初始化顯示
  const isAutoMode = window.__batCallControlsMemory.highFreqThreshold_dB_isAuto !== false;
  if (isAutoMode) {
    // Auto 模式：顯示 "Auto" 格式，灰色樣式
    highThresholdInput.value = '';  // 初始時為空白，等待第一次計算
    highThresholdInput.style.color = '#999';
  } else {
    // Manual 模式：顯示具體值（絕對值），黑色樣式
    highThresholdInput.value = Math.abs(window.__batCallControlsMemory.highFreqThreshold_dB).toString();
    highThresholdInput.style.color = '#000';
  }
  
  highThresholdControl.appendChild(highThresholdInput);
  batCallControlPanel.appendChild(highThresholdControl);

  // lowFreqThreshold_dB 控制 (Auto 和 Manual 模式)
  // 用於 Low Frequency 邊界計算，對稱於 High Frequency 控制
  const lowThresholdControl = document.createElement('label');
  const lowThresholdLabel = document.createElement('span');
  lowThresholdLabel.textContent = 'Low Thresh:';
  lowThresholdControl.appendChild(lowThresholdLabel);
  
  // Input field (可顯示 Auto 或具體數值)
  const lowThresholdInput = document.createElement('input');
  lowThresholdInput.id = 'lowThreshold_dB';
  lowThresholdInput.type = 'number';
  lowThresholdInput.placeholder = 'Auto';
  lowThresholdInput.title = 'Auto or Manual Low Frequency threshold (-24 to -70)';
  lowThresholdInput.style.width = '69px';
  lowThresholdInput.min = '24';  // 絕對值範圍
  lowThresholdInput.max = '70';
  lowThresholdInput.step = '0.5';
  
  // 根據模式初始化顯示
  const isLowAutoMode = window.__batCallControlsMemory.lowFreqThreshold_dB_isAuto !== false;
  if (isLowAutoMode) {
    // Auto 模式：顯示 "Auto" 格式，灰色樣式
    lowThresholdInput.value = '';  // 初始時為空白，等待第一次計算
    lowThresholdInput.style.color = '#999';
  } else {
    // Manual 模式：顯示具體值（絕對值），黑色樣式
    lowThresholdInput.value = Math.abs(window.__batCallControlsMemory.lowFreqThreshold_dB).toString();
    lowThresholdInput.style.color = '#000';
  }
  
  lowThresholdControl.appendChild(lowThresholdInput);
  batCallControlPanel.appendChild(lowThresholdControl);

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
  minDurationLabel.textContent = 'Min Dur:';
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
  fftSizeLabel.textContent = 'FFT:';
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
  protectionWindowInput.max = '20';
  protectionWindowInput.step = '1';
  protectionWindowInput.title = 'Protection window after peak energy (ms)';
  protectionWindowControl.appendChild(protectionWindowInput);
  
  const protectionWindowUnit = document.createElement('span');
  protectionWindowUnit.textContent = 'ms';
  protectionWindowControl.appendChild(protectionWindowUnit);
  batCallControlPanel.appendChild(protectionWindowControl);

  // ============================================================
  // HIGHPASS FILTER CONTROL
  // ============================================================
  
  // enableHighpassFilter (Checkbox)
  const highpassFilterControl = document.createElement('label');
  const highpassFilterCheckbox = document.createElement('input');
  highpassFilterCheckbox.id = 'enableHighpassFilter';
  highpassFilterCheckbox.type = 'checkbox';
  highpassFilterCheckbox.checked = window.__batCallControlsMemory.enableHighpassFilter !== false;
  highpassFilterCheckbox.title = 'Enable Butterworth highpass filter before call measurement';
  highpassFilterControl.appendChild(highpassFilterCheckbox);
  
  const highpassFilterLabel = document.createElement('span');
  highpassFilterLabel.textContent = 'Highpass filter:';
  highpassFilterControl.appendChild(highpassFilterLabel);
  batCallControlPanel.appendChild(highpassFilterControl);

  // highpassFilterFreq_kHz (Number input with Auto/Manual mode)
  const highpassFreqControl = document.createElement('label');
  const highpassFreqInput = document.createElement('input');
  highpassFreqInput.id = 'highpassFilterFreq_kHz';
  highpassFreqInput.type = 'number';
  highpassFreqInput.min = '5';
  highpassFreqInput.max = '100';
  highpassFreqInput.step = '5';
  highpassFreqInput.title = 'Highpass filter frequency (kHz) - leave empty for Auto mode';
  
  // 初始化：根據 isAuto 標誌設置值、placeholder 和樣式
  const isHighpassFreqAuto = window.__batCallControlsMemory.highpassFilterFreq_kHz_isAuto !== false;
  if (isHighpassFreqAuto) {
    // Auto 模式：value 為空，placeholder 顯示 "Auto (value)"，灰色文字
    highpassFreqInput.value = '';
    highpassFreqInput.placeholder = `Auto (${window.__batCallControlsMemory.highpassFilterFreq_kHz || 40})`;
    highpassFreqInput.style.color = '#999';
  } else {
    // Manual 模式：value 顯示用戶設定的數值，黑色文字
    highpassFreqInput.value = (window.__batCallControlsMemory.highpassFilterFreq_kHz || 40).toString();
    highpassFreqInput.placeholder = 'Auto';
    highpassFreqInput.style.color = '#000';
  }
  
  highpassFreqControl.appendChild(highpassFreqInput);
  
  const highpassFreqUnit = document.createElement('span');
  highpassFreqUnit.textContent = 'kHz';
  highpassFreqControl.appendChild(highpassFreqUnit);
  batCallControlPanel.appendChild(highpassFreqControl);

  // highpassFilterOrder (Number input)
  const highpassOrderControl = document.createElement('label');
  const highpassOrderLabel = document.createElement('span');
  highpassOrderLabel.textContent = 'Filter order:';
  highpassOrderControl.appendChild(highpassOrderLabel);
  
  const highpassOrderInput = document.createElement('input');
  highpassOrderInput.id = 'highpassFilterOrder';
  highpassOrderInput.type = 'number';
  highpassOrderInput.value = window.__batCallControlsMemory.highpassFilterOrder.toString();
  highpassOrderInput.min = '1';
  highpassOrderInput.max = '8';
  highpassOrderInput.step = '1';
  highpassOrderInput.title = 'Highpass filter order (1-8) - controls filter strength';
  highpassOrderControl.appendChild(highpassOrderInput);
  
  batCallControlPanel.appendChild(highpassOrderControl);

  popup.appendChild(batCallControlPanel);

  document.body.appendChild(popup);

  // 拖動功能
  makeDraggable(popup, dragBar);

  // ============================================================
  // 設置按鈕的點擊事件監聽器
  // ============================================================
  // 2025: Use popup's own settings button reference instead of global ID lookup
  // This allows each popup to independently control its own controls panel
  if (settingBtn) {
    settingBtn.addEventListener('click', () => {
      const isHidden = controlPanel.style.display === 'none';
      
      if (isHidden) {
        // 展開 - 移除 display 以恢復 CSS 中的 flex
        controlPanel.style.removeProperty('display');
        batCallControlPanel.style.removeProperty('display');
        popup.style.height = '885px';
        settingBtn.classList.add('active');
      } else {
        // 隱藏
        controlPanel.style.display = 'none';
        batCallControlPanel.style.display = 'none';
        popup.style.height = '696px';
        settingBtn.classList.remove('active');
      }
    });
  }

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

// 導出窗口函數和 Goertzel 工具，供其他模組使用
export function getApplyWindowFunction() {
  // 從 powerSpectrum 模組動態取得
  return (data, windowType) => {
    // 簡單的窗口應用 - 供相容性使用
    // 實際實現在 powerSpectrum.js 中
    const n = data.length;
    const windowed = new Float32Array(n);
    let window;

    const createHannWindow = (n) => {
      const w = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
      }
      return w;
    };

    const createHammingWindow = (n) => {
      const w = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
      }
      return w;
    };

    const createBlackmanWindow = (n) => {
      const w = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (2 * Math.PI * i) / (n - 1);
        w[i] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
      }
      return w;
    };

    const createTriangularWindow = (n) => {
      const w = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        w[i] = 1 - Math.abs((i - (n - 1) / 2) / ((n - 1) / 2));
      }
      return w;
    };

    const createRectangularWindow = (n) => {
      return new Float32Array(n).fill(1);
    };

    const createGaussWindow = (n) => {
      const w = new Float32Array(n);
      const sigma = (n - 1) / 4;
      for (let i = 0; i < n; i++) {
        const x = i - (n - 1) / 2;
        w[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      }
      return w;
    };

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
  };
}

export function getGoertzelEnergyFunction() {
  // 返回 Goertzel 算法函數供相容性使用
  return (audioData, freq, sampleRate) => {
    const w = (2 * Math.PI * freq) / sampleRate;
    const coeff = 2 * Math.cos(w);

    let s0 = 0, s1 = 0, s2 = 0;

    for (let i = 0; i < audioData.length; i++) {
      s0 = audioData[i] + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }

    const realPart = s1 - s2 * Math.cos(w);
    const imagPart = s2 * Math.sin(w);

    const energy = realPart * realPart + imagPart * imagPart;
    return energy;
  };
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
  
  // ============================================================
  // 2025: All time value elements are now in the same merged table
  // ============================================================
  const startFreqTimeEl = paramPanel.querySelector('.startfreq-time');
  const endFreqTimeEl = paramPanel.querySelector('.endfreq-time');
  const highFreqTimeEl = paramPanel.querySelector('.highfreq-time');
  const lowFreqTimeEl = paramPanel.querySelector('.lowfreq-time');
  const peakFreqTimeEl = paramPanel.querySelector('.peakfreq-time');
  const charFreqTimeEl = paramPanel.querySelector('.charfreq-time');
  
  if (batCall) {
    peakFreqEl.textContent = batCall.peakFreq_kHz?.toFixed(2) || '-';
    // Display startFreq_kHz calculated from -24dB threshold (Rule a/b applied)
    startFreqEl.textContent = batCall.startFreq_kHz?.toFixed(2) || '-';
    // Display endFreq_kHz calculated from last frame using -27dB threshold
    endFreqEl.textContent = batCall.endFreq_kHz?.toFixed(2) || '-';
    // Display lowFreq_kHz (may be optimized to use Start Frequency if lower)
    lowFreqEl.textContent = batCall.lowFreq_kHz?.toFixed(2) || '-';
    
    // Display High Freq (warning suppressed - using -30dB safety mechanism)
    highFreqEl.textContent = batCall.highFreq_kHz?.toFixed(2) || '-';
    if (highFreqWarningIcon) {
      highFreqWarningIcon.style.display = 'none';
    }
    highFreqEl.style.color = '#0066cc';  // Blue color for normal value
    
    // Display Low Freq (warning suppressed - using -30dB safety mechanism)
    lowFreqEl.textContent = batCall.lowFreq_kHz?.toFixed(2) || '-';
    lowFreqEl.style.color = '#0066cc';  // Blue color for normal value
    
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
    
    // ============================================================
    // Display Time Values for Frequency Parameters (2 decimal places)
    // All in merged table now
    // ============================================================
    if (startFreqTimeEl) {
      startFreqTimeEl.textContent = batCall.startFreq_ms !== null && batCall.startFreq_ms !== undefined 
        ? batCall.startFreq_ms.toFixed(2) 
        : '-';
    }
    
    if (endFreqTimeEl) {
      endFreqTimeEl.textContent = batCall.endFreq_ms !== null && batCall.endFreq_ms !== undefined 
        ? batCall.endFreq_ms.toFixed(2) 
        : '-';
    }
    
    if (highFreqTimeEl) {
      highFreqTimeEl.textContent = batCall.highFreqTime_ms !== null && batCall.highFreqTime_ms !== undefined 
        ? batCall.highFreqTime_ms.toFixed(2) 
        : '-';
    }
    
    if (lowFreqTimeEl) {
      lowFreqTimeEl.textContent = batCall.lowFreq_ms !== null && batCall.lowFreq_ms !== undefined 
        ? batCall.lowFreq_ms.toFixed(2) 
        : '-';
    }
    
    if (peakFreqTimeEl) {
      peakFreqTimeEl.textContent = batCall.peakFreqTime_ms !== null && batCall.peakFreqTime_ms !== undefined 
        ? batCall.peakFreqTime_ms.toFixed(2) 
        : '-';
    }
    
    if (charFreqTimeEl) {
      charFreqTimeEl.textContent = batCall.characteristicFreq_ms !== null && batCall.characteristicFreq_ms !== undefined 
        ? batCall.characteristicFreq_ms.toFixed(2) 
        : '-';
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
    
    // ============================================================
    // 2025: Clear Time Values when no call data (merged into single table)
    // ============================================================
    if (startFreqTimeEl) startFreqTimeEl.textContent = '-';
    if (endFreqTimeEl) endFreqTimeEl.textContent = '-';
    if (highFreqTimeEl) highFreqTimeEl.textContent = '-';
    if (lowFreqTimeEl) lowFreqTimeEl.textContent = '-';
    if (peakFreqTimeEl) peakFreqTimeEl.textContent = '-';
    if (charFreqTimeEl) charFreqTimeEl.textContent = '-';
  }
}

/**
 * 應用 Butterworth Highpass Filter (支持 order 1-8)
 * @param {Float32Array} audioData - 輸入音頻數據
 * @param {number} filterFreq_Hz - 濾波器截止頻率 (Hz)
 * @param {number} sampleRate - 採樣率 (Hz)
 * @param {number} order - 濾波器階數 (1-8，預設 2)
 * @returns {Float32Array} 濾波後的音頻數據
 */
export function applyButterworthHighpassFilter(audioData, filterFreq_Hz, sampleRate, order = 2) {
  if (!audioData || audioData.length === 0 || filterFreq_Hz <= 0) {
    return audioData;
  }

  // 限制 order 在 1-8 範圍內
  const clampedOrder = Math.max(1, Math.min(8, Math.round(order)));

  // 計算歸一化頻率 (0 to 1, 1 = Nyquist 頻率)
  const nyquistFreq = sampleRate / 2;
  const normalizedFreq = filterFreq_Hz / nyquistFreq;

  // 確保歸一化頻率有效
  if (normalizedFreq >= 1) {
    return audioData;
  }

  // 計算 Butterworth 濾波器係數
  const wc = Math.tan(Math.PI * normalizedFreq / 2);
  const wc2 = wc * wc;
  
  // 應用級聯的濾波器級數
  let filtered = new Float32Array(audioData);
  
  // 對於 order 1 和 2，直接應用
  // 對於 order > 2，級聯多個 2 階濾波器和 1 個 1 階濾波器（若需要）
  const numOf2ndOrder = Math.floor(clampedOrder / 2);
  const has1stOrder = (clampedOrder % 2) === 1;
  
  // 應用多個 2nd order 級聯
  for (let stage = 0; stage < numOf2ndOrder; stage++) {
    filtered = applyButterworthStage(filtered, wc, 2);
  }
  
  // 如果階數是奇數，應用一個 1st order 級聯
  if (has1stOrder) {
    filtered = applyButterworthStage(filtered, wc, 1);
  }
  
  return filtered;
}

/**
 * 應用特定階數的 Butterworth Highpass Filter 級
 */
function applyButterworthStage(audioData, wc, order) {
  const wc2 = wc * wc;
  
  if (order === 1) {
    // 1st order highpass filter
    const denom = wc + 1;
    const b0 = 1 / denom;
    const b1 = -1 / denom;
    const a1 = (wc - 1) / denom;
    
    const result = new Float32Array(audioData.length);
    let y1 = 0, x1 = 0;
    
    for (let i = 0; i < audioData.length; i++) {
      const x0 = audioData[i];
      const y0 = b0 * x0 + b1 * x1 - a1 * y1;
      result[i] = y0;
      x1 = x0;
      y1 = y0;
    }
    return result;
  } else {
    // 2nd order Butterworth highpass filter
    const sqrt2wc = Math.sqrt(2) * wc;
    const denom = wc2 + sqrt2wc + 1;
    
    const b0 = 1 / denom;
    const b1 = -2 / denom;
    const b2 = 1 / denom;
    const a1 = (2 * (wc2 - 1)) / denom;
    const a2 = (wc2 - sqrt2wc + 1) / denom;
    
    const result = new Float32Array(audioData.length);
    let y1 = 0, y2 = 0, x1 = 0, x2 = 0;
    
    for (let i = 0; i < audioData.length; i++) {
      const x0 = audioData[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      result[i] = y0;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }
    return result;
  }
}
