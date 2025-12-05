# spectrogram-wasm/Cargo.toml 完整參考

此檔案包含用於將音頻頻譜圖計算編譯為 WebAssembly 的所有必要配置。

## Cargo.toml 內容詳解

### 包元數據

```toml
[package]
name = "spectrogram-wasm"           # NPM 包名稱（自動轉換為 kebab-case）
version = "0.1.0"                   # 語義版本控制
edition = "2021"                    # Rust 版本（2021 edition 包括新語法特性）
```

### 庫配置

```toml
[lib]
crate-type = ["cdylib"]             # 編譯為動態庫（WASM 需要此設置）
```

**為什麼需要 "cdylib"**:
- `cdylib` 生成一個可以被其他語言調用的動態庫
- wasm-bindgen 需要此類型來生成 JavaScript 綁定

### 依賴項

```toml
[dependencies]
wasm-bindgen = "0.2.87"
    # 提供 #[wasm_bindgen] 宏和綁定生成
    # 允許 Rust 和 JavaScript 之間的相互調用

rustfft = "6.1"
    # 高性能 FFT 庫
    # 支持任意大小的 FFT（自動選擇最佳算法）

num-complex = "0.4"
    # 複數類型實現
    # rustfft 的依賴（自動包含）

getrandom = { version = "0.2", features = ["js"] }
    # 隨機數生成
    # "js" 特性允許在瀏覽器中使用
    # （由某些依賴間接需要）
```

### 發佈優化

```toml
[profile.release]
opt-level = "z"         # 優化大小（比 "s" 更激進）
lto = true              # 啟用鏈時優化
codegen-units = 1       # 單個代碼生成單元（更好的優化，構建較慢）
```

**配置影響**:
- **opt-level = "z"**: 最小化 WASM 二進制大小
  - 196 KB 未壓縮 (.wasm)
  - ~50 KB gzip 壓縮後
  
- **lto = true**: 跨單元優化
  - 增加構建時間 (~30-60 秒)
  - 提高運行時性能 (~5-10%)
  
- **codegen-units = 1**: 最大化優化機會
  - 默認值為 256（並行構建）
  - 設置為 1 時，編譯器可以全局優化

## 構建命令

### 開發構建
```bash
cd spectrogram-wasm
wasm-pack build --target web
```
- 輸出到 `pkg/` 目錄
- 適合開發和調試
- 包含源映射

### 發佈構建
```bash
wasm-pack build --target web --release
```
- 應用 Cargo.toml 中的優化設置
- 生成最小的二進制文件
- 移除調試符號

## 生成的文件

### 主要文件

| 文件 | 說明 |
|------|------|
| `spectrogram_wasm.js` | JavaScript 包裝代碼和初始化 |
| `spectrogram_wasm_bg.wasm` | 編譯的 WebAssembly 二進制 |
| `spectrogram_wasm.d.ts` | TypeScript 類型定義 |
| `spectrogram_wasm_bg.wasm.d.ts` | WASM 綁定類型定義 |
| `package.json` | NPM 包配置 |

### 文件大小

- **spectrogram_wasm_bg.wasm**: ~196 KB（未壓縮）
- **壓縮後**: ~50 KB（gzip）
- **spectrogram_wasm.js**: ~10 KB

## 版本更新檢查清單

升級依賴時：

- [ ] 檢查 wasm-bindgen 的破壞性變更
- [ ] 驗證 rustfft API 兼容性
- [ ] 運行完整的測試套件
- [ ] 比較 WASM 二進制大小
- [ ] 驗證 FFT 輸出精度

### 已知兼容版本

- rustfft: 6.0 - 6.4
- wasm-bindgen: 0.2.80+
- num-complex: 0.4+
- getrandom: 0.2.10+

## 故障排除

### 編譯錯誤

**錯誤**: "cannot find crate `wasm_bindgen`"
**解決**: 確保已安裝正確版本：`cargo update`

**錯誤**: "rustfft::FftPlanner not found"
**解決**: 檢查 Cargo.lock 中的版本，運行 `cargo clean && cargo build`

### 文件大小問題

如果 .wasm 文件過大（>300 KB）:

```toml
# 添加到 Cargo.toml
[profile.release]
opt-level = "z"     # 確認已設置
lto = true          # 確認已啟用
strip = true        # 添加此行移除符號
```

## 進階配置選項

### 啟用特定特性

```toml
[dependencies]
rustfft = { version = "6.1", features = ["std"] }
```

### 條件編譯

```toml
[target.'cfg(target_arch = "wasm32")'.dependencies]
js-sys = "0.3"
web-sys = "0.3"
```

---

**生成日期**: 2025年12月5日
**Cargo.toml 版本**: 1.0
