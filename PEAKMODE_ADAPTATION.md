# ✅ peakMode 適配完成 - WASM 新架構

## 🐛 問題識別

原始 peakMode 實現使用 **dB 轉換後的值** (0-255 範圍) 進行峰值檢測，但在新 WASM 架構中應該使用 **原始幅度值** (Float32Array) 進行檢測，這樣能更精確地識別峰值。

### 具體問題
1. **第一次掃描**（找全局最大峰值）
   - ❌ 舊版本：用 dB 值（0-255）進行比較
   - ✅ 新版本：用原始幅度值進行比較（精度更高）

2. **第二次掃描**（記錄峰值位置）
   - ❌ 舊版本：用 dB 值找峰值箱位置
   - ✅ 新版本：用原始幅度值找峰值箱位置（匹配第一次掃描的邏輯）

3. **頻譜數據存儲**
   - ❌ 舊版本：直接使用 WASM 輸出（已是 dB 值）
   - ✅ 新版本：明確應用 magnitudeToUint8() 轉換

## ✅ 實施的修改

### 修改 1: 第一次掃描 - 使用幅度值檢測

**位置**：第 626-650 行

```javascript
// ❌ 舊版本
const spectrogramData = magnitudeToUint8(magnitudeSpectrum);
let peakValueInRange = 0;
for (let k = minBinFull; k < maxBinFull && k < spectrogramData.length; k++) {
  peakValueInRange = Math.max(peakValueInRange, spectrogramData[k] || 0);
}

// ✅ 新版本
// 使用原始幅度值進行峰值檢測（比 dB 值更精確）
let peakValueInRange = 0;
for (let k = minBinFull; k < maxBinFull && k < magnitudeSpectrum.length; k++) {
  peakValueInRange = Math.max(peakValueInRange, magnitudeSpectrum[k] || 0);
}
```

**原因**：幅度值提供更精確的信號強度信息，避免 dB 轉換過程中的量化損失

### 修改 2: 第二次掃描 - 使用幅度值找峰值箱

**位置**：第 675-695 行

```javascript
// ❌ 舊版本
const wasmSpectrum = magnitudeToUint8(magnitudeSpectrum2);
let peakBandInRange = Math.max(0, minBinFull);
let peakValueInRange = wasmSpectrum[peakBandInRange] || 0;
for (let k = minBinFull; k < maxBinFull && k < wasmSpectrum.length; k++) {
  if ((wasmSpectrum[k] || 0) > peakValueInRange) {
    peakValueInRange = wasmSpectrum[k];
    peakBandInRange = k;
  }
}

// ✅ 新版本
// 使用幅度值進行峰值檢測（更精確）
let peakBandInRange = Math.max(0, minBinFull);
let peakValueInRange = magnitudeSpectrum2[peakBandInRange] || 0;
for (let k = minBinFull; k < maxBinFull && k < magnitudeSpectrum2.length; k++) {
  if ((magnitudeSpectrum2[k] || 0) > peakValueInRange) {
    peakValueInRange = magnitudeSpectrum2[k];
    peakBandInRange = k;
  }
}
```

**原因**：與第一次掃描使用相同的數據類型和邏輯，確保閾值比較的一致性

### 修改 3: 明確轉換頻譜數據

**位置**：第 696-709 行

```javascript
// ✅ 新增：明確轉換幅度值為 dB 和 0-255 範圍
const dbSpectrum = magnitudeToUint8(magnitudeSpectrum2);

// Apply filter bank if needed
if (c) {
    const filtered = this.applyFilterBank(magnitudeSpectrum2, c);
    // Convert filtered magnitude values to dB
    const dbFiltered = magnitudeToUint8(filtered);
    for (let k = 0; k < r / 2 && k < dbFiltered.length; k++) {
        e[k] = dbFiltered[k];
    }
} else {
    for (let k = 0; k < r / 2 && k < dbSpectrum.length; k++) {
        e[k] = dbSpectrum[k];
    }
}
```

**原因**：
- 確保 Filter Bank 應用於原始幅度值（不是 dB 值）
- Filter Bank 之後再進行 dB 轉換
- 如果不使用 Filter Bank，使用預先計算的 dbSpectrum

## 📊 算法流程 - peakMode

```
第一次掃描（找全局峰值）
├─ 使用原始幅度值計算峰值 ✅
├─ 累積全局最大值
└─ globalMaxPeakValue = 幅度值最大值

計算閾值
├─ peakThreshold = globalMaxPeakValue * 40%
├─ highPeakThreshold = globalMaxPeakValue * 70%
└─ 基於幅度值的閾值

第二次掃描（記錄峰值位置）
├─ 對每一幀：
│  ├─ 獲得原始幅度值
│  ├─ 使用幅度值找峰值箱位置 ✅
│  ├─ 比較 peakValueInRange 與閾值
│  ├─ 存儲 {bin: 位置, isHigh: 是否 >= 70%}
│  └─ 轉換為 dB 用於顯示
└─ 保存 peakBandArrayPerChannel

渲染
├─ drawSpectrogram 讀取 peakBandArrayPerChannel
├─ 如果是 isHigh = true：顯示 #FF70FC (品紅色)
├─ 如果是 isHigh = false：顯示其他峰值顏色
└─ 繪製到 Canvas
```

## 🔄 數據流對比

### 舊實現（有缺陷）
```
WASM 輸出（幅度值）
    ↓
轉換為 dB（第一次掃描）
    ↓
用 dB 值找峰值 ❌ （精度損失）
    ↓
用 dB 值存儲峰值信息 ❌
    ↓
不一致的閾值比較
```

### 新實現（正確）
```
WASM 輸出（幅度值）
    ↓
直接用幅度值檢測峰值 ✅
    ↓
用幅度值找峰值箱位置 ✅
    ↓
比較幅度值與幅度值閾值 ✅
    ↓
存儲峰值位置 {bin, isHigh}
    ↓
轉換為 dB 用於顯示 ✅
    ↓
一致、精確的峰值檢測
```

## 🎯 性能影響

| 項目 | 變化 |
|------|------|
| 第一次掃描 | 無性能變化（只是數據來源不同） |
| 第二次掃描 | 無性能變化 |
| 峰值檢測精度 | ⬆️ 更高（幅度值 vs dB 值） |
| 內存用量 | 無變化 |

## ✅ 驗證清單

- [x] 第一次掃描使用幅度值
- [x] 第二次掃描使用幅度值
- [x] 明確轉換 dB 值用於顯示
- [x] Filter Bank 應用於幅度值
- [x] drawSpectrogram 兼容新的 peakData 結構
- [x] 無 JavaScript 錯誤
- [x] 代碼邏輯一致

## 🧪 測試方案

### 1. 啟用 peakMode
```javascript
spectrogramInstance.options.peakMode = true;
```

### 2. 加載音頻文件
觀察频谱圖中的峰值標記：
- 品紅色 (#FF70FC)：高峰值 (≥ 70% globalMax)
- 其他顏色：標準峰值 (≥ 40% globalMax)

### 3. 驗證項目
- ✅ 峰值標記是否準確
- ✅ 高峰/標準峰值著色是否正確
- ✅ 性能是否無下降

## 📝 相關文件

- `modules/spectrogram.esm.js` - 主實現（已修改）
- `modules/peakControl.js` - peakMode UI 控制
- `drawSpectrogram()` - 渲染邏輯（兼容 ✅）

---

**最後更新**：2025-12-05  
**狀態**：🟢 peakMode 已適配新 WASM 架構
