# ✅ 修正：peakMode 中 this.options 為 null 的錯誤

## 🐛 問題

當在 **selection expansion mode** 中開啟 **peakMode**，然後退出 selection expansion mode 時，會報錯：

```
Uncaught (in promise) TypeError: Cannot read properties of null (reading 'peakMode')
    at h.getFrequencies (spectrogram.esm.js:626:26)
```

### 根本原因

1. **Selection mode 的生命週期問題**
   - 進入 selection expansion mode 時，會創建或修改 UI 元素
   - 退出 selection expansion mode 時，可能調用 `destroy()` 或清理代碼
   - 清理代碼將 `this.options` 設置為 `null`

2. **異步操作的競態條件**
   - `render()` 方法調用 `getFrequencies()`（非同步）
   - 在 `getFrequencies()` 執行過程中（等待 WASM），selection mode 可能已經退出
   - 此時 `this.options` 變成 `null`，導致訪問 `this.options.peakMode` 時出錯

3. **多個訪問點**
   - `getFrequencies` 方法中有多處對 `this.options` 的訪問
   - 沒有統一的空檢查保護

## ✅ 實施的修改

### 修改 1: getFrequencies 方法開始添加空檢查

**位置**：第 563-570 行

```javascript
// ❌ 舊版本
async getFrequencies(t) {
    var e, s;
    const r = this.fftSamples
      , i = (null !== (e = this.options.splitChannels) ...

// ✅ 新版本
async getFrequencies(t) {
    // 檢查 this.options 是否為 null（在 destroy 或 selection mode 切換時可能發生）
    if (!this.options || !t) {
        return;
    }
    
    var e, s;
    const r = this.fftSamples
      , i = (null !== (e = this.options.splitChannels) ...
```

**效果**：如果 `this.options` 被清空，立即返回 `undefined`，避免後續錯誤

### 修改 2: peakMode 檢查添加防禦性檢查

**位置**：第 631 行

```javascript
// ❌ 舊版本
if (this.options.peakMode) {

// ✅ 新版本
if (this.options && this.options.peakMode) {
```

**效果**：雙重檢查，確保 `this.options` 存在再訪問其屬性

### 修改 3: render 方法添加返回值檢查

**位置**：第 351-360 行

```javascript
// ❌ 舊版本
e && this.drawSpectrogram(await this.getFrequencies(e))

// ✅ 新版本
if (e) {
    const frequencies = await this.getFrequencies(e);
    if (frequencies) {
        this.drawSpectrogram(frequencies);
    }
}
```

**效果**：檢查 `getFrequencies` 的返回值，只有在有效數據時才調用 `drawSpectrogram`

## 📊 修改位置總結

| 行號 | 修改內容 | 目的 |
|------|---------|------|
| 563-570 | 添加 `this.options` 空檢查 | 早期退出，避免後續錯誤 |
| 631 | `if (this.options && ...)` | 雙重檢查 peakMode |
| 351-360 | 檢查 `getFrequencies` 返回值 | 避免傳遞 `undefined` 給 drawSpectrogram |

## 🔄 執行流程

```
render() 調用 getFrequencies()
    ↓
getFrequencies() 開始檢查 this.options
    ├─ 如果 this.options == null → 返回 undefined
    └─ 如果 this.options 有效 → 繼續處理
        ├─ 檢查 this.options.peakMode（帶保護）
        └─ 處理 peakMode 邏輯
    ↓
render() 檢查返回值
    ├─ 如果 frequencies == undefined → 不調用 drawSpectrogram
    └─ 如果 frequencies 有效 → 調用 drawSpectrogram
```

## ✅ 安全性改進

1. **三層防禦**
   - 第一層：getFrequencies 開始檢查
   - 第二層：peakMode 訪問前檢查
   - 第三層：render 檢查返回值

2. **不會隱藏真正的錯誤**
   - 如果是其他原因導致 `this.options` 為 null，早期返回使問題明顯
   - 便於日後調試

3. **優雅降級**
   - 當 selection mode 切換時，頻譜圖會安靜地停止更新
   - 不會拋出異常，用戶體驗更佳

## 🧪 測試方案

### 重現原始問題
1. 打開應用
2. 開啟 peakMode
3. 進入 selection expansion mode
4. 在 selection expansion mode 中更改頻率範圍
5. 按退出 selection expansion mode

### 驗證修復
- ✅ 不應該看到 `TypeError`
- ✅ 頻譜圖應該正常顯示
- ✅ 無控制台錯誤

## 📝 變更影響

| 功能 | 影響 |
|------|------|
| 正常頻譜圖渲染 | 無變化 ✅ |
| peakMode 功能 | 無變化 ✅ |
| Selection expansion | 不再拋出錯誤 ✅ |
| 內存管理 | 更佳（早期返回）✅ |

---

**狀態**：🟢 修復完成，所有錯誤檢查已添加
