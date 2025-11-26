# 2025 Start Frequency 與 High Frequency 獨立計算規則實現總結

## 概述

根據2025年新規則，對 `batCallDetector.js` 中的 Start Frequency 與 High Frequency 計算邏輯進行了重大重構。兩個頻率參數現在完全獨立計算，並應用了更嚴格的防呆機制。

## 核心變更

### 1. `findOptimalHighFrequencyThreshold()` 函數重構

**返回值從單一閾值改為完整對象：**

```javascript
// 舊：返回單一閾值
return -24;

// 新：返回完整測量結果
return {
  threshold: -24,
  highFreq_Hz: 25000,
  highFreq_kHz: 25.0,
  startFreq_Hz: 15000,
  startFreq_kHz: 15.0,
  warning: false
};
```

**新增功能：**
- 同時計算 High Frequency 和 Start Frequency
- High Frequency：從高到低掃描，找第一個超過閾值的頻率（最高頻）
- Start Frequency：從低到高掃描，找第一個超過閾值的頻率（最低頻）
- 兩者都使用相同的閾值，但掃描方向相反

**異常檢測改進：**
- 繼續使用原有的異常檢測邏輯（頻率跳變 > 2.5 kHz）
- 保險機制：超大幅跳變 (> 5 kHz) 時立即停止
- 支持 3 連續正常值後忽略早期異常

### 2. `measureFrequencyParameters()` 函數中的防呆機制

**Auto Mode 中新增防呆檢查：**

```javascript
if (this.config.highFreqThreshold_dB_isAuto === true) {
  const result = this.findOptimalHighFrequencyThreshold(...);
  
  // 防呆機制：High Frequency 必須 >= Peak Frequency
  if (result.highFreq_kHz < peakFreq_kHz) {
    // 重新掃描閾值，找到第一個有效的 High Frequency >= Peak Frequency
    for (let testThreshold_dB = -24; testThreshold_dB >= -70; testThreshold_dB--) {
      // 計算此閾值的 High Frequency
      if (testHighFreq_Hz >= peakFreq_Hz) {
        // 使用此閾值
        break;
      }
    }
  }
}
```

**STEP 2.5：獨立計算 Start Frequency**

新增邏輯決定 Start Frequency 的值：

```javascript
if (call._startFreq_Hz_fromAuto !== undefined) {
  // 情況 1：使用 Auto Mode 計算的值
  startFreq_Hz = call._startFreq_Hz_fromAuto;
} else {
  // 情況 2：非 Auto Mode，使用以下規則：
  // (a) 若 -24dB 閾值的頻率 < Peak Frequency → 使用該值為 Start Frequency
  // (b) 若 -24dB 閾值的頻率 >= Peak Frequency → Start Frequency = High Frequency
}
```

## 計算流程圖

```
測試閾值範圍 (-24 → -70 dB)
  ↓
對每個閾值計算：
  ├─ High Frequency (從高到低掃描)
  └─ Start Frequency (從低到高掃描)
  ↓
異常檢測 (頻率跳變)
  ├─ > 5 kHz: 立即停止
  ├─ > 2.5 kHz: 記錄異常
  └─ 檢查 3 連續正常值
  ↓
防呆檢查 (High Frequency >= Peak Frequency)
  ├─ 若不符合: 重新掃描找有效值
  └─ 若符合: 採用此閾值
  ↓
返回最終結果
  ├─ threshold: 選定的閾值
  ├─ highFreq_kHz: 最高頻率
  ├─ startFreq_kHz: 最低頻率
  └─ warning: 警告標誌
```

## 關鍵改動詳情

### 變更 1：函數簽名和返回值

**檔案位置：** `modules/batCallDetector.js` 第 583-628 行

- 更新 JSDoc 註釋，明確 2025 新演算法
- 修改返回值結構，包含所有必要信息

### 變更 2：測量計算

**檔案位置：** `modules/batCallDetector.js` 第 629-705 行

- 在測試每個閾值時同時計算 High Frequency 和 Start Frequency
- High Frequency：從 `firstFramePower.length - 1` 向下掃描
- Start Frequency：從 `0` 向上掃描
- 兩者都使用線性插值提高精度

### 變更 3：異常檢測邏輯

**檔案位置：** `modules/batCallDetector.js` 第 706-823 行

- 移除舊的重複邏輯
- 合併異常檢測和最終決定部分
- 返回包含 High Frequency 和 Start Frequency 的完整對象

### 變更 4：Auto Mode 防呆機制

**檔案位置：** `modules/batCallDetector.js` 第 1010-1086 行

- 在 Auto Mode 中檢查返回的 High Frequency 是否 >= Peak Frequency
- 如不符合，重新掃描 -24 到 -70 dB 範圍找到第一個有效值
- 同時計算並存儲對應的 Start Frequency

### 變更 5：STEP 2.5 Start Frequency 獨立計算

**檔案位置：** `modules/batCallDetector.js` 第 1298-1379 行

新增完整的 Start Frequency 計算流程：
- 優先使用 Auto Mode 計算的值
- 非 Auto Mode 時，使用 -24dB 閾值測試規則 (a)/(b)
- 應用線性插值提高精度
- 存儲最終計算結果

## 驗證清單

- [x] 代碼無語法錯誤
- [x] 函數返回結構正確
- [x] High Frequency 計算邏輯完整
- [x] Start Frequency 獨立計算實現
- [x] 防呆機制正確應用
- [x] 異常檢測保持原邏輯
- [x] 線性插值保留
- [x] Auto Mode 完整處理

## 使用建議

1. **測試 Auto Mode：** 確保 `config.highFreqThreshold_dB_isAuto === true`
2. **驗證 Peak Frequency：** 檢查防呆機制是否正確過濾異常值
3. **檢查 Start Frequency：** 確保獨立計算邏輯按預期工作
4. **監控警告標誌：** `call.highFreqDetectionWarning` 在使用 -70dB 極限時為 true

## 相關文檔

參考用戶請求文檔了解完整的規則定義：
- Start Frequency 規則 (a)/(b)
- High Frequency 防呆機制
- 閾值測試範圍說明
