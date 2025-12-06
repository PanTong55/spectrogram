# 性能優化驗證指南

## 🧪 測試方法

### 1. 性能計量代碼

在 `sonoradar.html` 或你的主應用中添加以下代碼來測量性能：

```javascript
// 在 render() 或 getFrequencies() 前後添加
const perfMetrics = {
    filterBankTime: 0,
    wasmLoadTime: 0,
    totalTime: 0
};

// 在 Spectrogram 類中修改:
async getFrequencies(t) {
    const startTotal = performance.now();
    
    // ... 現有代碼 ...
    
    if (this.scale !== "linear") {
        if (this._lastFilterBankScale !== currentFilterBankKey) {
            const startFilterBank = performance.now();
            
            let c;
            if (this._filterBankCacheByKey[currentFilterBankKey]) {
                c = this._filterBankCacheByKey[currentFilterBankKey];
                console.log('✅ 使用已緩存的濾波器組 (命中)');
            } else {
                c = this.createFilterBank(...);
                this._filterBankCacheByKey[currentFilterBankKey] = c;
                const filterBankTime = performance.now() - startFilterBank;
                console.log(`⏱️  計算濾波器組耗時: ${filterBankTime.toFixed(2)}ms`);
                perfMetrics.filterBankTime = filterBankTime;
            }
            
            if (this._loadedFilterBankKey !== currentFilterBankKey) {
                const startWasmLoad = performance.now();
                this.flattenAndLoadFilterBank(c);
                const wasmLoadTime = performance.now() - startWasmLoad;
                this._loadedFilterBankKey = currentFilterBankKey;
                console.log(`⏱️  WASM 加載耗時: ${wasmLoadTime.toFixed(2)}ms`);
                perfMetrics.wasmLoadTime = wasmLoadTime;
            } else {
                console.log('✅ 濾波器組已加載到 WASM (跳過)');
            }
        }
    }
    
    // ... 現有代碼 ...
    
    const totalTime = performance.now() - startTotal;
    console.log(`⏱️  總計 getFrequencies 耗時: ${totalTime.toFixed(2)}ms`);
    perfMetrics.totalTime = totalTime;
    
    return h;
}
```

### 2. 瀏覽器控制台測試

#### 測試場景 A: 相同 WAV 重新加載

```javascript
// 1. 加載第一個 WAV 文件
// 預期: 40-75ms (包含濾波器計算)
// 控制台看到: "計算濾波器組耗時: 30-50ms" + "WASM 加載耗時: 10-20ms"

// 2. 加載同一個 WAV 文件
// 預期改善後: 1-2ms (僅 WASM 的幀計算，無濾波器計算)
// 控制台看到: "✅ 使用已緩存的濾波器組 (命中)"
```

#### 測試場景 B: 不同 WAV，相同 sample rate

```javascript
// 1. 加載 WAV A (44.1kHz, Mel scale)
// 預期: 40-75ms

// 2. 加載 WAV B (44.1kHz, Mel scale)
// 預期改善後: 1-2ms
// 控制台看到: "✅ 使用已緩存的濾波器組 (命中)" + "✅ 濾波器組已加載到 WASM (跳過)"
```

#### 測試場景 C: 改變濾波器類型

```javascript
// 1. 加載 WAV A (44.1kHz, Mel scale)
// 預期: 40-75ms

// 2. 改變濾波器到 Bark
// 預期: 40-75ms (新濾波器組計算)
// 控制台看到: "計算濾波器組耗時: 30-50ms" + "WASM 加載耗時: 10-20ms"

// 3. 回到 Mel scale
// 預期改善後: 1-2ms
// 控制台看到: "✅ 使用已緩存的濾波器組 (命中)" + "✅ WASM 加載耗時: ..."
```

## 📊 預期結果對比

### 優化前

```
加載 WAV A (Mel scale):        ████████░ 45ms
加載 WAV B (Mel scale):        ████████░ 45ms  ← 相同濾波器仍然重新計算
改變濾波器到 Bark:             ████████░ 50ms
回到 Mel:                      ████████░ 45ms  ← 同樣重新計算
───────────────────────────────────────────
總耗時:                        185ms
```

### 優化後

```
加載 WAV A (Mel scale):        ████████░ 45ms  (首次計算)
加載 WAV B (Mel scale):        ░░░░░░░░░ 1ms   ← 使用緩存! ✅
改變濾波器到 Bark:             ████████░ 50ms  (新濾波器)
回到 Mel:                      ░░░░░░░░░ 1ms   ← 使用緩存! ✅
───────────────────────────────────────────
總耗時:                        97ms (48% 改善) ✅
```

## 🔍 監測指標

### 關鍵性能指標 (KPI)

| 指標 | 目標 | 檢驗方法 |
|------|------|--------|
| 首次濾波器計算 | 30-50ms | 看控制台 "計算濾波器組耗時" |
| WASM 加載 (首次) | 10-20ms | 看控制台 "WASM 加載耗時" |
| 快取命中 (重複) | <2ms | 看控制台 "✅ 使用已緩存" |
| WASM 重用 | 不執行 | 看控制台 "✅ 濾波器組已加載 (跳過)" |

### 快取命中率計算

```javascript
// 在 Spectrogram 類中添加
this._cacheStats = {
    totalRequests: 0,
    cacheHits: 0,
    wasmReuses: 0
};

// 在 getFrequencies 中更新:
this._cacheStats.totalRequests++;

if (this._filterBankCacheByKey[currentFilterBankKey]) {
    this._cacheStats.cacheHits++;
}

if (this._loadedFilterBankKey === currentFilterBankKey && previouslyLoaded) {
    this._cacheStats.wasmReuses++;
}

// 定期檢查:
console.log(`快取命中率: ${(100 * this._cacheStats.cacheHits / this._cacheStats.totalRequests).toFixed(1)}%`);
console.log(`WASM 重用率: ${(100 * this._cacheStats.wasmReuses / this._cacheStats.totalRequests).toFixed(1)}%`);
```

## 🧪 完整測試套件

### 自動化測試

```javascript
// 在瀏覽器控制台執行此代碼進行性能測試
async function performanceTest() {
    console.log('🧪 開始性能測試...\n');
    
    const results = [];
    
    // 測試 1: 首次加載
    console.log('📝 測試 1: 首次加載 WAV (Mel scale)');
    const t1 = performance.now();
    // 加載 WAV 文件的代碼...
    const time1 = performance.now() - t1;
    results.push({ test: '首次加載', time: time1, expected: '40-75ms' });
    console.log(`✅ 耗時: ${time1.toFixed(2)}ms\n`);
    
    // 測試 2: 相同配置重新加載
    console.log('📝 測試 2: 相同配置重新加載');
    const t2 = performance.now();
    // 加載同一個 WAV 的代碼...
    const time2 = performance.now() - t2;
    results.push({ test: '重新加載', time: time2, expected: '<2ms' });
    console.log(`✅ 耗時: ${time2.toFixed(2)}ms\n`);
    
    // 測試 3: 改變濾波器
    console.log('📝 測試 3: 改變濾波器類型');
    const t3 = performance.now();
    // 改變濾波器的代碼...
    const time3 = performance.now() - t3;
    results.push({ test: '改變濾波器', time: time3, expected: '40-75ms' });
    console.log(`✅ 耗時: ${time3.toFixed(2)}ms\n`);
    
    // 測試 4: 回到之前的濾波器
    console.log('📝 測試 4: 回到之前的濾波器');
    const t4 = performance.now();
    // 切換回舊濾波器的代碼...
    const time4 = performance.now() - t4;
    results.push({ test: '回到舊濾波器', time: time4, expected: '<2ms' });
    console.log(`✅ 耗時: ${time4.toFixed(2)}ms\n`);
    
    // 總結
    console.log('📊 測試結果總結:');
    console.table(results);
    
    const totalImprovement = ((time1 - time2 + time3 - time4) / (time1 + time3) * 100).toFixed(1);
    console.log(`\n🎉 整體性能改善: ${totalImprovement}%`);
}

// 執行測試
performanceTest();
```

## 📈 記錄基線數據

### 優化前 (保存此數據用於對比)

```javascript
// 執行以下代碼並複製結果
const baseline = {
    firstLoad_mel: null,        // ms
    reload_mel: null,            // ms
    change_to_bark: null,        // ms
    change_back_to_mel: null,    // ms
    
    // 你的結果:
    // firstLoad_mel: 52,
    // reload_mel: 48,
    // change_to_bark: 55,
    // change_back_to_mel: 50,
};
```

### 優化後 (與基線對比)

```javascript
// 優化後執行相同測試，對比結果
const optimized = {
    firstLoad_mel: null,        // ms
    reload_mel: null,            // ms (應該 < 2ms)
    change_to_bark: null,       // ms
    change_back_to_mel: null,   // ms (應該 < 2ms)
    
    // 你的結果:
    // firstLoad_mel: 48,
    // reload_mel: 1.2,          ✅ 97% 改善
    // change_to_bark: 52,
    // change_back_to_mel: 1.1,  ✅ 97% 改善
};

// 計算改善率
const improvement = {
    reload_improvement: ((baseline.reload_mel - optimized.reload_mel) / baseline.reload_mel * 100).toFixed(1) + '%',
    back_to_mel_improvement: ((baseline.change_back_to_mel - optimized.change_back_to_mel) / baseline.change_back_to_mel * 100).toFixed(1) + '%'
};

console.log('改善結果:', improvement);
```

## ✅ 驗證檢查清單

- [ ] 首次加載顯示 "計算濾波器組耗時" 和 "WASM 加載耗時"
- [ ] 第二次加載相同配置顯示 "✅ 使用已緩存的濾波器組 (命中)"
- [ ] 改變濾波器類型時重新計算濾波器
- [ ] 回到之前的濾波器類型時使用快取
- [ ] 相同配置重新加載耗時 <2ms
- [ ] 快取命中率 >90%
- [ ] 沒有記憶體泄漏 (打開多個 WAV 不會導致崩潰)

## 🐛 故障排除

### 問題: "使用已緩存" 不出現

**原因**: 濾波器組 key 不匹配
**解決**:
```javascript
// 檢查 key 是否相同
console.log('currentKey:', currentFilterBankKey);
console.log('cachedKeys:', Object.keys(this._filterBankCacheByKey));
```

### 問題: WASM 加載時間沒有減少

**原因**: `_loadedFilterBankKey` 沒有正確更新
**解決**:
```javascript
// 檢查狀態
console.log('loaded key:', this._loadedFilterBankKey);
console.log('current key:', currentFilterBankKey);
console.log('should load:', this._loadedFilterBankKey !== currentFilterBankKey);
```

### 問題: 記憶體使用增加

**原因**: 過多的濾波器組配置被緩存
**解決**:
```javascript
// 限制快取大小
const maxCacheEntries = 20;
if (Object.keys(this._filterBankCacheByKey).length > maxCacheEntries) {
    // 清除最舊的條目
    const keys = Object.keys(this._filterBankCacheByKey);
    delete this._filterBankCacheByKey[keys[0]];
}
```

## 📝 測試報告模板

```
性能優化驗證報告
================

日期: ___________
環境: Chrome _____ / Firefox _____ / Safari _____

測試結果:
✅ / ❌ 首次加載耗時: _____ ms (期望: 40-75ms)
✅ / ❌ 重新加載耗時: _____ ms (期望: <2ms)
✅ / ❌ 改變濾波器耗時: _____ ms (期望: 40-75ms)
✅ / ❌ 回到舊濾波器耗時: _____ ms (期望: <2ms)

快取命中率: _____ %
WASM 重用率: _____ %

總體改善: _____ %

觀察到的改進:
- 快速切換 WAV 文件: ✅ / ❌
- 流暢的濾波器切換: ✅ / ❌
- 無明顯卡頓: ✅ / ❌

遇到的問題 (如有):
1. ___________
2. ___________

建議:
___________
```

## 🎯 預期性能目標

| 場景 | 舊版本 | 新版本 | 目標達成 |
|------|------|------|--------|
| 首次加載 (Mel) | 45-75ms | 40-75ms | ✅ 無退化 |
| 重新加載 (相同 Mel) | 45-75ms | <2ms | ✅ 97% ↓ |
| 改變到 Bark | 50-75ms | 40-75ms | ✅ 無退化 |
| 回到 Mel | 45-75ms | <2ms | ✅ 97% ↓ |

---

**用戶體驗**: 從明顯的加載延遲變為立即響應 ✨
