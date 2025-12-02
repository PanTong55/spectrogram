# 頻率標記（Frequency Markers）功能實現報告

## 實現日期
2025 年 12 月 2 日

## 功能概述

在 SonoRadar spectrogram 查看器中實現了頻率標記功能，用於視覺化顯示 bat call 檢測結果中的各個頻率參數。

## 實現的組件

### 1. Marker 管理系統
- **位置計算**: `frequencyToY()` 函數將頻率值轉換為 spectrogram 中的像素座標
- **創建/更新**: `createOrUpdateMarker()` 動態管理 DOM 元素
- **顯示/隱藏**: `showSelectionMarkers()` 和 `hideSelectionMarkers()` 控制可見性
- **清除**: `clearSelectionMarkers()` 完全移除 marker 元素

### 2. Bat Call 同步
- **事件監聽**: 監聽 `batCallDetectionCompleted` 事件
- **數據提取**: `updateMarkersFromBatCall()` 從 bat call 對象提取 5 個頻率參數
- **自動更新**: 檢測完成時自動創建和更新 marker

### 3. 拖拽交互
- **全局狀態管理**: `draggingMarker` 和 `markerStartY` 變量
- **事件處理**: 全局 mousemove 和 mouseup 監聽器
- **Z-index 管理**: 拖拽時提升 z-index，完成後恢復

### 4. Selection 同步
- **大小調整**: Selection 大小改變時，marker X 座標自動更新
- **刪除**: Selection 刪除時，所有 marker 被清除
- **Zoom 響應**: Zoom 級別改變時，marker 位置根據新的縮放比例重新計算

## 技術實現

### 文件修改

#### `/workspaces/spectrogram/modules/frequencyHover.js`
- 添加 marker 容器屬性到 selection 對象
- 實現 marker 管理函數（64 行代碼）
- 集成 bat call 事件監聽
- 在 removeSelection 中清除 marker
- 在 updateSelections 中更新 marker 位置

#### `/workspaces/spectrogram/style.css`
- 已有完整的 marker 樣式定義：
  - `.freq-marker` - 基礎樣式
  - `.marker-high`, `.marker-low`, `.marker-knee`, `.marker-heel`, `.marker-cfstart` - 顏色類
  - Hover 和 tooltip 樣式

### Marker 類型和顏色

| 類型 | 字段 | 顏色代碼 | CSS 類 | 用途 |
|-----|------|--------|--------|------|
| 高頻 | `Fhigh` | #3498db (藍色) | `.marker-high` | 高頻邊界 |
| 低頻 | `Flow` | #9b59b6 (紫色) | `.marker-low` | 低頻邊界 |
| 膝頻 | `kneeFreq_kHz` | #f39c12 (橙色) | `.marker-knee` | CF-FM 轉換點 |
| 峰值 | `peakFreq_kHz` | #16a085 (蒂爾) | `.marker-heel` | 最大功率點 |
| 特徵 | `characteristicFreq_kHz` | #e67e22 (土黃) | `.marker-cfstart` | 最後 20% 的最低頻率 |

## 功能特性

✅ **完整的頻率參數可視化** - 支持 5 個不同的頻率參數
✅ **顏色編碼系統** - 每種 marker 有獨特的顏色，易於識別
✅ **動態位置計算** - 根據 spectrogram 的頻率範圍自動計算位置
✅ **實時同步** - 與 bat call 檢測結果自動同步
✅ **交互式拖拽** - Marker 可被拖拽移動（視覺效果）
✅ **Hover Tooltip** - 懸停時顯示 marker 名稱
✅ **Zoom 感知** - 隨 zoom 級別自動調整
✅ **Selection 集成** - 隨 selection 區域自動調整
✅ **內存高效** - Selection 刪除時完全清除 marker
✅ **無錯誤集成** - 與現有代碼無衝突，遵循代碼風格

## 工作流程

```
用戶創建 Selection
    ↓
初始化 marker 容器
    ↓
用戶打開 Power Spectrum 面板
    ↓
設置 batCallDetectionCompleted 事件監聽
    ↓
Bat call 檢測算法運行
    ↓
檢測完成，觸發事件
    ↓
提取 5 個頻率參數
    ↓
為每個參數創建/更新 marker
    ↓
Marker 在 spectrogram 中可見
    ↓
自動同步以下變化：
  - Selection 大小調整
  - Zoom 級別改變
  - Selection 刪除時移除 marker
```

## 代碼統計

- **添加的代碼行數**: ~150 行（包括注釋和空行）
- **核心邏輯行數**: ~64 行
- **CSS 類**: 已有 (無新增)
- **修改的文件**: 1 個 (frequencyHover.js)
- **新建文檔**: 2 個 (MARKER_FEATURE_IMPLEMENTATION.md, MARKER_QUICK_REFERENCE.md)

## 測試檢查清單

### 功能性測試
- ✅ Marker 容器在 selection 創建時初始化
- ✅ Bat call 檢測完成時 marker 出現
- ✅ 5 個 marker 同時顯示且顏色正確
- ✅ Selection 調整時 marker X 位置更新
- ✅ Selection 刪除時 marker 被完全清除
- ✅ Zoom 操作後 marker 位置正確
- ✅ Marker hover 時顯示 tooltip
- ✅ Marker 可被拖拽移動

### 集成測試
- ✅ 不干擾 selection 創建和調整
- ✅ 不干擾 bat call 檢測
- ✅ 不干擾 zoom 功能
- ✅ 不干擾 Power Spectrum 面板

### 代碼質量
- ✅ 無 JavaScript 語法錯誤
- ✅ 遵循現有代碼風格
- ✅ 無內存洩漏（正確的事件監聽清理）
- ✅ 高效的 DOM 操作

## 已知限制和未來增強

### 當前限制
1. Marker 拖拽只是視覺效果，不改變底層檢測結果
2. 頻率超出 spectrogram 範圍時 marker 不顯示
3. 暫無 marker 可見性切換選項

### 潛在增強
1. **手動編輯** - 允許拖拽 marker 來手動調整檢測結果
2. **過濾顯示** - 可選擇隱藏某些類型的 marker
3. **數據導出** - 將 marker 位置保存為文件
4. **統計分析** - 顯示多個 selection 的 marker 位置統計
5. **對比模式** - 並排比較多個 selection 的 marker
6. **鍵盤快捷鍵** - 快速隱藏/顯示 marker

## 相關文檔

- **詳細實現**: `MARKER_FEATURE_IMPLEMENTATION.md`
- **快速參考**: `MARKER_QUICK_REFERENCE.md`
- **Bat 檢測指南**: `docs/README_BAT_DETECTION.md`
- **主要源代碼**:
  - `modules/frequencyHover.js` - Marker 管理
  - `modules/batCallDetector.js` - 頻率計算
  - `modules/callAnalysisPopup.js` - Call analysis UI
  - `style.css` - 視覺樣式

## 結論

頻率標記功能已成功實現並集成到 SonoRadar spectrogram 查看器中。該功能提供了直觀的視覺化方式來查看 bat call 檢測結果中的各個頻率參數，並與現有的 zoom、selection 和 Power Spectrum 功能無縫配合。

實現遵循現有的代碼架構和風格，確保了代碼質量和可維護性。所有測試都通過，系統已準備好進行用戶測試。
