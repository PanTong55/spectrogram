# Power Spectrum 重構文檔 (2025)

## 概述

此重構將 `powerSpectrum.js` 中的計算密集型信號處理邏輯遷移至 Rust/WASM，顯著提升性能。

---

## 架構變更

### 舊架構 (JavaScript Only)
```
powerSpectrum.js
├── calculatePowerSpectrumWithOverlap (JS)
├── calculatePowerSpectrum (JS)
├── findPeakFrequencyFromSpectrum (JS)
├── goertzelEnergy (JS) ← 瓶頸
├── applyWindow (JS) ← 瓶頸
└── drawPowerSpectrumSVG (JS - SVG 繪製)
```

### 新架構 (WASM 加速)
```
powerSpectrum.js (JavaScript)
├── calculatePowerSpectrumWithOverlap ← 包裝器，調用 WASM
├── calculatePowerSpectrum ← 包裝器，調用 WASM
├── findPeakFrequencyFromSpectrum ← 包裝器，調用 WASM
└── drawPowerSpectrumSVG (JS - SVG 繪製) ✓ 保留

↓ 通過 globalThis._spectrogramWasm

spectrogram_wasm (Rust/WASM)
├── compute_power_spectrum ← FFT 加速
└── find_peak_frequency_from_spectrum ← 拋物線插值
```

---

## Rust 實現 (`spectrogram-wasm/src/lib.rs`)

### 新增函數

#### 1. `compute_power_spectrum`
**目的**: 計算覆蓋 Overlap 和 Windowing 的功率譜

**簽名**:
```rust
#[wasm_bindgen]
pub fn compute_power_spectrum(
    audio_data: &[f32],
    sample_rate: u32,
    fft_size: usize,
    window_type: &str,
    overlap_percent: Option<f32>
) -> Vec<f32>
```

**實現步驟**:
1. **確定 Hop Size**: 根據 `overlap_percent` 計算幀之間的跳躍
2. **創建窗函數**: 支持 hann, hamming, blackman, gauss, rectangular, triangular
3. **分幀處理**:
   - 提取音頻幀 (大小為 `fft_size`)
   - 應用窗函數
   - 移除 DC 偏移
   - 執行 FFT (使用 `rustfft` 庫)
   - 提取功率並累積
4. **後處理**:
   - 計算平均功率
   - 轉換為 dB: `10 * log10(PSD)`
5. **返回**: `Vec<f32>` 包含 dB 值

**關鍵優化**:
- 使用 `rustfft` 而非 Goertzel 算法（Goertzel 對完整頻譜計算較慢）
- 最小化內存分配（預分配緩衝區）
- 直接在 Rust 中完成所有信號處理

#### 2. `find_peak_frequency_from_spectrum`
**目的**: 從功率譜中找到峰值頻率（帶拋物線插值）

**簽名**:
```rust
#[wasm_bindgen]
pub fn find_peak_frequency_from_spectrum(
    spectrum: &[f32],
    sample_rate: u32,
    fft_size: usize,
    flow_hz: f32,
    fhigh_hz: f32
) -> f32
```

**實現**:
- 在 `[flow_hz, fhigh_hz]` 範圍內找最大值 bin
- 如果峰值在中間，使用拋物線插值提高精度
- 返回峰值頻率 (Hz)

---

## JavaScript 重構 (`modules/powerSpectrum.js`)

### 移除的函數

以下函數已完全從 JavaScript 移除，邏輯現在由 Rust 實現：

❌ `goertzelEnergy()`  
❌ `applyWindow()`  
❌ `createHannWindow()`, `createHammingWindow()`, 等所有窗口生成函數

### 修改的導出函數

#### 1. `calculatePowerSpectrumWithOverlap`
**舊實現**: 純 JavaScript，使用 Goertzel 算法逐頻率計算  
**新實現**: JavaScript 包裝器，調用 WASM

```javascript
export function calculatePowerSpectrumWithOverlap(
  audioData, 
  sampleRate, 
  fftSize, 
  windowType, 
  overlap = 'auto'
) {
  if (!audioData || audioData.length === 0) return null;

  // 檢查 WASM 可用性
  if (!globalThis._spectrogramWasm?.compute_power_spectrum) {
    console.error('[powerSpectrum] WASM module not loaded.');
    return null;
  }

  // 轉換 overlap 參數
  const overlapPercent = normalizeOverlapPercent(overlap);

  try {
    // 調用 WASM
    const spectrum = globalThis._spectrogramWasm.compute_power_spectrum(
      audioData,
      sampleRate,
      fftSize,
      windowType.toLowerCase(),
      overlapPercent
    );

    return spectrum?.length > 0 ? new Float32Array(spectrum) : null;
  } catch (err) {
    console.error('[powerSpectrum] WASM error:', err);
    return null;
  }
}
```

**變更**:
- 移除了所有時域計算邏輯
- 現在是簡單的包裝器和錯誤處理

#### 2. `calculatePowerSpectrum`
**新實現**: 委託給 `calculatePowerSpectrumWithOverlap`，設 `overlap = 0`

#### 3. `findPeakFrequencyFromSpectrum`
**新實現**: JavaScript 包裝器，調用 WASM `find_peak_frequency_from_spectrum`

### 保留的函數

✅ `drawPowerSpectrumSVG()` - 完全保留，零變動  
✅ `findOptimalOverlap()` - 簡單邏輯，保留  
✅ `getApplyWindowFunction()` - 返回 `null` + 警告（向後相容）  
✅ `getGoertzelEnergyFunction()` - 返回 `null` + 警告（向後相容）

---

## 性能提升

### 預期改進

| 操作 | 舊 (JS) | 新 (WASM) | 加速比 |
|------|---------|----------|--------|
| Windowing | O(n) (JS 迴圈) | O(n) (Rust) | 3-5x |
| FFT (per frame) | N/A (Goertzel) | O(n log n) (rustfft) | 10-50x* |
| DC 移除 | O(n) (JS) | O(n) (Rust) | 3-5x |
| dB 轉換 | O(n) (JS) | O(n) (Rust) | 3-5x |
| **總計** | **基準** | **加速** | **50-100x** |

*Goertzel 對完整頻譜的逐頻率計算導致 O(n²) 複雜度；FFT 的 O(n log n) 優勢顯著。

### 基準測試建議

```javascript
// 在 browser console 中測試
const audioData = new Float32Array(44100); // 1 秒 @ 44.1kHz
console.time('PowerSpectrum');
const spectrum = calculatePowerSpectrumWithOverlap(audioData, 44100, 2048, 'hann', 75);
console.timeEnd('PowerSpectrum');
```

預期：
- **舊版**: 500-2000 ms
- **新版**: 10-50 ms

---

## 依賴項

### Rust (`Cargo.toml`)
- ✅ `rustfft = "6.1"` (已存在)
- ✅ `num-complex = "0.4"` (已存在)
- ✅ `wasm-bindgen = "0.2.87"` (已存在)

無需新增依賴。

### JavaScript
- 依賴於 `globalThis._spectrogramWasm` (由 `main.js` 初始化)

```javascript
// main.js 中的初始化
import init, * as spectrogramWasm from './modules/spectrogram_wasm.js';

init().then(() => {
    globalThis._spectrogramWasm = spectrogramWasm;
}).catch(e => {
    console.error('WASM initialization failed:', e);
});
```

---

## 容錯機制

### WASM 未加載

如果 WASM 模塊無法加載或函數不存在：

```javascript
if (!globalThis._spectrogramWasm?.compute_power_spectrum) {
    console.error('[powerSpectrum] WASM module not loaded. Cannot compute power spectrum.');
    return null; // 返回 null，上層應用應有備用邏輯
}
```

**建議**: 應用應在初始化時檢查 WASM 可用性，並在必要時禁用功率譜功能。

---

## 測試檢查清單

- [ ] Rust 編譯無誤 (`cargo build --release`)
- [ ] WASM 模塊正確導出新函數
- [ ] JavaScript 包裝器正確調用 WASM
- [ ] 計算結果與原 JavaScript 版本數值相同 (允許浮點誤差)
- [ ] 視覺圖表顯示正確 (SVG 繪製保持不變)
- [ ] 性能測試顯示顯著提升
- [ ] WASM 未加載時，應用優雅降級

---

## 遷移注意事項

### 代碼中引用檢查

如果其他模塊直接調用移除的函數，需更新：

```javascript
// ❌ 不再可用
const rms = Math.sqrt(goertzelEnergy(data, freq, sr));

// ✓ 現在應使用
const spectrum = calculatePowerSpectrum(data, sr, fftSize, windowType);
```

### 向後兼容性

導出函數簽名保持不變，現有調用無需修改。

```javascript
// 原調用方式仍然有效
const spectrum = calculatePowerSpectrumWithOverlap(
    audioData, 
    sampleRate, 
    fftSize, 
    windowType, 
    '75'  // overlap 參數
);
```

---

## 未來優化空間

1. **流式處理**: 支持實時音頻流的增量 FFT
2. **多線程**: 在 Rust 中並行處理多幀
3. **特化窗口**: 針對特定窗口類型優化
4. **緩存 FFT 計劃**: 重複使用相同 FFT 大小的計劃

---

## 參考資源

- [rustfft 文檔](https://docs.rs/rustfft/latest/rustfft/)
- [wasm-bindgen 指南](https://rustwasm.github.io/docs/wasm-bindgen/)
- [Power Spectral Density](https://en.wikipedia.org/wiki/Power_spectral_density)
