# 蝙蝠叫聲測量 (Call Measurement) 詳細步驟文檔

## 概述

`BatCallDetector.measureFrequencyParameters()` 函數負責從頻譜圖中測量蝙蝠叫聲的關鍵頻率參數。整個過程分為多個步驟，從找到峰值開始，到計算四個主要頻率（Peak、High、Low、End）結束。

---

## 完整流程圖

```
Selection Area (spectrogram + timeFrames)
         ↓
    STEP 0: 初始化與配置讀取
         ↓
    STEP 1: 計算峰值 (Peak Frequency/Power)
         ├─ 全局掃描找最高功率點
         ├─ 應用拋物線插值
         └─ 記錄 peakFrameIdx, peakPower_dB
         ↓
    STEP 1.5: 自動模式高頻閾值優化 (Auto Mode)
         ├─ 調用 findOptimalHighFrequencyThreshold()
         ├─ 執行防呆檢查
         └─ 追蹤 safeHighFreqFrameIdx
         ↓
    STEP 2: 計算高頻 (High Frequency)
         ├─ Manual Mode: 用戶手動閾值
         ├─ Auto Mode: 使用優化後的閾值
         ├─ 左到右掃描 (0 → peakFrameIdx)
         ├─ 找第一個超過閾值的幀
         └─ 記錄 highFreqFrameIdx, highFreqTime_ms
         ↓
    STEP 2.5: 計算起始頻率 (Start Frequency)
         ├─ 使用 -24dB 固定閾值
         ├─ 掃描第 0 幀
         ├─ 應用低頻 Noise 保護
         └─ 規則 (a)/(b) 邏輯
         ↓
    STEP 3: 計算低頻 (Low Frequency)
         ├─ Manual Mode: 用戶手動閾值
         ├─ Auto Mode: 調用 findOptimalLowFrequencyThreshold()
         └─ 記錄 lowFreqFrameIdx, lowFreqTime_ms
         ↓
    STEP 4: 計算結束頻率 (End Frequency)
         ├─ 後向掃描 (backward scan)
         ├─ 防止 rebounce
         └─ 記錄 endFreqFrameIdx, endFreqTime_ms
         ↓
    Final Call Object with 12 frequency parameters
```

---

## 詳細步驟說明

### STEP 0: 初始化與配置讀取

**目的**: 準備所有必要的輸入參數和配置。

```javascript
// 輸入參數
const spectrogram = call.spectrogram;          // 2D 陣列 [timeFrame][freqBin]
const timeFrames = call.timeFrames;            // 時間戳陣列 (秒)
const freqBins = call.freqBins;                // 頻率 bin 中心 (Hz)
const flowKHz = this.config.flowKHz;           // 最低頻率邊界
const fhighKHz = this.config.fhighKHz;         // 最高頻率邊界
const call = call;                             // 要填入結果的物件

// 配置讀取
this.config.highFreqThreshold_dB_isAuto        // High Frequency 自動模式
this.config.lowFreqThreshold_dB_isAuto         // Low Frequency 自動模式
this.config.highFreqThreshold_dB               // 手動高頻閾值 (相對於峰值)
this.config.lowFreqThreshold_dB                // 手動低頻閾值 (相對於峰值)
```

**關鍵檢查**:
- 頻譜圖不為空: `spectrogram.length > 0`
- 時間幀數與頻譜幀數相同
- 頻率 bins 遞增排序

---

### STEP 1: 計算峰值 (Peak Frequency & Power)

**目的**: 找到整個選擇區域中的最高能量點。

#### Phase 1a: 全局掃描

```javascript
// 掃描所有幀的所有 bins
for (let frameIdx = 0; frameIdx < spectrogram.length; frameIdx++) {
  for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
    if (framePower[binIdx] > peakPower_dB) {
      peakPower_dB = framePower[binIdx];    // dB 值
      peakBinIdx = binIdx;                   // 頻率索引
      peakFrameIdx = frameIdx;               // 時間索引
    }
  }
}
```

**結果**:
- `peakPower_dB`: 最高功率 (dB)
- `peakBinIdx`: 峰值在頻率軸的 bin 索引
- `peakFrameIdx`: 峰值在時間軸的幀索引

#### Phase 1b: 拋物線插值精化

**為什麼需要?**
- 原始 bin 解析度可能不足 (~50 Hz)
- 拋物線插值提供 ~0.1 Hz 精度
- 符合專業標準 (Avisoft, SonoBat, Kaleidoscope)

```javascript
// 若峰值 bin 不在邊界
if (peakBinIdx > 0 && peakBinIdx < spectrogram[peakFrameIdx].length - 1) {
  // 取三個相鄰 bins 的功率值
  const db0 = framePower[peakBinIdx - 1];   // 左側
  const db1 = framePower[peakBinIdx];       // 中心
  const db2 = framePower[peakBinIdx + 1];   // 右側
  
  // 計算二階導數係數
  const a = (db2 - 2 * db1 + db0) / 2;
  
  // 計算 bin 位移修正
  const binCorrection = (db0 - db2) / (4 * a);
  
  // 轉換為實際頻率 (Hz)
  const binWidth = freqBins[1] - freqBins[0];
  peakFreq_Hz = freqBins[peakBinIdx] + binCorrection * binWidth;
}
```

**輸出儲存在 call 物件**:
```javascript
call.peakFreq_kHz = peakFreq_Hz / 1000;
call.peakPower_dB = peakPower_dB;
call.peakFreqTime_ms = (timeFrames[peakFrameIdx] - timeFrames[0]) * 1000;
```

---

### STEP 1.5: 自動模式優化閾值 (Auto Mode Only)

**條件**: `this.config.highFreqThreshold_dB_isAuto === true`

**目的**: 自動找到最佳的高頻檢測閾值，避免異常值跳變。

#### Phase 1.5a: 調用優化函數

```javascript
const result = this.findOptimalHighFrequencyThreshold(
  spectrogram,
  freqBins,
  flowKHz,
  fhighKHz,
  peakPower_dB,      // 使用穩定的峰值功率
  peakFrameIdx       // 限制掃描範圍
);

// 解包結果
safeHighFreq_kHz = result.highFreq_kHz;
safeHighFreq_Hz = result.highFreq_Hz;
safeHighFreqBinIdx = result.highFreqBinIdx;
safeHighFreqFrameIdx = result.highFreqFrameIdx;  // 追蹤哪一幀
```

#### Phase 1.5b: `findOptimalHighFrequencyThreshold()` 內部邏輯

這個函數執行異常偵測演算法：

1. **測試多個閾值** (-24 到 -70 dB，間隔 0.5 dB)
2. **對每個閾值**:
   - 計算 High Frequency (從高到低掃描)
   - 計算 Start Frequency (從低到高掃描)
   - 記錄找到的幀索引 (`frameIndexForBin[]`)

3. **異常偵測**:
   - 相鄰測量的頻率跳變
   - 大於 4.0 kHz: 立即停止 (major anomaly)
   - 2.5-4.0 kHz: 檢查後續 3 個測量是否正常
   - 如果後續正常: 忽略跳變繼續
   - 如果後續有更多異常: 使用跳變前的閾值

4. **返回最優閾值** 及其對應的頻率和幀索引

#### Phase 1.5c: 防呆檢查

如果優化後的 High Frequency < Peak Frequency (異常)：

```javascript
if (result.highFreq_kHz < (peakFreq_Hz / 1000)) {
  // 重新測試閾值，尋找第一個 >= Peak Frequency 的值
  for (let testThreshold_dB = -24; testThreshold_dB >= -70; testThreshold_dB--) {
    // 計算此閾值的 High Frequency...
    if (testHighFreq_Hz >= peakFreq_Hz) {
      // 找到有效值！停止
      safeHighFreq_Hz = testHighFreq_Hz;
      safeHighFreqFrameIdx = testFrameIdx;  // 記錄幀索引
      break;
    }
  }
}

// 更新配置
this.config.highFreqThreshold_dB = usedThreshold;
call.highFreqThreshold_dB_used = usedThreshold;
```

**關鍵改進 (2025)**:
- 現在追蹤 `highFreqFrameIdx` (之前遺失)
- 使用 Max Hold Spectrum 找到最高值所在的幀
- 防呆檢查也保存正確的幀索引

---

### STEP 2: 計算高頻 (High Frequency)

**目的**: 找到叫聲中的最高頻率成分。

**掃描範圍**: Frame 0 到 peakFrameIdx (防止掃描 rebounce 衰減)

#### Phase 2a: 初始化

```javascript
let highFreq_Hz = 0;                    // 初始化為 0 (好比較)
let highFreqBinIdx = 0;
let highFreqFrameIdx = -1;              // -1 表示未找到
const highFreqScanLimit = Math.min(peakFrameIdx, spectrogram.length - 1);

// 決定使用哪個閾值
let highThreshold_dB;
if (this.config.highFreqThreshold_dB_isAuto === true) {
  // Auto Mode: 使用優化後的閾值
  highThreshold_dB = peakPower_dB + this.config.highFreqThreshold_dB;
} else {
  // Manual Mode: 使用用戶手動設定
  highThreshold_dB = peakPower_dB + this.config.highFreqThreshold_dB;
}
```

#### Phase 2b: 掃描邏輯 (Anti-Rebounce)

**掃描方向**: 左到右 (Frame 0 → peakFrameIdx)
**目的**: 找「第一次出現的最高頻率」而不是「衰減階段的最後最高頻」

```javascript
for (let frameIdx = 0; frameIdx <= highFreqScanLimit; frameIdx++) {
  const framePower = spectrogram[frameIdx];
  
  // 在此幀內，從高到低掃描頻率
  for (let binIdx = framePower.length - 1; binIdx >= 0; binIdx--) {
    if (framePower[binIdx] > highThreshold_dB) {
      const testHighFreq_Hz = freqBins[binIdx];
      
      // 2025 Anti-Rebounce 邏輯：
      // 1. 若首次找到 (-1) → 接受
      // 2. 若此頻率 > 當前最高 → 接受 (找更高的)
      // 3. 若此頻率 ≤ 當前最高 → 拒絕 (保持較早的幀)
      if (highFreqFrameIdx === -1 || testHighFreq_Hz > highFreq_Hz) {
        highFreq_Hz = testHighFreq_Hz;
        highFreqBinIdx = binIdx;
        highFreqFrameIdx = frameIdx;
        
        // 嘗試線性插值精化
        if (binIdx < framePower.length - 1) {
          const thisPower = framePower[binIdx];
          const nextPower = framePower[binIdx + 1];
          
          if (nextPower < highThreshold_dB && thisPower > highThreshold_dB) {
            const powerRatio = (thisPower - highThreshold_dB) / (thisPower - nextPower);
            const freqDiff = freqBins[binIdx + 1] - freqBins[binIdx];
            highFreq_Hz = freqBins[binIdx] + powerRatio * freqDiff;
          }
        }
      }
      break;  // 此幀找到後移動到下一幀
    }
  }
}

// 安全回退（若沒找到任何 bin）
if (highFreqFrameIdx === -1) {
  highFreq_Hz = fhighKHz * 1000;
  highFreqFrameIdx = 0;
}
```

#### Phase 2c: 使用 Auto Mode 結果 (若可用)

```javascript
if (this.config.highFreqThreshold_dB_isAuto === true && safeHighFreqFrameIdx !== undefined) {
  // 若 Auto Mode 有結果，優先使用
  highFreq_Hz = safeHighFreq_Hz;
  highFreqFrameIdx = safeHighFreqFrameIdx;
  highFreqBinIdx = safeHighFreqBinIdx;
}
```

#### Phase 2d: 計算時間戳

```javascript
const firstFrameTimeInSeconds = timeFrames[0];
let highFreqTime_ms = 0;

if (highFreqFrameIdx < timeFrames.length && highFreqFrameIdx >= 0) {
  const highFreqTimeInSeconds = timeFrames[highFreqFrameIdx];
  highFreqTime_ms = (highFreqTimeInSeconds - firstFrameTimeInSeconds) * 1000;
}

call.highFreq_kHz = highFreq_Hz / 1000;
call.highFreqFrameIdx = highFreqFrameIdx;
call.highFreqTime_ms = highFreqTime_ms;
call.highFreqThreshold_dB_used = this.config.highFreqThreshold_dB;
```

**重點改進 (2025)**:
- ✅ 追蹤 `highFreqFrameIdx` (正確的幀位置)
- ✅ 計算 `highFreqTime_ms` (基於幀位置的時間)
- ✅ 左到右掃描避免 rebounce
- ✅ 連續找最高頻而不是第一個超過閾值的

---

### STEP 2.5: 計算起始頻率 (Start Frequency)

**目的**: 找到叫聲起始時的最低頻率。

**時間點**: 總是第 0 幀 (`startFreqTime_ms = 0`)

**閾值**: 固定 -24 dB (不受 Auto/Manual 影響)

#### Phase 2.5a: 基本邏輯

```javascript
const firstFramePower = spectrogram[0];
let startFreq_Hz = null;
let startFreqFrameIdx = 0;  // 總是第 0 幀

// 固定使用 -24dB 閾值
const threshold_24dB = peakPower_dB - 24;

// 從低到高掃描，找最低頻率
for (let binIdx = 0; binIdx < firstFramePower.length; binIdx++) {
  if (firstFramePower[binIdx] > threshold_24dB) {
    startFreq_Hz = freqBins[binIdx];
    // ... (應用線性插值)
    break;  // 第一個超過閾值的就是最低
  }
}
```

#### Phase 2.5b: 規則 (a) - 找最低頻率

如果 -24dB 頻率 < Peak Frequency：

```javascript
if (startFreq_kHz < peakFreqInKHz) {
  // 規則 (a) 滿足
  startFreq_Hz = testStartFreq_Hz;
  startFreq_kHz = testStartFreq_kHz;
  // 儲存此值
  break;
}
```

#### Phase 2.5c: 規則 (b) - 若規則 (a) 不滿足

如果沒找到 < Peak Frequency 的值：

```javascript
// 規則 (b)：使用 High Frequency 作為 Start Frequency
if (startFreq_Hz === null) {
  startFreq_Hz = highFreq_Hz;
  startFreq_kHz = highFreq_kHz;
}
```

#### Phase 2.5d: 低頻 Noise 保護機制

**目的**: 防止將低頻 noise 誤判為起始頻率。

```javascript
const LOW_FREQ_NOISE_THRESHOLD_kHz = 40;   // 40 kHz 以下視為 noise
const HIGH_PEAK_THRESHOLD_kHz = 60;        // Peak ≥ 60 kHz 時啟動保護
const peakFreqInKHz = peakFreq_Hz / 1000;
const shouldIgnoreLowFreqNoise = peakFreqInKHz >= HIGH_PEAK_THRESHOLD_kHz;

// 掃描時跳過低頻 noise
for (let binIdx = 0; binIdx < firstFramePower.length; binIdx++) {
  if (firstFramePower[binIdx] > threshold_24dB) {
    const testStartFreq_kHz = freqBins[binIdx] / 1000;
    
    // 若 Peak ≥ 60 kHz 且候選 ≤ 40 kHz → 跳過
    if (shouldIgnoreLowFreqNoise && testStartFreq_kHz <= LOW_FREQ_NOISE_THRESHOLD_kHz) {
      continue;  // 跳過此 bin，繼續掃描
    }
    
    // ... (檢查規則 a)
  }
}
```

**保存結果**:
```javascript
call.startFreq_kHz = startFreq_kHz;
call.startFreqTime_ms = 0;  // 總是 0 ms
call.startFreqFrameIdx = 0; // 總是第 0 幀
```

---

### STEP 3: 計算低頻 (Low Frequency)

**目的**: 找到叫聲中的最低頻率成分。

**掃描範圍**: 最後一幀 (反映叫聲衰減時的頻率)

#### Phase 3a: Auto Mode - 優化低頻閾值

```javascript
if (this.config.lowFreqThreshold_dB_isAuto === true) {
  const result = this.findOptimalLowFrequencyThreshold(
    spectrogram,
    freqBins,
    flowKHz,
    fhighKHz,
    peakPower_dB
  );
  
  // 解包結果
  safeLowFreq_kHz = result.lowFreq_kHz;
  safeLowFreq_Hz = result.lowFreq_Hz;
  safeLowFreqFrameIdx = result.lowFreqFrameIdx;
  usedLowThreshold = result.threshold;
}
```

#### Phase 3b: Manual Mode - 使用手動閾值

```javascript
if (this.config.lowFreqThreshold_dB_isAuto === false) {
  const lowThreshold_dB = peakPower_dB + this.config.lowFreqThreshold_dB;
  
  // 從最後一幀掃描
  const lastFramePower = spectrogram[spectrogram.length - 1];
  
  // 從低到高掃描，找最低頻率
  for (let binIdx = 0; binIdx < lastFramePower.length; binIdx++) {
    if (lastFramePower[binIdx] > lowThreshold_dB) {
      lowFreq_Hz = freqBins[binIdx];
      lowFreqFrameIdx = spectrogram.length - 1;
      break;
    }
  }
}
```

#### Phase 3c: 計算時間戳

```javascript
if (lowFreqFrameIdx < timeFrames.length) {
  const lowFreqTimeInSeconds = timeFrames[lowFreqFrameIdx];
  lowFreqTime_ms = (lowFreqTimeInSeconds - timeFrames[0]) * 1000;
}

call.lowFreq_kHz = lowFreq_Hz / 1000;
call.lowFreqFrameIdx = lowFreqFrameIdx;
call.lowFreqTime_ms = lowFreqTime_ms;
```

---

### STEP 4: 計算結束頻率 (End Frequency)

**目的**: 找到叫聲結束時的頻率。

**特殊機制**: 後向掃描 (Backward Scan) 防止 rebounce

#### Phase 4a: 後向掃描邏輯

```javascript
if (this.config.enableBackwardEndFreqScan === true) {
  // 從最後一幀向前掃描
  for (let frameIdx = spectrogram.length - 1; frameIdx >= 0; frameIdx--) {
    const framePower = spectrogram[frameIdx];
    
    // 從低到高掃描頻率
    for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
      if (framePower[binIdx] > endThreshold_dB) {
        // 找到超過閾值的最低頻率
        endFreq_Hz = freqBins[binIdx];
        endFreqFrameIdx = frameIdx;
        endFreqBinIdx = binIdx;
        
        // 應用線性插值
        // ...
        
        break;  // 找到後停止
      }
    }
  }
} else {
  // Standard forward scan (備選方案)
  // ...
}
```

#### Phase 4b: 最大頻率下降保護

防止掃描時選到異常低的頻率：

```javascript
const maxFrequencyDropThreshold_kHz = this.config.maxFrequencyDropThreshold_kHz;

if (endFreq_kHz !== null) {
  const freqDrop = lowFreq_kHz - endFreq_kHz;
  
  if (freqDrop > maxFrequencyDropThreshold_kHz) {
    // 下降超過限制，視為異常，採用 Low Frequency 作為 End Frequency
    endFreq_Hz = lowFreq_Hz;
    endFreqFrameIdx = lowFreqFrameIdx;
  }
}
```

#### Phase 4c: 峰值後保護窗口

防止在峰值之後立即檢測結束：

```javascript
const protectionWindowAfterPeak_ms = this.config.protectionWindowAfterPeak_ms;
const protectionWindowFrames = Math.max(1, 
  Math.round(protectionWindowAfterPeak_ms / frameIntervalMs)
);
const minEndFrameIdx = peakFrameIdx + protectionWindowFrames;

if (endFreqFrameIdx < minEndFrameIdx) {
  // 超出保護窗口，至少使用保護後的幀
  endFreqFrameIdx = minEndFrameIdx;
}
```

#### Phase 4d: 計算時間戳

```javascript
if (endFreqFrameIdx < timeFrames.length) {
  const endFreqTimeInSeconds = timeFrames[endFreqFrameIdx];
  endFreqTime_ms = (endFreqTimeInSeconds - timeFrames[0]) * 1000;
}

call.endFreq_kHz = endFreq_Hz / 1000;
call.endFreqFrameIdx = endFreqFrameIdx;
call.endFreqTime_ms = endFreqTime_ms;
```

---

## STEP 5: 計算衍生參數

完成前四個步驟後，系統自動計算以下衍生參數：

### Phase 5a: 計算持續時間 (Duration)

```javascript
const duration_ms = (timeFrames[timeFrames.length - 1] - timeFrames[0]) * 1000;
call.duration_ms = duration_ms;
```

**說明**: 從選擇區域開始到結束的總時間

### Phase 5b: 計算 Characteristic Frequency (Cf)

**定義**: 峰值功率點所對應的頻率

```javascript
call.characteristicFreq_kHz = call.peakFreq_kHz;
call.characteristicFreqTime_ms = call.peakFreqTime_ms;
call.characteristicFreqFrameIdx = call.peakFrameIdx;
```

**用途**: 
- 許多蝙蝠物種的種類鑑定依據
- 通常是叫聲中最穩定的特徵
- 在自動分類中優先使用

### Phase 5c: 計算 Knee Frequency (Kf) 和轉折時間

**定義**: 從起始頻率到峰值頻率的轉折點

**計算邏輯**:

```javascript
// 1. 若 startFreq = highFreq（規則 b 情況）
//    → 無轉折，Knee Freq = startFreq
if (call.startFreq_kHz === call.highFreq_kHz) {
  call.kneeFreq_kHz = call.startFreq_kHz;
  call.kneeFreqTime_ms = call.startFreqTime_ms;
  call.kneeFreqFrameIdx = call.startFreqFrameIdx;
}
// 2. 若 startFreq < peakFreq < highFreq（罕見）
//    → 使用 startFreq 作為轉折點
else if (call.startFreq_kHz < call.peakFreq_kHz && call.peakFreq_kHz < call.highFreq_kHz) {
  call.kneeFreq_kHz = call.startFreq_kHz;
  call.kneeFreqTime_ms = call.startFreqTime_ms;
}
// 3. 標準情況：startFreq < highFreq ≤ peakFreq
//    → Knee Freq 在 highFreq 和 peakFreq 之間的中點
else {
  const kneeFreq = (call.highFreq_kHz + call.peakFreq_kHz) / 2;
  const kneeTime = (call.highFreqTime_ms + call.peakFreqTime_ms) / 2;
  call.kneeFreq_kHz = kneeFreq;
  call.kneeFreqTime_ms = kneeTime;
  
  // 尋找最接近 kneeFreq 的實際幀
  // 通常在 highFreqFrameIdx 和 peakFrameIdx 之間
  call.kneeFreqFrameIdx = Math.round(
    (call.highFreqFrameIdx + call.peakFrameIdx) / 2
  );
}
```

**用途**:
- 標示頻率上升的轉折位置
- 幫助識別特定的叫聲形態（如 FM chirp）
- 在掃頻叫聲分析中重要

### Phase 5d: 計算頻率範圍和帶寬

```javascript
// 頻率範圍
const frequencyRange_kHz = call.highFreq_kHz - call.lowFreq_kHz;
call.frequencyRange_kHz = frequencyRange_kHz;

// 帶寬（從 Start 到 High）
const bandwidth_kHz = call.highFreq_kHz - call.startFreq_kHz;
call.bandwidth_kHz = bandwidth_kHz;
```

---

## 最終輸出 Call 物件

完成所有步驟後，`call` 物件包含以下參數：

### 主要頻率參數 (5個)
| 參數 | 單位 | 說明 | 時間戳 |
|------|------|------|--------|
| `peakFreq_kHz` | kHz | 最高能量點的頻率 (Characteristic Freq) | `peakFreqTime_ms` |
| `highFreq_kHz` | kHz | 叫聲中的最高頻率 | `highFreqTime_ms` |
| `startFreq_kHz` | kHz | 叫聲起始的頻率 | `startFreqTime_ms` (=0) |
| `lowFreq_kHz` | kHz | 叫聲中的最低頻率 | `lowFreqTime_ms` |
| `endFreq_kHz` | kHz | 叫聲結束時的頻率 | `endFreqTime_ms` |

### 衍生頻率參數
| 參數 | 單位 | 說明 | 時間戳 |
|------|------|------|--------|
| `characteristicFreq_kHz` | kHz | 峰值頻率（與 peakFreq 相同）| `characteristicFreqTime_ms` |
| `kneeFreq_kHz` | kHz | 頻率上升的轉折點 | `kneeFreqTime_ms` |
| `frequencyRange_kHz` | kHz | High - Low 的範圍 | - |
| `bandwidth_kHz` | kHz | High - Start 的帶寬 | - |

### 時間相關參數
| 參數 | 單位 | 說明 |
|------|------|------|
| `duration_ms` | ms | 叫聲總持續時間 |
| `peakFreqTime_ms` | ms | 峰值出現的相對時間 |
| `highFreqTime_ms` | ms | 最高頻率出現的相對時間 |
| `startFreqTime_ms` | ms | 起始頻率時間（總是 0 ms） |
| `lowFreqTime_ms` | ms | 最低頻率出現的相對時間 |
| `endFreqTime_ms` | ms | 結束頻率出現的相對時間 |
| `characteristicFreqTime_ms` | ms | 峰值出現的相對時間 |
| `kneeFreqTime_ms` | ms | 轉折點出現的相對時間 |

### 幀索引參數
| 參數 | 單位 | 說明 |
|------|------|------|
| `peakFrameIdx` 或 `peakFreqFrameIdx` | frame | 峰值在時間軸的位置 |
| `highFreqFrameIdx` | frame | 最高頻率在時間軸的位置 |
| `startFreqFrameIdx` | frame | 起始頻率幀索引（總是 0） |
| `lowFreqFrameIdx` | frame | 最低頻率在時間軸的位置 |
| `endFreqFrameIdx` | frame | 結束頻率在時間軸的位置 |
| `kneeFreqFrameIdx` | frame | 轉折點在時間軸的位置 |

### 功率參數
| 參數 | 單位 | 說明 |
|------|------|------|
| `peakPower_dB` | dB | 最高能量值 |

### 閾值相關參數
| 參數 | 單位 | 說明 |
|------|------|------|
| `highFreqThreshold_dB_used` | dB | 高頻檢測使用的實際閾值 (相對於峰值) |
| `lowFreqThreshold_dB_used` | dB | 低頻檢測使用的實際閾值 (相對於峰值) |

---

## 參數之間的關係和時間序列

### 時間順序關係

```
時間軸 (ms)
    ↓
    0                                        duration_ms
    |────────────────────────────────────────|
    |                                        |
    Start                                    End
    (startFreqTime=0)                        (endFreqTime)
    |                                        |
    |  High        Peak    Low               |
    |   |           |       |                |
    |   v           v       v                |
    |───●───...────●───...──●───...─────────|
       T_high     T_peak   T_low    T_end
       
    也可能出現 Knee (轉折點)：
    |───●───●───...────●───...───────────────|
       H   K          P
       High Knee Peak
```

### 頻率大小關係

**標準情況**:
```
lowFreq < startFreq < kneeFreq < highFreq ≤ peakFreq
```

**特殊情況 (規則 b)**:
```
lowFreq < startFreq = highFreq ≤ peakFreq
（此時 kneeFreq = startFreq）
```

### 每個參數的物理意義

| 參數 | 物理意義 | 蝙蝠類型示例 |
|------|---------|-------------|
| **startFreq** | 叫聲開始時的頻率 | 蝙蝠剛開始發聲時 |
| **highFreq** | 叫聲中出現的最高頻率 | 快速上升的FM chirp頂端 |
| **peakFreq** (Cf) | 最高能量濃度的頻率 | 種類識別的關鍵特徵 |
| **kneeFreq** | 頻率變化的拐點 | 複雜叫聲的形態特徵 |
| **lowFreq** | 叫聲中出現的最低頻率 | 叫聲衰減時的頻率 |
| **endFreq** | 叫聲結束時的頻率 | 信號淡出的最後頻率 |

---

## 重要概念和改進 (2025)

### 1. 穩定峰值 (Stable Peak Value)

**問題**: 之前全局計算的峰值容易受到後期 noise 影響。

**解決方案**: 
- 峰值只在選擇區域內計算
- 自動模式使用此穩定值作為所有閾值的基準
- 防止衰減階段異常波動影響閾值

### 2. 幀索引追蹤 (Frame Index Tracking)

**改進**:
- 每個頻率現在記錄其所在的幀索引
- 使得時間計算更加準確
- 便於調試和視覺化

### 3. Anti-Rebounce 機制

**原理**: Rebounce 是信號結束後的低能量反彈

**防護措施**:
- High Frequency: 限制掃描到 `peakFrameIdx` (攻擊階段)
- End Frequency: 使用後向掃描和最大下降限制
- 優先選擇時間較早的同頻率點

### 4. 自動異常偵測

**功能**: `findOptimalHighFrequencyThreshold()` 和 `findOptimalLowFrequencyThreshold()`

**算法**:
- 測試多個閾值 (-24 到 -70 dB)
- 檢測頻率跳變異常 (anomaly jump)
- 自動選擇最穩定的閾值
- 防呆機制處理極端情況

### 5. 低頻 Noise 保護

**條件**: 當 Peak Frequency ≥ 60 kHz

**保護**:
- 忽略 40 kHz 以下的候選起始頻率
- 防止低頻背景 noise 被誤判

---

## 配置參數參考

```javascript
// Auto/Manual 模式
highFreqThreshold_dB_isAuto: true|false    // High Frequency 自動優化
lowFreqThreshold_dB_isAuto: true|false     // Low Frequency 自動優化

// 手動閾值 (dB，相對於峰值)
highFreqThreshold_dB: -24 to -70            // 預設 -24 dB
lowFreqThreshold_dB: -24 to -70             // 預設 -27 dB

// Anti-Rebounce 參數
enableBackwardEndFreqScan: true|false       // 後向掃描結束頻率
maxFrequencyDropThreshold_kHz: number       // 最大頻率下降 (預設 2.5 kHz)
protectionWindowAfterPeak_ms: number        // 峰值後保護 (預設 10 ms)

// 頻率範圍
flowKHz: number                             // 最低掃描頻率 (Hz)
fhighKHz: number                            // 最高掃描頻率 (Hz)
```

---

## 故障排除

### 問題: `highFreqTime_ms` 總是 0.00 ms

**原因**: 
- `highFreqFrameIdx` 未正確設置為實際找到的幀
- 可能被重置為 0

**檢查**:
```javascript
console.log(`highFreqFrameIdx: ${call.highFreqFrameIdx}`);
console.log(`highFreqTime_ms: ${call.highFreqTime_ms}`);
// 應該不相等（除非真的在第 0 幀）
```

### 問題: 高頻大於峰值頻率

**原因**:
- 閾值設置過低
- 掃描包含了衰減階段

**檢查**:
```javascript
console.log(`peakFreq: ${call.peakFreq_kHz}, highFreq: ${call.highFreq_kHz}`);
// 應該 highFreq ≤ peakFreq
```

### 問題: Auto Mode 結果與 Manual Mode 不同

**可能的原因**:
1. 異常偵測選擇了不同的閾值
2. 防呆檢查觸發了回退機制

**調試**:
```javascript
console.log(`highFreqThreshold_dB_used: ${call.highFreqThreshold_dB_used}`);
// 查看實際使用的閾值值
```

### 問題: Knee Frequency 計算結果不符預期

**原因**:
1. startFreq 等於 highFreq（規則 b）→ 無轉折
2. 頻率關係異常（罕見情況）

**檢查**:
```javascript
console.log(`startFreq: ${call.startFreq_kHz}`);
console.log(`highFreq: ${call.highFreq_kHz}`);
console.log(`peakFreq: ${call.peakFreq_kHz}`);
console.log(`kneeFreq: ${call.kneeFreq_kHz}`);

// 應該滿足： startFreq < highFreq ≤ peakFreq
```

### 問題: Duration 計算結果異常

**原因**:
- 選擇區域的時間幀數不正確
- timeFrames 陣列有缺失或排序錯誤

**檢查**:
```javascript
console.log(`timeFrames length: ${call.timeFrames.length}`);
console.log(`timeFrames[0]: ${call.timeFrames[0]}`);
console.log(`timeFrames[last]: ${call.timeFrames[call.timeFrames.length-1]}`);
console.log(`duration: ${call.duration_ms} ms`);
```

### 問題: 頻率時間順序錯亂 (Time not monotonic)

**期望**:
```
startFreqTime (0) < highFreqTime < peakFreqTime < lowFreqTime < endFreqTime
```

**原因**:
- 掃描邏輯錯誤
- 幀索引追蹤失敗

**調試**:
```javascript
console.log(`startFreqTime: ${call.startFreqTime_ms}`);
console.log(`highFreqTime: ${call.highFreqTime_ms}`);
console.log(`peakFreqTime: ${call.peakFreqTime_ms}`);
console.log(`lowFreqTime: ${call.lowFreqTime_ms}`);
console.log(`endFreqTime: ${call.endFreqTime_ms}`);
```

---

## 常見的叫聲模式識別

基於測量參數，可以識別以下叫聲類型：

### 1. 簡單峰值型 (Simple Peak Call)

**特徵**:
- startFreq ≈ highFreq (接近)
- peakFreq = highFreq
- 無明顯轉折 (Knee ≈ Start)
- 短時間內完成

**頻譜外觀**: 
```
    ╱╲
   ╱  ╲    (簡單鐘形)
──╱────╲──
```

**檢測條件**:
```javascript
if (Math.abs(call.startFreq_kHz - call.highFreq_kHz) < 0.5) {
  // 可能是簡單峰值型
}
```

### 2. FM 上升掃頻 (FM Sweep Up)

**特徵**:
- startFreq < highFreq = peakFreq
- 有明顯轉折 (kneeFreq)
- Time: startTime < kneeTime < peakTime
- 帶寬明顯 (bandwidth > 2 kHz)

**頻譜外觀**:
```
        ╱╱  (持續上升)
       ╱
      ╱
─────╱─────
```

**檢測條件**:
```javascript
if (call.startFreq_kHz < call.highFreq_kHz &&
    Math.abs(call.highFreq_kHz - call.peakFreq_kHz) < 0.5 &&
    call.bandwidth_kHz > 2) {
  // 可能是 FM 上升掃頻
}
```

### 3. FM 下降掃頻 (FM Sweep Down)

**特徵**:
- startFreq = highFreq = peakFreq
- lowFreq < startFreq
- 時間順序: start → peak → low → end
- 帶寬明顯

**頻譜外觀**:
```
╲╲╲        (持續下降)
  ╲
   ╲
────╲─────
```

**檢測條件**:
```javascript
if (call.startFreq_kHz > call.lowFreq_kHz &&
    call.endFreq_kHz < call.lowFreq_kHz) {
  // 可能是 FM 下降掃頻
}
```

### 4. 複雜多段型 (Complex Multi-segment)

**特徵**:
- highFreq < peakFreq (明顯差異)
- 多個轉折點
- kneeFreqTime 在 highFreqTime 和 peakFreqTime 之間

**頻譜外觀**:
```
        ●
       ╱ ╲
      ╱   ╲
─────●─────●────
    high  peak
```

**檢測條件**:
```javascript
if (Math.abs(call.highFreq_kHz - call.peakFreq_kHz) > 0.5) {
  // 可能是複雜多段型
}
```

### 5. 噪聲反彈型 (Rebounce - 異常)

**特徵** (應該被系統排除):
- endFreq > lowFreq (明顯高於)
- endFreqTime 接近 peakFreqTime (不應有)
- endFreq 接近 highFreq

**檢測** (用於驗證系統是否正常):
```javascript
if (call.endFreq_kHz > call.lowFreq_kHz + 2 &&
    Math.abs(call.endFreqTime_ms - call.peakFreqTime_ms) < 20) {
  console.warn("可能偵測到 rebounce 異常");
}
```

---

## 參數計算詳細流程圖

```
┌─────────────────────────────────────────────────────────┐
│ 輸入: Spectrogram + timeFrames + freqBins               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 1: 全域掃描找峰值                                  │
│ 輸出: peakFreq, peakPower, peakFrameIdx                 │
│       peakFreqTime = timeFrames[peakFrameIdx]           │
└─────────────────────────────────────────────────────────┘
                         ↓
                   ┌─────┴─────┐
                   ↓           ↓
           [Auto Mode]     [Manual Mode]
                   ↓           ↓
         ┌─────────────────────────┐
         │ 決定高頻檢測閾值        │
         └─────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 2: 掃描找高頻                                      │
│ 輸出: highFreq, highFreqFrameIdx                        │
│       highFreqTime = timeFrames[highFreqFrameIdx]       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 2.5: 掃描第0幀找起始頻率                           │
│ 輸出: startFreq, startFreqFrameIdx (=0)                 │
│       startFreqTime = 0 ms                              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 3: 掃描最後幀找低頻                                │
│ 輸出: lowFreq, lowFreqFrameIdx                          │
│       lowFreqTime = timeFrames[lowFreqFrameIdx]         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 4: 後向掃描找結束頻率                              │
│ 輸出: endFreq, endFreqFrameIdx                          │
│       endFreqTime = timeFrames[endFreqFrameIdx]         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 5: 計算衍生參數                                    │
│ ├─ characteristicFreq = peakFreq (別名)                 │
│ ├─ kneeFreq = (startFreq + peakFreq) / 2 (或規則)      │
│ ├─ bandwidth = highFreq - startFreq                     │
│ ├─ frequencyRange = highFreq - lowFreq                  │
│ └─ duration = timeFrames[last] - timeFrames[0]          │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 完整 Call 物件輸出                                      │
│ (20+ 個參數)                                            │
└─────────────────────────────────────────────────────────┘
```

---

## 參考資源

- **頻譜分析**: STFT (Short-Time Fourier Transform)
- **插值方法**: 拋物線插值 (Parabolic Interpolation)
- **蝙蝠叫聲軟體**: Avisoft, SonoBat, Kaleidoscope, BatSound
- **標準**: 國際蝙蝠生物聲學群體 (IBAC)

---

**文檔版本**: 2025-12-05  
**維護者**: BatCallDetector 開發團隊  
**最後更新**: 2025-12-05 with Characteristic Freq, Knee Freq, Duration, and Frame Time Tracking
