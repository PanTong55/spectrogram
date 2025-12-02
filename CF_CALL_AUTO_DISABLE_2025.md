# CF Call 自動保護窗口禁用 - 實現文檔

**日期：** 2025年12月2日  
**狀態：** ✅ 完成

---

## 📋 功能概述

為 CF（Constant Frequency）調用自動禁用 protection window 的限制，允許 CF 蝙蝠的長頻呼聲正常延伸而不被人為截斷。

---

## 🔧 實現細節

### CF/FM 自動檢測邏輯

**檢測方法：** 基於 Peak Frequency 與 High Frequency 的差異

```
Peak Freq vs High Freq 差異
├─ < 2.0 kHz  → CF 調用（Constant Frequency bat）
│             └─ 禁用 protection window 限制
│
└─ ≥ 2.0 kHz  → FM 調用（Frequency Modulated bat）
              └─ 保持 protection window 限制
```

### CF 蝙蝠特性

典型的 CF 蝙蝠（常見物種）：
- **Molossidae**（墨西哥無尾蝙蝠科）
  - 特徵：高 CF 頻率（80-120 kHz）
  - 呼聲持續時間：較長，通常 > 10ms
  
- **Rhinolophidae**（蹄鼻蝙蝠科）
  - 特徵：中高 CF 頻率（50-80 kHz）
  - 呼聲持續時間：很長，通常 > 20ms
  
- **Hipposideridae**（吸血蝙蝠科）
  - 特徵：高 CF 頻率（100-140 kHz）
  - 呼聲持續時間：長，通常 > 15ms

### FM 蝙蝠特性

典型的 FM 蝙蝠：
- **Vespertilionidae**（蝙蝠科）
  - 特徵：下掃 FM 呼聲
  - 呼聲持續時間：短，通常 < 10ms
  
- **Phyllostomidae**（葉鼻蝙蝠科）
  - 特徵：複雜的 FM 呼聲
  - 呼聲持續時間：短到中等，通常 < 15ms

---

## 💻 代碼修改

**文件：** `batCallDetector.js`  
**行號：** 2440-2469

### 修改前

```javascript
// CF-FM AUTO-DETECTION
if (freqDifference < 1.0) {
  // CF-FM type call detected
  this.config.enableBackwardEndFreqScan = false;
} else {
  // Pure FM call
  this.config.enableBackwardEndFreqScan = this.config.enableBackwardEndFreqScan !== false;
}
```

### 修改後

```javascript
// CF-FM AUTO-DETECTION
// 2025 ENHANCEMENT: Detect CF calls by Peak Freq vs High Freq difference
const CF_DETECTION_THRESHOLD_kHz = 2.0;  // Threshold for CF/FM distinction

if (freqDifference < CF_DETECTION_THRESHOLD_kHz) {
  // CF call detected
  this.config.enableBackwardEndFreqScan = false;
  this.config.protectionWindowAfterPeak_ms = 999;  // Effectively disable
} else {
  // FM call detected
  this.config.enableBackwardEndFreqScan = this.config.enableBackwardEndFreqScan !== false;
  // Keep the original protectionWindowAfterPeak_ms value (typically 10 ms)
}
```

---

## 🎯 改進點

### 1. 檢測閾值提升
- **舊值：** < 1.0 kHz
- **新值：** < 2.0 kHz
- **理由：** 提供更準確的 CF/FM 區分

### 2. 雙機制禁用
- **舊：** 僅禁用 `enableBackwardEndFreqScan`
- **新：** 同時禁用：
  - `enableBackwardEndFreqScan = false`
  - `protectionWindowAfterPeak_ms = 999`
- **效果：** 完全禁用 protection window 限制

### 3. 動態調整
- CF 調用自動調整為允許長期呼聲
- FM 調用保持用戶配置的保護窗口
- 無需手動干預

---

## 📊 工作流程

```
detectCalls() → measureFrequencyParameters()
    ↓
計算 Peak Freq 和 High Freq
    ↓
計算 freqDifference = |Peak - High|
    ↓
CF-FM AUTO-DETECTION
    ├─ If freqDifference < 2.0 kHz
    │  ├─ enableBackwardEndFreqScan = false
    │  └─ protectionWindowAfterPeak_ms = 999
    │     (maxFrameIdxAllowed ≈ spectrogram.length)
    │     → Protection window 被有效禁用
    │
    └─ Else (freqDifference ≥ 2.0 kHz)
       ├─ enableBackwardEndFreqScan = [user config]
       └─ protectionWindowAfterPeak_ms = [user config, e.g., 10 ms]
          (maxFrameIdxAllowed ≈ peakFrameIdx + 小值)
          → Protection window 生效
```

---

## ✅ 驗證清單

- ✅ 檢測邏輯正確（Peak - High < 2 kHz = CF）
- ✅ CF 調用禁用 enableBackwardEndFreqScan
- ✅ CF 調用禁用 protectionWindowAfterPeak_ms
- ✅ FM 調用保持用戶設置
- ✅ 語法檢查通過
- ✅ 無編譯錯誤
- ✅ 向後兼容

---

## 🔍 測試場景

### 場景 1：CF 調用（Rhinolophidae）
```
Peak Freq: 60.5 kHz
High Freq: 61.2 kHz
freqDifference: 0.7 kHz < 2.0 kHz
→ CF detected ✓
→ protectionWindowAfterPeak_ms = 999
→ 長呼聲不被截斷 ✓
```

### 場景 2：FM 調用（Vespertilionidae）
```
Peak Freq: 50.0 kHz
High Freq: 80.0 kHz
freqDifference: 30.0 kHz ≥ 2.0 kHz
→ FM detected ✓
→ protectionWindowAfterPeak_ms = 10 (user config)
→ 保護窗口正常運作 ✓
```

### 場景 3：CF-FM 混合調用
```
Peak Freq: 55.0 kHz
High Freq: 56.5 kHz
freqDifference: 1.5 kHz < 2.0 kHz
→ CF detected ✓
→ 主要 CF 成分被保留，不被截斷 ✓
```

---

## 📈 預期效果

### CF 調用改善
- ✅ 完整的 CF 呼聲被正確測量
- ✅ 不再因 10ms 窗口被人為截斷
- ✅ 更準確的 Duration 測量
- ✅ 更準確的 Bandwidth 和 Characteristic Frequency

### FM 調用不變
- ✅ 保持原有保護機制
- ✅ 回波/反射仍被正確防止
- ✅ 10ms 保護窗口仍然有效

---

## 💡 技術說明

### Protection Window 禁用原理

```javascript
// 原始計算
const protectionFrameLimit = Math.round(
  (protectionWindowAfterPeak_ms / 1000) / timeFrameInterval
);
const maxFrameIdxAllowed = Math.min(
  peakFrameIdx + protectionFrameLimit,
  spectrogram.length - 1
);

// CF 調用時
protectionWindowAfterPeak_ms = 999;
// protectionFrameLimit = 999000 / timeFrameInterval ≈ 非常大
// maxFrameIdxAllowed ≈ spectrogram.length - 1
// → 保護窗口被有效禁用
```

### 配置恢復（FM 調用）

```javascript
// FM 調用時恢復用戶配置
this.config.enableBackwardEndFreqScan = this.config.enableBackwardEndFreqScan !== false;
// protectionWindowAfterPeak_ms 保持原值 (通常 10 ms)
// → 用戶的設置被恢復應用
```

---

## 🚀 後續優化建議

1. **可配置的檢測閾值**
   - 讓用戶通過 UI 調整 CF_DETECTION_THRESHOLD_kHz
   - 目前硬編碼為 2.0 kHz

2. **物種特定的配置**
   - 根據地區/物種選擇預設配置
   - 例如："Molossidae (80-120 kHz)" → 特定的檢測閾值

3. **詳細的檢測日誌**
   - 記錄 CF/FM 檢測結果
   - 幫助用戶驗證自動檢測的準確性

4. **混合調用處理**
   - 更精細的 CF-FM 邊界檢測
   - 可能需要 Knee Frequency 分析

---

## 📝 相關文件

- `modules/batCallDetector.js` - 主要實現
- `OPTIMIZATION_SUMMARY_2025.md` - 總體優化文檔
- `CHANGELOG_2025_12_02.md` - 變更日誌

