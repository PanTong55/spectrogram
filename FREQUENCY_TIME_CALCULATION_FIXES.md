# 频率 Bin 时间计算修复报告 - 2025

## 修复概览

已完成对 `batCallDetector.js` 中各频率参数时间计算的全面审查和改进，确保所有 marker 能够准确显示其对应的时间点。

## 时间坐标系统梳理

### batCallDetector.js 中的时间定义（已验证）

| 频率参数 | 值 | 时间戳 | 基准 | 状态 |
|---------|-----|--------|------|------|
| **High Freq** | Fhigh | startFreqTime_s | 第一帧时间（绝对） | ✅ 正确 |
| **Low Freq** | Flow | endFreqTime_s | 最后一帧时间（绝对） | ✅ 正确 |
| **Peak Freq** | peakFreq_kHz | peakFreqTime_s | 峰值帧时间（绝对） | ✅ **已添加** |
| **Knee Freq** | kneeFreq_kHz | kneeTime_ms | 相对于 startTime_s（毫秒） | ✅ 正确 |
| **Char Freq** | characteristicFreq_kHz | charFreqTime_s | 最后 20% 加权时间（绝对） | ✅ **已添加** |

## 代码修改详情

### 1. batCallDetector.js 修改

#### 修改 1-1: 添加 peakFreqTime_s 字段到 BatCall 类 (行 112)

```javascript
// BatCall 构造函数中
this.peakFreq_kHz = null;       // Peak frequency (kHz)
this.peakFreqTime_s = null;     // 新增：Peak frequency time (s)
```

#### 修改 1-2: 设置 peakFreqTime_s 值 (行 1407)

在计算峰值频率后立即设置时间戳：
```javascript
call.peakFreq_kHz = peakFreq_Hz / 1000;
call.peakFreqTime_s = timeFrames[peakFrameIdx];  // 新增
```

#### 修改 1-3: 添加 charFreqTime_s 字段到 BatCall 类 (行 122)

```javascript
// BatCall 构造函数中
this.characteristicFreq_kHz = null;  // Characteristic freq
this.charFreqTime_s = null;          // 新增：时间戳
```

#### 修改 1-4: 计算和设置 charFreqTime_s 值 (行 2142-2204)

改进 Characteristic Frequency 计算，记录加权时间戳：

```javascript
// 变量初始化
let charFreqTimeFrame = spectrogram.length - 1;  // 默认最后一帧

// 在加权计算中跟踪时间
let weightedTimeFrame = 0;
let totalTimeWeight = 0;

// ... 加权频率计算 ...

// 计算加权时间帧
charFreqTimeFrame = Math.round(weightedTimeFrame / totalTimeWeight);

// 最后设置时间戳
call.charFreqTime_s = timeFrames[charFreqTimeFrame];
```

### 2. frequencyHover.js 修改

#### 修改 2-1: 更新 Peak Freq marker 映射 (行 640-648)

```javascript
// 之前：无时间戳
peakFreqMarker: { 
  field: 'peakFreq_kHz', 
  getTime: () => null,
  // ...
}

// 现在：使用新的 peakFreqTime_s
peakFreqMarker: { 
  field: 'peakFreq_kHz', 
  getTime: () => {
    if (batCall.peakFreqTime_s !== null && batCall.peakFreqTime_s !== undefined) {
      return batCall.peakFreqTime_s - selectionStartTime;
    }
    return null;
  },
  // ...
}
```

#### 修改 2-2: 更新 Char Freq marker 映射 (行 650-660)

```javascript
// 之前：使用 endFreqTime_s
charFreqMarker: { 
  field: 'characteristicFreq_kHz', 
  getTime: () => {
    if (batCall.endFreqTime_s !== null && batCall.endFreqTime_s !== undefined) {
      return batCall.endFreqTime_s - selectionStartTime;
    }
    return null;
  },
  // ...
}

// 现在：使用新的 charFreqTime_s
charFreqMarker: { 
  field: 'characteristicFreq_kHz', 
  getTime: () => {
    if (batCall.charFreqTime_s !== null && batCall.charFreqTime_s !== undefined) {
      return batCall.charFreqTime_s - selectionStartTime;
    }
    return null;
  },
  // ...
}
```

#### 修改 2-3: 添加调试日志 (行 556-575, 450-480)

在 `updateMarkersFromBatCall` 和 `createOrUpdateMarker` 中添加控制台日志，用于诊断：

```javascript
// updateMarkersFromBatCall 中
console.log('🔍 updateMarkersFromBatCall - batCall fields:', {
  Fhigh: batCall.Fhigh,
  Flow: batCall.Flow,
  kneeFreq_kHz: batCall.kneeFreq_kHz,
  kneeTime_ms: batCall.kneeTime_ms,
  peakFreq_kHz: batCall.peakFreq_kHz,
  peakFreqTime_s: batCall.peakFreqTime_s,  // 新添加
  characteristicFreq_kHz: batCall.characteristicFreq_kHz,
  charFreqTime_s: batCall.charFreqTime_s,  // 新添加
  // ... 其他字段
});

// createOrUpdateMarker 中（仅 Knee marker）
if (markerType === 'kneeFreqMarker') {
  console.log(`🔷 ${markerType}: freqKHz=${freqKHz}, timeValue=${timeValue}`);
}
```

## 时间坐标转换规则

### batCallDetector.js → frequencyHover.js 的转换

所有频率参数的时间值在 `frequencyHover.js` 中转换为**相对于 selection.startTime 的秒数**：

```
最终 timeValue = (绝对时间_s 或相对时间_s) - selection.startTime
```

**具体规则**:
1. **High Freq**: `startFreqTime_s - selectionStartTime`
2. **Low Freq**: `endFreqTime_s - selectionStartTime`
3. **Peak Freq**: `peakFreqTime_s - selectionStartTime` ✅ 新
4. **Knee Freq**: `(startTime_s + kneeTime_ms/1000) - selectionStartTime`
5. **Char Freq**: `charFreqTime_s - selectionStartTime` ✅ 改进

## 验证清单

- ✅ 语法检查通过 (`node -c` 验证)
- ✅ 所有 5 个 marker 都有时间戳（Peak Freq 新增，Char Freq 改进）
- ✅ 时间坐标转换逻辑统一
- ✅ 添加了调试日志便于排查问题
- ✅ 向后兼容（如果某个时间戳为 null，marker 会正确处理）

## Knee Frequency Marker 调试

### 调试步骤

1. 打开浏览器开发者工具 (F12 或右键 → 检查)
2. 切换到 **Console** 选项卡
3. 加载音频文件
4. 创建 selection 区域
5. 执行蝙蝠叫声检测
6. 观察控制台输出：
   - 如果看到 `🔍 updateMarkersFromBatCall` 输出，检查 `kneeFreq_kHz` 和 `kneeTime_ms` 的值
   - 如果看到 `🔷 kneeFreqMarker` 输出，检查 `freqKHz` 和 `timeValue` 的值
   - 如果看到隐藏信息，说明频率或 Y 坐标计算失败

### 可能的问题

1. **kneeFreq_kHz 为 null**:
   - Knee 点检测失败（CF-FM 转折点不存在或不明显）
   - 检查蝙蝠叫声的特性（CF 段足够长吗？）

2. **kneeTime_ms 为 null**:
   - 虽然检测到 knee 点，但时间值无效
   - 检查 `call.startTime_s` 是否正确设置

3. **Y 坐标计算失败**:
   - `frequencyToY` 函数返回 null（频率超出范围或显示区域配置问题）
   - 检查频率范围设置

4. **时间坐标转换错误**:
   - 相对时间计算不正确
   - 检查 `selection.startTime` 是否正确传递

## 关键改进

1. **完整的时间戳**：所有 5 个频率参数现在都有对应的时间信息
2. **更精确的 Char Freq 时间**：从简单的 endFreqTime_s 改为加权平均时间
3. **Peak Freq 可追踪**：现在可以查看峰值出现的确切时间
4. **调试友好**：添加了详细的控制台日志便于排查问题

## 相关代码行数

**batCallDetector.js**:
- 第 115 行：BatCall 构造函数（新增字段）
- 第 122 行：charFreqTime_s 字段定义
- 第 1407 行：peakFreqTime_s 赋值
- 第 2142-2204 行：charFreqTime_s 计算和赋值

**frequencyHover.js**:
- 第 556-575 行：调试日志（updateMarkersFromBatCall）
- 第 450-480 行：调试日志（createOrUpdateMarker）
- 第 640-648 行：Peak Freq marker 映射
- 第 650-660 行：Char Freq marker 映射

## 后续建议

1. 在生产环境中移除调试日志（或改为 `console.debug`）
2. 添加单元测试验证时间计算准确性
3. 考虑为所有频率参数添加 `_precision` 或 `_confidence` 字段
4. 在 UI 中显示频率参数的采集源（例如"第一帧"、"最后帧"、"加权平均"等）

