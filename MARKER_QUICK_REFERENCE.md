# 頻率標記功能 - 快速參考

## 什麼是頻率標記？

頻率標記是在 spectrogram 中顯示的視覺指標，代表 bat call 檢測中的各個頻率參數。

## 標記類型和顏色

| 標記 | 說明 | 顏色 |
|-----|------|------|
| 🔵 High Freq | 檢測到的高頻邊界 | 藍色 |
| 🟣 Low Freq | 檢測到的低頻邊界 | 紫色 |
| 🟠 Knee Freq | CF-FM 轉換點 | 橙色 |
| 🟢 Peak Freq | 最大功率點 | 蒂爾色 |
| 🟡 Char Freq | 特徵頻率 | 土黃色 |

## 何時出現標記

1. 創建 selection（選擇區域）
2. 打開 "Power Spectrum" 面板
3. Bat call 檢測完成
4. 標記會自動出現在 spectrogram 中

## 與標記互動

### Hover（懸停）
- 將滑鼠懸停在標記上會顯示標記的名稱

### 拖拽
- 點擊並拖拽標記可以移動它（暫時只是視覺效果）

## 標記位置

- **X 軸**: 位於 selection 區域的中心
- **Y 軸**: 根據頻率值在 spectrogram 中的位置

## 自動同步

標記會自動與以下事件同步：

- ✅ Selection 大小改變
- ✅ Zoom 級別改變
- ✅ Bat call 檢測結果更新
- ✅ Selection 刪除時移除標記

## 故障排查

### 標記不顯示

1. 確認是否打開了 Power Spectrum 面板
2. 確認 bat call 檢測是否成功（查看面板中的參數）
3. 檢查頻率值是否在 spectrogram 範圍內

### 標記位置不正確

1. 檢查是否正在拖拽標記（應該不影響正常位置）
2. 嘗試重新調整 selection 大小
3. 嘗試重新打開 Power Spectrum 面板

### 標記顏色不對

- 刷新頁面
- 清除瀏覽器快取

## 技術細節

### 實現的模組
- `frequencyHover.js` - 主要邏輯
- `style.css` - 視覺樣式
- `batCallDetector.js` - 頻率計算

### 事件流
```
Selection 創建 
    ↓
打開 Power Spectrum 面板
    ↓
監聽 batCallDetectionCompleted 事件
    ↓
Bat call 檢測完成
    ↓
提取頻率值
    ↓
創建/更新 marker
    ↓
標記顯示在 spectrogram 中
```

### CSS 類名
- `.freq-marker` - 基礎 marker 樣式
- `.marker-high`, `.marker-low`, `.marker-knee`, `.marker-heel`, `.marker-cfstart` - 顏色類

## 未來增強

可能的改進方向：

1. **手動調整檢測結果** - 允許拖拽 marker 來編輯檢測結果
2. **Marker 過濾** - 允許隱藏特定類型的 marker
3. **Marker 匯出** - 將 marker 位置保存為數據
4. **Marker 統計** - 显示 marker 相對位置的統計信息
5. **Marker 對比** - 比較多個 selection 的 marker 位置

## 相關文件

- 實現詳情: `MARKER_FEATURE_IMPLEMENTATION.md`
- 完整說明: `docs/README_BAT_DETECTION.md`
