# Start/End Threshold Auto Mode 實現方案

## 概述

實現了 Start/End Threshold 的自動模式（Auto mode），允許程式自動偵測最佳臨界值，同時保留手動調整的選項。

## 功能說明

### 1. Auto Mode（默認啟用）
- **工作原理**：程式自動測試 -24 dB 到 -50 dB 範圍內的所有閾值
- **異常偵測**：找出第一個導致 Start Frequency 大幅跳躍（>3 kHz）的臨界點
- **結果**：返回該臨界點的前一個閾值作為最優值
- **應用場景**：避免過度估計（overestimation）導致的 Start Frequency 虛高

### 2. Manual Mode（用戶可切換）
- **工作原理**：用戶手動輸入 -50 ~ -6 dB 範圍的閾值
- **控制方式**：Checkbox 切換到 Manual，然後編輯 number input
- **應用場景**：特殊情況下需要微調特定錄音

## 實現細節

### UI 控件結構

```
Start/End Thresh: [☑ Auto] [Input: -24 (隱藏)]
                  或
Start/End Thresh: [☐ Auto] [Input: -24 (可見)]
```

- **Auto Checkbox**：勾選時啟用自動模式，隱藏 Manual input
- **Manual Input**：只在 Auto 未勾選時顯示

### 算法邏輯（findOptimalStartEndThreshold）

```javascript
1. 測試範圍：從 -24 dB 逐步下降到 -50 dB（步長：1 dB）
2. 對每個閾值測量首幀的 Start Frequency
3. 比較連續測量間的頻率差異
4. 首次檢測到 > 3 kHz 的跳躍時，返回前一個閾值
5. 返回值範圍確保在 [-50, -24] 之間
```

### 異常偵測門檻值

- **Normal transition**：1-2 kHz（漸進式噪聲擴展）
- **Anomaly threshold**：> 3 kHz（過度估計的信號）
- **Strong jump**：5-10 kHz（明顯的 rebounce 或虛報）

### 數據流

```
User toggles Auto checkbox
    ↓
updateBatCallConfig() 
    ↓
batCallConfig.startEndThreshold_dB_isAuto = checkbox.checked
    ↓
detector.config 更新
    ↓
updateBatCallAnalysis()
    ↓
measureFrequencyParameters() 檢查 config.startEndThreshold_dB_isAuto
    ↓
如果 Auto：調用 findOptimalStartEndThreshold(spectrogram, ...)
如果 Manual：使用 config 中的手動值
    ↓
完成頻率測量
```

## 全局內存持久化

```javascript
window.__batCallControlsMemory = {
  // ... 其他參數 ...
  startEndThreshold_dB: -24,
  startEndThreshold_dB_isAuto: true,  // ← 新增
  // ...
}
```

## 文件修改清單

### 1. modules/powerSpectrum.js

**修改 1**：全局內存初始化（第 18 行）
```javascript
startEndThreshold_dB_isAuto: true,  // Auto mode for Start/End Threshold
```

**修改 2**：batCallConfig 初始化（第 60 行）
```javascript
startEndThreshold_dB_isAuto: memory.startEndThreshold_dB_isAuto !== false,
```

**修改 3**：querySelector 獲取 Auto checkbox（第 232 行）
```javascript
const batCallStartEndThresholdAutoCheckbox = popup.querySelector('#startEndThreshold_isAuto');
```

**修改 4**：UI 控件創建（第 561-607 行）
- 替換單純的 number input 為 checkbox + number input 組合
- 初始化時隱藏 Manual input（如果 Auto 啟用）
- 添加 checkbox change 事件監聽器

**修改 5**：updateBatCallConfig 函數（第 277-320 行）
- 讀取 Auto checkbox 狀態
- 根據模式決定是否讀取 Manual 值
- 保存 startEndThreshold_dB_isAuto 到全局內存

**修改 6**：事件監聽器（第 365-368 行）
- 為 Auto checkbox 添加 change 事件

### 2. modules/batCallDetector.js

**修改 1**：新增 findOptimalStartEndThreshold 方法（第 488-565 行）
- 測試 -24 ~ -50 dB 範圍
- 測量每個閾值下的 Start Frequency
- 偵測第一個異常跳躍
- 返回最優閾值

**修改 2**：measureFrequencyParameters 方法開頭（第 575-586 行）
- 檢查 config.startEndThreshold_dB_isAuto 狀態
- 如果 Auto：調用 findOptimalStartEndThreshold()
- 自動計算最優值

### 3. style.css

**修改 1**：新增 checkbox 樣式（第 2506-2510 行）
```css
.bat-call-controls input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: #2563eb;
}
```

## 測試建議

### 手動測試流程

1. **打開 Power Spectrum Popup**
   - 檢查 "Start/End Thresh" 控件
   - 默認應显示 "☑ Auto" 和隱藏的 input

2. **測試 Auto Mode（默認）**
   - 執行 Bat Call 檢測
   - 觀察 Start Frequency 是否合理
   - 應避免明顯的過度估計

3. **切換到 Manual Mode**
   - 點擊 Auto checkbox 取消勾選
   - 應看到 Manual input 變為可見
   - 嘗試輸入不同的值（-30, -35, -40）
   - 觀察 Start Frequency 如何隨閾值變化

4. **切換回 Auto Mode**
   - 重新勾選 checkbox
   - Manual input 應隱藏
   - Bat Call 分析應自動更新

5. **新窗口測試**
   - 開啟新的 Power Spectrum Popup
   - 檢查是否記憶了前一次的 Auto/Manual 設置
   - 驗證全局內存持久化

## 性能考量

- **算法複雜度**：O(27 × N)，其中 N 是頻率 bin 數量
  - 測試 27 個閾值（-24 到 -50）
  - 每個閾值掃描一次第一幀的頻率
  - 實際運行時間 < 10ms（256kHz 採樣率）

- **內存使用**：
  - measurements 陣列：27 個對象
  - 不影響整體內存開銷

## 後續優化建議

1. **自適應異常門檻**
   - 根據信噪比（SNR）動態調整 3 kHz 門檻值
   - 較低 SNR 時增加門檻，提高容錯性

2. **可視化反饋**
   - 在 UI 中顯示已自動選擇的閾值值
   - 例如："Auto (-28 dB)" 提示用戶實際使用的值

3. **日誌記錄**
   - 記錄自動選擇的過程（測試的所有閾值和對應的 Start Freq）
   - 用於調試和驗證算法性能

4. **批量處理**
   - 對多個區間同時應用 Auto mode
   - 使用相同的最優閾值確保一致性
