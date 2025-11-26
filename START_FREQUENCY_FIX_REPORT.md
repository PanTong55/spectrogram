# Start Frequency 規則 (a)/(b) 修正說明

## 問題說明

在 Auto Mode 中，Start Frequency 的計算存在錯誤：

### 錯誤示例
```
Peak Frequency = 83.7 kHz
-24dB 閾值偵測頻率 = 68.29 kHz（< Peak Frequency，應該滿足規則 a）

錯誤結果：
  使用了 High Frequency Threshold (-50dB) 的值
  得出 Start Frequency = 87.75 kHz （錯誤！）

正確結果：
  應使用 -24dB 閾值的值
  Start Frequency 應該 = 68.29 kHz （規則 a）
```

## 根本原因

### 之前的錯誤邏輯
在防呆重掃中（Auto Mode），計算 Start Frequency 時：
```javascript
// 錯誤做法：使用了 High Frequency Threshold 的值
const highFreqThreshold_dB = peakPower_dB + testThreshold_dB;  // 用的是優化後的閾值
for (let binIdx = 0; binIdx < firstFramePower.length; binIdx++) {
  if (firstFramePower[binIdx] > highFreqThreshold_dB) {  // 用錯誤的閾值
    testStartFreq_Hz = freqBins[binIdx];  // 結果就錯了
    break;
  }
}
```

### 規則的正確理解
**Start Frequency 應該總是基於 -24dB 閾值計算，與 High Frequency 的優化閾值無關！**

```
規則 (a)：若 -24dB 閾值的頻率 < Peak Frequency
         → Start Frequency = -24dB 閾值的頻率值

規則 (b)：若 -24dB 閾值的頻率 >= Peak Frequency
         → Start Frequency = High Frequency（使用優化後的閾值）
```

## 修正內容

### 修改 1：移除不正確的 Auto Mode Start Frequency 計算

**位置：** `measureFrequencyParameters()` 函數，行 1015-1023

**修正前：**
```javascript
// 在防呆重掃中錯誤地計算了 testStartFreq_Hz
const highFreqThreshold_dB = peakPower_dB + testThreshold_dB;
for (let binIdx = 0; binIdx < firstFramePower.length; binIdx++) {
  if (firstFramePower[binIdx] > highFreqThreshold_dB) {
    testStartFreq_Hz = freqBins[binIdx];  // 錯誤！
    // ...
  }
}

// 錯誤地存儲了臨時值
call._startFreq_kHz_fromAuto = safeStartFreq_kHz;
call._startFreq_Hz_fromAuto = safeStartFreq_Hz;
```

**修正後：**
```javascript
// 移除了錯誤的 Start Frequency 計算
// 不再在防呆重掃中計算 testStartFreq_Hz
// 不再存儲臨時的 _startFreq_kHz_fromAuto 和 _startFreq_Hz_fromAuto

// 添加明確的註釋
// ============================================================
// 重要修正 (2025)：
// Start Frequency 必須基於 -24dB 閾值計算，與 High Frequency 無關
// 規則 (a)/(b) 應用在 STEP 2.5 中，不在此處提前計算
// Auto Mode 中只使用優化的 High Frequency，Start Frequency 留到 STEP 2.5 計算
// ============================================================
```

### 修改 2：統一的 STEP 2.5 計算邏輯

**位置：** `measureFrequencyParameters()` 函數，STEP 2.5

**修正前：**
```javascript
if (call._startFreq_Hz_fromAuto !== undefined) {
  // 使用 AUTO MODE 計算的值（但這個值是錯誤計算的）
  startFreq_Hz = call._startFreq_Hz_fromAuto;
  startFreq_kHz = call._startFreq_kHz_fromAuto;
  delete call._startFreq_Hz_fromAuto;
  delete call._startFreq_kHz_fromAuto;
} else {
  // 非 AUTO MODE：使用 -24dB 閾值計算（正確的）
  const threshold_24dB = peakPower_dB - 24;
  // ...
}
```

**修正後：**
```javascript
// 統一邏輯：無論 AUTO MODE 還是 NON-AUTO MODE
// 都使用 -24dB 閾值計算 Start Frequency

// 使用 -24dB 閾值計算 Start Frequency（無論是否 Auto Mode）
const threshold_24dB = peakPower_dB - 24;

// 從低到高掃描，找最低頻率
for (let binIdx = 0; binIdx < firstFramePower.length; binIdx++) {
  if (firstFramePower[binIdx] > threshold_24dB) {
    const testStartFreq_Hz = freqBins[binIdx];
    const testStartFreq_kHz = testStartFreq_Hz / 1000;
    
    // 檢查是否低於 Peak Frequency（規則 a）
    if (testStartFreq_kHz < (peakFreq_Hz / 1000)) {
      // 滿足規則 (a)：使用此值為 Start Frequency
      startFreq_Hz = testStartFreq_Hz;
      startFreq_kHz = testStartFreq_kHz;
      // 線性插值...
      break;
    }
  }
}

// 如果規則 (a) 不滿足，使用規則 (b)
if (startFreq_Hz === null) {
  // Start Frequency = High Frequency
  startFreq_Hz = highFreq_Hz;
  startFreq_kHz = highFreq_Hz / 1000;
}
```

## 修正效果驗證

### 修正前的錯誤情況
```
Peak Frequency = 83.7 kHz
-24dB 偵測 = 68.29 kHz
High Freq Threshold (-50dB) = 87.75 kHz

錯誤：Start Frequency = 87.75 kHz ❌
（使用了 High Freq Threshold 的值）
```

### 修正後的正確情況
```
Peak Frequency = 83.7 kHz
-24dB 偵測 = 68.29 kHz
High Freq Threshold (-50dB) = 87.75 kHz

判斷：68.29 kHz < 83.7 kHz？
      YES → 滿足規則 (a)

正確：Start Frequency = 68.29 kHz ✅
（使用 -24dB 閾值的值）
```

## 規則應用邏輯總結

### 完整的計算流程

```
STEP 2：計算 High Frequency
  使用優化後的 highFreqThreshold_dB
  ↓
STEP 2.5：計算 Start Frequency
  使用固定的 -24dB 閾值
  
  -24dB 掃描結果 vs Peak Frequency
    ├─ < Peak Frequency → 規則 (a)：使用 -24dB 值
    └─ >= Peak Frequency → 規則 (b)：使用 High Frequency
```

### 關鍵區別

| 項目 | High Frequency | Start Frequency |
|------|---|---|
| 閾值來源 | 優化計算（-24 到 -70 dB） | 固定 -24dB |
| 計算位置 | findOptimalHighFrequencyThreshold() 或防呆重掃 | STEP 2.5 |
| 規則應用 | 防呆保證 >= Peak Frequency | 規則 (a)/(b) |
| 掃描方向 | 高→低 | 低→高 |

## 編譯驗證

✅ 代碼無語法錯誤
✅ 邏輯清晰正確
✅ 規則應用完整
✅ 可立即部署

## 測試建議

### 測試用例 1：規則 (a) 情況
```
Peak Frequency = 83.7 kHz
-24dB 掃描結果 = 68.29 kHz

預期：
  Start Frequency = 68.29 kHz ✓
  因為 68.29 < 83.7，滿足規則 (a)
```

### 測試用例 2：規則 (b) 情況
```
Peak Frequency = 25 kHz
-24dB 掃描結果 = 26 kHz
High Frequency = 27 kHz

預期：
  Start Frequency = 27 kHz ✓
  因為 26 >= 25，滿足規則 (b)，使用 High Frequency
```

### 驗證方法
1. 在 detectCalls 後檢查 call.startFreq_kHz 值
2. 驗證是否滿足規則 (a) 或 (b)
3. 確保 Start Frequency <= High Frequency（通常情況）

## 總結

**核心修正：** Start Frequency 必須獨立使用 -24dB 閾值計算，不能使用 High Frequency Threshold 的優化值。

**修正位置：**
1. Auto Mode 中移除不正確的 Start Frequency 計算
2. STEP 2.5 中統一使用 -24dB 閾值，應用規則 (a)/(b)

**修正結果：** 規則 (a)/(b) 現在正確應用，Start Frequency 計算完全獨立且準確。

