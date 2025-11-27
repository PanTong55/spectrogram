# 低頻優化快速参考 (2025)

## 切換自動模式

### 啟用自動化
```javascript
// 全域
DEFAULT_DETECTION_CONFIG.lowFreqThreshold_dB_isAuto = true;

// 或單個檢測器實例
detector.config.lowFreqThreshold_dB_isAuto = true;
```

### 禁用自動化（回到手動模式）
```javascript
detector.config.lowFreqThreshold_dB_isAuto = false;
detector.config.lowFreqThreshold_dB = -27;  // 使用固定值
```

---

## 配置組合建議

### 情況 1: 標準蝙蝠檢測（建議）
```javascript
{
  highFreqThreshold_dB_isAuto: false,
  highFreqThreshold_dB: -24,
  lowFreqThreshold_dB_isAuto: false,
  lowFreqThreshold_dB: -27,
  enableBackwardEndFreqScan: true
}
```

### 情況 2: 嘈雜環境（自動適應）
```javascript
{
  highFreqThreshold_dB_isAuto: true,   // 自動適應高頻
  lowFreqThreshold_dB_isAuto: true,    // 自動適應低頻
  enableBackwardEndFreqScan: true
}
```

### 情況 3: 保守測量（CF 蝙蝠）
```javascript
{
  highFreqThreshold_dB: -18,  // 更寬鬆的高頻邊界
  lowFreqThreshold_dB: -24,   // 更寬鬆的低頻邊界
  enableBackwardEndFreqScan: false
}
```

### 情況 4: 最大精度（FM 蝙蝠）
```javascript
{
  highFreqThreshold_dB_isAuto: true,
  lowFreqThreshold_dB_isAuto: true,
  enableBackwardEndFreqScan: true
}
```

---

## 工作流程

```
┌─────────────────────┐
│ 開始測量 call      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ 計算 peakFreq, peakPower（穩定值）  │
└──────────┬──────────────────────────┘
           │
           ▼
     ┌─────────────┐
     │ Auto High?  │
     └──┬──────┬──┘
        │是    │否
        ▼      ▼
    [優化]  [固定]
        │      │
        └──┬──┘
           ▼
┌─────────────────────────────────────┐
│ 計算 High Frequency + Start Freq    │
└──────────┬──────────────────────────┘
           │
           ▼
     ┌─────────────┐
     │ Auto Low?   │
     └──┬──────┬──┘
        │是    │否
        ▼      ▼
    [優化]  [固定]
        │      │
        └──┬──┘
           ▼
┌─────────────────────────────────────┐
│ 計算 Low Frequency + End Freq       │
│ 驗證 + 與 Start Freq 比較           │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ 計算 Characteristic Freq 等參數     │
└──────────┬──────────────────────────┘
           │
           ▼
      完成測量
```

---

## 調試技巧

### 檢查使用的實際閾值
```javascript
console.log('High Freq Threshold:', detector.config.highFreqThreshold_dB);
console.log('Low Freq Threshold:', detector.config.lowFreqThreshold_dB);
console.log('Using Auto?', detector.config.lowFreqThreshold_dB_isAuto);
```

### 查看驗證詳情
```javascript
console.log('Low Freq Validation:', call._lowFreqValidation);
// 顯示：
// {
//   valid: true,
//   confidence: 0.95,
//   interpolationRatio: 0.35,
//   powerRatio_dB: 8.5,
//   frequencySpread_kHz: 15.3,
//   rebounceCompat: 'verified'
// }
```

### 檢查警告
```javascript
if (call.lowFreqDetectionWarning) {
  console.warn('Low frequency reached -70dB limit!');
}
if (call.highFreqDetectionWarning) {
  console.warn('High frequency reached -70dB limit!');
}
```

---

## 常見問題

### Q: 自動模式如何選擇最佳閾值？
A: 測試 -24 到 -70 dB，檢測頻率跳變：
- 大于 5 kHz → 停止，用異常前值
- 2.5-5 kHz → 記錄為異常
- < 2.5 kHz → 正常，繼續
- 異常後 3+ 正常值 → 忽略異常

### Q: 自動模式會影響 anti-bounce 嗎？
A: 否。Anti-bounce 在 STEP 1.5 已設定時間邊界。自動優化只改變閾值，不改變邊界。

### Q: 為什麼不同閾值會得到不同的低頻？
A: 更寬鬆的閾值（-70dB）檢測更多頻率bin，可能找到更低的頻率。選擇點是在測試過程中檢測異常。

### Q: 應該何時啟用自動模式？
A: 當您有多種蝙蝠種類或不同錄音條件時。標準用途建議保持關閉（使用固定 -27dB）。

### Q: 自動模式的計算成本？
A: 額外 ~0.5-1 ms（低頻優化 70 次測試）。總體影響可忽略。

---

## 性能優化

### 快速失敗機制
- 如果測試發現無效 bin → 停止此閾值測試
- 大幅頻率跳變 (> 5 kHz) → 立即終止所有測試

### 推薦設定
- 對於實時檢測：保持自動模式關閉
- 對於批量分析：啟用自動模式獲得最佳結果
- 對於 UI 預覽：使用固定 -24dB 或 -27dB 保持速度

---

## 集成檢查表

- [x] `DEFAULT_DETECTION_CONFIG` 添加配置項
- [x] `findOptimalLowFrequencyThreshold()` 實現
- [x] `measureFrequencyParameters()` 集成自動優化
- [x] 防呆檢查（lowFreq ≤ peakFreq）
- [x] 驗證函數兼容性
- [x] Anti-bounce 相容性測試
- [x] 異常檢測邏輯對稱

---

## 2025 更新摘要

| 組件 | 變更 |
|------|------|
| 配置 | +2 項新設定 |
| 方法 | +1 新方法 (findOptimalLowFrequencyThreshold) |
| 流程 | 在 STEP 3 前後添加自動優化邏輯 |
| 相容性 | 100% 向后相容（預設關閉） |

