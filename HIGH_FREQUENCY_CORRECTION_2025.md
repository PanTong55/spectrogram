# High Frequency 修正總結 (2025年12月)

## 修正內容

### 1. High Frequency 並不一定是 Frame 0
**問題：** 原來的代碼假設 High Frequency 總是在第一幀（frame 0）。

**修正：** 
- 現在 High Frequency 掃描整個 spectrogram 的所有幀
- 找到最高頻率及其所在的幀索引 `highFreqFrameIdx`
- 存儲在 `call.highFreqFrameIdx` 中

**代碼位置：** `measureFrequencyParameters()` 中的 STEP 2

```javascript
// 掃描所有幀找最高頻率
for (let frameIdx = 0; frameIdx < spectrogram.length; frameIdx++) {
  const framePower = spectrogram[frameIdx];
  // ... 從高到低掃描頻率
  if (testHighFreq_Hz > highFreq_Hz || ...) {
    highFreq_Hz = testHighFreq_Hz;
    highFreqFrameIdx = frameIdx;  // 2025: Store the frame index
  }
}
```

### 2. Start Frequency 是真正的 Frame 0
**說明：** 
- Start Frequency 定義為 "First frame of call signal"
- 總是從第一幀（frame 0）掃描得出
- 時間點固定為 0 ms
- 其值由規則 (a)/(b) 決定：
  - **(a)** 若 -24dB 閾值的頻率 < Peak Frequency：使用該值為 Start Frequency
  - **(b)** 若 -24dB 閾值的頻率 >= Peak Frequency：Start Frequency = High Frequency

**代碼位置：** `measureFrequencyParameters()` 中的 STEP 2.5

```javascript
// Start Frequency 總是在第一幀
let startFreqFrameIdx = 0;  // Always frame 0
const firstFrameTime_ms = 0;  // Always at time 0
call.startFreq_ms = firstFrameTime_ms;
call.startFreqFrameIdx = startFreqFrameIdx;
```

**關鍵區別：**
- High Frequency 時間 = `(timeFrames[highFreqFrameIdx] - timeFrames[0]) * 1000` ms
- Start Frequency 時間 = 0 ms（總是在第一幀）

### 3. High Frequency 的時間計算修正
**問題：** 原來硬編碼為 `firstFrameTime_ms = 0`，假設 High Frequency 總是在 frame 0。

**修正：**
- 時間應相對於 `timeFrames[0]` 計算
- 基於 High Frequency 所在的幀計算

**代碼：**
```javascript
const firstFrameTimeInSeconds = timeFrames[0];
let highFreqTime_ms = 0;
if (highFreqFrameIdx < timeFrames.length) {
  const highFreqTimeInSeconds = timeFrames[highFreqFrameIdx];
  highFreqTime_ms = (highFreqTimeInSeconds - firstFrameTimeInSeconds) * 1000;
}
call.highFreqTime_ms = highFreqTime_ms;  // Relative to selection area start
```

## 相關屬性更新

### BatCall 類的屬性
```javascript
// High Frequency 相關
this.highFreq_kHz = null;           // 最高頻率 (kHz)
this.highFreqTime_ms = null;        // High Frequency 發生的時間 (ms)
this.highFreqFrameIdx = null;       // High Frequency 所在的幀索引

// Start Frequency 相關
this.startFreq_kHz = null;          // Start Frequency (kHz)
this.startFreq_ms = 0;              // Start Frequency 時間 (always 0 ms)
this.startFreqFrameIdx = 0;         // Start Frequency 幀索引 (always 0)
```

## 邏輯流程總結

### 原來的邏輯
```
Frame 0: High Frequency (frame 0)
         Start Frequency (frame 0)
         Time = 0 ms
         
Frame N: Peak Frequency (somewhere)
```

### 修正後的邏輯
```
Frame 0: Start Frequency (rule a/b, always frame 0, time = 0 ms)
Frame M: High Frequency (highest across entire call, time = relative to frame 0)
Frame N: Peak Frequency (highest energy point)
Frame K: Low Frequency (last frame with signal)
```

## 驗證項目

- [x] High Frequency 掃描整個 spectrogram
- [x] High Frequency 幀索引正確追蹤
- [x] High Frequency 時間相對於 timeFrames[0] 計算
- [x] Start Frequency 總是在 frame 0（時間 = 0 ms）
- [x] Start Frequency 值由規則 (a)/(b) 決定
- [x] 獨立的 bin index 用於 High Frequency 和 Start Frequency
- [x] 時間計算單位統一為 ms，相對於 selection area start
- [x] 文檔註解更新說明新邏輯
- [x] 無語法錯誤

## 相關文件

- 主要修改文件：`/workspaces/spectrogram/modules/batCallDetector.js`
- 修改時間：2025年12月
- 修改行數：STEP 2 和 STEP 2.5 部分
