# 實現總結 - 2025年11月

## 1. Auto Mode Overlap 簡化

### 需求
取消 `findOptimalOverlap` 的複雜算法，在 auto mode 時，Overlap size 一律使用 75%。

### 實現細節

#### 文件：`modules/powerSpectrum.js`

**1. 簡化 `findOptimalOverlap` 函數**
- 移除複雜的掃描和評分算法（原先掃描 50%-95% 範圍）
- 現在直接返回固定的 75%
- 減少計算開銷

```javascript
export function findOptimalOverlap(audioData, sampleRate, fftSize, windowType) {
  // Auto mode 時直接使用 75% overlap
  return 75;
}
```

**2. 修改 `calculatePowerSpectrumWithOverlap` 函數**
- 當 `overlap === 'auto'` 或為空字符串時，使用 75% overlap
- 計算 hop size：`hopSize = Math.floor(fftSize * (1 - 0.75))`
- 無效值也改為使用 75% 作為預設值

### 優勢
- 性能提升：消除複雜的掃描算法
- 一致性：所有 auto mode 都使用相同的 75% overlap
- 簡化代碼維護

---

## 2. Call Analysis 窗口狀態管理

### 需求
- 當 selection area 已開啟了 Call Analysis 窗口，禁用該 selection area 的右鍵 context menu 中的 Call analysis 按鈕
- 當對應的 Call Analysis 窗口關閉後，啟用該 selection area 的右鍵 context menu 中的 Call analysis 按鈕

### 實現細節

#### 文件：`modules/frequencyHover.js`

**1. 全局狀態管理系統**
```javascript
const openCallAnalysisPopups = new Map();  // Map<popupElement, {selection}>
```

**2. 核心函數**
- `registerCallAnalysisPopup(popupElement, selection)` - 註冊打開的 popup
- `unregisterCallAnalysisPopup(popupElement)` - 反註冊 popup 並啟用菜單項
- `hasOpenPopup(selection)` - 檢查 selection 是否有打開的 popup
- `disableCallAnalysisMenuItem(selection)` - 禁用菜單項（灰色、不可點擊）
- `enableCallAnalysisMenuItem(selection)` - 啟用菜單項

**3. 右鍵菜單邏輯修改**
- 在顯示 context menu 時，檢查該 selection 是否已有打開的 popup
- 若有，則禁用 "Call analysis" 菜單項
- 菜單項添加 CSS class `disabled`、設置 opacity 0.5、禁用 pointer-events

**4. Popup 打開時的處理**
- 在 `handleShowPowerSpectrum` 中：
  1. 呼叫 `registerCallAnalysisPopup(popupElement, selection)` 註冊 popup
  2. 呼叫 `disableCallAnalysisMenuItem(selection)` 禁用菜單項

**5. Popup 關閉時的處理**
- 監聽關閉按鈕點擊事件
- 使用 MutationObserver 監聽 DOM 移除事件（以防其他方式關閉）
- 兩種方式都會觸發 `unregisterCallAnalysisPopup(popupElement)`，自動啟用菜單項

**6. 清理邏輯**
- 修改 `clearSelections()` 函數：
  - 移除 popup 相關的事件監聽器
  - 斷開 MutationObserver
  - 呼叫 `unregisterCallAnalysisPopup()` 進行完整清理

### 視覺反饋
- **禁用狀態**：菜單項文字灰暗（opacity: 0.5），不可點擊
- **啟用狀態**：菜單項恢復正常（opacity: 1），可點擊

### 技術亮點
- 使用 Map 數據結構有效追蹤多個 popup
- 同時監聽點擊事件和 DOM 移除事件，確保完整的狀態管理
- 自動清理機制，避免記憶體洩漏

---

## 修改總結

| 文件 | 修改函數 | 改動內容 |
|------|---------|---------|
| `powerSpectrum.js` | `findOptimalOverlap()` | 移除複雜算法，直接返回 75% |
| `powerSpectrum.js` | `calculatePowerSpectrumWithOverlap()` | 更新 overlap 邏輯為 75% |
| `frequencyHover.js` | （全局） | 添加 popup 狀態管理系統 |
| `frequencyHover.js` | `showSelectionContextMenu()` | 檢查和禁用菜單項 |
| `frequencyHover.js` | `handleShowPowerSpectrum()` | 註冊 popup 並禁用菜單項 |
| `frequencyHover.js` | `clearSelections()` | 完整的清理邏輯 |

---

## 測試建議

### 功能 1：Auto Mode Overlap
1. 打開 Call Analysis 窗口
2. 確認 Overlap 為 'auto' 或空值時，計算使用 75%
3. 驗證頻譜圖計算是否正確

### 功能 2：菜單項禁用/啟用
1. 右鍵點擊 selection area，打開 context menu
2. 點擊 "Call analysis" 打開窗口
3. 再次右鍵點擊同一 selection area，驗證 "Call analysis" 已禁用（灰色）
4. 關閉 Call Analysis 窗口
5. 再次右鍵點擊，驗證 "Call analysis" 已啟用（正常顏色）
