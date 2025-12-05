# spectrogram-wasm/src/lib.rs 完整實現參考

## 概述

此 Rust 模塊實現了高性能的音頻頻譜圖計算引擎，暴露給 JavaScript/WebAssembly。主要功能包括 FFT 計算、窗函數應用和 dB 轉換。

## 模塊結構

```rust
use wasm_bindgen::prelude::*;
use rustfft::FftPlanner;
use num_complex::Complex;
use std::f32::consts::PI;
```

### 依賴說明

- **wasm_bindgen**: 提供與 JavaScript 的互操作
- **rustfft**: Fast Fourier Transform 實現
- **num_complex**: 複數算術
- **PI 常數**: 三角函數計算

## SpectrogramEngine 結構體

### 定義

```rust
#[wasm_bindgen]
pub struct SpectrogramEngine {
    fft_size: usize,
    window_func: String,
    window_values: Vec<f32>,
    planner: FftPlanner<f32>,
    scratch_buffer: Vec<Complex<f32>>,
    output_buffer: Vec<f32>,
    alpha: f32,
}
```

### 字段詳解

| 字段 | 類型 | 說明 |
|------|------|------|
| `fft_size` | usize | FFT 大小（必須是 2 的冪，通常 512、1024、2048） |
| `window_func` | String | 窗函數類型名稱 |
| `window_values` | Vec<f32> | 預計算的窗函數係數表 |
| `planner` | FftPlanner<f32> | rustfft 規劃器（優化 FFT 算法選擇） |
| `scratch_buffer` | Vec<Complex<f32>> | 複數輸入/輸出緩衝（避免重複分配） |
| `output_buffer` | Vec<f32> | 幅度輸出緩衝 |
| `alpha` | f32 | 窗函數參數（Blackman 等） |

## 方法實現

### 1. 構造函數 (`new`)

```rust
#[wasm_bindgen(constructor)]
pub fn new(fft_size: usize, window_func: String, alpha: Option<f32>) -> SpectrogramEngine
```

**流程**:
1. 提取或使用默認 alpha 值（0.16 用於 Blackman）
2. 調用 `create_window()` 預計算窗函數表
3. 創建 FftPlanner 實例
4. 初始化緩衝區：
   - `scratch_buffer`: fft_size 個複數元素
   - `output_buffer`: fft_size/2 個浮點數（只需半個頻譜）

**為何预分配**:
- 避免每幀分配（高頻操作）
- 內存重複使用提高緩存局部性
- 減少 JavaScript 和 Rust 之間的通信開銷

### 2. 核心方法 (`compute_spectrogram`)

```rust
#[wasm_bindgen]
pub fn compute_spectrogram(
    &mut self,
    audio_data: &[f32],
    noverlap: usize,
    gain_db: f32,
    range_db: f32,
) -> Vec<u8>
```

#### 參數

| 參數 | 說明 |
|------|------|
| `audio_data` | Float32Array 音頻樣本 |
| `noverlap` | 幀之間的重疊樣本數（通常 fft_size/2） |
| `gain_db` | 增益偏移 (dB，通常 20) |
| `range_db` | 動態範圍 (dB，通常 80) |

#### 算法步驟

**1. 計算幀參數**
```rust
let step = self.fft_size - noverlap;  // 幀移位
let num_frames = (audio_data.len() - self.fft_size) / step + 1;
let freq_bins = self.fft_size / 2;
```

**2. 預計算轉換常數**
```rust
let gain_db_neg = -gain_db;                    // -20
let gain_db_neg_range = gain_db_neg - range_db; // -100
let range_db_reciprocal = 255.0 / range_db;     // 255/80 = 3.1875
```

這些常數用於將 dB 值映射到 0-255：
```
value = (db + gain_db) * range_db_reciprocal
```

**3. 逐幀處理**
```rust
for frame_idx in 0..num_frames {
    // a. 應用窗函數
    for i in 0..self.fft_size {
        let windowed = audio_data[pos + i] * self.window_values[i];
        self.scratch_buffer[i] = Complex { re: windowed, im: 0.0 };
    }
    
    // b. 執行 FFT
    fft.process(&mut self.scratch_buffer);
    
    // c. 計算幅度並轉換為 dB
    for i in 0..freq_bins {
        let c = self.scratch_buffer[i];
        let magnitude = (c.re * c.re + c.im * c.im).sqrt();
        let magnitude = if magnitude > 1e-12 { magnitude } else { 1e-12 };
        let db = 20.0 * magnitude.log10();
        
        // d. 映射到 0-255
        let value = if db < gain_db_neg_range {
            0u8
        } else if db > gain_db_neg {
            255u8
        } else {
            ((db + gain_db) * range_db_reciprocal + 256.0).round() as u8
        };
        
        result[frame_idx * freq_bins + i] = value;
    }
    
    pos += step;
}
```

#### 為何使用平坦數組

```
JavaScript 中的多維數組:
frequencies = [
    [bin0, bin1, ..., binN],  // 時間 0
    [bin0, bin1, ..., binN],  // 時間 1
    ...
]

Rust 返回的平坦陣列:
result = [bin0_t0, bin1_t0, ..., binN_t0, bin0_t1, bin1_t1, ...]
         \_____________時間 0_____________/ \_____________時間 1_____________/
```

**優勢**:
- 單次內存分配
- 改進的內存佈局（對緩存友好）
- 減少 JavaScript 序列化開銷
- 轉換為二維數組很簡單：`result.slice(0, freq_bins)`

### 3. 窗函數實現 (`create_window`)

```rust
fn create_window(window_name: &str, size: usize, alpha: f32) -> Vec<f32>
```

支持的窗函數：

#### Hann（默認）
```rust
window[i] = 0.5 * (1.0 - cos(2π·i/(N-1)))
```
用途：良好的頻譜泄漏和瓣寬權衡

#### Hamming
```rust
window[i] = 0.54 - 0.46 * cos(2π·i/(N-1))
```
用途：減少旁瓣，適合頻率檢測

#### Blackman（參數化）
```rust
window[i] = (1-α)/2 - 0.5·cos(2π·i/(N-1)) + α/2·cos(4π·i/(N-1))
```
用途：可變邊帶抑制（α = 0.16 為標準）

#### Bartlett（三角形）
```rust
window[i] = 2/(N-1) * ((N-1)/2 - |i - (N-1)/2|)
```
用途：簡單、無傍瓣

#### Bartlett-Hann
```rust
window[i] = 0.62 - 0.48·|i/(N-1) - 0.5| - 0.38·cos(2π·i/(N-1))
```

#### Cosine
```rust
window[i] = cos(π·i/(N-1) - π/2)
```

#### Gauss（參數化）
```rust
σ = 0.25·(N-1)/2
window[i] = exp(-0.5·((i-(N-1)/2)/σ)²)
```

#### Lanczos（參數化）
```rust
x = 2·i/(N-1) - 1
window[i] = sin(π·x) / (π·x)    [或 1 當 x ≈ 0]
```

#### Rectangular（無窗）
```rust
window[i] = 1.0
```

#### Triangular
```rust
window[i] = 2/N * (N/2 - |i - (N-1)/2|)
```

### 4. 輔助方法

```rust
#[wasm_bindgen]
pub fn get_window_values(&self) -> Vec<f32>
```
返回當前窗函數值（用於驗證和調試）

```rust
#[wasm_bindgen]
pub fn get_fft_size(&self) -> usize
```
返回 FFT 大小

```rust
#[wasm_bindgen]
pub fn get_freq_bins(&self) -> usize
```
返回頻率箱數（= fft_size / 2）

## 性能考慮

### 內存使用

```
窗函數表:        fft_size × 4 字節 = 512 × 4 = 2 KB
FFT 緩衝區:      fft_size × 8 字節 = 512 × 8 = 4 KB
輸出緩衝區:      (fft_size/2) × 4 字節 = 256 × 4 = 1 KB
總固定開銷:      ~7-10 KB
```

### 時間複雜度

| 操作 | 時間複雜度 | 實際時間 (512 點) |
|------|----------|-----------------|
| FFT | O(N log N) | ~0.05-0.1 ms |
| 窗函數應用 | O(N) | <0.01 ms |
| 幅度計算 | O(N/2) | <0.01 ms |
| dB 轉換 | O(N/2) | ~0.01-0.02 ms |
| **總計** | **O(N log N)** | **~0.1-0.15 ms** |

相比純 JavaScript FFT (~0.5-1.0 ms)，性能提升 **5-10 倍**。

## 集成示例

### JavaScript 中的使用

```javascript
import init, { SpectrogramEngine } from './spectrogram_wasm.js';

async function setupSpectrogram() {
    // 初始化 WASM
    await init();
    
    // 創建引擎
    const engine = new SpectrogramEngine(512, "hann", 0.16);
    
    // 計算頻譜圖
    const audioData = new Float32Array([...]); // 512 個樣本
    const result = engine.compute_spectrogram(audioData, 256, 20, 80);
    
    // 結果是平坦的 Uint8Array
    const freqBins = 256;
    const spectrum = new Uint8Array(freqBins);
    spectrum.set(result.slice(0, freqBins));
}
```

### 轉換為二維數組

```javascript
function reshape1DTo2D(flatArray, freqBins, timeSteps) {
    const result = [];
    for (let t = 0; t < timeSteps; t++) {
        const start = t * freqBins;
        result.push(new Uint8Array(flatArray.slice(start, start + freqBins)));
    }
    return result;
}
```

## 故障排除

### 常見問題

**Q: FFT 輸出看起來不對**
A: 檢查 fft_size 是否為 2 的冪（512、1024 等）

**Q: 性能沒有改進**
A: 確保發佈構建已啟用優化（--release 標誌）

**Q: 在某些頻率出現偽影**
A: 驗證窗函數選擇；某些應用可能受益於不同的窗函數

**Q: 頻譜"單調"或"平坦"**
A: 檢查 gain_db 和 range_db 參數；可能需要調整以適應動態範圍

---

**實現日期**: 2025年12月5日
**Rust 版本**: 1.91.1+
**版本**: 1.0
