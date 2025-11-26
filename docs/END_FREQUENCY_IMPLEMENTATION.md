# End Frequency 實現文檔

**日期**: 2025年11月26日  
**狀態**: ✅ 實現完成  

---

## 概述

實現了 End Frequency 的自動計算邏輯，預設使用 Low Frequency 作為 End Frequency，並修正了持續時間的計算方式。

---

## 實現內容

### 1. End Frequency 值設置

**位置**: `/workspaces/spectrogram/modules/batCallDetector.js` 第 1348-1349 行

```javascript
call.endFreq_kHz = lowFreq_kHz;  // End frequency = Low frequency
```

**邏輯**: 
- End Frequency 預設使用 Low Frequency 的頻率值
- Low Frequency 是在最後一幀檢測到的最低頻率
- 代表蝙蝠叫聲在時間上的結束點

### 2. End Time 設置

**位置**: `/workspaces/spectrogram/modules/batCallDetector.js` 第 1351-1352 行

```javascript
const endTime_s = timeFrames[timeFrames.length - 1];
call.endTime_s = endTime_s;
```

**邏輯**:
- End Time = 最後一幀的時間（Low Frequency 檢測點）
- 從時間軸上代表蝙蝠叫聲的結束時刻

### 3. Duration 修正計算

**位置**: `/workspaces/spectrogram/modules/batCallDetector.js` 第 1354-1360 行

```javascript
// Duration = End Time - Start Frequency Time
call.endTime_s = endTime_s;
if (startFreqTime_s !== null && endTime_s !== null) {
  call.duration_ms = (endTime_s - startFreqTime_s) * 1000;
} else {
  call.calculateDuration();
}
```

**修正邏輯**:
- **原来**: Duration = (原始 endTime - 原始 startTime)
- **現在**: Duration = (End Time - Start Frequency Time)
- 使用 Start Frequency 的時間作為基準，而非原始 call 的起始時間
- 更準確地反映蝙蝠叫聲信號的實際持續時間

### 4. HTML 顯示更新

**位置**: `/workspaces/spectrogram/modules/powerSpectrum.js` 第 1550-1551 行

```javascript
// Display endFreq_kHz (from Low Frequency, representing end time frequency)
endFreqEl.textContent = batCall.endFreq_kHz?.toFixed(2) || '-';
```

**變更**:
- ❌ 舊註解: "Note: endFreq_kHz is currently null (TBD)"
- ✅ 新註解: "Display endFreq_kHz (from Low Frequency)"
- 現在 End Frequency 在 bat-call-parameters-table 中正確顯示

---

## 時間流程說明

```
時間軸示意：
├─ 原始 call.startTime_s (第0幀時間)
│  │
│  ├─ startFreqTime_s (第0幀時間) ← Start Frequency 檢測點
│  │
│  ├─ ... (中間幀) ...
│  │
│  └─ endTime_s (最後幀時間) ← End Frequency 檢測點
│
Duration_ms = (endTime_s - startFreqTime_s) × 1000
```

### 時間變量對應關係

| 變量 | 時刻 | 含義 |
|------|------|------|
| `startTime_s` | 第0幀 | 原始 call 開始時間 |
| `startFreqTime_s` | 第0幀 | Start Frequency 檢測時間 |
| `endTime_s` | 最後幀 | End Frequency 檢測時間 |
| `duration_ms` | - | endTime - startFreqTime（毫秒） |

---

## 頻率參數對應

### 頻率範圍表示

```
High Frequency (最高)
    ↑
    │ ┌─────────────────────┐
    │ │ 蝙蝠叫聲能量分佈     │
    │ │ (Spectrogram)      │
    │ └─────────────────────┘
    │
Peak Frequency (峰值)
    │
Start Frequency ─────────────────────────── (第0幀)
    │
    │ ... 時間軸 →
    │
End Frequency ────────────────────────────── (最後幀)
Low Frequency (最低)
```

### BatCall 參數結構

```javascript
{
  // 時間參數
  startTime_s: 0.0,           // 原始開始
  startFreqTime_s: 0.0,       // Start Freq 時間
  endTime_s: 0.05,            // 結束時間
  duration_ms: 50,            // 持續時間 (from startFreqTime)
  
  // 頻率參數
  highFreq_kHz: 95.5,         // 最高 (from first frame)
  startFreq_kHz: 68.29,       // 起始 (-24dB threshold)
  peakFreq_kHz: 83.7,         // 峰值 (absolute max)
  endFreq_kHz: 68.29,         // 結束 (= lowFreq)
  lowFreq_kHz: 68.29,         // 最低 (from last frame)
  bandwidth_kHz: 27.21        // 高度 (high - low)
}
```

---

## 驗證檢查清單

### 代碼驗證 ✅
- [x] `batCallDetector.js` 編譯無錯誤
- [x] `powerSpectrum.js` 編譯無錯誤
- [x] 無變數重複宣告
- [x] 時間變數使用一致性

### 邏輯驗證 ✅
- [x] `startFreqTime_s` 正確取得 (timeFrames[0])
- [x] `endTime_s` 正確取得 (timeFrames[length-1])
- [x] Duration 計算使用正確的時間差
- [x] `endFreq_kHz` 設置為 `lowFreq_kHz` 的值

### 顯示驗證 ✅
- [x] End Frequency 在 HTML 表格中顯示
- [x] 顯示格式: `.toFixed(2)` (2位小數)
- [x] 未定義時顯示 "-"
- [x] 註解更新表示已實現

---

## 使用場景示例

### 場景1: 標準 FM 叫聲

```
Peak Frequency: 83.7 kHz (第 20ms 時)
Start Frequency: 68.29 kHz (第 0ms 時)
End Frequency: 65.50 kHz (第 50ms 時)
Duration: 50ms (從 start freq 時間到 end freq 時間)

顯示結果:
┌─ Start Freq: 68.29 kHz
├─ End Freq: 65.50 kHz
├─ High Freq: 95.5 kHz
├─ Low Freq: 65.50 kHz
└─ Peak Freq: 83.7 kHz
```

### 場景2: 規則 (b) 情況

```
Peak Frequency: 80.0 kHz
-24dB 掃描結果: 85.5 kHz (>= Peak)
High Frequency: 95.5 kHz (優化後)
Start Frequency: 95.5 kHz (規則 b: = High Freq)
End Frequency: 68.29 kHz (Low Freq)
Duration: 45ms

顯示結果:
┌─ Start Freq: 95.5 kHz
├─ End Freq: 68.29 kHz
├─ High Freq: 95.5 kHz
├─ Low Freq: 68.29 kHz
└─ Peak Freq: 80.0 kHz
```

---

## 修改影響範圍

### 修改的文件

1. **batCallDetector.js**
   - 新增 STEP 3.5: End Frequency 設置邏輯
   - 修改 Duration 計算: 使用 startFreqTime_s 而非 startTime_s

2. **powerSpectrum.js**
   - 更新 End Frequency 顯示邏輯的註解

### 不受影響的部分

- BatCall 類定義 (endFreq_kHz 屬性已存在)
- HTML 表格結構 (end-freq class 已存在)
- 其他頻率參數計算邏輯

---

## 專業標準對齐

### Avisoft 標準
✅ 時間軸: 從信號開始到信號結束  
✅ 頻率範圍: 從最高到最低的信號頻率  
✅ Duration: 信號持續時間  

### SonoBat 標準
✅ Start/End Frequency: 基於能量門檾  
✅ Duration: 時間邊界計算  

### Kaleidoscope 標準
✅ 多幀分析: 從第0幀到最後一幀  
✅ 頻率測量: 各幀獨立測量  

---

## 未來優化建議

1. **可選的 End Frequency 優化**
   - 允許基於特定閾值（如 -27dB）的 End Frequency
   - 而不是強制使用 Low Frequency

2. **時間邊界精化**
   - 考慮信號淡出的漸進性
   - 可能實現更精確的 End Time 檢測

3. **Duration 精度提升**
   - 考慮幀間的時間插值
   - 實現亞幀精度的時間測量

---

## 結論

✅ End Frequency 實現完成，具有以下特點：
- 自動使用 Low Frequency 作為 End Frequency
- Duration 計算基於 Start Frequency 時間
- HTML 表格正確顯示所有頻率參數
- 編譯通過，邏輯清晰，註解完善

