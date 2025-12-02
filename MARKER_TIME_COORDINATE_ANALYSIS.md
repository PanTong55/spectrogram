# Marker 时间坐标诊断分析

## 问题背景

1. Knee Frequency Marker 无法显示
2. 需要验证各频率 bin 的时间计算是否正确

## 时间坐标系统分析

### batCallDetector.js 中的时间

| 字段 | 类型 | 含义 | 基准 |
|------|------|------|------|
| `startTime_s` | 秒 | Call 开始时间 | 绝对时间 |
| `endTime_s` | 秒 | Call 结束时间 | 绝对时间 |
| `startFreqTime_s` | 秒 | 第一帧时间（High Freq） | 绝对时间 (`timeFrames[0]`) |
| `endFreqTime_s` | 秒 | 最后一帧时间（Low Freq） | 绝对时间 (`lastFrameTime_s`) |
| `kneeTime_ms` | 毫秒 | 膝点时间 | **相对时间**（`call.startTime_s` 为基准） |
| `peakFreq_kHz` | kHz | 峰值频率 | - |
| ~~`peakFreqTime_s`~~ | - | **缺失** | 应为绝对时间 (`timeFrames[peakFrameIdx]`) |
| `characteristicFreq_kHz` | kHz | 特征频率 | 从最后 20% 计算 |
| ~~`charFreqTime_s`~~ | - | **缺失** | 应为最后 20% 的中点时间 |

### 关键发现

1. **kneeTime_ms 的计算** (line 2434):
   ```javascript
   const rawKneeTime_ms = (timeFrames[finalKneeIdx] - call.startTime_s) * 1000;
   ```
   ✅ **正确** - 相对于 call.startTime_s

2. **Peak Frequency 没有时间戳**:
   - `call.peakFreq_kHz` ✅ 有
   - `call.peakFreqTime_s` ❌ **缺失**
   - 应该在 line 1405 附近添加

3. **Characteristic Frequency 没有时间戳**:
   - `call.characteristicFreq_kHz` ✅ 有（line 2192）
   - `call.charFreqTime_s` ❌ **缺失**
   - 应该在最后 20% 的某个帧

### frequencyHover.js 中的时间转换

```javascript
// 时间转换规则（相对于 selection.startTime）

// 1. High Freq (绝对时间 → 相对时间)
timeValue = startFreqTime_s - selectionStartTime

// 2. Low Freq (绝对时间 → 相对时间)
timeValue = endFreqTime_s - selectionStartTime

// 3. Knee Freq (相对时间转换)
actualTime_s = call.startTime_s + (kneeTime_ms / 1000)
timeValue = actualTime_s - selectionStartTime

// 4. Peak Freq (缺失时间戳)
timeValue = null (或 peakFreqTime_s - selectionStartTime 如果添加了的话)

// 5. Char Freq (应使用相关时间，目前使用 endFreqTime_s)
timeValue = endFreqTime_s - selectionStartTime (或应该是 charFreqTime_s - selectionStartTime)
```

## 需要修复的问题

### 问题 1: Peak Frequency 时间戳缺失

**位置**: `modules/batCallDetector.js` line ~1405

**需要添加**:
```javascript
// 在 call.peakFreq_kHz = peakFreq_Hz / 1000; 后添加
call.peakFreqTime_s = timeFrames[peakFrameIdx];
```

**影响**: 虽然 Peak Freq marker 当前设置 `getTime: () => null`，但为了完整性应该添加

### 问题 2: Characteristic Frequency 时间戳缺失

**位置**: `modules/batCallDetector.js` line ~2192

**当前状态**:
- 从最后 20% 计算加权平均频率
- 但没有记录对应的时间戳

**需要添加**:
- 计算加权时间戳（对应最后 20% 的中点时间）
- 或记录找到 Char Freq 的确切帧

### 问题 3: Knee Frequency Marker 无法显示

**可能原因**:
1. `kneeFreq_kHz` 为 null（Knee 点检测失败）
2. `kneeTime_ms` 为 null
3. `call.startTime_s` 为 null
4. Y 坐标计算失败（frequencyToY 返回 null）
5. 时间坐标转换错误

**调试步骤**:
- ✅ 已添加控制台日志
- 需要在浏览器中运行并检查 console 输出

## 当前修改

### frequencyHover.js 中的调试

```javascript
// 在 updateMarkersFromBatCall 中添加了:
console.log('🔍 updateMarkersFromBatCall - batCall fields:', {
  Fhigh: batCall.Fhigh,
  Flow: batCall.Flow,
  kneeFreq_kHz: batCall.kneeFreq_kHz,
  kneeTime_ms: batCall.kneeTime_ms,
  // ... 其他字段
});

// 在 createOrUpdateMarker 中添加了:
if (markerType === 'kneeFreqMarker') {
  console.log(`🔷 ${markerType}: freqKHz=${freqKHz}, timeValue=${timeValue}, title=${title}`);
}
```

## 后续步骤

1. 打开浏览器开发者工具 (F12)
2. 加载音频文件
3. 创建 selection 区域
4. 执行蝙蝠叫声检测
5. 查看 console 输出，确认:
   - 是否输出了 batCall 字段
   - `kneeFreq_kHz` 和 `kneeTime_ms` 的值
   - Knee marker 被隐藏的原因

## 代码规范

- 时间值统一为秒（`_s` 后缀）
- 毫秒值使用 `_ms` 后缀
- 频率值使用 `_kHz` 或 `_Hz` 后缀
- 所有频率参数都应有对应的时间参数

