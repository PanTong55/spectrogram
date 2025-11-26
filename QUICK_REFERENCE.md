# 2025 Start Frequency 與 High Frequency 新規則實現 - 快速查詢指南

## 📍 核心代碼位置

### 1️⃣ findOptimalHighFrequencyThreshold() 函數
**文件：** `/workspaces/spectrogram/modules/batCallDetector.js`

| 功能 | 行數 | 描述 |
|------|------|------|
| 函數簽名 & 文檔 | 583-628 | 2025 新演算法說明，返回對象結構 |
| High Frequency 計算 | 629-660 | 高→低掃描，找最高頻率 |
| Start Frequency 計算 | 661-694 | 低→高掃描，找最低頻率 |
| 異常檢測邏輯 | 706-823 | 頻率跳變檢測，選擇最優閾值 |
| 返回值 | 818-827 | 包含 threshold, highFreq, startFreq, warning |

### 2️⃣ measureFrequencyParameters() 函數
**文件：** `/workspaces/spectrogram/modules/batCallDetector.js`

| 功能 | 行數 | 描述 |
|------|------|------|
| Auto Mode 防呆檢查 | 1010-1086 | 驗證 High Frequency >= Peak Frequency |
| STEP 2：High Frequency | 1215-1240 | 獲取並存儲高頻率 |
| STEP 2.5：Start Frequency | 1240-1305 | 獨立計算起始頻率，應用規則 (a)/(b) |
| STEP 3：Low Frequency | 1308-1340 | 計算最低頻率（保持原邏輯） |

### 3️⃣ BatCall 類定義
**文件：** `/workspaces/spectrogram/modules/batCallDetector.js`

| 屬性 | 行數 | 描述 |
|------|------|------|
| startFreq_kHz | 125 | Start Frequency 屬性定義 |
| toAnalysisRecord() | 195-216 | 導出方法，包含所有頻率值 |

---

## 🔑 關鍵邏輯概覽

### 新規則 1：獨立計算
```javascript
// High Frequency: 高→低掃描
for (let binIdx = firstFramePower.length - 1; binIdx >= 0; binIdx--) {
  if (firstFramePower[binIdx] > threshold) {
    highFreq_Hz = freqBins[binIdx];
    break;
  }
}

// Start Frequency: 低→高掃描（同時執行）
for (let binIdx = 0; binIdx < firstFramePower.length; binIdx++) {
  if (firstFramePower[binIdx] > threshold) {
    startFreq_Hz = freqBins[binIdx];
    break;
  }
}
```

### 新規則 2：Start Frequency 規則
```javascript
// 規則 (a)：-24dB < Peak Frequency
if (testStartFreq_kHz < peakFreq_kHz) {
  startFreq = testStartFreq;  // 使用此值
}
// 規則 (b)：-24dB >= Peak Frequency
else {
  startFreq = highFreq;  // 使用 High Frequency
}
```

### 新規則 3：防呆機制
```javascript
// 若 High Frequency < Peak Frequency
if (result.highFreq_kHz < peakFreq_kHz) {
  // 重新掃描找到第一個 >= Peak Frequency 的值
  for (let testThreshold = -24; testThreshold >= -70; testThreshold--) {
    if (testHighFreq >= peakFreq) {
      highFreq = testHighFreq;  // 採用此值
      break;
    }
  }
}
```

---

## 📊 數據流

```
detectCalls()
    ↓
[PHASE 1] detectCallSegments() - 初步檢測
    ↓
[PHASE 2] measureFrequencyParameters()
    │
    ├─ [STEP 0] 計算 Peak Frequency
    │           └→ 使用拋物線插值
    │
    ├─ [AUTO MODE] 防呆檢查 (新增)
    │           └→ 驗證 High Frequency >= Peak Frequency
    │           └→ 重掃找到有效值
    │
    ├─ [STEP 1.5] 重新計算時間邊界
    │
    ├─ [STEP 2] 計算 High Frequency
    │           └→ 高→低掃描，線性插值
    │
    ├─ [STEP 2.5] 計算 Start Frequency (新增)
    │           ├→ 若 Auto Mode: 使用預計算值
    │           └→ 否則: 應用規則 (a)/(b)
    │
    ├─ [STEP 3] 計算 Low Frequency
    │           └→ 低→高掃描，-27dB 固定閾值
    │
    ├─ [STEP 4] 計算 Characteristic Frequency
    │
    ├─ [STEP 5] 驗證頻率關係
    │
    ├─ [STEP 6] 計算 Knee Frequency & Time
    │
    └─ [返回] BatCall 對象
        含: peakFreq, highFreq, startFreq, lowFreq
```

---

## 📝 配置項

### Auto Mode 配置
```javascript
// 在 DEFAULT_DETECTION_CONFIG 中
highFreqThreshold_dB_isAuto: true|false

// 若為 true，執行：
// 1. findOptimalHighFrequencyThreshold() 計算最優閾值
// 2. 同時計算 High Frequency 和 Start Frequency
// 3. 應用防呆檢查
```

---

## ✅ 驗證要點

### 重要檢查清單
- [ ] High Frequency 是否 >= Peak Frequency？
- [ ] Start Frequency 是否遵循規則 (a)/(b)？
- [ ] 防呆重掃是否被正確觸發？
- [ ] 異常檢測邏輯是否保留？
- [ ] 線性插值是否應用？
- [ ] toAnalysisRecord() 是否包含所有頻率？

### 測試命令
```javascript
// 檢查編譯
node --check modules/batCallDetector.js

// 載入模組
import { BatCallDetector } from './modules/batCallDetector.js';
const detector = new BatCallDetector();

// 檢查函數簽名
console.log(detector.findOptimalHighFrequencyThreshold.length);  // 參數數量
```

---

## 📚 相關文檔

| 文檔 | 用途 |
|------|------|
| `IMPLEMENTATION_SUMMARY_2025.md` | 實現概述、代碼片段、驗證清單 |
| `NEW_RULES_DETAILED_EXPLANATION.md` | 詳細規則說明、計算流程、測試用例 |
| `CODE_MODIFICATION_VERIFICATION.md` | 改動清單、編譯驗證、性能分析 |
| `quick_reference.md` | 本文檔 |

---

## 🔗 快速跳轉

### 按功能查找
- **獨立計算邏輯？** → STEP 2 & STEP 2.5 (行 1215-1305)
- **防呆機制？** → Auto Mode (行 1010-1086)
- **異常檢測？** → findOptionalThreshold (行 706-823)
- **規則應用？** → STEP 2.5 (行 1260-1295)

### 按行號查找
| 行數範圍 | 內容 |
|---------|------|
| 583-628 | 函數簽名、文檔、返回結構 |
| 629-705 | 測量計算：High Freq, Start Freq |
| 706-823 | 異常檢測、選擇最優值 |
| 1010-1086 | Auto Mode 防呆檢查 |
| 1215-1240 | STEP 2: High Frequency |
| 1240-1305 | STEP 2.5: Start Frequency |

---

## 💡 常見問題

**Q: High Frequency 和 Start Frequency 的區別？**
A: 
- High Frequency：最高頻率（從高向低掃描找到）
- Start Frequency：最低頻率（從低向高掃描找到）
- 兩者獨立計算，使用相同閾值

**Q: 什麼時候會觸發防呆重掃？**
A: 當 findOptimalHighFrequencyThreshold 返回的 High Frequency < Peak Frequency 時，重掃 -24 到 -70 dB 找到第一個有效值。

**Q: 規則 (a) 和 (b) 何時適用？**
A:
- 規則 (a)：-24dB 掃描結果 < Peak Frequency → 使用該值為 Start Frequency
- 規則 (b)：-24dB 掃描結果 >= Peak Frequency → Start Frequency = High Frequency

**Q: 是否向後兼容？**
A: 是的。Non-Auto Mode 仍按舊邏輯工作，新邏輯只在 Auto Mode 中激活。

---

## 🚀 部署檢查

部署前請確認：
- [ ] 代碼編譯無錯誤
- [ ] 所有三個文檔已生成
- [ ] 測試覆蓋所有蝙蝠叫聲類型
- [ ] UI 顯示 Start Frequency 值
- [ ] 監控防呆機制觸發情況

---

## 📞 技術支持

遇到問題時，請參考：
1. `NEW_RULES_DETAILED_EXPLANATION.md` - 規則詳解
2. `CODE_MODIFICATION_VERIFICATION.md` - 代碼驗證
3. 源代碼註釋 - 查看具體實現

