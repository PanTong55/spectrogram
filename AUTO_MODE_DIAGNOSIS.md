# Auto Mode 演算法診斷修復 (2025-11-23)

## 問題診斷

### 原始問題
使用者報告計算結果顯示所有測量都是 99.24 kHz（Selection area 的 high frequency 上邊界），然後才在 threshold -30 到 -31 之間出現突然跳變到 66.59 kHz。

**原始 Debug 輸出**:
```
[0]: {thresholdBefore: -24, thresholdCurrent: -25, freqBefore: '99.24', freqCurrent: '99.24', freqDiff: '0.00'}
[1]: {thresholdBefore: -25, thresholdCurrent: -26, freqBefore: '99.24', freqCurrent: '99.24', freqDiff: '0.00'}
...
[6]: {thresholdBefore: -30, thresholdCurrent: -31, freqBefore: '99.24', freqCurrent: '66.59', freqDiff: '32.65'}
```

### 根本原因分析

**代碼位置**: `findOptimalStartEndThreshold()` 第 508 行

**問題邏輯**:
```javascript
// 舊代碼（有缺陷）
let startFreq_Hz = fhighHz;  // 默認為 99.24 kHz
for (let binIdx = firstFramePower.length - 1; binIdx >= 0; binIdx--) {
  if (firstFramePower[binIdx] > threshold) {
    startFreq_Hz = freqBins[binIdx];
    // ...
    break;
  }
}
// 如果迴圈結束都沒有找到超過閾值的 bin，
// startFreq_Hz 保持預設值 fhighHz (99.24 kHz)
```

**發生原因**:
1. 当 threshold = -24 dB 时，第一帧（firstFrame）中没有任何功率值超过 -24 dB
2. 迴圈完成後沒有找到任何符合条件的 bin，所以 `startFreq_Hz` 保持默認值 99.24 kHz
3. 直到 threshold 降低到足夠低（如 -31 dB）時，才有第一个 bin 超過該閾值，此時才出現正确的频率值

**为什么会这样**:
- 声音信号中，第一帧通常不包含最强的功率
- 第一帧可能是鸣叫的前沿或轻微起始阶段
- 如果闾值设定为 -24 dB，可能超过了整个第一帧的最大功率
- 因此无法找到任何超过该阾值的频率

---

## 修復方案

### 修改 1: 添加 Debug 診斷信息

**目的**: 诊断 firstFrame 的实际功率范围

**代碼**:
```javascript
// DEBUG: 記錄 firstFrame 的 power 範圍
let frameMaxPower = -Infinity;
let frameMinPower = Infinity;
let frameMaxPowerBinIdx = 0;

for (let binIdx = 0; binIdx < firstFramePower.length; binIdx++) {
  const power = firstFramePower[binIdx];
  if (power > frameMaxPower) {
    frameMaxPower = power;
    frameMaxPowerBinIdx = binIdx;
  }
  frameMinPower = Math.min(frameMinPower, power);
}

const frameMaxFreq_kHz = freqBins[frameMaxPowerBinIdx] / 1000;
console.log(`[DEBUG] First Frame - Max Power: ${frameMaxPower.toFixed(2)} dB at ${frameMaxFreq_kHz.toFixed(2)} kHz, Min Power: ${frameMinPower.toFixed(2)} dB`);
```

**輸出示例**:
```
[DEBUG] First Frame - Max Power: -25.34 dB at 69.38 kHz, Min Power: -80.45 dB
```

这会告诉我们，第一帧的最大功率是 -25.34 dB。如果我们用 -24 dB 作为阾值，就找不到任何超过它的 bin。

### 修改 2: 追蹤有效的測量點

**目的**: 区分哪些测量是有效的（找到了 bin），哪些是无效的（没找到 bin）

**代碼**:
```javascript
let startFreq_Hz = null;  // 改為 null，而不是預設為 fhighHz
let foundBin = false;

for (let binIdx = firstFramePower.length - 1; binIdx >= 0; binIdx--) {
  if (firstFramePower[binIdx] > threshold) {
    startFreq_Hz = freqBins[binIdx];
    foundBin = true;
    // ... 插值邏輯
    break;
  }
}

if (!foundBin) {
  startFreq_Hz = null;  // 顯式標記為無效
}

measurements.push({
  threshold: threshold,
  startFreq_Hz: startFreq_Hz,
  startFreq_kHz: startFreq_Hz !== null ? startFreq_Hz / 1000 : null,
  foundBin: foundBin  // 新增標籤
});
```

### 修改 3: 只比較有效的測量點

**目的**: 過濾掉 `foundBin === false` 的測量，只在有效測量之間比較頻率差異

**代碼**:
```javascript
// 只收集成功找到 bin 的測量
const validMeasurements = measurements.filter(m => m.foundBin);

console.log(`[DEBUG] Total measurements: ${measurements.length}, Valid measurements (foundBin=true): ${validMeasurements.length}`);

// 從第二個有效測量開始，比較與前一個測量的差異
for (let i = 1; i < validMeasurements.length; i++) {
  const prevFreq_kHz = validMeasurements[i - 1].startFreq_kHz;
  const currFreq_kHz = validMeasurements[i].startFreq_kHz;
  const freqDifference = Math.abs(currFreq_kHz - prevFreq_kHz);
  
  // ... 比較邏輯
}
```

### 修改 4: 改進的結果邏輯

**代碼**:
```javascript
if (optimalThreshold === -24 && validMeasurements.length > 0) {
  // 如果沒有檢測到異常，使用最後一個有效測量
  optimalThreshold = validMeasurements[validMeasurements.length - 1].threshold;
} else if (validMeasurements.length === 0) {
  // 警告：所有測量都無效
  console.log('✗ 警告：所有測量都無效（firstFrame 中無數據超過閾值）');
  optimalThreshold = -24;
}
```

---

## 新的 Debug 輸出格式

### 情況 1: 正常情況（檢測到異常）

```
[DEBUG] First Frame - Max Power: -18.50 dB at 69.38 kHz, Min Power: -80.00 dB
[DEBUG] Total measurements: 27, Valid measurements (foundBin=true): 24
[DEBUG] All measurements: [
  {threshold: -24, startFreq_Hz: 69380, startFreq_kHz: 69.38, foundBin: true},
  {threshold: -25, startFreq_Hz: 69790, startFreq_kHz: 69.79, foundBin: true},
  ...
  {threshold: -31, startFreq_Hz: 68200, startFreq_kHz: 68.20, foundBin: true},
  {threshold: -32, startFreq_Hz: 45000, startFreq_kHz: 45.00, foundBin: true},  ← 異常
  ...
]
✓ 異常檢測到！頻率差異: 23.20 kHz
✓ 選擇異常前的閾值: -31 dB
✓ 計算過程 (有效測量): [
  {thresholdBefore: -24, thresholdCurrent: -25, freqBefore: '69.38', freqCurrent: '69.79', freqDiff: '0.41'},
  {thresholdBefore: -25, thresholdCurrent: -26, freqBefore: '69.79', freqCurrent: '70.15', freqDiff: '0.36'},
  ...
  {thresholdBefore: -30, thresholdCurrent: -31, freqBefore: '68.50', freqCurrent: '68.20', freqDiff: '0.30'},
  {thresholdBefore: -31, thresholdCurrent: -32, freqBefore: '68.20', freqCurrent: '45.00', freqDiff: '23.20'} ← 異常點
]
```

### 情況 2: 無異常情況（平緩變化）

```
[DEBUG] First Frame - Max Power: -20.00 dB at 55.50 kHz, Min Power: -85.00 dB
[DEBUG] Total measurements: 27, Valid measurements (foundBin=true): 27
[DEBUG] All measurements: [全部 foundBin: true]
✗ 未偵測到明顯異常（頻率變化 ≤ 3 kHz）
✗ 使用最後一個有效測量的閾值
✗ 計算過程 (有效測量): [所有差異 ≤ 3 kHz]
```

### 情況 3: 無效測量情況（firstFrame 過弱）

```
[DEBUG] First Frame - Max Power: -45.00 dB at 62.00 kHz, Min Power: -95.00 dB
[DEBUG] Total measurements: 27, Valid measurements (foundBin=true): 8
[DEBUG] All measurements: [前 19 個 foundBin: false，後 8 個 foundBin: true]
✗ 警告：所有測量都無效（firstFrame 中無數據超過閾值）
✗ 使用預設值: -24 dB
```

---

## 驗證步驟

### 測試 1: 執行計算並檢查 Debug 輸出

1. 打開 Browser Console (F12)
2. 加載 WAV 檔案
3. 點擊 "Detect Bat Calls"
4. 在 Console 中查看以下信息:
   - `[DEBUG] First Frame` 的功率範圍
   - `[DEBUG] Total measurements` 中有多少有效測量
   - `[DEBUG] All measurements` 中每個點的 `foundBin` 狀態
   - 最終的異常檢測結果

### 測試 2: 驗證頻率值的合理性

1. 檢查第一組有效測量的頻率是否合理
   - 應該在 ~69-70 kHz 左右（根據實際鳴叫）
   - 不應該再是 99.24 kHz
2. 檢查頻率差異是否平緩
   - 正常情況下每步應在 0.5-2 kHz 範圍
   - 異常時才會突跳 > 3 kHz

### 測試 3: 檢查異常偵測點

1. 找到頻率差異 > 3 kHz 的點
2. 確認選擇的是異常前的閾值
3. 驗證該閾值是否合理（通常在 -28 到 -35 dB）

---

## 常見情況解釋

| 情況 | 原因 | 解決方案 |
|------|------|--------|
| 全是 99.24 kHz 然後跳變 | firstFrame 太弱，初始閾值太高 | 演算法自動跳過無效測量 |
| foundBin 全為 false | firstFrame 功率遠低於所有測試閾值 | 使用預設值 -24 dB |
| 有效測量但無異常 | 鳴叫平緩，無明顯回聲 | 使用最後一個有效測量的閾值 |
| 異常在 -28 dB | 典型的回聲/反彈起始點 | 選擇 -27 dB 作為最優值 |

---

## 檔案修改摘要

**文件**: `/workspaces/spectrogram/modules/batCallDetector.js`

**行號**: 488-605

**修改內容**:
1. 添加 firstFrame power 範圍診斷
2. 將 `startFreq_Hz` 初始值改為 `null`
3. 添加 `foundBin` 標籤追蹤有效測量
4. 過濾只有效測量進行比較
5. 改進異常檢測和結果邏輯
6. 添加詳細的 console.log() 輸出

**編譯狀態**: ✅ No errors found

---

## 後續建議

1. **細調異常閾值**: 如果 3 kHz 過敏感，可改為 2.5 或 3.5 kHz
2. **保存計算歷史**: 考慮在導出結果時記錄選擇過程
3. **視覺化**: 可在 UI 中顯示頻率曲線圖，直觀看出異常點
4. **自適應阾值**: 根據 firstFrame 的功率範圍自動調整初始測試閾值

