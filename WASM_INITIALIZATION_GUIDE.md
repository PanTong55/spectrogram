# WASM 初始化診斷指南

## 修正摘要

已在以下位置加入 WASM 初始化代碼：

### 1. **main.js** (第 1-10 行)
```javascript
import init, * as spectrogramWasm from './modules/spectrogram_wasm.js';

// 初始化並暴露 WASM 模塊到全局變量，讓 WaveSurfer 可以訪問
init().then(() => {
    globalThis._spectrogramWasm = spectrogramWasm;
    console.log('✅ WASM 模塊已初始化並暴露到 globalThis._spectrogramWasm');
}).catch(e => {
    console.error('❌ WASM 模塊初始化失敗:', e);
});
```

### 2. **modules/wavesurfer.esm.js**

#### a. 在 constructor 中初始化 _wasmWaveformEngine
```javascript
this._wasmWaveformEngine = null,
this._wasmReady = Promise.resolve().then( () => {
    try {
        const wasmModule = typeof globalThis !== 'undefined' && globalThis._spectrogramWasm 
            ? globalThis._spectrogramWasm 
            : null;
        
        if (wasmModule && wasmModule.WaveformEngine) {
            this._wasmWaveformEngine = new wasmModule.WaveformEngine();
        }
    } catch (e) {
        console.warn('⚠️ 無法初始化 WaveformEngine:', e);
    }
});
```

#### b. 在 loadAudio 中等待並加載數據
```javascript
// 等待 WASM 初始化完成，然後加載音頻數據
if (this.decodedData) {
    try {
        yield this._wasmReady;  // 等待 WaveformEngine 初始化完成
        
        if (this._wasmWaveformEngine) {
            const numChannels = this.decodedData.numberOfChannels;
            this._wasmWaveformEngine.resize(numChannels);
            
            for (let ch = 0; ch < numChannels; ch++) {
                const channelData = this.decodedData.getChannelData(ch);
                this._wasmWaveformEngine.load_channel(ch, channelData);
            }
            
            console.log(`✅ 已加載 ${numChannels} 個通道到 WaveformEngine (${this.decodedData.length} 樣本)`);
        }
    } catch (e) {
        console.warn('⚠️ WASM 初始化或加載失敗:', e);
    }
}
```

#### c. 在 renderMultiCanvas 中使用 WASM 優化
```javascript
if (this._wasmWaveformEngine && t[0] && t[0].length > 0) {
    // 使用 WASM get_peaks_in_range
    // ...
} else {
    // 診斷為何沒有 WASM
    if (!this._wasmWaveformEngine) {
        renderMode = '⚫ WASM 未初始化 (globalThis._spectrogramWasm 不可用)';
    } else if (!t[0] || t[0].length === 0) {
        renderMode = '⚫ 無有效音頻數據 (通道為空)';
    }
}
```

## 執行流程

### 頁面加載流程：
1. **main.js 加載** → 執行頂部的 WASM 導入和初始化
2. **init() 調用** → 異步初始化 WASM，成功後暴露到 `globalThis._spectrogramWasm`
3. **WaveSurfer constructor** → 檢查 `globalThis._spectrogramWasm` 是否存在，創建 WaveformEngine
4. **loadAudio()** → 等待 `this._wasmReady` 完成，然後加載音頻數據
5. **renderMultiCanvas()** → 使用 WASM 進行高效下採樣

## 瀏覽器 DevTools 檢查清單

### Console 檢查
打開 DevTools (F12) → Console 標籤，應該看到：

✅ **正常情況下應看到的訊息：**
```
✅ WASM 模塊已初始化並暴露到 globalThis._spectrogramWasm
✅ 已加載 2 個通道到 WaveformEngine (48000 樣本)
🎯 Zoom Render Mode: ✅ WASM 優化版本 (2 通道)
```

❌ **問題情況下的訊息：**
```
⚫ WASM 未初始化 (globalThis._spectrogramWasm 不可用)
⚫ 無有效音頻數據 (通道為空)
🔴 完全 Fallback (JS 實現)
```

### Network 檢查
1. 打開 DevTools → Network 標籤
2. 重新加載頁面
3. 搜索 `spectrogram_wasm_bg.wasm` - 應該看到 200 OK，大小約 245KB

### globalThis 檢查
在 Console 中執行：
```javascript
console.log(globalThis._spectrogramWasm);
console.log(globalThis._spectrogramWasm?.WaveformEngine);
```

應該輸出 WASM 模塊對象和 WaveformEngine 類。

## 常見問題排查

### 問題 1: WASM 未初始化
**症狀：** `Zoom Render Mode: 🔵 原始 JS 實現` 或 `⚫ WASM 未初始化`

**原因：** `globalThis._spectrogramWasm` 不可用

**解決方案：**
1. 確認 main.js 頂部有 WASM 導入代碼 ✅
2. 檢查 Network 標籤中 spectrogram_wasm_bg.wasm 是否成功加載 (200 OK)
3. 檢查 Console 中是否有初始化錯誤訊息
4. 檢查 modules 目錄中是否有 spectrogram_wasm.js、spectrogram_wasm_bg.wasm 等文件

### 問題 2: 混合模式或完全 Fallback
**症狀：** `⚠️ 混合模式` 或 `🔴 完全 Fallback`

**原因：** WASM 已初始化但某些操作失敗

**解決方案：**
1. 檢查 Console 中的詳細錯誤訊息
2. 確保音頻加載後確實調用了 `load_channel`
3. 驗證音頻數據是否正確傳遞到 WASM

### 問題 3: WASM 初始化時間太長
**症狀：** 音頻加載後很久才看到 `✅ 已加載 X 通道`

**原因：** WASM 初始化較慢或網絡延遲

**解決方案：**
1. 在 main.js 中更早加載 WASM（已實施 ✅）
2. 確保不在主線程進行其他重型計算
3. 考慮使用 Worker 進行初始化（如果需要）

## 測試文件

可使用 `/test-wasm.html` 進行快速 WASM 功能測試：
1. 啟動 HTTP 伺服器
2. 打開 `http://localhost:PORT/test-wasm.html`
3. 檢查 console 輸出

## 最終驗證

✅ **已完成的修正：**
- [x] main.js 中加入 WASM 初始化
- [x] main.js 中暴露 WASM 模塊到 globalThis
- [x] wavesurfer.esm.js constructor 中等待 WASM 初始化
- [x] loadAudio 中等待 _wasmReady 完成
- [x] renderMultiCanvas 中加入診斷訊息
- [x] 語法驗證通過

✅ **已有的 WASM 文件：**
- [x] modules/spectrogram_wasm.js (20K)
- [x] modules/spectrogram_wasm_bg.wasm (245K)
- [x] modules/spectrogram_wasm.d.ts (2.3K)
- [x] modules/spectrogram_wasm_bg.wasm.d.ts

---

**更新日期：** 2025-12-06
**狀態：** ✅ 所有修正已實施，等待測試驗證
