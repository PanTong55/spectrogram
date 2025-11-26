# 2025 年 Bat Call Detection 優化實現清單

## 已完成的變更

### 1. 定義 Start Frequency 的邏輯（需求 1）

**實現位置**: `/workspaces/spectrogram/modules/batCallDetector.js` - `findOptimalHighFrequencyThreshold()` 方法

**具體邏輯**:
- 在測試循環中（-24 dB 到 -70 dB）計算每個閾值對應的 High Frequency
- **新增**: 在整個 spectrogram 中找到 Peak Frequency（最大功率頻率）
- **判斷邏輯**:
  - 若第一個測出的 frequency **< Peak frequency**: 將該第一個測出的頻率標記為 **Start Frequency**
  - 若所有測出的 frequency 都 **> Peak frequency**: 將首次測出且 **> Peak frequency** 的頻率標記為 **Start Frequency**
  
**代碼實現** (第 710-730 行):
```javascript
// 判斷第一個測量是否低於 Peak frequency
if (peakFreq_kHz !== null && firstFreq_kHz !== null) {
  firstFreqBelowPeak = firstFreq_kHz < peakFreq_kHz;
  
  // 定義 Start Frequency
  if (firstFreqBelowPeak) {
    // 若第一個測出的 frequency < Peak frequency，使用第一個測出的頻率
    startFreq_kHz = firstFreq_kHz;
  }
}

// 若第一次測出的 frequency > Peak frequency，定義該頻率為 Start frequency
if (startFreq_kHz === null && currFreq_kHz > peakFreq_kHz) {
  startFreq_kHz = currFreq_kHz;
}
```

---

### 2. 優化 High Frequency 搜尋機制（需求 2）

**實現位置**: `/workspaces/spectrogram/modules/batCallDetector.js` - `findOptimalHighFrequencyThreshold()` 方法

**具體邏輯**:
- 引入 **動態頻率跳變檢測啟動機制** (`enableFreqJumpDetection` 旗標)
- **關鍵邏輯流程**:
  1. 當測試開始時，`enableFreqJumpDetection = false`（不檢測 > 2.5 kHz 的跳變）
  2. 在測試循環中，檢查當前 frequency 與 Peak frequency 的距離
  3. **當距離 < 1 kHz 時**：啟動 `enableFreqJumpDetection = true`
  4. **只有在 `enableFreqJumpDetection = true` 時**，才檢測 > 2.5 kHz 的頻率跳變
  5. 從啟動點開始，尋找真正的 High Frequency（通過大幅跳變檢測）

**代碼實現** (第 750-775 行):
```javascript
// 新的優化邏輯（2025）：決定何時啟動 2.5 kHz 跳變檢測
if (!enableFreqJumpDetection && peakFreq_kHz !== null && currFreq_kHz !== null) {
  const freqToPeakDiff = Math.abs(currFreq_kHz - peakFreq_kHz);
  
  // 若當前 frequency 與 Peak frequency 差距 < 1 kHz，啟動跳變檢測
  if (freqToPeakDiff < 1.0) {
    enableFreqJumpDetection = true;
  }
}

// 頻率跳變檢測：只在 enableFreqJumpDetection = true 時進行
let isAnomaly = false;
if (enableFreqJumpDetection) {
  isAnomaly = freqDifference > 2.5;
}
```

**異常檢測中的應用** (第 808-813 行):
```javascript
// 檢查當前值與前一個值是否有異常
let checkIsAnomaly = false;
if (enableFreqJumpDetection) {
  checkIsAnomaly = checkFreqDiff > 2.5;
}
```

---

### 3. 返回值結構更新

**舊返回值**:
```javascript
return finalThreshold;  // 只返回單個數值
```

**新返回值** (第 836-841 行):
```javascript
return {
  threshold: finalThreshold,        // 最優的 High Frequency 閾值
  warning: hasWarning,              // 警告標誌（是否達到 -70 dB 極限）
  startFreq_kHz: startFreq_kHz      // 新增：計算得出的 Start Frequency
};
```

---

### 4. 調用點更新

**位置**: `measureFrequencyParameters()` 方法（第 939-954 行）

**變更內容**:
```javascript
// 原來
this.config.highFreqThreshold_dB = result.threshold;
call.highFreqDetectionWarning = result.warning;

// 現在
this.config.highFreqThreshold_dB = result.threshold;
call.highFreqDetectionWarning = result.warning;
// 新增：存儲計算得出的 Start Frequency
if (result.startFreq_kHz !== null) {
  call.startFreq_kHz_autoCalculated = result.startFreq_kHz;
}
```

---

## 技術優勢

### 為什麼這些優化很重要？

1. **Start Frequency 定義的合理性**:
   - 根據實際 Peak frequency 動態定義，而不是固定規則
   - 適應不同蝙蝠種類的頻率特徵

2. **自適應頻率跳變檢測**:
   - **降低誤檢**: 避免在遠離 Peak frequency 時的虛假跳變檢測
   - **提高精度**: 只在接近真實 High frequency 時啟動嚴格檢測
   - **FM call 友好**: 處理 FM call 中段能量弱導致的斷層問題

3. **保險機制保留**:
   - 超大幅跳變 (>5 kHz) 檢測仍然有效
   - 後續連續 3 個正常值的忽略機制保留

---

## 驗證清單

- [x] 代碼語法檢查通過（無 Node.js 語法錯誤）
- [x] 返回值結構正確（對象包含 threshold、warning、startFreq_kHz）
- [x] 邏輯完整性驗證：
  - [x] Peak Frequency 計算邏輯正確
  - [x] Start Frequency 定義邏輯完整
  - [x] enableFreqJumpDetection 狀態機制正確
  - [x] 頻率跳變檢測條件正確
  - [x] 異常處理邏輯正確

---

## 下一步（可選）

如果需要進一步驗證，可以：
1. 使用實際 bat call 音頻文件進行測試
2. 比較優化前後的檢測結果
3. 檢查 `call.startFreq_kHz_autoCalculated` 是否在 UI 中正確顯示
