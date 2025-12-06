# Spectrogram WASM 重構摘要

## 概述

本次重構將濾波器組應用和 dB 轉換邏輯從 JavaScript 完全移到 Rust 中實現，解決了之前將濾波器組應用於 dB 數據（數學上不正確）的問題。

## 核心問題解決

### 舊實現的問題
1. **數學錯誤**: JavaScript 應用濾波器組到 dB 數據上，但濾波器組必須應用於線性幅度數據
2. **性能損失**: 從 Rust 傳輸大型 float 數組回 JavaScript，產生"橋接稅"
3. **邏輯分散**: 頻譜計算邏輯分散於 Rust 和 JavaScript 之間

### 新實現的優勢
1. **數學正確**: 完整的 FFT -> 線性幅度 -> 濾波器組 -> dB -> u8 量化 流程在 Rust 中完成
2. **性能提升**: 僅傳輸量化的 u8 數據 (0-255)，減少橋接開銷
3. **統一邏輯**: 核心算法完全在 Rust 中實現，避免 JavaScript 側的複雜計算

## 實現細節

### Rust 端 (src/lib.rs)

#### 新增字段
```rust
pub struct SpectrogramEngine {
    // 新增:
    filter_bank: Vec<f32>,      // 扁平化的濾波器組矩陣
    num_filters: usize,          // 濾波器數量
    use_filter_bank: bool,       // 是否使用濾波器組
}
```

#### 新增方法

1. **load_filter_bank(flat_weights, num_filters)**
   - 接收扁平化的 Float32Array 濾波器權重
   - 矩陣順序: 行優先 (row-major)
   - 維度: num_filters x (fft_size / 2 + 1)

2. **clear_filter_bank()**
   - 清除已加載的濾波器組，禁用濾波

3. **compute_spectrogram_u8(audio_data, noverlap, gain_db, range_db)**
   - 新的主要計算方法
   - 返回 Uint8Array (0-255)
   - 完整流程: FFT -> 線性幅度 -> 濾波器組應用 -> dB 轉換 -> u8 量化

4. **apply_filter_bank(magnitude)** (內部方法)
   - 執行矩陣乘法: result[i] = sum(magnitude[j] * filter_bank[i * freq_bins + j])
   - 優化的熱路徑

#### 計算流程詳解

```
FFT輸入 (帶窗函數應用)
    ↓
執行 FFT (複數輸出)
    ↓
計算線性幅度: sqrt(re² + im²) * (2/N)
    ↓
[條件] 如果 use_filter_bank=true
    ├→ 應用濾波器組矩陣乘法
    └→ 輸出: num_filters 個線性能量值
    
[條件] 如果 use_filter_bank=false
    └→ 原始線性幅度 (freq_bins 個值)
    ↓
dB 轉換: 20*log10(max(value, 1e-10))
    ↓
量化到 0-255:
    - 值 < (gain_db_neg - range_db) → 0
    - 值 > gain_db_neg → 255
    - 中間值線性映射
    ↓
Uint8Array 輸出
```

### JavaScript 端 (modules/spectrogram.esm.js)

#### 新增字段 (constructor)
```javascript
this._filterBankMatrix = null;       // 當前濾波器組矩陣 (二維陣列)
this._filterBankFlat = null;         // 扁平化的濾波器組 (Float32Array)
this._lastFilterBankScale = null;    // 檢測濾波器組是否需要更新
```

#### 新增方法

1. **flattenAndLoadFilterBank(filterBankMatrix)**
   - 將二維濾波器組矩陣扁平化為 Float32Array
   - 行優先順序排列
   - 調用 WASM engine 的 load_filter_bank()

#### getFrequencies() 重寫

**濾波器組初始化邏輯:**
- 檢查是否需要重新計算濾波器組 (基於 scale、sampleRate 等)
- 根據 scale 類型計算對應濾波器組 (Mel/Bark/Log/ERB)
- 扁平化並加載到 WASM

**計算流程:**
- Peak Mode: 使用舊 API 獲得線性幅度以進行峰值檢測，然後用新 API 獲得量化結果
- Normal Mode: 直接使用新 API compute_spectrogram_u8()

## 數據流示例

### Mel Scale 模式

```
JavaScript:
  - 計算 Mel 濾波器組 (createMelFilterBank)
  - 扁平化為 Float32Array
  - 調用 wasmEngine.load_filter_bank(flatArray, numFilters)

WASM (compute_spectrogram_u8):
  1. FFT 計算線性幅度
  2. 應用 Mel 濾波器組 (矩陣乘法)
  3. 轉換為 dB
  4. 量化到 0-255

結果: Uint8Array (numFilters * num_frames)
```

### Linear 模式

```
JavaScript:
  - 不計算濾波器組
  - 調用 wasmEngine.clear_filter_bank()

WASM (compute_spectrogram_u8):
  1. FFT 計算線性幅度
  2. [跳過] 濾波器組
  3. 轉換為 dB
  4. 量化到 0-255

結果: Uint8Array (freq_bins * num_frames)
```

## 性能改進

### 橋接開銷減少
- **舊**: 傳輸 `freq_bins * num_frames * 4 bytes` (float32) + 額外的濾波器組應用
- **新**: 傳輸 `output_bins * num_frames * 1 byte` (uint8)
- **示例**: 512 FFT, 10 秒音頻 (@44.1kHz, 256 重疊)
  - 舊: ~1.2 MB (float) + JS 計算開銷
  - 新: ~300 KB (uint8) 無額外開銷

### 計算效率
- 濾波器組應用: O(num_filters × freq_bins) 在 Rust 中完成 (優化的循環)
- dB 轉換和量化: 單次遍歷
- 無重複計算: 每幀只計算一次

## 測試建議

1. **功能測試**
   - Mel scale: 驗證濾波器組正確應用
   - Bark scale: 驗證不同濾波器組
   - Linear scale: 驗證無濾波器情況
   - Peak detection: 驗證峰值檢測仍然正確

2. **性能測試**
   - 測量傳輸數據量
   - 比較 WASM 計算時間
   - 驗證減少了 JavaScript 側計算

3. **邊界條件**
   - 小音頻文件
   - 非標準 FFT 大小
   - 極端 gain_db/range_db 值

## 向後兼容性

- `compute_spectrogram()` 方法保留，返回線性幅度值
- 舊的 `createFilterBank()` 等方法保留，用於峰值檢測
- 新代碼可以與舊代碼共存

## 編譯和部署

### 編譯 WASM
```bash
cd spectrogram-wasm
cargo build --target wasm32-unknown-unknown --release
wasm-bindgen target/wasm32-unknown-unknown/release/spectrogram_wasm.wasm --out-dir . --target web
```

### 複製生成的文件到 modules/
```bash
cp spectrogram_wasm.js ../modules/
cp spectrogram_wasm_bg.wasm ../modules/
cp spectrogram_wasm.d.ts ../modules/
cp spectrogram_wasm_bg.wasm.d.ts ../modules/
```

## 已修改的文件

1. **spectrogram-wasm/src/lib.rs**
   - 新增濾波器組相關字段
   - 新增 load_filter_bank/clear_filter_bank 方法
   - 新增 compute_spectrogram_u8 方法
   - 新增 apply_filter_bank 內部方法
   - 移除 compute_spectrogram_with_db (未使用)
   - 修復未使用變量的警告

2. **modules/spectrogram.esm.js**
   - 新增 _filterBankMatrix, _filterBankFlat, _lastFilterBankScale 字段
   - 新增 flattenAndLoadFilterBank 方法
   - 重寫 getFrequencies 方法以使用新 API
   - 保留舊方法以兼容性

3. **modules/spectrogram_wasm.js** (重新生成)
4. **modules/spectrogram_wasm_bg.wasm** (重新生成)
5. **modules/spectrogram_wasm.d.ts** (重新生成)
6. **modules/spectrogram_wasm_bg.wasm.d.ts** (重新生成)

## 注意事項

1. **濾波器組矩陣維度**: 確保從 JavaScript 傳入的濾波器組矩陣維度正確
   - 行數: num_filters
   - 列數: fft_size / 2 + 1

2. **數值穩定性**: dB 轉換使用 1e-10 作為最小值以避免 log10(0)

3. **性能監控**: 建議在實際應用中測量性能改進

## 相關文檔

- spectrogram-wasm/RUST_IMPLEMENTATION.md - Rust 實現細節
- spectrogram-wasm/CARGO_REFERENCE.md - Cargo 構建說明
