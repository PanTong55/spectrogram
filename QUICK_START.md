# ⚡ 快速開始指南

## 📦 文件清單驗證

運行此命令驗證所有文件就位：

```bash
# 檢查 WASM 編譯輸出
ls -lh /workspaces/spectrogram/waveform-wasm/pkg/

# 檢查部署到 modules 的文件
ls -lh /workspaces/spectrogram/modules/waveform_wasm*

# 檢查測試文件
ls -lh /workspaces/spectrogram/waveform-wasm-test.html

# 檢查文檔
ls -lh /workspaces/spectrogram/*.md | grep -E "WASM|STATUS|TEST"
```

預期輸出：
```
waveform_wasm.js           8.7K
waveform_wasm.d.ts         3.1K
waveform_wasm_bg.wasm      19K   ← 二進制模組
waveform_wasm_bg.wasm.d.ts 514B

waveform-wasm-test.html    8.4K
WAVESURFER_WASM_INTEGRATION.md
TEST_WASM_INTEGRATION.md
PROJECT_STATUS.md
```

## �� 5 分鐘快速測試

### 步驟 1：啟動服務器

```bash
cd /workspaces/spectrogram
python3 -m http.server 8000
```

### 步驟 2：打開測試頁面

```
http://localhost:8000/waveform-wasm-test.html
```

### 步驟 3：檢查結果

應該看到：

```
✅ Test 1: WASM Module Loading
   Status: PASSED
   Time: 12ms

✅ Test 2: Peak Calculation Correctness  
   Status: PASSED
   Time: 3.2ms
   Samples: 44100
   Peaks: 8000

✅ Test 3: Performance Benchmark
   Status: PASSED
   Average Time: 3.1ms
   Min Time: 2.8ms
   Max Time: 3.5ms
   Throughput: 70,967,742 samples/sec
```

**全部綠色 = 成功！** ✅

## 🐛 常見問題排查

### 問題 1：WASM 加載失敗 ❌

**症狀**：
```
❌ WASM module loading failed: Failed to fetch module script
```

**解決**：
```bash
# 檢查文件是否存在
ls -la /workspaces/spectrogram/modules/waveform_wasm_bg.wasm

# 檢查文件大小（應該 > 10KB）
ls -lh /workspaces/spectrogram/modules/waveform_wasm_bg.wasm
```

### 問題 2：函數未定義 ❌

**症狀**：
```
❌ compute_peaks_optimized is not defined
```

**解決**：
```bash
# 檢查 import 語句
grep "import init" /workspaces/spectrogram/modules/wavesurfer.esm.js

# 應該看到：
# import init, { compute_peaks_optimized, ... } from './waveform_wasm.js';
```

### 問題 3：計算失敗 ❌

**症狀**：
```
❌ Peak calculation failed: TypeError: peaks is not an array
```

**解決**：
```bash
# 檢查 TypeScript 定義
cat /workspaces/spectrogram/modules/waveform_wasm.d.ts | head -20

# 查看返回類型應該是 Float32Array
```

### 問題 4：性能沒有改善 ⚠️

**症狀**：
```
時間仍然是 15-30ms（未改善）
```

**檢查**：
1. 打開瀏覽器開發者工具（F12）
2. 在 Console 中執行：
   ```javascript
   console.log(typeof compute_peaks_optimized);
   // 應該輸出 'function'
   ```
3. 檢查 WASM 模組是否已加載：
   ```javascript
   console.log(wasmReady instanceof Promise ? 'loading...' : 'ready');
   ```

## 📊 性能預期

### 應該看到的數字

**計算時間**：
- ✅ 單個 exportPeaks：2-5ms
- ✅ 5 秒音頻：3-5ms
- ✅ 峰值計算吞吐量：50+ 百萬樣本/秒

**對比 JavaScript**：
- ❌ JS 版本：15-30ms
- ✅ WASM 版本：2-5ms
- 📈 改進倍數：5-10 倍

## 🎯 集成驗證檢查表

完成以下步驟確保集成正確：

```
[ ] 1. WASM 模組加載成功
      - 測試頁面顯示綠色標記
      - 無控制台錯誤

[ ] 2. 峰值計算正確
      - 結果是 Float32Array
      - 值在 0-1 範圍內
      - 計算時間 < 5ms

[ ] 3. 性能改善顯著
      - 性能測試吞吐量 > 50M 樣本/秒
      - 時間測量與預期一致
      - 無異常或超時

[ ] 4. 錯誤處理工作
      - WASM 加載失敗時自動降級
      - 無未捕獲的異常
      - 控制台無警告

[ ] 5. 集成到主應用
      - sonoradar.html 正常加載
      - 波形正常顯示
      - 導出峰值成功
```

## 🔄 完整集成測試流程

### 階段 1：基礎驗證（5 分鐘）

```bash
# 1. 驗證文件完整
ls /workspaces/spectrogram/modules/waveform_wasm* | wc -l
# 應該顯示：4

# 2. 檢查導入語句
grep "import init" /workspaces/spectrogram/modules/wavesurfer.esm.js
# 應該找到導入行

# 3. 運行測試頁面
# 打開 http://localhost:8000/waveform-wasm-test.html
# 應該看到 3 個綠色測試通過
```

### 階段 2：功能驗證（10 分鐘）

```bash
# 1. 打開主應用
# http://localhost:8000/sonoradar.html

# 2. 加載音頻文件
# 使用拖放或文件選擇

# 3. 檢查波形顯示
# 應該正常渲染

# 4. 導出峰值
# 點擊相關按鈕（如果有）

# 5. 打開開發者工具（F12）
# 檢查 Console 無紅色錯誤
```

### 階段 3：性能驗證（10 分鐘）

```bash
# 1. 在開發者工具中打開 Performance 標籤

# 2. 加載大型音頻文件
# > 100 MB 的文件

# 3. 點擊導出峰值（或等待自動計算）

# 4. 記錄時間
# 應該 < 10 秒完成

# 5. 檢查 Main 線程
# 應該沒有長時間的阻塞
```

## 📈 預期時間線

| 階段 | 操作 | 耗時 |
|------|------|------|
| 1 | 文件驗證 | 1 分鐘 |
| 2 | 測試頁面運行 | 2 分鐘 |
| 3 | 基本功能測試 | 3 分鐘 |
| 4 | 性能基準測試 | 5 分鐘 |
| 5 | 集成驗證 | 5 分鐘 |
| **總計** | | **15 分鐘** |

## ✅ 成功標記

當看到以下情況時，集成完成成功：

✅ **WASM 加載**
```javascript
> compute_peaks_optimized
ƒ compute_peaks_optimized(channel_data, num_peaks, precision)
```

✅ **計算正確**
```
Peak values: [0.05, 0.12, 0.08, ..., 0.03]
Type: Float32Array
Length: 8000
```

✅ **性能達標**
```
Calculation time: 3.2 ms (target: < 5 ms)
Throughput: 68.9 M samples/sec (target: > 50 M)
```

✅ **集成穩定**
```
No errors in console
No warnings about WASM
Wavesurfer functions working normally
```

## 🎉 下一步

1. ✅ 完成所有驗證
2. ✅ 記錄性能指標
3. ✅ 文檔更新（如需要）
4. ✅ 準備生產部署

---

**最後更新**：2025-12-05
**難度**：⭐ 簡單
**預計耗時**：15 分鐘
