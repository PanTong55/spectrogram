# Marker Tooltip 增强与 Knee Frequency 修复

## 修复内容

### 1. 修复 Knee Frequency Marker 转换错误
**问题**: `kneeFreqMarker` 的映射中有不必要的转换，将频率值除以 1000
**原因**: `kneeFreq_kHz` 字段已经是 kHz 单位，不需要再转换
**解决方案**: 移除 `convert: (v) => v ? v / 1000 : null` 函数

```javascript
// 修改前（错误）
kneeFreqMarker: { 
  field: 'kneeFreq_kHz', 
  timeField: 'kneeTime_ms', 
  convert: (v) => v ? v / 1000 : null,  // ❌ 错误：不应该再除以 1000
  color: 'marker-knee', 
  label: 'Knee Freq' 
}

// 修改后（正确）
kneeFreqMarker: { 
  field: 'kneeFreq_kHz', 
  timeField: 'kneeTime_ms', 
  color: 'marker-knee', 
  label: 'Knee Freq' 
}
```

### 2. 增强 Tooltip 显示格式
**原功能**: 仅显示标签，如 "High Freq"
**新功能**: 显示标签、频率和时间，如 "High Freq (82.79kHz 2.34ms)"

#### 变化1：在 updateMarkersFromBatCall 中处理时间转换
```javascript
// 获取时间值后立即转换为秒
if (config.timeField) {
  timeValue = batCall[config.timeField];
  // 如果时间值是毫秒（如 kneeTime_ms），转换为秒
  if (timeValue !== null && timeValue !== undefined && timeValue > 100) {
    timeValue = timeValue / 1000;  // 毫秒转秒
  }
}
```

#### 变化2：在 createOrUpdateMarker 中格式化 Tooltip
```javascript
// 格式化 tooltip：显示标签、频率和时间
let tooltipText = title;
if (freqKHz !== null && freqKHz !== undefined) {
  tooltipText += ` (${freqKHz.toFixed(2)}kHz`;
  if (timeValue !== null && timeValue !== undefined) {
    // timeValue 是秒，转换为毫秒
    const timeMs = timeValue * 1000;
    tooltipText += ` ${timeMs.toFixed(2)}ms`;
  }
  tooltipText += ')';
}
marker.setAttribute('data-title', tooltipText);
```

#### 变化3：简化 updateSelections 中的时间处理
```javascript
// 修改前：需要判断毫秒还是秒
if (timeValue > 100) {
  timeInSeconds = timeValue / 1000;
}

// 修改后：时间值已在 updateMarkersFromBatCall 中统一转换为秒
let timeInSeconds = parseFloat(timeValue);  // 直接使用
```

## 测试验证清单

- [ ] 打开音频文件
- [ ] 创建 selection 区域
- [ ] 执行蝙蝠叫声检测
- [ ] 验证所有 5 个 marker 是否显示：
  - [ ] High Freq marker - 应显示格式: "High Freq (XX.XXkHz X.XXms)"
  - [ ] Low Freq marker - 应显示格式: "Low Freq (XX.XXkHz X.XXms)"
  - [ ] **Knee Freq marker** - 应显示格式: "Knee Freq (XX.XXkHz X.XXms)" ← 之前没显示
  - [ ] Peak Freq marker - 应显示格式: "Peak Freq (XX.XXkHz)"（无时间）
  - [ ] Char Freq marker - 应显示格式: "Char Freq (XX.XXkHz X.XXms)"
- [ ] 鼠标悬停在 marker 上查看 tooltip
- [ ] 缩放和拖动 selection，验证 marker 位置是否正确更新
- [ ] 关闭 Power Spectrum 面板，验证 marker 是否正确清除

## 相关文件修改

**修改文件**: `modules/frequencyHover.js`
- updateMarkersFromBatCall 函数 (行 548-568)
- createOrUpdateMarker 函数 (行 450-535)
- updateSelections 函数 - marker 位置更新部分 (行 1287-1309)

## 数据流

```
batCall 对象 (来自 batCallDetector.js)
  ├─ kneeFreq_kHz (kHz)
  ├─ kneeTime_ms (毫秒)
  ├─ Fhigh (kHz)
  ├─ Flow (Hz) → 转换为 kHz
  ├─ peakFreq_kHz (kHz)
  ├─ characteristicFreq_kHz (kHz)
  ├─ startFreqTime_s (秒)
  ├─ endFreqTime_s (秒)
  
↓ (updateMarkersFromBatCall)

marker 数据
  ├─ freqKHz (显示用)
  ├─ timeValue (秒 - 统一转换)
  ├─ data-title (tooltip - 格式化字符串)
  
↓ (createOrUpdateMarker)

DOM 元素
  ├─ style.left (X 坐标)
  ├─ style.top (Y 坐标)
  ├─ data-title (悬停时显示的 tooltip)
  ├─ data-timeValue (用于重新计算位置)
```

## 时间单位转换规则

1. **输入**：来自 batCall 对象
   - `startFreqTime_s`, `endFreqTime_s`: **秒**
   - `kneeTime_ms`: **毫秒** (> 100 判断)
   
2. **中间存储**：在 updateMarkersFromBatCall 中转换为 **秒**
   - 所有时间值统一为秒以便位置计算

3. **显示**：在 tooltip 中显示为 **毫秒**
   - `timeMs = timeInSeconds * 1000`
   - 格式: `${timeMs.toFixed(2)}ms`

## 已知问题和注意事项

- Peak Freq marker 没有 timeField，因为 peak 频率没有特定的时间戳（在 Power Spectrum 分析中计算）
- 时间值 > 100 被认为是毫秒，这是启发式判断（因为如果是秒的话最多只有几秒的音频）
- Tooltip 显示格式使用 toFixed(2) 保留 2 位小数
