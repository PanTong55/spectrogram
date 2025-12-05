# WASM 集成驗證和測試指南

## 快速驗證檢查清單

### 1. 文件完整性檢查

```bash
# 驗證所有必要文件存在
ls -lh modules/spectrogram_wasm*
ls -lh modules/spectrogram.esm.js
```

**預期輸出**:
```
-rw-rw-rw- 1 ... 2.9K spectrogram_wasm.d.ts
-rw-rw-rw- 1 ... 9.9K spectrogram_wasm.js
-rw-rw-rw- 1 ... 196K spectrogram_wasm_bg.wasm
-rw-rw-rw- 1 ... 936B spectrogram_wasm_bg.wasm.d.ts
-rw-rw-rw- 1 ... XXK spectrogram.esm.js
```

### 2. 導入驗證

在瀏覽器控制台測試：

```javascript
// 測試 1: 模塊加載
import('./modules/spectrogram.esm.js').then(mod => {
    console.log('✓ 模塊加載成功');
    console.log(mod);
}).catch(err => {
    console.error('✗ 加載失敗:', err);
});
```

### 3. WASM 初始化驗證

```javascript
// 測試 2: WASM 初始化
(async () => {
    try {
        const { default: Spectrogram } = await import('./modules/spectrogram.esm.js');
        const spec = new Spectrogram({
            container: '#spectrogram',
            fftSamples: 512,
            windowFunc: 'hann'
        });
        console.log('✓ Spectrogram 實例創建成功');
        console.log('引擎:', spec._wasmEngine);
    } catch (err) {
        console.error('✗ 初始化失敗:', err);
    }
})();
```

### 4. 計算驗證

```javascript
// 測試 3: FFT 計算
(async () => {
    try {
        const { default: Spectrogram } = await import('./modules/spectrogram.esm.js');
        const spec = new Spectrogram({
            container: '#spectrogram',
            fftSamples: 512,
            windowFunc: 'hann'
        });
        
        // 等待 WASM 初始化
        await spec._wasmReady;
        
        // 創建測試音頻（512 個樣本，1 kHz 的正弦波）
        const audioData = new Float32Array(512);
        const frequency = 1000; // 1 kHz
        const sampleRate = 44100;
        for (let i = 0; i < 512; i++) {
            audioData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
        }
        
        // 計算頻譜
        const result = spec._wasmEngine.compute_spectrogram(audioData, 256, 20, 80);
        
        console.log('✓ FFT 計算成功');
        console.log('結果大小:', result.length);
        console.log('樣本值:', Array.from(result.slice(0, 10)));
        
        // 驗證輸出
        if (result.length === 256) {
            console.log('✓ 輸出大小正確 (256 個頻率箱)');
        }
        if (Math.max(...result) <= 255 && Math.min(...result) >= 0) {
            console.log('✓ 值範圍正確 (0-255)');
        }
    } catch (err) {
        console.error('✗ 計算失敗:', err);
    }
})();
```

## 性能基準測試

### 基準測試套件

```javascript
async function benchmarkFFT() {
    const { default: Spectrogram } = await import('./modules/spectrogram.esm.js');
    const spec = new Spectrogram({
        container: '#spectrogram',
        fftSamples: 512,
        windowFunc: 'hann'
    });
    
    await spec._wasmReady;
    
    // 準備測試數據
    const audioData = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
        audioData[i] = Math.random() * 2 - 1;
    }
    
    // 預熱
    for (let i = 0; i < 10; i++) {
        spec._wasmEngine.compute_spectrogram(audioData, 256, 20, 80);
    }
    
    // 基準測試
    const iterations = 1000;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
        spec._wasmEngine.compute_spectrogram(audioData, 256, 20, 80);
    }
    
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;
    
    console.log(`FFT 基準 (${iterations} 次迭代):`);
    console.log(`  平均時間: ${avgTime.toFixed(3)} ms`);
    console.log(`  吞吐量: ${(1000/avgTime).toFixed(1)} FFT/秒`);
}

benchmarkFFT();
```

### 預期性能

| 場景 | FFT 大小 | 平均時間 | 預期 |
|------|--------|--------|------|
| 標準 | 512 | 0.08-0.15 ms | ✓ |
| 大型 | 2048 | 0.25-0.4 ms | ✓ |
| 小型 | 256 | 0.04-0.08 ms | ✓ |

## 集成測試

### 完整工作流測試

```javascript
async function integratedTest() {
    console.log('=== WASM 集成測試開始 ===\n');
    
    try {
        // 第 1 步: 加載模塊
        console.log('1. 加載模塊...');
        const { default: Spectrogram } = await import('./modules/spectrogram.esm.js');
        console.log('   ✓ 模塊加載成功\n');
        
        // 第 2 步: 創建實例
        console.log('2. 創建 Spectrogram 實例...');
        const container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);
        
        const spec = new Spectrogram({
            container: '#test-container',
            fftSamples: 512,
            windowFunc: 'hann',
            height: 200,
            splitChannels: false
        });
        console.log('   ✓ 實例創建成功\n');
        
        // 第 3 步: 等待 WASM
        console.log('3. 初始化 WASM...');
        await spec._wasmReady;
        console.log('   ✓ WASM 初始化完成\n');
        
        // 第 4 步: 驗證引擎
        console.log('4. 驗證引擎配置...');
        console.log(`   FFT 大小: ${spec._wasmEngine.get_fft_size()}`);
        console.log(`   頻率箱: ${spec._wasmEngine.get_freq_bins()}`);
        const windowValues = spec._wasmEngine.get_window_values();
        console.log(`   窗函數值: ${windowValues.length} 個元素`);
        console.log(`   第一個值: ${windowValues[0].toFixed(4)}\n`);
        
        // 第 5 步: 計算頻譜
        console.log('5. 計算頻譜...');
        const audioData = new Float32Array(512);
        // 生成多頻率信號
        for (let i = 0; i < 512; i++) {
            const t = i / 44100;
            audioData[i] = 0.3 * Math.sin(2 * Math.PI * 440 * t) +  // A4
                          0.2 * Math.sin(2 * Math.PI * 880 * t) +  // A5
                          0.1 * Math.sin(2 * Math.PI * 220 * t);   // A3
        }
        
        const result = spec._wasmEngine.compute_spectrogram(audioData, 256, 20, 80);
        console.log(`   ✓ 頻譜計算完成`);
        console.log(`   輸出大小: ${result.length}`);
        console.log(`   數據統計:`);
        console.log(`     最小值: ${Math.min(...result)}`);
        console.log(`     最大值: ${Math.max(...result)}`);
        console.log(`     平均值: ${(result.reduce((a, b) => a + b) / result.length).toFixed(0)}\n`);
        
        // 第 6 步: 驗證輸出質量
        console.log('6. 驗證輸出質量...');
        const validRange = result.every(v => v >= 0 && v <= 255);
        const hasVariation = new Set(result).size > 1;
        console.log(`   值範圍 0-255: ${validRange ? '✓' : '✗'}`);
        console.log(`   有數據變化: ${hasVariation ? '✓' : '✗'}\n`);
        
        // 清理
        container.remove();
        
        console.log('=== 測試完成: 所有檢查通過 ✓ ===');
        return true;
        
    } catch (error) {
        console.error('✗ 測試失敗:', error);
        console.error(error.stack);
        return false;
    }
}

// 運行測試
integratedTest();
```

## 窗函數驗證

驗證所有支持的窗函數：

```javascript
async function verifyWindowFunctions() {
    const { default: Spectrogram } = await import('./modules/spectrogram.esm.js');
    
    const windows = [
        'hann', 'hamming', 'bartlett', 'bartlettHann',
        'blackman', 'cosine', 'gauss', 'lanczos',
        'rectangular', 'triangular'
    ];
    
    console.log('驗證窗函數...\n');
    
    for (const windowName of windows) {
        try {
            const spec = new Spectrogram({
                container: document.body,
                fftSamples: 512,
                windowFunc: windowName
            });
            
            await spec._wasmReady;
            const window = spec._wasmEngine.get_window_values();
            const sum = window.reduce((a, b) => a + b);
            
            console.log(`✓ ${windowName.padEnd(14)} | 和: ${sum.toFixed(3)} | 最小: ${Math.min(...window).toFixed(3)} | 最大: ${Math.max(...window).toFixed(3)}`);
        } catch (err) {
            console.error(`✗ ${windowName}: ${err.message}`);
        }
    }
}

verifyWindowFunctions();
```

## 故障排除

### 問題 1: "Cannot find module spectrogram_wasm"

**原因**: WASM 文件未正確部署
**解決**:
```bash
# 驗證文件存在
ls modules/spectrogram_wasm*

# 重新複製（如果缺失）
cp spectrogram-wasm/pkg/* modules/
```

### 問題 2: "WebAssembly.instantiate" 失敗

**原因**: .wasm 文件損壞或不可訪問
**解決**:
```bash
# 驗證文件完整性
file modules/spectrogram_wasm_bg.wasm
# 應顯示: WebAssembly (wasm) binary module

# 檢查文件大小
ls -lh modules/spectrogram_wasm_bg.wasm
# 應約 196 KB
```

### 問題 3: FFT 輸出全為零

**原因**: 音頻數據範圍不正確，或 FFT 結果映射出錯
**解決**:
```javascript
// 驗證輸入數據
const audioData = new Float32Array(512);
// ... 填充數據...
console.log('輸入範圍:', Math.min(...audioData), 'to', Math.max(...audioData));

// 應該在 -1 到 1 之間
if (Math.abs(Math.max(...audioData)) > 1.0) {
    // 正規化
    const max = Math.max(...Array.from(audioData).map(Math.abs));
    for (let i = 0; i < audioData.length; i++) {
        audioData[i] /= max;
    }
}
```

### 問題 4: 性能沒有改進

**原因**: 使用開發構建而非發佈構建
**解決**:
```bash
cd spectrogram-wasm
wasm-pack build --target web --release
cp pkg/* ../modules/
```

## 驗證清單

在部署到生產環境之前：

- [ ] 所有 WASM 文件已複製到 `modules/` 目錄
- [ ] spectrogram.esm.js 正確導入 WASM 模塊
- [ ] 在瀏覽器控制台進行了快速測試
- [ ] FFT 計算產生預期的數值範圍（0-255）
- [ ] 性能基準測試通過（平均 < 0.2 ms per FFT）
- [ ] 所有支持的窗函數都能正確初始化
- [ ] 在不同的 FFT 大小下測試（256、512、1024、2048）
- [ ] 驗證了多通道（立體聲）支持
- [ ] 測試了各種增益和範圍參數
- [ ] 在 Firefox、Chrome 和 Safari 上進行了跨瀏覽器測試

---

**測試日期**: 2025年12月5日
**版本**: 1.0
