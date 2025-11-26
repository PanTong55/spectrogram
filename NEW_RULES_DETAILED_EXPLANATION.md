# Start Frequency 與 High Frequency 新規則詳細說明

## 概述

根據2025年新規則，Start Frequency 與 High Frequency 的計算邏輯已經完全重構，兩者現在獨立計算且有各自的防呆機制。

## 新規則 1：Start Frequency 與 High Frequency 必須獨立計算

### 核心原則
- **之前：** Start Frequency = High Frequency（預設相同）
- **現在：** 兩者獨立計算，可能不同

### 計算方法

#### High Frequency 計算
```
使用 findOptimalHighFrequencyThreshold() 中選定的閾值
從高頻向低頻掃描第一幀頻譜
找到第一個超過閾值的頻率 bin
↓
線性插值獲得更高精度
↓
此頻率即為 High Frequency（最高頻）
```

#### Start Frequency 計算
```
同時在 findOptimalHighFrequencyThreshold() 中計算
從低頻向高頻掃描第一幀頻譜
使用相同的閾值，但掃描方向相反
↓
線性插值獲得更高精度
↓
此頻率即為 Start Frequency（最低頻）
```

### 主要優勢
- **更準確的頻率邊界檢測：** 兩個方向的掃描可捕捉更複雜的頻譜結構
- **防止信息丟失：** 不再假設起點和終點使用相同的頻率
- **支持複雜信號：** CF-FM 混合信號的邊界檢測更準確

---

## 新規則 2：Start Frequency 的獨立定義與計算

### 計算邏輯

在「Find optimal high frequency threshold」流程中，會從 -24dB 開始逐步往下測試到 -70dB。

**根據以下規則決定 Start Frequency：**

#### 規則 (a)：-24dB 閾值結果低於 Peak Frequency
```
若 -24dB 閾值所偵測到的頻率 < Peak Frequency：
  ↓
立即將此 -24dB 偵測到的頻率
（此時必然是整個頻譜中最左邊/最低頻的邊界）
↓
標記為 Start Frequency
```

**例子：**
```
Peak Frequency = 25 kHz
-24dB 閾值掃描到的最低頻率 = 20 kHz

20 kHz < 25 kHz ✓ 滿足規則 (a)
→ Start Frequency = 20 kHz
```

#### 規則 (b)：-24dB 閾值結果高於或等於 Peak Frequency
```
若 -24dB 閾值偵測到的頻率 >= Peak Frequency：
  ↓
Start Frequency = High Frequency
（與現行邏輯相同）
```

**例子：**
```
Peak Frequency = 25 kHz
-24dB 閾值掃描到的最低頻率 = 26 kHz

26 kHz >= 25 kHz ✗ 規則 (a) 不滿足
→ Start Frequency = High Frequency（使用優化閾值的結果）
```

### 實現位置
- **Auto Mode：** `measureFrequencyParameters()` 函數第 1010-1086 行
- **STEP 2.5：** `measureFrequencyParameters()` 函數第 1240-1305 行

---

## 新規則 3：High Frequency 的優化機制（確保不會低於 Peak Frequency）

### 核心防呆邏輯

在「Find optimal high frequency threshold」流程中，逐一測試每個閾值時（-24dB → -70dB），必須額外加入以下防呆判斷：

```
若某個閾值計算出的 High Frequency < Peak Frequency：
  ↓
視為異常結果，不得採用此值作為 High Frequency
  ↓
必須丟棄並繼續測試下一個更低的閾值（-25dB、-26dB...）
  ↓
一直測試到找到第一個 >= Peak Frequency 的 High Frequency 為止
  ↓
才正式採用該值作為最終的 High Frequency
```

### 詳細流程圖

```
開始 Auto Mode
  ↓
findOptimalHighFrequencyThreshold() 返回初步結果
  ↓
檢查: result.highFreq_kHz >= Peak Frequency ?
  ├─ YES → 採用此結果，進行規則 (b) 判斷 Start Frequency
  │
  └─ NO → 執行防呆重掃
      ↓
      從 -24dB 到 -70dB 重新測試每個閾值
      ↓
      為每個閾值計算 High Frequency
      ↓
      檢查: testHighFreq_Hz >= peakFreq_Hz ?
        ├─ YES → 找到有效值！
        │        計算對應的 Start Frequency
        │        記錄此閾值和頻率值
        │        結束搜索
        │
        └─ NO → 繼續下一個更低的閾值
                (-25dB, -26dB, ...)
      ↓
採用找到的第一個有效值
```

### 實現位置
- **防呆邏輯：** `measureFrequencyParameters()` 函數第 1010-1086 行
  - 檢查並驗證 High Frequency >= Peak Frequency
  - 若不符合，重新掃描找到第一個有效值

### 邏輯保障

1. **永遠有效：** 至少 -70dB 閾值會給出結果（如果頻譜有內容）
2. **單調性：** 更低的閾值（更寬鬆）會得到更高的頻率
3. **生物學合理性：** Peak Frequency 是能量最大點，High Frequency 必然 >= Peak Frequency

### 特殊情況處理

#### 情況 1：選擇區域未覆蓋足夠高頻率
```
即使 -70dB 也找不到有效 High Frequency
  ↓
警告標誌設置: call.highFreqDetectionWarning = true
返回值: threshold = -70, warning = true
```

#### 情況 2：複雜頻譜結構
```
異常檢測（> 2.5 kHz 跳變）可能中斷搜索
  ↓
採用異常前的最後有效值
↓
防呆檢查確保此值 >= Peak Frequency
```

---

## 計算流程整體圖

```
detectCalls() → findOptimalHighFrequencyThreshold()
  │
  ├─ 測試所有閾值 (-24 → -70 dB)
  │  ├─ 計算 High Frequency (高→低掃描)
  │  └─ 計算 Start Frequency (低→高掃描)
  │
  ├─ 異常檢測
  │  ├─ > 5 kHz 跳變: 立即停止
  │  ├─ > 2.5 kHz 跳變: 記錄異常
  │  └─ 3 連續正常值: 忽略異常
  │
  └─ 返回最優結果
     {threshold, highFreq_kHz, startFreq_kHz, warning}
       ↓
measureFrequencyParameters()
  │
  ├─ Auto Mode: 防呆檢查 High Frequency >= Peak Frequency
  │
  ├─ STEP 2: 獲取 High Frequency
  │          (從 findOptimalHighFrequencyThreshold 或重新掃描)
  │
  ├─ STEP 2.5: 獨立計算 Start Frequency
  │            ├─ 規則 (a): 若 -24dB < Peak Frequency → 使用該值
  │            └─ 規則 (b): 否則 → Start Frequency = High Frequency
  │
  ├─ STEP 3: 計算 Low Frequency (從最後一幀, -27dB 固定)
  │
  └─ 返回完整的 BatCall 對象
     含 peakFreq, highFreq, startFreq, lowFreq
```

---

## 變數定義與類型

### BatCall 對象屬性

```javascript
call.peakFreq_kHz     // Peak frequency (kHz) - 能量最大點
call.highFreq_kHz     // High frequency (kHz) - 最高頻率（獨立計算）
call.startFreq_kHz    // Start frequency (kHz) - 最低頻率（規則 a/b）
call.lowFreq_kHz      // Low frequency (kHz) - 最後一幀的最低頻
```

### findOptimalHighFrequencyThreshold 返回值

```javascript
{
  threshold: -24 to -70,      // 選定的最優閾值 (dB)
  highFreq_Hz: number | null, // 高頻率 (Hz)
  highFreq_kHz: number | null,// 高頻率 (kHz)
  startFreq_Hz: number | null,// 低頻率 (Hz)
  startFreq_kHz: number | null,// 低頻率 (kHz)
  warning: boolean            // -70dB 警告標誌
}
```

---

## 驗證與測試建議

### 檢查清單

- [ ] High Frequency 始終 >= Peak Frequency
- [ ] Start Frequency 正確應用規則 (a)/(b)
- [ ] Auto Mode 防呆重掃工作正常
- [ ] 異常檢測邏輯保留
- [ ] 線性插值提高精度
- [ ] toAnalysisRecord() 包含 startFreq

### 測試用例

#### 用例 1：FM 信號（降頻掃描）
```
輸入: 30 kHz 起點，15 kHz 終點的 FM 呼叫
Peak Frequency: 29 kHz
預期結果:
  - High Frequency = 29-30 kHz (規則 a)
  - Start Frequency = ~20 kHz (規則 a: 低於 Peak)
  - Low Frequency = 15-16 kHz
```

#### 用例 2：CF 信號（常頻）
```
輸入: 25 kHz 恆定頻率的 CF 呼叫
Peak Frequency: 25 kHz
預期結果:
  - High Frequency = 25-26 kHz (規則 a)
  - Start Frequency = 25-26 kHz (規則 b: >= Peak)
  - Low Frequency = 24-25 kHz
```

#### 用例 3：CF-FM 混合
```
輸入: 26 kHz CF 段 + 15 kHz FM 段的混合呼叫
Peak Frequency: 26 kHz
預期結果:
  - High Frequency = 26-27 kHz (規則 a)
  - Start Frequency = 20-24 kHz (規則 a: 低於 Peak)
  - Low Frequency = 14-15 kHz
```

---

## 回顧與總結

新規則通過**獨立計算**和**防呆機制**確保：

1. ✓ Start Frequency 與 High Frequency 的計算完全獨立
2. ✓ High Frequency 永遠不低於 Peak Frequency（由防呆保證）
3. ✓ Start Frequency 遵循明確的規則 (a)/(b)
4. ✓ 支持複雜的 CF-FM 混合信號
5. ✓ 向後兼容 Non-Auto Mode 計算

