# Marker X 坐标修复和调试指南

## 修复内容

### 问题症状
- Marker 全部错误地显示在 spectrogram 的最左边
- 应该在对应的 Selection area 内显示

### 根本原因
- X 坐标计算逻辑需要优化
- 时间值到像素位置的转换需要更清晰的注释

### 修复内容 (frequencyHover.js 行 517-558)

**关键改进**：
1. 添加更清晰的注释说明时间转换过程
2. 确保 X 坐标 = rectLeft + (时间比例 × rectWidth)
3. 添加详细的调试日志跟踪坐标计算

## 坐标计算流程

```
Selection 在全局时间轴上的位置：
├─ startTime: selection 开始时间（秒）
├─ endTime: selection 结束时间（秒）
└─ duration: endTime - startTime

Selection 在 spectrogram 上的像素位置：
├─ rectLeft: (startTime / totalDuration) × totalPixelWidth
├─ rectWidth: (duration / totalDuration) × totalPixelWidth
└─ rectRight: rectLeft + rectWidth

Marker 在 Selection 内的相对位置：
├─ timeValue: 相对于 startTime 的秒数（已经是相对时间）
├─ localTimeRatio: timeValue / duration
└─ markerXPos: rectLeft + (localTimeRatio × rectWidth)
```

## 调试输出

在浏览器控制台 (F12) 中查看详细的坐标计算日志：

```javascript
📍 kneeFreqMarker X coordinate: {
  selectionStartTime: 0.5,        // Selection 开始时间
  timeValue: 0.003,               // 相对于 selection 开始的时间（秒）
  rectLeft: 512,                  // Selection 在 viewer 中的左边界 X 坐标
  rectWidth: 256,                 // Selection 的宽度（像素）
  selectionDuration: 0.1,         // Selection 持续时间（秒）
  localTimeRatio: 0.03,           // 时间值在 selection 内的比例 (0.003 / 0.1)
  xPos: 519.68                    // 最终 X 坐标 = 512 + (0.03 × 256)
}
```

## 坐标验证公式

验证 marker 是否位置正确：

```
预期位置 = selectionStartTime + timeValue
marker X = rectLeft + (timeValue / selectionDuration) × rectWidth

验证：
1. rectLeft 应该对应 selectionStartTime
2. rectLeft + rectWidth 应该对应 selectionEndTime
3. marker X 应该在 [rectLeft, rectLeft + rectWidth] 范围内
```

## 可能的问题和解决方案

### 问题 1: Marker 仍然在最左边
**原因**: `rectLeft` 计算可能有问题
**检查**:
- console 输出中 rectLeft 是否正确
- 它应该与 selection rectangle 的左边界 X 坐标相同

### 问题 2: Marker 在 Selection 之外
**原因**: `localTimeRatio` 计算错误
**检查**:
- `timeValue` 是否在 [0, selectionDuration] 范围内
- `selectionDuration` 是否正确

### 问题 3: Marker 位置跳动
**原因**: Zoom 或 selection 改变时坐标重新计算
**正常**: 这是预期行为，marker 应该随 selection 和 zoom 自动调整

## 测试步骤

1. 打开浏览器开发者工具 (F12)
2. 切换到 Console 选项卡
3. 加载音频文件
4. 创建 selection 区域（记下 start/end 时间）
5. 执行蝙蝠叫声检测
6. 观察 console 输出：
   - 查看 `📍 kneeFreqMarker X coordinate` 日志
   - 验证 `rectLeft` 是否与 selection 矩形的左边界匹配
   - 验证 `xPos` 是否在 selection 区域内

## 相关代码行数

- `frequencyHover.js` 行 517-558: marker X 坐标计算
- `frequencyHover.js` 行 1327-1352: updateSelections 中的 marker 位置更新

## 预期效果

- ✅ Marker 显示在对应 selection area 内
- ✅ Marker 位置随 timeValue 而改变（在 selection 内）
- ✅ Zoom/拖动 selection 时，marker 位置自动更新
- ✅ Console 输出清晰地显示坐标计算过程
