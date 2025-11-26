# Power Spectrum 顯示方式優化計劃

## 目標
將 Power Spectrum 的圖表顯示從 **Canvas PNG 生成** 改為 **純 HTML/CSS/SVG** 動態渲染，減少即時更新時的圖片重新生成。

---

## 現狀分析

### 現有方案 (Canvas)
**優點**:
- 單一 Canvas 完整繪製，代碼邏輯簡單
- 最終生成固定的圖像

**缺點**:
- 每次參數變更都需要重繪整個 Canvas
- Canvas 本身是位圖，更新效率低
- 無法利用 CSS 動畫和過渡效果

---

## 改進方案對比

### 方案 A: SVG 動態圖表 ✅ **推薦**
**優點**:
- ✅ 矢量圖，可無損縮放
- ✅ DOM 可訪問，可用 CSS/JS 動態更新
- ✅ 支持 CSS 動畫和過渡
- ✅ 文件大小小
- ✅ 可以分層更新（只重繪數據層，坐標軸不動）

**缺點**:
- 大數據集下性能略低於 Canvas

**使用場景**: 中等規模數據，需要頻繁更新

---

### 方案 B: HTML Table + CSS Grid
**優點**:
- 最簡單，完全 HTML/CSS

**缺點**:
- 不適合平滑曲線
- 只能柱狀圖效果

---

### 方案 C: Canvas + 優化更新
**優點**:
- 保留原有代碼結構大部分

**缺點**:
- 本質上還是位圖，優化有限

---

## 實現策略

### 第 1 步: SVG 框架建立
- 創建 SVG 容器，定義尺寸、邊距、坐標軸
- 分離 DOM 結構: 坐標軸層（靜態） + 數據層（動態）

### 第 2 步: 數據轉換
- 將 `drawPowerSpectrum()` 的計算邏輯保留
- 改為生成 SVG `<path>` 或 `<line>` 元素，而不是 Canvas 繪製

### 第 3 步: 動態更新
- 只更新 `<g class="spectrum-data">` 組內的路徑
- 保留 `<g class="axes">` 等靜態元素

### 第 4 步: CSS 增強
- 添加曲線顏色漸變
- 可選: 添加 CSS 過渡動畫

---

## 代碼結構變更

### 舊結構
```javascript
// Canvas 方式
const canvas = popup.querySelector('canvas');
const ctx = canvas.getContext('2d');

// 繪製時直接操作 ctx
drawPowerSpectrum(ctx, spectrum, ...);
```

### 新結構
```javascript
// SVG 方式
const svgContainer = popup.querySelector('.spectrum-svg-container');

// 繪製時生成 SVG 並插入 DOM
drawPowerSpectrumSVG(svgContainer, spectrum, ...);
```

---

## 性能對比估算

| 操作 | Canvas | SVG |
|------|--------|-----|
| 初始繪製 | ~10ms | ~15ms |
| 參數更新 | ~10ms | ~5ms (只更新數據層) |
| 整體更新 (50次) | ~500ms | ~150ms |
| 文件大小 | N/A | ~2-5KB |

---

## 實現計劃

### Phase 1: 核心 SVG 函數
- [ ] 創建 `drawPowerSpectrumSVG()` 函數
- [ ] 實現坐標軸、刻度標籤
- [ ] 實現頻譜曲線路徑
- [ ] 實現峰值標記

### Phase 2: DOM 集成
- [ ] 修改 `createPopupWindow()` 使用 SVG 而非 Canvas
- [ ] 更新 `redrawSpectrum()` 調用新函數
- [ ] 測試所有交互功能

### Phase 3: CSS 美化
- [ ] 添加曲線樣式 (顏色、寬度、漸變)
- [ ] 可選: 動畫過渡效果
- [ ] 響應式設計

### Phase 4: 優化和清理
- [ ] 移除舊 Canvas 代碼
- [ ] 性能測試
- [ ] 文檔更新

---

## 預計工作量

- **實現 SVG 核心**: 2-3 小時
- **DOM 集成和測試**: 1-2 小時
- **CSS 美化**: 1 小時
- **優化和調試**: 1-2 小時

**總計**: 5-8 小時

---

## 相關文件修改

### 主要修改
- `modules/powerSpectrum.js` (核心邏輯)
- `style.css` (SVG 樣式)

### 可能涉及
- `sonoradar.html` (如果有 Canvas 標記需要改)

