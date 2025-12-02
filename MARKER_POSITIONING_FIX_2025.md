# Marker 位置定位修复 - 2025年12月

## 问题

Marker 显示在 spectrogram 的最左边（全局位置），而不是在对应的 selection area 内的相对位置。

例如：
- ❌ **错误**: 所有 marker 都显示在最左边，无论 selection 的位置如何
- ✅ **正确**: Marker 应该相对于其所在 selection 的位置显示

## 根本原因

### 之前的计算方式（错误）
```javascript
const actualWidth = getDuration() * getZoomLevel();
const rectLeft = (selObj.data.startTime / getDuration()) * actualWidth;
const rectWidth = ((selObj.data.endTime - selObj.data.startTime) / getDuration()) * actualWidth;

// 使用 getBoundingClientRect() 计算，但没有正确处理坐标系转换
```

这种方式混合了视口坐标和DOM坐标，导致位置错误。

### 修复后的计算方式（正确）
```javascript
// 使用与 updateSelections 完全相同的计算逻辑
const actualWidth = getDuration() * getZoomLevel();
const rectLeft = (selObj.data.startTime / getDuration()) * actualWidth;
const rectWidth = ((selObj.data.endTime - selObj.data.startTime) / getDuration()) * actualWidth;

// 时间比例 = timeValue / selectionDuration
const localTimeRatio = timeValue / selectionDuration;

// 最终位置 = selection 左边 + (时间比例 × selection 宽度)
xPos = rectLeft + localTimeRatio * rectWidth;
```

## 修复内容

### 文件: `modules/frequencyHover.js`

#### 修改 1: createOrUpdateMarker 函数 (行 ~490-520)

重新实现 marker X 坐标计算，使用与 `updateSelections` 一致的方式：

```javascript
// 之前：混合使用 getBoundingClientRect()
const rectBounds = selObj.rect.getBoundingClientRect();
const rectLeftInOverlay = rectBounds.left - fixedOverlayBounds.left;

// 现在：使用全局缩放坐标系
const actualWidth = getDuration() * getZoomLevel();
const rectLeft = (selObj.data.startTime / getDuration()) * actualWidth;
const rectWidth = ((selObj.data.endTime - selObj.data.startTime) / getDuration()) * actualWidth;

xPos = rectLeft + localTimeRatio * rectWidth;
```

#### 修改 2: updateSelections 函数中 marker 位置更新 (行 ~1379-1404)

更新注释，澄清 marker 应该在 selection 区域内显示。代码逻辑本身是正确的，只需澄清意图：

```javascript
// 注释改为：marker 應該在 selection 區域內，相對於 selection rect 的位置
// 已验证: left 和 width 参数正确代表 selection 的全局坐标
```

## 坐标系统说明

### 全局坐标系（使用的方式）
- **原点**: spectrogram 的左上角
- **单位**: 像素
- **与缩放和滚动的关系**: 
  - `actualWidth = getDuration() * getZoomLevel()` (缩放后的总宽度)
  - `rectLeft = (startTime / getDuration()) * actualWidth` (缩放后的位置)
  - 自动处理 viewer.scrollLeft 对 fixedOverlay 的影响

### 为什么要用全局坐标而不是视口坐标？
1. **一致性**: `updateSelections` 已经使用全局坐标，marker 需要与之一致
2. **滚动处理**: fixedOverlay 使用 `position: absolute`，需要全局坐标
3. **简单性**: 避免复杂的坐标转换

## 验证检查清单

- [ ] 加载音频文件
- [ ] 创建 selection 区域（确保不在最左边）
- [ ] 执行蝙蝠叫声检测
- [ ] 验证 marker 在 selection 区域内显示
- [ ] 拖动 selection 移动时，marker 随之移动
- [ ] 缩放操作后，marker 仍在正确的相对位置
- [ ] 滚动 spectrogram 时，marker 跟随 selection 移动

## 预期结果

### 时间位置对应
- **High Freq marker**: 显示在 selection 左边缘起计 `startFreqTime` 的位置
- **Low Freq marker**: 显示在 selection 左边缘起计 `endFreqTime` 的位置  
- **Knee Freq marker**: 显示在 selection 左边缘起计 `kneeTime` 的位置
- **Peak Freq marker**: 显示在 selection 左边缘起计 `peakFreqTime` 的位置
- **Char Freq marker**: 显示在 selection 左边缘起计 `charFreqTime` 的位置

### 示例
如果 selection 的范围是 0.5s-1.5s（持续1秒），而 High Freq 的 startFreqTime 是 0.52s：
- High Freq 应显示在 selection 左边缘 + 20ms 处
- 计算: (0.52 - 0.5) / (1.5 - 0.5) = 0.02 = 2%
- 位置: rectLeft + 0.02 × rectWidth

## 相关代码行数

**frequencyHover.js**:
- 第 490-520 行: createOrUpdateMarker 中的 X 坐标计算
- 第 1307-1316 行: updateSelections 中 left/width 的计算
- 第 1379-1404 行: updateSelections 中 marker 位置更新

## 调试命令

在浏览器控制台查看 marker 位置信息：

```javascript
// 查看所有 marker 的位置
document.querySelectorAll('.freq-marker').forEach((m, i) => {
  console.log(`Marker ${i}: left=${m.style.left}, top=${m.style.top}`);
});
```
