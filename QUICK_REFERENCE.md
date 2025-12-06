# 重構快速參考指南

## 概要更新

### 修改的核心文件

#### 1. Rust 實現 (`spectrogram-wasm/src/lib.rs`)
- **行數**: 378 行 (+136 行，原 242 行)
- **主要添加**:
  - 濾波器組存儲字段: `filter_bank`, `num_filters`, `use_filter_bank`
  - 公開方法: `load_filter_bank()`, `clear_filter_bank()`, `compute_spectrogram_u8()`, `get_num_filters()`
  - 內部方法: `apply_filter_bank()`

#### 2. JavaScript 主模塊 (`modules/spectrogram.esm.js`)
- **行數**: 913 行 (-1 行，原 914 行)
- **主要更新**:
  - 濾波器組字段: `_filterBankMatrix`, `_filterBankFlat`, `_lastFilterBankScale`
  - 新方法: `flattenAndLoadFilterBank()`
  - 重寫方法: `getFrequencies()`
  - 優化: 使用 `get_num_filters()` 替代計算

#### 3. WASM 綁定 (自動生成)
- `modules/spectrogram_wasm.js`
- `modules/spectrogram_wasm_bg.wasm`
- `modules/spectrogram_wasm.d.ts`
- `modules/spectrogram_wasm_bg.wasm.d.ts`

## 新 API 完整參考

### Rust 側

```rust
// 加載濾波器組
fn load_filter_bank(&mut self, flat_weights: &[f32], num_filters: usize)

// 清除濾波器組
fn clear_filter_bank(&mut self)

// 計算頻譜 (u8 量化)
fn compute_spectrogram_u8(
    &mut self,
    audio_data: &[f32],
    noverlap: usize,
    gain_db: f32,
    range_db: f32,
) -> Vec<u8>

// 獲取濾波器數量
fn get_num_filters(&self) -> usize

// 獲取頻率箱數
fn get_freq_bins(&self) -> usize

// 舊 API (仍可用)
fn compute_spectrogram(
    &mut self,
    audio_data: &[f32],
    noverlap: usize,
) -> Vec<f32>
```

### JavaScript 側

```javascript
// WASM engine 實例 (自動初始化)
this._wasmEngine  // SpectrogramEngine

// 新字段
this._filterBankMatrix    // Float32Array[] - 二維濾波器組
this._filterBankFlat      // Float32Array - 扁平化濾波器組
this._lastFilterBankScale // string - 快取鍵

// 新方法
flattenAndLoadFilterBank(filterBankMatrix)
  // 將二維矩陣轉換為扁平化 Float32Array
  // 自動調用 WASM 的 load_filter_bank()

// 重寫方法
async getFrequencies(audioBuffer)
  // 完整重寫，使用新 WASM API
  // 自動檢測和更新濾波器組

// 在 WASM engine 中
engine.compute_spectrogram_u8(audioData, noverlap, gainDB, rangeDB)
  // 返回 Uint8Array

engine.get_num_filters()
  // 返回當前濾波器數量 (integer)
```

## 計算流程

### Peak 模式
```
1. 創建濾波器組 (若需要)
   ↓
2. 扁平化並加載到 WASM
   ↓
3. 掃描一: 使用舊 API 獲得線性幅度 -> 檢測峰值
   ↓
4. 掃描二: 使用新 API 獲得 u8 頻譜
   ↓
5. 返回 u8 數據 + 峰值信息
```

### 普通模式
```
1. 創建濾波器組 (若需要)
   ↓
2. 扁平化並加載到 WASM
   ↓
3. 直接使用新 API 計算 u8 頻譜
   ↓
4. 返回 u8 數據
```

## 數據格式

### 輸入 (JavaScript -> WASM)

#### 音頻數據
- **格式**: Float32Array
- **範圍**: -1.0 ~ 1.0
- **長度**: 任意

#### 濾波器組矩陣
- **格式**: Float32Array[]（JavaScript 中是二維陣列）
- **維度**: num_filters × (fft_size / 2 + 1)
- **順序**: 行優先 (row-major)
- **扁平化**: Float32Array (長度 = num_filters × freq_bins)

### 輸出 (WASM -> JavaScript)

#### compute_spectrogram()
- **格式**: Float32Array（經過 WASM 綁定轉換）
- **內容**: 線性幅度值
- **維度**: freq_bins × num_frames
- **範圍**: 0 ~ ∞

#### compute_spectrogram_u8()
- **格式**: Uint8Array
- **內容**: 量化頻譜 (0-255)
- **維度**: output_bins × num_frames
  - 若 use_filter_bank: output_bins = num_filters
  - 否則: output_bins = freq_bins
- **範圍**: 0-255

## 性能指標

### 數據傳輸
| 場景 | 舊方式 | 新方式 | 比例 |
|------|------|------|------|
| 10 秒音頻 (512 FFT) | ~1.2 MB | ~300 KB | 4:1 |
| 1 分鐘音頻 | ~7.2 MB | ~1.8 MB | 4:1 |

### 計算位置
| 操作 | 舊方式 | 新方式 |
|------|------|------|
| FFT | Rust ✅ | Rust ✅ |
| 線性幅度 | Rust ✅ | Rust ✅ |
| 濾波器組 | JS ❌ | Rust ✅ |
| dB 轉換 | JS ❌ | Rust ✅ |
| u8 量化 | JS ❌ | Rust ✅ |

## 集成步驟

### 1. 確認文件已複製
```bash
ls -la modules/spectrogram_wasm.*
```

### 2. 檢查 HTML 中的腳本標籤
```html
<!-- 應已存在 -->
<script src="modules/spectrogram.esm.js" type="module"></script>
```

### 3. 驗證 WASM 初始化
```javascript
// 應自動初始化，無需額外配置
const spectrogram = new Spectrogram({...});
```

### 4. 測試基本功能
```javascript
// 使用 Mel scale
spectrogram.scale = 'mel';
spectrogram.render();  // 應正常工作
```

## 故障排除

### 問題: WASM 未加載
**原因**: 文件未正確複製
**解決**: 確認 spectrogram_wasm_bg.wasm 在 modules/ 目錄

### 問題: 濾波器組不生效
**原因**: 未調用 load_filter_bank()
**解決**: flattenAndLoadFilterBank() 自動調用，檢查控制台錯誤

### 問題: 輸出大小不對
**原因**: get_num_filters() 返回 0
**解決**: 確認濾波器組已加載，檢查 scale 設置

### 問題: 性能下降
**原因**: 峰值檢測掃描兩次
**解決**: 可以優化為單次掃描 (未來改進)

## 關鍵數值

### FFT 參數 (預設)
- **FFT 大小**: 2048
- **窗函數**: hann
- **頻率箱**: 1024 (2048 / 2)

### dB 轉換參數 (預設)
- **增益**: -80 dB
- **範圍**: 60 dB
- **最小值**: 1e-10 (防止 log10(0))

### Mel 濾波器 (預設)
- **濾波器數**: 128
- **類型**: Mel 刻度

## 驗證檢查清單

- [ ] 所有 WASM 文件都在 modules/ 目錄
- [ ] spectrogram.esm.js 已更新
- [ ] TypeScript 定義已生成
- [ ] WASM 初始化無錯誤
- [ ] 濾波器組正確計算
- [ ] 頻譜輸出尺寸正確
- [ ] Peak 檢測仍然有效
- [ ] 性能符合預期

## 文檔參考

- **詳細實現**: `REFACTORING_SUMMARY.md`
- **完成報告**: `REFACTORING_COMPLETE.md`
- **Rust 實現**: `spectrogram-wasm/RUST_IMPLEMENTATION.md`

## 支援聯絡

如有問題，請參考以下文件:
1. `REFACTORING_SUMMARY.md` - 完整技術細節
2. `REFACTORING_COMPLETE.md` - 完成驗證清單
3. `spectrogram-wasm/src/lib.rs` - 源代碼註解
