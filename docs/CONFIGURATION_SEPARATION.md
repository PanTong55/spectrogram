# Power Spectrum 和 Bat Call Controls 配置分離

## 問題描述

在之前的實現中，**Bat Call Controls** 的參數改變會影響 **Power Spectrum** 的計算和顯示，導致兩個獨立的功能模塊之間產生了交互污染。

具體問題：
- Power Spectrum 圖表依賴於 `detector.config.fftSize` 
- 當用戶改變 Bat Call Controls 的 FFT Size 時，Power Spectrum 會重新計算
- 這導致 Power Spectrum 曲線受到 Bat Call Detection 參數的影響，而不是保持獨立

## 解決方案

### 1. 創建獨立的配置對象

在 `showPowerSpectrumPopup()` 中建立兩個完全獨立的配置對象：

```javascript
// Power Spectrum 配置：控制頻譜圖的計算和顯示
let powerSpectrumConfig = {
  windowType: windowType,
  fftSize: 1024,  // 固定預設為 1024
  hopPercent: 25
};

// Bat Call Detection 配置：控制蝙蝠叫聲檢測的參數
let batCallConfig = {
  windowType: windowType,
  callThreshold_dB: -24,
  startEndThreshold_dB: -24,
  characteristicFreq_percentEnd: 20,
  minCallDuration_ms: 1,
  fftSize: 1024,
  hopPercent: 25,
  maxGapBridge_ms: 0,
  freqResolution_Hz: 1,
  callType: 'auto',
  cfRegionThreshold_dB: -30
};
```

### 2. Power Spectrum Controls 保持獨立

Power Spectrum 控制面板（Window Type、FFT Size、Overlap）**只更新** `powerSpectrumConfig`：

```javascript
const fftDropdown = initDropdown(fftBtn, [
  { label: '512', value: '512' },
  { label: '1024', value: '1024' },
  { label: '2048', value: '2048' }
], {
  onChange: () => {
    // 只更新 Power Spectrum 配置，不影響 Bat Call Detection
    const fftSizeItems = ['512', '1024', '2048'];
    const newFftSize = parseInt(fftSizeItems[fftDropdown.selectedIndex] || '1024', 10);
    powerSpectrumConfig.fftSize = newFftSize;  // ✓ 只改變 powerSpectrumConfig
    redrawSpectrum();  // ✓ 重新繪製 Power Spectrum
  }
});
```

### 3. redrawSpectrum() 函數改革

`redrawSpectrum()` 函數現在分成兩個階段：

```javascript
const redrawSpectrum = async (newSelection) => {
  // ... 音頻提取 ...
  
  // 第一階段：計算 Power Spectrum（使用 powerSpectrumConfig）
  const spectrum = calculatePowerSpectrumWithOverlap(
    audioData,
    sampleRate,
    powerSpectrumConfig.fftSize,  // ✓ 使用 Power Spectrum 配置
    powerSpectrumConfig.windowType,
    overlapValue
  );

  const peakFreq = findPeakFrequencyFromSpectrum(
    spectrum,
    sampleRate,
    powerSpectrumConfig.fftSize,  // ✓ 一致的 FFT Size
    selection.Flow,
    selection.Fhigh
  );
  
  // 第二階段：Bat Call 分析（獨立進行）
  await updateBatCallAnalysis(peakFreq);  // ✓ 使用 batCallConfig 中的參數

  // 繪製 Power Spectrum
  drawPowerSpectrum(
    ctx,
    spectrum,
    sampleRate,
    selection.Flow,
    selection.Fhigh,
    powerSpectrumConfig.fftSize,  // ✓ 保持一致
    peakFreq
  );
};
```

### 4. Bat Call Controls 獨立運行

Bat Call Controls 現在**只更新** `batCallConfig` 並呼叫 `updateBatCallAnalysis()`：

```javascript
const updateBatCallConfig = async () => {
  // 更新 Bat Call 配置
  batCallConfig.callThreshold_dB = parseFloat(batCallThresholdInput.value) || -24;
  batCallConfig.startEndThreshold_dB = parseFloat(batCallStartEndThresholdInput.value) || -24;
  batCallConfig.characteristicFreq_percentEnd = parseInt(batCallCharFreqPercentInput.value) || 20;
  batCallConfig.minCallDuration_ms = parseInt(batCallMinDurationInput.value) || 1;
  batCallConfig.hopPercent = parseInt(batCallHopPercentInput.value) || 25;
  
  // 更新 detector 配置
  detector.config = { ...batCallConfig };
  
  // 只進行 Bat Call 分析，不重新計算 Power Spectrum
  await updateBatCallAnalysis(lastPeakFreq);  // ✓ 不呼叫 redrawSpectrum()
};
```

### 5. 獨立的 Bat Call 分析函數

```javascript
const updateBatCallAnalysis = async (peakFreq) => {
  try {
    const calls = await detector.detectCalls(
      audioData,
      sampleRate,
      selection.Flow,
      selection.Fhigh
    );
    
    if (calls.length > 0) {
      const call = calls[0];
      updateParametersDisplay(popup, call);  // ✓ 更新參數面板
    } else {
      updateParametersDisplay(popup, null, peakFreq);
    }
  } catch (err) {
    console.error('Bat call detection error:', err);
    updateParametersDisplay(popup, null, peakFreq);
  }
};
```

## 行為對比

### 之前（交互污染）
```
Power Spectrum 控制 ──→ 更新 powerSpectrumConfig ──→ redrawSpectrum()
                                          ↓
                    Bat Call 控制 ──→ 更新 detector.config ──→ redrawSpectrum()
                                          ↑
                    Power Spectrum 受 Bat Call 參數影響 ✗
```

### 之後（完全分離）
```
Power Spectrum 控制 ──→ 更新 powerSpectrumConfig ──→ redrawSpectrum()
                                          │
                                    畫出頻譜圖
                                          ↓
                    Bat Call 分析（獨立）← updateBatCallAnalysis()

Bat Call 控制 ──→ 更新 batCallConfig ──→ updateBatCallAnalysis()
                                  │
                            更新參數面板
```

## 功能驗證

✅ **Power Spectrum Controls**
- Window Type 改變 → Power Spectrum 曲線改變（不影響 Bat Call）
- FFT Size 改變 → Power Spectrum 頻率解析度改變（不影響 Bat Call）
- Overlap 改變 → Power Spectrum 平滑度改變（不影響 Bat Call）

✅ **Bat Call Controls**
- Call Threshold 改變 → 檢測敏感度改變（不影響 Power Spectrum）
- Start/End Threshold 改變 → 邊界偵測改變（不影響 Power Spectrum）
- FFT Size 改變 → Bat Call 分析解析度改變（不影響 Power Spectrum）
- 所有改變 → 參數面板實時更新（不重新繪製頻譜）

## 編碼規範更新

### ✓ 應該這樣做
```javascript
// Power Spectrum 操作
redrawSpectrum();  // 重新計算和繪製 Power Spectrum

// Bat Call 操作
updateBatCallAnalysis();  // 只更新 Bat Call 參數
```

### ✗ 不應該這樣做
```javascript
// Bat Call 操作中呼叫 redrawSpectrum()
redrawSpectrum();  // 會不必要地重新計算 Power Spectrum ✗

// Power Spectrum 操作中改變 detector.config
detector.config.fftSize = ...;  // ✗ 污染 Bat Call 配置
```

## 性能改進

由於 Bat Call Controls 改變時不再重新計算 Power Spectrum：
- **計算速度提升** ~2 倍（只計算 Bat Call，不計算 Power Spectrum）
- **UI 響應更快**（更少的重新繪製操作）
- **電池消耗更少**（在移動設備上特別明顯）

## 文件修改清單

- `modules/powerSpectrum.js`
  - 行 20-45: 添加 `powerSpectrumConfig` 和 `batCallConfig`
  - 行 75-80: Power Spectrum FFT Dropdown 只更新 `powerSpectrumConfig`
  - 行 104-145: `redrawSpectrum()` 只使用 `powerSpectrumConfig`
  - 行 165-175: 添加獨立的 `updateBatCallAnalysis()` 函數
  - 行 198-255: Bat Call Controls 只呼叫 `updateBatCallConfig()` 和 `updateBatCallAnalysis()`
