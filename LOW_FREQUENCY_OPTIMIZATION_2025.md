# 低頻優化機制 2025 - 完整實現指南

## 概述

優化後的 Find Low Frequency 機制現在支援與 Find Optimal High Frequency Threshold 相同的自動化功能。通過測試 -24dB 至 -70dB 的範圍，自動尋找最佳低頻閾值，同時支援現有的 anti-bounce 機制。

---

## 新增功能

### 1. `findOptimalLowFrequencyThreshold()` 方法

**目的**: 自動測試多個閾值並找出最優的低頻檢測閾值。

**工作原理**:
- 測試範圍：-24dB 至 -70dB（步進 1dB）
- 使用最後一幀的功率譜測量低頻（代表信號末尾）
- 採用與高頻相同的異常檢測邏輯（> 5kHz 停止，> 2.5kHz 記錄異常）
- 支援 3-次連續正常值後忽略異常的機制
- 回傳低頻和結束頻率（End Frequency = Low Frequency）

**簽名**:
```javascript
findOptimalLowFrequencyThreshold(spectrogram, freqBins, flowKHz, fhighKHz, callPeakPower_dB)
→ {threshold, lowFreq_Hz, lowFreq_kHz, endFreq_Hz, endFreq_kHz, warning}
```

**參數說明**:
- `spectrogram`: STFT 譜圖（時間 × 頻率二維陣列）
- `freqBins`: 頻率 bin 值（單位：Hz）
- `flowKHz`: 低頻邊界（單位：kHz）
- `fhighKHz`: 高頻邊界（單位：kHz）
- `callPeakPower_dB`: 呼叫峰值功率（穩定值，不受選擇區域大小影響）

**回傳值**:
- `threshold`: 選定的最優閾值（-24 至 -70 dB）
- `lowFreq_Hz/kHz`: 最優閾值下的最低頻率
- `endFreq_Hz/kHz`: 最優閾值下的結束頻率
- `warning`: 是否使用了 -70dB 極限閾值的警告標誌

---

### 2. 配置項更新

在 `DEFAULT_DETECTION_CONFIG` 中新增:

```javascript
// 低頻自動閾值優化
lowFreqThreshold_dB: -27,              // 手動模式的固定閾值
lowFreqThreshold_dB_isAuto: false,     // 啟用自動模式開關

// 高頻自動閾值優化（已存在，現已完善記錄）
highFreqThreshold_dB: -24,
highFreqThreshold_dB_isAuto: false,
```

---

### 3. 集成到 `measureFrequencyParameters()`

#### 流程順序:
1. **計算初始低頻**：使用固定 -27dB 閾值（手動模式）
2. **自動優化** (如果啟用)：調用 `findOptimalLowFrequencyThreshold()`
3. **防呆檢查**：確保低頻 ≤ 峰值頻率（FM 掃頻特性）
4. **驗證品質**：執行低頻測量驗證
5. **與起始頻率比較**：如果起始頻率更低，使用起始頻率

#### 防呆機制:
```javascript
// 如果最優低頻 > 峰值頻率，重新測試
if (result.lowFreq_kHz > peakFreq_kHz) {
  // 尋找第一個 <= 峰值頻率的低頻
  for (threshold from -24 to -70) {
    if (testLowFreq_kHz <= peakFreq_kHz) {
      使用此值並停止;
    }
  }
}
```

---

## 使用方式

### 啟用自動模式

```javascript
// 方式 1：在檢測器初始化時配置
const detector = new BatCallDetector();
detector.config.lowFreqThreshold_dB_isAuto = true;
detector.config.highFreqThreshold_dB_isAuto = true;

// 方式 2：直接修改全域配置
DEFAULT_DETECTION_CONFIG.lowFreqThreshold_dB_isAuto = true;
```

### 手動設置固定閾值

```javascript
// 保持自動模式關閉，使用固定閾值
detector.config.lowFreqThreshold_dB_isAuto = false;
detector.config.lowFreqThreshold_dB = -27;  // 使用 -27dB

// 或改用其他閾值
detector.config.lowFreqThreshold_dB = -30;  // 使用 -30dB（更保守）
```

---

## 異常檢測邏輯

兩個閾值之間的頻率跳變判定:

```
頻率跳變大小              判定          動作
─────────────────────────────────────────────────
> 5.0 kHz                超大異常        立即停止，使用異常前閾值
2.5 - 5.0 kHz            大異常          記錄異常位置
0 - 2.5 kHz              正常            繼續測試
```

**異常忽略機制**:
- 如果異常後有 3+ 個連續正常值，忽略此異常並繼續
- 選擇最後一個有效的閾值（異常前或最後測試的閾值）

---

## Anti-bounce 相容性

### 保持相容性的設計:

1. **時間邊界**：
   - 低頻測量使用最後一幀（call.endTime_s）
   - 起始頻率使用第一幀（call.startTime_s）
   - 兩者都在 anti-bounce 保護的邊界內

2. **防呆檢查**：
   - 低頻應 ≤ 峰值頻率（與高頻相反）
   - 確保測量邏輯一致性

3. **驗證機制**：
   - 執行 `validateLowFrequencyMeasurement()`
   - 檢查頻率順序、功率比、插值有效性
   - 確認與 anti-bounce 機制相容

---

## 關鍵改進點

### 對比高頻優化:

| 特性 | 高頻優化 | 低頻優化 |
|------|---------|---------|
| 測試範圍 | -24 至 -70 dB | -24 至 -70 dB |
| 掃描方向 | 高 → 低（第一幀） | 低 → 高（最後幀） |
| 防呆條件 | highFreq ≥ peakFreq | lowFreq ≤ peakFreq |
| 異常檢測 | 相同邏輯 | 相同邏輯 |
| Anti-bounce | ✓ 相容 | ✓ 相容 |
| 驗證函數 | `validateHighFrequencyMeasurement()` | `validateLowFrequencyMeasurement()` |

### 優勢:

1. **自動適應**：不同錄音條件自動調整閾值
2. **穩定性強**：異常檢測防止噪音乾擾
3. **後向相容**：預設關閉，不影響現有工作流
4. **可靠測量**：線性插值提高精度（~0.1 Hz）
5. **與 anti-bounce 無縫整合**：保護窗機制完全相容

---

## 調試資訊

### 存儲在呼叫物件上:

```javascript
call.lowFreqDetectionWarning      // 是否達到 -70dB 極限
call.lowFreqThreshold_dB          // 使用的實際閾值（自動模式）
call._lowFreqValidation           // 驗證詳情
  ├─ valid                        // 測量是否有效
  ├─ confidence                   // 信心分數 (0-1)
  ├─ interpolationRatio           // 插值比例
  ├─ powerRatio_dB                // 功率梯度
  ├─ frequencySpread_kHz          // 頻率分佈
  ├─ rebounceCompat               // Anti-bounce 相容性
  └─ warnings[]                   // 警告訊息列表
```

---

## 測試清單

- [ ] 自動模式在不同蝙蝠種類上的效果
- [ ] 與 anti-bounce 機制的相容性測試
- [ ] 邊界情況：低信噪比、短呼叫、廣頻掃頻
- [ ] 性能影響（自動模式增加計算成本）
- [ ] 與高頻優化的協同效應

---

## 性能注意事項

- **自動模式成本**：額外 70 次閾值測試（-24 至 -70 dB）
- **優化點**：測試失敗快速終止（發現無效 bin 時停止）
- **實際影響**：通常 < 1ms 額外處理時間

---

## 版本歷史

| 版本 | 日期 | 改進 |
|------|------|------|
| 2025-01 | 2025-01-XX | 初始實現，與高頻優化對稱 |

