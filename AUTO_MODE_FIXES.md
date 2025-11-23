# Auto Mode 修復總結 (2025-11-23)

## 修復內容

### 1. 修復 findOptimalStartEndThreshold() 演算法

**文件**: `/workspaces/spectrogram/modules/batCallDetector.js` (行 488-565)

**問題**: 算法邏輯正確，但缺少調試信息和詳細註解

**解決方案**:
- 添加了 `debugLog` 陣列來記錄每一次迭代的詳細信息
- 添加了 `console.log()` 輸出，顯示:
  - 異常檢測到時的頻率差異值 (kHz)
  - 選擇的最終閾值 (dB)
  - 完整計算過程 (所有測量點)

**驗證方法**:
1. 打開 Browser DevTools (F12)
2. 切換到 Console 標籤
3. 加載 WAV 檔案並啟用 Bat Call Detection
4. 查看 console 輸出的完整計算過程
5. 確認:
   - 存在頻率差異 > 3 kHz 的點
   - 選擇的閾值是異常前的那個

**範例輸出**:
```
異常檢測到！頻率差異: 5.23 kHz
選擇異常前的閾值: -32 dB
計算過程: [
  {thresholdBefore: -24, thresholdCurrent: -25, freqBefore: "40.50", freqCurrent: "40.52", freqDiff: "0.02"},
  {thresholdBefore: -25, thresholdCurrent: -26, freqBefore: "40.52", freqCurrent: "40.54", freqDiff: "0.02"},
  // ... 更多測量
  {thresholdBefore: -31, thresholdCurrent: -32, freqBefore: "42.30", freqCurrent: "47.53", freqDiff: "5.23"}
]
```

---

### 2. 修改 UI 顯示格式為 "Auto (值)"

**文件**: `/workspaces/spectrogram/modules/powerSpectrum.js`

#### A. updateBatCallAnalysis() - 行 200-227

**修改**:
- Auto 模式時，顯示格式變為 `"Auto (-40)"` 而不是單純 `-40`
- 應用灰色文字 (`color: #999`) + 斜體 (`font-style: italic`) 以視覺區分
- Manual 模式時，保持黑色正常文字

**代碼**:
```javascript
if (detector.config.startEndThreshold_dB_isAuto === true) {
  // Auto 模式：顯示 "Auto (計算值)" 格式，並設定灰色樣式
  const calculatedValue = detector.config.startEndThreshold_dB;
  batCallStartEndThresholdInput.value = `Auto (${calculatedValue})`;
  batCallStartEndThresholdInput.style.color = '#999';  // 灰色
  batCallStartEndThresholdInput.style.fontStyle = 'italic';
} else {
  // Manual 模式：保持用戶輸入的值，黑色文字
  batCallStartEndThresholdInput.value = detector.config.startEndThreshold_dB.toString();
  batCallStartEndThresholdInput.style.color = '#000';  // 黑色
  batCallStartEndThresholdInput.style.fontStyle = 'normal';
}
```

#### B. updateBatCallConfig() - 行 273-300

**修改**:
- 現在能正確解析新的 `"Auto (-40)"` 格式
- 保持 `startEndThreshold_dB_isAuto = true`
- 支持三種輸入格式:
  1. 空白 `""` → Auto 模式
  2. `"auto"` (任意大小寫) → Auto 模式
  3. `"Auto (-40)"` (包含括號) → Auto 模式，自動提取數值

**代碼**:
```javascript
if (startEndValue === '' || 
    startEndValue.toLowerCase().startsWith('auto') || 
    startEndValue.toLowerCase() === 'auto') {
  // Auto 模式
  batCallConfig.startEndThreshold_dB_isAuto = true;
  // 嘗試從括號內提取值
  const match = startEndValue.match(/\(([^)]+)\)/);
  if (match && !isNaN(parseFloat(match[1]))) {
    batCallConfig.startEndThreshold_dB = parseFloat(match[1]);
  } else {
    batCallConfig.startEndThreshold_dB = -24;
  }
}
```

#### C. 鍵盤事件支持 - 行 363-390

**修改**:
- ArrowUp / ArrowDown 事件現在能正確處理 `"Auto (-40)"` 格式
- 從 Auto 模式切換到數值時，自動移除灰色 + 斜體樣式
- 支持的格式檢測:
  - `""` (空白) → Auto
  - `"auto"` → Auto
  - `"Auto (-40)"` → Auto

**代碼**:
```javascript
const currentValue = inputElement.value.trim().toLowerCase();
if (currentValue === '' || 
    currentValue === 'auto' ||
    currentValue.startsWith('auto')) {
  // 從 Auto 切換到 -24
  inputElement.value = '-24';
  inputElement.style.color = '#000';
  inputElement.style.fontStyle = 'normal';
} else {
  // 數值增加/減少
  const numValue = parseFloat(currentValue);
  if (!isNaN(numValue)) {
    const newValue = numValue + 1;  // or - 1
    inputElement.value = newValue.toString();
  }
}
```

#### D. UI 初始化 - 行 674-684

**修改**:
- Auto 模式初始化時，立即應用灰色 + 斜體樣式
- 無需等待第一次計算，視覺效果立即呈現

**代碼**:
```javascript
const isAutoMode = window.__batCallControlsMemory.startEndThreshold_dB_isAuto !== false;
if (isAutoMode) {
  startEndThresholdInput.value = '';  // 初始時為空白
  startEndThresholdInput.style.color = '#999';
  startEndThresholdInput.style.fontStyle = 'italic';
} else {
  startEndThresholdInput.value = window.__batCallControlsMemory.startEndThreshold_dB.toString();
  startEndThresholdInput.style.color = '#000';
  startEndThresholdInput.style.fontStyle = 'normal';
}
```

---

## 驗證步驟

### 測試 1: 驗證 Auto 模式計算正確性

1. 打開 sonoradar.html
2. 加載含有蝙蝠叫聲的 WAV 檔案 (如 HK_bat_call.wav)
3. 打開 Browser Console (F12 → Console)
4. 點擊 "Detect Bat Calls" 按鈕
5. **檢查 Console 輸出**:
   - 應該看到 `異常檢測到！頻率差異: X.XX kHz`
   - 應該看到 `選擇異常前的閾值: Y dB`
   - X > 3 且 Y 是合理的閾值 (-24 到 -50 之間)

### 測試 2: 驗證 UI 顯示格式

1. 切換到 Auto 模式 (保持 Start/End Thresh 為空或 "Auto")
2. 檢查 UI:
   - **Auto 模式時**: 
     - 應顯示 `Auto (-40)` 格式 (灰色 + 斜體)
     - 計算後自動更新為實際值，如 `Auto (-32)`
   - **Manual 模式時**:
     - 輸入 `-40`，應顯示 `-40` (黑色 + 正常)
     - 計算結果使用 `-40`，不會改變

### 測試 3: 驗證鍵盤導航

1. 在 Start/End Thresh 字段中:
   - **Auto 模式**: 按 ArrowUp → 應變為 `-24` (黑色正常字)
   - **Auto 模式**: 按 ArrowDown → 應變為 `-50` (黑色正常字)
   - **Manual 模式**: 按 ArrowUp → 應增加 1 dB
   - **Manual 模式**: 按 ArrowDown → 應減少 1 dB

### 測試 4: 驗證模式切換

1. Manual 模式 (`-40`) → 清空 → Auto 模式應自動激活
2. Auto 模式 → 輸入 `-35` → Manual 模式應激活
3. 計算結果應該反映所選模式

---

## 預期結果

| 場景 | 預期行為 |
|------|--------|
| Auto 模式，未計算 | 顯示空白/placeholder，灰色斜體 |
| Auto 模式，已計算 | 顯示 `Auto (-32)`，灰色斜體 |
| Manual 模式 `-40` | 顯示 `-40`，黑色正常 |
| ArrowUp 從 Auto | 切換到 `-24`，黑色正常 |
| ArrowDown 從 Auto | 切換到 `-50`，黑色正常 |
| ArrowUp 從 `-40` | 變為 `-39`，黑色正常 |

---

## 技術細節

### Auto 模式工作流程

```
用戶保持 Input 為空 / "Auto"
  ↓
detectCalls() → measureFrequencyParameters()
  ↓
findOptimalStartEndThreshold() 測試 -24 到 -50
  ↓
偵測到頻率差異 > 3 kHz 的異常點
  ↓
返回異常前的閾值，例如 -32 dB
  ↓
保存到 this.config.startEndThreshold_dB = -32
  ↓
updateBatCallAnalysis() 讀取 config
  ↓
UI 顯示 "Auto (-32)" 灰色斜體
  ↓
所有 STEP 計算使用實際值 -32 而非預設 -24
```

### Manual 模式工作流程

```
用戶輸入 "-40"
  ↓
updateBatCallConfig() 解析為數值 -40
  ↓
設置 isAuto = false，值 = -40
  ↓
detectCalls() 跳過 findOptimalStartEndThreshold()
  ↓
直接使用 -40 進行所有計算
  ↓
UI 顯示 "-40" 黑色正常
```

---

## 編譯狀態

✅ **無編譯錯誤**
- batCallDetector.js: No errors found
- powerSpectrum.js: No errors found

---

## 修改文件摘要

| 文件 | 行號 | 修改類型 | 說明 |
|------|------|--------|------|
| batCallDetector.js | 488-565 | 算法改進 | 添加 DEBUG 日誌 |
| powerSpectrum.js | 200-227 | UI 顯示 | Auto (-值) 格式 + 灰色斜體 |
| powerSpectrum.js | 273-300 | 配置解析 | 支持新格式解析 |
| powerSpectrum.js | 363-390 | 鍵盤事件 | 支持新格式導航 |
| powerSpectrum.js | 674-684 | UI 初始化 | 預設灰色斜體樣式 |

---

## 後續建議

1. **測試環境**: 使用包含明顯回聲/反彈的蝙蝠叫聲進行測試
2. **異常閾值微調**: 如果 3 kHz 閾值過於敏感/遲鈍，可調整第 544 行的 `if (freqDifference > 3)`
3. **視覺反饋**: 可在計算中顯示進度條或 "calculating..." 提示
4. **導出功能**: 考慮在導出結果時記錄選擇的最終閾值和計算過程

