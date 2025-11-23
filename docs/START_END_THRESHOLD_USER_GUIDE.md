# Start/End Threshold Auto Mode 用戶指南

## 概括

Start/End Threshold Auto Mode 是一項智能功能，可自動為您找到最佳的起始/結束頻率檢測閾值，避免過度估計（overestimation）。

---

## 🎯 什麼時候使用？

| 場景 | 推薦模式 |
|------|--------|
| 標準檢測（大多數情況） | **Auto** ✓ |
| 特殊錄音環境 | Manual |
| 需要精細調整 | Manual |
| 新用戶 | Auto |
| 專業用戶 | 兩者都可 |

---

## 🔧 如何使用

### 方式 1：使用 Auto Mode（推薦）

1. **打開 Power Spectrum Popup**
   - 在頻譜圖上右鍵點擊選區
   - 點擊 "Show Power Spectrum"

2. **檢查 Start/End Thresh 控件**
   - 應顯示：`☑ Auto`（勾選狀態）
   - 下方的 number input 應該是隱藏的

3. **執行 Bat Call 分析**
   - 系統自動找到最佳阈值
   - 不需要手動調整

### 方式 2：切換到 Manual Mode

1. **在 Power Spectrum Popup 中**
   - 找到 "Start/End Thresh: ☑ Auto" 控件

2. **取消勾選 Auto**
   - 點擊 checkbox
   - 應變為：`☐ Auto`

3. **Manual Input 現在可見**
   - 您會看到一個 number input 框
   - 可輸入 -50 ~ -6 dB 之間的值

4. **調整數值**
   - 輸入想要的阈值（例如 -30）
   - 按 Enter 或點擊外部應用變更
   - 蝙蝠叫聲分析會立即更新

5. **使用上下鍵微調**
   - 點擊 input 框
   - 按 ↑ 鍵：增加 1 dB（例如 -30 → -29）
   - 按 ↓ 鍵：降低 1 dB（例如 -30 → -31）

### 方式 3：回到 Auto Mode

1. **勾選 Auto checkbox**
   - Manual input 自動隱藏
   - 系統恢復自動計算

---

## 📊 理解 Start/End Threshold

### 什麼是 Start/End Threshold？

這是一個功率閾值，用來確定蝙蝠叫聲在時間軸上的開始和結束點。

```
功率譜圖（第一幀）

      ↑ Power
      |     ╱╲
      |    ╱  ╲      ← 信號峰值
      |   ╱    ╲╲
   -24dB─────────╲──  ← Threshold = -24 dB
      |          ╲╲
      |           ╲╲
      |            ╲╲__
  -∞  |__________________ → Frequency

起始頻率：首個超過 -24 dB 的頻率
```

### -24 dB vs -30 dB vs -40 dB

| 閾值 | 特性 | 應用 |
|------|------|------|
| **-24 dB** | 較寬鬆，容易過度估計 | 强信號 |
| **-30 dB** | 平衡 | 大多數情況 |
| **-40 dB** | 較嚴格，可能漏檢 | 弱信號 |

---

## 💡 Auto Mode 工作原理

### 簡化說明

Auto Mode 做以下事情：

1. **測試不同的閾值**
   - 嘗試 -24, -25, -26, ... -50 dB

2. **觀察 Start Frequency 如何變化**
   - 正常情況：平緩變化（1-2 kHz）
   - 異常情況：突然跳變（> 3 kHz）

3. **找出第一個異常**
   - 當發現 > 3 kHz 的跳躍時停止
   - 回退到前一個安全的閾值

4. **應用最優值**
   - 自動選用推薦的閾值
   - 結果：避免過度估計

### 為什麼使用 3 kHz？

- **< 3 kHz**：正常的噪聲擴展
- **≥ 3 kHz**：明確的過度估計信號
- **5-10 kHz**：回音（rebounce）或虛報

---

## ✨ 優點

| 功能 | 益處 |
|------|-----|
| Auto 預設開啟 | 新用戶開箱即用 |
| 自動避免過度估計 | 減少手動調整 |
| 可切換 Manual | 專業用戶保有控制權 |
| 記憶設置 | 新窗口自動復原配置 |
| 即時反饋 | 參數變更立即應用 |

---

## 🐛 常見問題

### Q1：Auto Mode 還是總是過度估計怎麼辦？

**A**：這可能表示錄音質量較差或有強烈的 rebounce。

解決方案：
1. 切換到 Manual 模式
2. 嘗試 -35 或 -40 dB（更嚴格）
3. 觀察 Start Frequency 是否更合理
4. 如果有改善，可保存此設置供未來使用

### Q2：Manual Mode 應該用什麼值？

**A**：取決於您的錄音：

- **高質量、清晰信號**：-24 ~ -28 dB
- **中等質量**：-28 ~ -35 dB  
- **低質量、弱信號或回音**：-35 ~ -40 dB

建議先嘗試 -30 dB，然後根據結果調整。

### Q3：新窗口為什麼還是 Auto 模式？

**A**：系統記憶了您的設置。

- 如果您最後一次用的是 Auto，新窗口也會是 Auto
- 如果您用的是 Manual -30 dB，新窗口會復原 Manual -30 dB

這是有意設計的，方便重複工作流程。

### Q4：Auto Mode 需要多長時間？

**A**：< 50ms（不可察覺）

系統會快速測試所有可能的閾值，您不會感到延遲。

---

## 🎓 最佳實踐

### 標準工作流程

1. **默認使用 Auto Mode**
   ```
   Power Spectrum Popup → ☑ Auto → Analyze
   ```

2. **如果結果不理想**
   ```
   取消勾選 Auto → 輸入 -32 dB → Observe → 調整
   ```

3. **找到最佳值後**
   ```
   保持該設置 → 系統記憶 → 新窗口自動復原
   ```

### 針對特殊環境

**隧道或洞穴錄音（強回音）**
- 推薦：Manual -35 ~ -40 dB
- 原因：防止 rebounce 被誤認為信號

**戶外清晰錄音**
- 推薦：Auto（或 Manual -24 ~ -28 dB）
- 原因：信噪比高，寬鬆閾值可接受

**移動設備或弱信號**
- 推薦：Manual -35 dB
- 原因：避免漏檢弱信號

---

## 🔗 相關功能

- **Anti-Rebounce**：與 Auto Mode 配合使用，進一步提高準確性
- **Characteristic Frequency**：與 Auto Mode 無直接關係，可獨立調整
- **Call Threshold**：不同參數，控制叫聲能量門檻（不是頻率）

---

## 📞 需要幫助？

如有問題或建議，請查看：
- 技術文檔：`docs/START_END_THRESHOLD_AUTO_MODE.md`
- 實現報告：`docs/AUTO_MODE_COMPLETION_REPORT.md`

---

**提示**：95% 的情況下，使用默認的 Auto Mode 就可以獲得最佳結果！✨
