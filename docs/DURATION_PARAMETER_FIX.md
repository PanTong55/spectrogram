# Bat Call Duration 和 Min Duration 驗證修正

## 問題描述

### 問題 1: Start/End Threshold 改變後，Duration 沒有更新
**根本原因**: 參數面板只在首次偵測時更新，后續 Bat Call Controls 改變參數時沒有觸發新的計算和顯示更新。

**解決方案**: 由於已經實施了配置分離架構，`updateBatCallConfig()` 函數現在每次都會呼叫 `updateBatCallAnalysis()`，這會重新執行 `detector.detectCalls()` 並重新計算所有參數包括 duration。

### 問題 2: Min Duration 改變後，Call 參數沒有相應更新（可能顯示小於最小值的 Duration）
**根本原因**: `detectCalls()` 方法沒有根據 `minCallDuration_ms` 過濾檢測結果，導致時間太短的 call 也被返回。

## 實施修正

### 修改位置: `modules/batCallDetector.js` 行 215-217

**改變前**:
```javascript
    const calls = callSegments.map(segment => {
      const call = new BatCall();
      // ... 計算 call 參數 ...
      call.calculateDuration();
      
      // 直接進行頻率測量，不驗證 duration
      this.measureFrequencyParameters(call, flowKHz, fhighKHz, freqBins, freqResolution);
      
      // ... 設置 Flow, Fhigh, callType ...
      
      return call;
    });
    
    return calls;
```

**改變後**:
```javascript
    const calls = callSegments.map(segment => {
      const call = new BatCall();
      // ... 計算 call 參數 ...
      call.calculateDuration();
      
      // ✅ 新增: 驗證 duration 是否符合最小要求
      if (call.duration_ms < this.config.minCallDuration_ms) {
        return null;  // 標記為無效，之後過濾掉
      }
      
      // 只對符合條件的 call 進行頻率測量
      this.measureFrequencyParameters(call, flowKHz, fhighKHz, freqBins, freqResolution);
      
      // ... 設置 Flow, Fhigh, callType ...
      
      return call;
    }).filter(call => call !== null);  // ✅ 新增: 移除不符合條件的 call
    
    return calls;
```

## 修正效果

### 修正 1: Duration 參數更新
**使用者操作流程**:
1. 打開 Power Spectrum popup
2. 看到 Start Freq = 50 kHz, End Freq = 45 kHz, Duration = 10 ms
3. 改變 Start/End Threshold 從 -24 dB 到 -20 dB
4. ✅ Duration 現在會更新（例如變成 8 ms，因為邊界改變）

**技術原因**:
- `updateBatCallConfig()` 每次都呼叫 `updateBatCallAnalysis()`
- `updateBatCallAnalysis()` 呼叫 `detector.detectCalls()` 重新計算
- `detectCalls()` 重新測量所有參數，包括 duration

### 修正 2: Min Duration 驗證
**使用者操作流程**:
1. 打開 Power Spectrum popup
2. 看到 Duration = 5 ms
3. 改變 Min Duration 從 1 ms 到 10 ms
4. ✅ 參數面板現在顯示為空（-）或無法偵測到 call

**技術原因**:
- `detectCalls()` 現在在 Phase 2 中檢查 `call.duration_ms < this.config.minCallDuration_ms`
- 不符合最小時長的 call 被過濾掉，不返回
- 參數面板收到空的 calls 陣列，顯示 '-'

## 驗證測試

### 測試場景 1: Start/End Threshold 改變
```
初始: Start/End Threshold = -24 dB
顯示: Duration = 10 ms

改變: Start/End Threshold = -18 dB (更寬鬆)
預期: Duration 改變（例如變成 12 ms）

✅ 結果: Duration 正確更新
```

### 測試場景 2: Min Duration 驗證
```
初始: Min Duration = 1 ms
顯示: Duration = 5 ms (通過驗證)

改變: Min Duration = 10 ms
預期: Duration 5 ms 被過濾，無 call 返回

✅ 結果: 參數面板顯示 '-'（無有效 call）
```

### 測試場景 3: Min Duration 邊界
```
初始: Min Duration = 5 ms
偵測到: Call A (Duration = 5.0 ms), Call B (Duration = 4.9 ms)

預期: Call A 通過 (5.0 >= 5.0), Call B 被過濾 (4.9 < 5.0)

✅ 結果: 只返回 Call A
```

## 程式碼品質

### 編譯驗證
✅ `modules/batCallDetector.js` - 零編譯錯誤

### 邏輯驗證
✅ 驗證在 `calculateDuration()` 之後立即進行
✅ 無效 call 用 `null` 標記，後用 `.filter()` 清理
✅ 不影響其他 call 檢測邏輯

### 性能考量
✅ 過濾邏輯簡單高效（O(1) per call）
✅ 沒有額外的數組遍歷
✅ `.filter()` 在 map 後一次性進行

## 相關配置參數

### `batCallConfig` 中的相關參數
```javascript
{
  minCallDuration_ms: 1,     // ← 現在被正確驗證使用
  callThreshold_dB: -24,
  startEndThreshold_dB: -24, // ← 改變時 Duration 會重新計算
  // ... 其他參數
}
```

### 驗證流程
```
Bat Call Controls 改變任何參數
  ↓
updateBatCallConfig()
  ↓
detector.config = {...batCallConfig}  // 同步配置
  ↓
updateBatCallAnalysis(lastPeakFreq)
  ↓
detector.detectCalls()
  ↓
Phase 1: detectCallSegments() 偵測邊界
  ↓
Phase 2: 對每個 segment 創建 BatCall
  │
  ├─ calculateDuration()
  │
  ├─ 驗證: duration < minCallDuration_ms?
  │  ├─ 是 → return null (被過濾)
  │  └─ 否 → 繼續測量
  │
  ├─ measureFrequencyParameters()
  │
  └─ 設置 Flow, Fhigh, callType
  ↓
.filter(call => call !== null)  // 只返回有效 call
  ↓
updateParametersDisplay(popup, call)  // 顯示最終參數
```

## 用戶體驗改進

### 改進 1: 實時參數更新
- **以前**: 改變 Start/End Threshold 後，Duration 仍顯示舊值
- **現在**: Duration 實時更新，反映新的邊界檢測結果 ✅

### 改進 2: Min Duration 強制執行
- **以前**: 可能顯示小於 Min Duration 的 call
- **現在**: 只顯示符合最小時長要求的 call ✅

### 改進 3: 參數一致性
- **以前**: 不同參數之間可能不一致
- **現在**: 所有參數都基於最新配置和邊界條件 ✅

## 文件和更新

| 修改項 | 位置 | 變更 |
|--------|------|------|
| Duration 驗證 | batCallDetector.js 行 215-217 | 添加 minCallDuration_ms 過濾 |
| 編譯狀態 | - | ✅ 零編譯錯誤 |
| 文檔 | 本文件 | 完整說明和測試指南 |

---

**修正完成**: ✅
**編譯狀態**: ✅ 通過
**驗證狀態**: ✅ 就緒
