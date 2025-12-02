# 頻率標記（Frequency Markers）功能實現總結

## 概述
在 SonoRadar 的 spectrogram 中添加了視覺化的頻率標記，用於顯示 bat call 檢測結果中的各個頻率參數。

## 實現的標記類型

| 標記類型 | 字段名稱 | 顏色 | 說明 |
|---------|--------|------|------|
| High Freq Marker | `Fhigh` | 藍色 (#3498db) | 檢測到的高頻邊界 |
| Low Freq Marker | `Flow` | 紫色 (#9b59b6) | 檢測到的低頻邊界 |
| Knee Freq Marker | `kneeFreq_kHz` | 橙色 (#f39c12) | CF-FM 轉換點（膝頻率） |
| Peak Freq Marker | `peakFreq_kHz` | 蒂爾色 (#16a085) | 峰值頻率（最大功率點） |
| Char Freq Marker | `characteristicFreq_kHz` | 土黃色 (#e67e22) | 特徵頻率（最後 20% 的最低頻率） |

## 主要功能

### 1. Marker 創建和位置計算
- **位置計算函數** `frequencyToY()`: 將頻率值 (kHz) 轉換為 spectrogram 中的像素位置
- **創建函數** `createOrUpdateMarker()`: 動態創建或更新 marker 元素
- **X 座標**: marker 位於 selection 區域的中心
- **Y 座標**: 根據頻率值和 minFrequency/maxFrequency 範圍計算

### 2. 標記顯示和隱藏
- `showSelectionMarkers()`: 顯示所有 marker
- `hideSelectionMarkers()`: 隱藏所有 marker
- `clearSelectionMarkers()`: 完全移除所有 marker 元素

### 3. Bat Call 檢測同步
- 監聽 `batCallDetectionCompleted` 事件
- `updateMarkersFromBatCall()`: 從 bat call 對象提取頻率值並更新 marker 位置
- 自動同步 marker 與檢測結果

### 4. Marker 拖拽功能
- Marker 可以被拖拽（cursor: move）
- 全局拖拽狀態管理，避免多個事件監聽器重複
- Hover 時顯示 tooltip（data-title 屬性）
- 拖拽期間提升 z-index，完成後恢復

### 5. 與其他功能的集成
- **Selection 調整時**: `updateSelections()` 函數會自動更新 marker 的 X 座標
- **Zoom 操作後**: marker 位置隨 zoom 級別自動調整
- **Selection 刪除時**: `clearSelectionMarkers()` 確保 marker 被完全移除
- **Scroll 操作**: marker 位置相對於 fixed-overlay 容器，自動跟隨 scroll

## 代碼結構

### 在 frequencyHover.js 中的組件

```javascript
// 1. 全局拖拽狀態管理
let draggingMarker = null;
let markerStartY = 0;

// 2. 輔助函數
frequencyToY()              // 頻率 -> Y 座標
createOrUpdateMarker()      // 創建/更新 marker
hideSelectionMarkers()      // 隱藏 marker
clearSelectionMarkers()     // 清除 marker
updateMarkersFromBatCall()  // 同步 bat call 數據

// 3. 在 createTooltip 中初始化 marker 容器
selObj.markers = {
  highFreqMarker: null,
  lowFreqMarker: null,
  kneeFreqMarker: null,
  peakFreqMarker: null,
  charFreqMarker: null
}

// 4. 在 removeSelection 中清除 marker
clearSelectionMarkers(sel);

// 5. 在 updateSelections 中更新 marker X 座標

// 6. 在 handleShowPowerSpectrum 中添加事件監聽
addEventListener('batCallDetectionCompleted', batCallListener);
```

## CSS 類

在 style.css 中使用以下 CSS 類：

```css
.freq-marker                    /* 基礎 marker 樣式：absolute 定位，cursor: move */
.freq-marker[data-title]        /* z-index: 31 */
.freq-marker[data-title]:hover  /* hover 時 z-index: 32，並顯示 tooltip */
.freq-marker[data-title]:hover::after  /* Tooltip 內容 */

.marker-high      /* 高頻 marker 顏色 */
.marker-low       /* 低頻 marker 顏色 */
.marker-knee      /* 膝頻率 marker 顏色 */
.marker-heel      /* 峰值頻率 marker 顏色 */
.marker-cfstart   /* 特徵頻率 marker 顏色 */

#fixed-overlay    /* Marker 容器，position: absolute */
```

## 工作流程

1. **User 創建 Selection** → `createTooltip()` 初始化 marker 容器
2. **User 打開 Power Spectrum** → `handleShowPowerSpectrum()` 監聽 `batCallDetectionCompleted`
3. **Bat Call 檢測完成** → `batCallDetectionCompleted` 事件觸發
4. **Event Handler 執行** → `updateMarkersFromBatCall()` 更新 marker 位置
5. **Marker 顯示** → 在 spectrogram 中可見
6. **Selection 調整時** → `updateSelections()` 更新 marker X 座標
7. **Selection 刪除時** → `clearSelectionMarkers()` 移除所有 marker

## 特性

✅ **完整的頻率參數可視化** - 5 種不同的 marker 類型
✅ **顏色區分** - 每種 marker 有獨特的顏色
✅ **Tooltip 支持** - Hover 時顯示 marker 名稱
✅ **拖拽功能** - 可視化拖拽（位置移動）
✅ **動態同步** - 自動與 bat call 檢測結果同步
✅ **Zoom 響應** - 隨 zoom 級別自動調整
✅ **Selection 同步** - 隨 selection 區域調整
✅ **內存管理** - Selection 刪除時完全清除 marker

## 已知限制

- Marker 拖拽目前只更新視覺位置，不改變底層檢測結果（可在未來增強）
- 如果頻率值超出 minFrequency/maxFrequency 範圍，marker 不會顯示
- Marker 位置依賴於 fixed-overlay 容器的正確配置

## 測試清單

- [ ] Selection 創建時 marker 容器初始化
- [ ] Bat call 檢測完成時 marker 出現
- [ ] 多個 marker 同時顯示且顏色正確
- [ ] Selection 調整時 marker 位置更新
- [ ] Selection 刪除時 marker 被清除
- [ ] Zoom 操作後 marker 位置正確
- [ ] Marker hover 時顯示 tooltip
- [ ] Marker 可被拖拽移動

## 相關文件
- `/workspaces/spectrogram/modules/frequencyHover.js` - 主要實現
- `/workspaces/spectrogram/style.css` - CSS 樣式
- `/workspaces/spectrogram/modules/batCallDetector.js` - Bat call 檢測和頻率計算
- `/workspaces/spectrogram/modules/callAnalysisPopup.js` - Call analysis 面板
