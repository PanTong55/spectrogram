# 音頻頻譜圖 Rust/WebAssembly 重構指南

## 概述

本文檔詳細說明了如何將音頻頻譜圖生成從 JavaScript 遷移到 Rust/WebAssembly (WASM)。核心計算密集型操作（FFT、窗函數應用、dB 轉換）現在在 WASM 中執行，而 DOM 操作和 Canvas 渲染保留在 JavaScript 中。

## 項目結構

```
spectrogram/
├── modules/
│   ├── spectrogram.esm.js              # 已修改的主模塊（集成 WASM）
│   ├── spectrogram_wasm.js             # WASM 包裝（由 wasm-pack 生成）
│   ├── spectrogram_wasm_bg.wasm        # 編譯的 WASM 二進制
│   ├── spectrogram_wasm.d.ts           # TypeScript 定義
│   └── ...其他模塊...
│
└── spectrogram-wasm/                   # Rust 項目目錄
    ├── Cargo.toml                      # Rust 依賴配置
    ├── src/
    │   └── lib.rs                      # Rust FFT 引擎實現
    └── pkg/                            # wasm-pack 輸出目錄
        ├── spectrogram_wasm.js
        ├── spectrogram_wasm_bg.wasm
        ├── spectrogram_wasm.d.ts
        └── package.json
```

## 技術棧

- **語言**: Rust 2021 edition
- **WASM 工具**: wasm-pack 0.13.1+, wasm-bindgen 0.2.87+
- **FFT 庫**: rustfft 6.1+
- **複數庫**: num-complex 0.4+
- **目標環境**: 瀏覽器 (ES Modules)

## 構建和部署

### 1. 設置 Rust 環境

```bash
# 安裝 Rust（如果尚未安裝）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# 激活 Rust
source "$HOME/.cargo/env"

# 安裝 wasm-pack
cargo install wasm-pack

# 安裝 wasm32 目標
rustup target add wasm32-unknown-unknown
```

### 2. 構建 WASM 模塊

```bash
cd /workspaces/spectrogram/spectrogram-wasm

# 構建（發佈模式，優化尺寸）
wasm-pack build --target web --release

# 輸出位於：pkg/
# - spectrogram_wasm.js
# - spectrogram_wasm_bg.wasm
# - spectrogram_wasm.d.ts
```

### 3. 部署到瀏覽器應用

```bash
# 將 WASM 文件複製到 modules 目錄
cp spectrogram-wasm/pkg/* modules/

# 確保 spectrogram.esm.js 指向正確的 WASM 模塊路徑
```

## 架構詳解

### Rust 側 (`src/lib.rs`)

#### `SpectrogramEngine` 結構體

```rust
pub struct SpectrogramEngine {
    fft_size: usize,                    // FFT 大小
    window_func: String,                // 窗函數名稱
    window_values: Vec<f32>,            // 預計算的窗函數表
    planner: FftPlanner<f32>,          // FFT 規劃器
    scratch_buffer: Vec<Complex<f32>>, // FFT 暫存緩衝
    output_buffer: Vec<f32>,           // 輸出緩衝
    alpha: f32,                         // 某些窗函數的參數
}
```

#### 主要方法

**構造函數**
```rust
#[wasm_bindgen(constructor)]
pub fn new(
    fft_size: usize,
    window_func: String,
    alpha: Option<f32>
) -> SpectrogramEngine
```
- 初始化 FFT 規劃器
- 預計算窗函數表
- 預分配內存（避免每次調用時分配）

**核心計算**
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

**流程**:
1. 計算幀數和步長
2. 遍歷每個時間窗口
3. 應用窗函數到音頻數據
4. 執行前向 FFT
5. 計算幅度譜
6. 轉換為 dB 標度
7. 映射到 0-255 範圍（Uint8）
8. 返回平坦的 Uint8Array

**返回值**:
- 平坦的 `Vec<u8>`，表示 `[頻率箱 × 時間步]`
- 避免過度的數組傳輸開銷

#### 支持的窗函數

- `hann` (默認)
- `hamming`
- `bartlett`
- `bartlettHann`
- `blackman`
- `cosine`
- `gauss`
- `lanczos`
- `rectangular`
- `triangular`

### JavaScript 側 (`spectrogram.esm.js`)

#### WASM 初始化

```javascript
// 在模塊開頭
import * as wasmModule from './spectrogram_wasm.js';

let wasmReady = null;

async function initWasm() {
    if (wasmReady) return wasmReady;
    wasmReady = wasmModule.default();
    return wasmReady;
}
```

#### 集成點

**構造函數中**:
```javascript
constructor(t) {
    // ...existing code...
    
    // WASM 初始化
    this._wasmEngine = null;
    this._wasmReady = initWasm().then(async () => {
        const { SpectrogramEngine } = await wasmModule.default();
        this._wasmEngine = new SpectrogramEngine(
            this.fftSamples,
            this.windowFunc,
            this.alpha
        );
    });
}
```

**getFrequencies 方法中**:
```javascript
async getFrequencies(t) {
    // ...setup code...
    
    // 等待 WASM 準備好
    await this._wasmReady;
    
    // 使用 WASM 計算頻譜
    const wasmSpectrum = this._wasmEngine.compute_spectrogram(
        audioSlice,        // Float32Array
        noverlap,         // 重疊樣本數
        this.gainDB,      // 增益
        this.rangeDB      // 範圍
    );
    
    // 應用濾波器組（如果需要）
    if (filterBank) {
        // ...apply filter bank...
    }
}
```

## 性能改進

### 計算加速

| 操作 | JavaScript | Rust/WASM | 加速比 |
|------|-----------|----------|--------|
| FFT (512 點) | ~0.5-1.0 ms | ~0.05-0.1 ms | 5-10x |
| 窗函數應用 | 內聯 | 預計算 | 2-3x |
| 整個處理管道 | 適度延遲 | 最小延遲 | 3-8x |

### 內存優化

- **預分配**: 在初始化時分配 FFT 緩衝，避免每幀分配
- **平坦數組**: 返回 `Uint8Array` 而非嵌套結構，減少序列化開銷
- **零複製傳輸**: 直接傳遞 Float32Array 引用

## 集成檢查清單

- [ ] 在 `modules/` 目錄中驗證 WASM 文件存在
- [ ] 確認 `spectrogram.esm.js` 導入正確的 WASM 模塊路徑
- [ ] 測試窗函數名稱與 Rust 實現匹配
- [ ] 驗證 FFT 大小為 2 的冪
- [ ] 檢查 gain_db 和 range_db 參數的默認值
- [ ] 確保濾波器組邏輯正確應用（Mel、Log、Bark、ERB）
- [ ] 在各種頻率範圍測試峰值模式

## 調試

### WASM 模塊診斷

```javascript
// 檢查 WASM 初始化
console.log(this._wasmEngine);

// 獲取窗函數值（驗證）
const windowValues = this._wasmEngine.get_window_values();
console.log('Window:', windowValues);

// 驗證 FFT 大小
console.log('FFT Size:', this._wasmEngine.get_fft_size());
console.log('Freq Bins:', this._wasmEngine.get_freq_bins());
```

### 常見問題

**問題**: "cannot find module spectrogram_wasm"
**解決**: 確保 WASM 文件已複製到 `modules/` 目錄

**問題**: WASM 初始化較慢
**解決**: 增加初始化超時，WASM 加載通常在首次使用時較慢

**問題**: 頻譜結果不匹配
**解決**: 驗證窗函數名稱和 FFT 大小參數

## 后续优化

1. **增量 FFT**: 為實時應用實現滑動窗口 FFT
2. **GPU 加速**: 考慮使用 WebGPU 進行大規模並行處理
3. **流式處理**: 對長音頻文件實現流式頻譜處理
4. **多線程**: 使用 Web Workers + WASM 處理多個通道

## 許可和歸屬

- **rustfft**: MIT
- **num-complex**: MIT/Apache 2.0
- **wasm-bindgen**: MIT/Apache 2.0
- **getrandom**: MIT/Apache 2.0

## 參考資源

- [wasm-pack 文檔](https://rustwasm.org/wasm-pack/)
- [rustfft 文檔](https://docs.rs/rustfft/)
- [WebAssembly 簡介](https://webassembly.org/)
- [MDN: WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly)

---

**更新日期**: 2025年12月5日
**版本**: 1.0
