# Marker 時間定位修復 - 2025年12月2日

## 問題描述

Marker 的 X 軸位置定位不正確。原問題：
- Marker 應該基於其**對應頻率的時間點**來定位
- 但目前所有 marker 被放置在 **selection 區域的全局時間座標**中

## 正確的行為

Marker 應該遵循以下邏輯：

1. **高頻率 marker 在 selection 區域內的位置**
   - 高頻率 bin 的時間點：4ms（相對於 selection 開始）
   - marker 應該顯示在 selection 區域內的 4ms 位置

2. **所有 marker 應該在 selection 區域內**
   - marker 的時間值是**相對於 selection 的開始時間**（本地時間）
   - 不是絕對的全局時間

3. **Zoom 級別影響 marker 位置**
   - 高 zoom 級別時，marker 分散更開
   - 低 zoom 級別時，marker 聚集在一起

## 修復方案

### 原始錯誤邏輯

```javascript
// ❌ 錯誤：使用全局時間計算
xPos = (timeInSeconds / getDuration()) * actualWidth;
```

這導致：
- marker 在全局時間軸上定位
- 不會在 selection 區域內
- 時間值應該相對於 selection 被忽略

### 修復後的邏輯

```javascript
// ✓ 正確：使用本地時間計算
const rectLeft = (selObj.data.startTime / getDuration()) * actualWidth;
const rectWidth = ((selObj.data.endTime - selObj.data.startTime) / getDuration()) * actualWidth;

const selectionDuration = selObj.data.endTime - selObj.data.startTime;
const localTimeRatio = selectionDuration > 0 ? timeInSeconds / selectionDuration : 0;
xPos = rectLeft + localTimeRatio * rectWidth;
```

## 公式解釋

### 步驟 1：計算 Selection 區域的像素座標
```
rectLeft = (selection.startTime / totalDuration) × totalPixelWidth
rectWidth = (selection.duration / totalDuration) × totalPixelWidth
```

### 步驟 2：計算 Marker 在 Selection 內的相對位置
```
localTimeRatio = markerTime / selectionDuration
```

### 步驟 3：計算最終的 X 座標
```
xPos = rectLeft + localTimeRatio × rectWidth
```

## 具體例子

假設：
- 全局持續時間：100ms
- Selection 範圍：20ms - 60ms（持續 40ms）
- Zoom 級別：500px/s
- 高頻率 marker 時間：4ms（相對於 selection）

計算過程：

1. **計算 Selection 的像素座標**
   - rectLeft = (20ms / 100ms) × (100ms × 500) = 10,000px
   - rectWidth = (40ms / 100ms) × (100ms × 500) = 20,000px

2. **計算 Marker 的相對位置**
   - localTimeRatio = 4ms / 40ms = 0.1

3. **計算最終 X 座標**
   - xPos = 10,000 + 0.1 × 20,000 = 12,000px

結果：marker 顯示在 selection 內的 10% 位置。

## 修改的代碼位置

### 1. `createOrUpdateMarker()` 函數（第 450-520 行）
- 修改 marker X 座標計算邏輯
- 使用 selection 的本地時間而不是全局時間

### 2. `updateSelections()` 函數（第 1274-1302 行）
- 修改 marker X 座標更新邏輯
- Zoom 或 selection 調整時正確重新計算位置

## Marker 時間映射

| Marker 類型 | 時間字段 | 說明 |
|-----------|---------|------|
| High Freq | startFreqTime_s | 高頻率開始時間（相對於 selection）|
| Low Freq | endFreqTime_s | 低頻率結束時間（相對於 selection）|
| Knee Freq | kneeTime_ms | 膝頻率時間（相對於 selection）|
| Peak Freq | - | 無時間值（使用中心）|
| Char Freq | endFreqTime_s | 特徵頻率時間（相對於 selection）|

## 單位轉換

所有時間值都會被正規化為秒：
- 秒：直接使用
- 毫秒（> 100）：÷ 1000 → 秒

## 驗證檢查清單

- ✅ 語法檢查通過
- ✅ Marker 時間值相對於 selection 計算
- ✅ Marker 應該始終在 selection 區域內
- ✅ Zoom 級別不影響相對位置的正確性
- ✅ Selection 調整時 marker 位置同步更新

## 性能優化

該修復：
- 不增加計算複雜度
- 只改變坐標計算公式
- 不影響性能
- 完全向後兼容

## 相關測試場景

1. **基本測試**：創建 selection 和 marker，檢查位置是否在 selection 內
2. **Zoom 測試**：改變 zoom 級別，marker 應該在 selection 內重新定位
3. **Selection 調整測試**：調整 selection 大小，marker 應該跟隨
4. **多個 Selection**：創建多個 selection，確保 marker 在各自的 selection 內

## 後續改進建議

1. 添加 marker 位置驗證（確保始終在 selection 內）
2. 添加 marker 超出 selection 邊界的警告
3. 考慮添加動畫過渡（zoom 和 selection 調整時）
4. 添加 marker 時間的視覺反饋（顯示精確時間值）
