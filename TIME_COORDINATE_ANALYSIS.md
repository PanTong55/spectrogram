# 频率参数时间坐标系统分析

## 发现的问题

### 1. 时间坐标系统不一致

#### 在 batCallDetector.js 中计算的时间：

| 字段 | 含义 | 时间坐标系 | 示例计算 |
|------|------|----------|--------|
| `startFreqTime_s` | 开始频率时间点 | **绝对时间**（全局） | `timeFrames[0]` → 例如 2.345 秒 |
| `endFreqTime_s` | 结束频率时间点 | **绝对时间**（全局） | `timeFrames[lastIdx]` → 例如 2.410 秒 |
| `kneeTime_ms` | 膝频率时间点 | **相对时间**（相对于 call.startTime_s） | `(timeFrames[kneeIdx] - call.startTime_s) * 1000` → 例如 45 毫秒 |
| `call.startTime_s` | 蝙蝠叫声开始时间 | **绝对时间**（全局） | 2.345 秒 |
| `call.endTime_s` | 蝙蝠叫声结束时间 | **绝对时间**（全局） | 2.410 秒 |

#### 在 frequencyHover.js 中需要的时间：

| 需要的信息 | 用途 | 时间坐标系 | 如何计算 |
|----------|------|----------|--------|
| marker X 坐标 | 在 selection 区域内定位 marker | **相对于 selection.startTime** | `(timeInSeconds - selection.startTime) / (selection.endTime - selection.startTime) * rectWidth` |
| tooltip 显示 | 用户看到的时间值 | **相对时间** | `(绝对时间 - selection.startTime) * 1000` ms |

### 2. 当前代码中的错误

```javascript
// frequencyHover.js 第 563-570 行
const markerMap = {
  highFreqMarker: { field: 'Fhigh', timeField: 'startFreqTime_s', ... },
  lowFreqMarker: { field: 'Flow', timeField: 'endFreqTime_s', ... },
  kneeFreqMarker: { field: 'kneeFreq_kHz', timeField: 'kneeTime_ms', ... },  // ❌ 混合单位！
  peakFreqMarker: { field: 'peakFreq_kHz', timeField: null, ... },
  charFreqMarker: { field: 'characteristicFreq_kHz', timeField: 'endFreqTime_s', ... }
};

// 时间转换逻辑（行 571-576）
if (timeValue !== null && timeValue !== undefined && timeValue > 100) {
  // 假设 > 100 的是毫秒，转换为秒
  timeValue = timeValue / 1000;
}
```

**问题**：
- `startFreqTime_s` 和 `endFreqTime_s` 是**绝对时间**（秒），需要减去 `selection.startTime` 才能得到相对时间
- `kneeTime_ms` 已经是**相对时间**（相对于 call.startTime_s），但为毫秒单位
- 时间值 > 100 的启发式判断不可靠！可能出现 > 100 秒的情况

### 3. Knee Frequency Marker 无法显示的原因

可能的原因：

1. **kneeTime_ms 为 null**：
   - batCallDetector.js 中的计算可能返回 null
   - 原因：finalKneeIdx 无效，或时间值超出范围

2. **时间坐标转换错误**：
   - `kneeTime_ms` 应该是 `(timeFrames[finalKneeIdx] - call.startTime_s) * 1000`
   - 但实际上可能是相对于不同的参考点

3. **时间值在位置计算中出错**：
   - 在 `createOrUpdateMarker` 中，时间值被错误地用于 X 坐标计算
   - 坐标计算需要相对于 **selection.startTime** 的时间

## 解决方案

### 步骤 1：统一时间坐标系统

在 `updateMarkersFromBatCall` 中，需要将所有时间值统一转换为**相对于 selection.startTime 的秒数**：

```javascript
const updateMarkersFromBatCall = (selObj, batCall) => {
  if (!batCall) {
    hideSelectionMarkers(selObj);
    return;
  }

  const selectionStartTime = selObj.data.startTime;  // 获取 selection 开始时间

  const markerMap = {
    highFreqMarker: { 
      field: 'Fhigh', 
      getTime: () => batCall.startFreqTime_s !== null ? batCall.startFreqTime_s - selectionStartTime : null,
      color: 'marker-high', 
      label: 'High Freq' 
    },
    lowFreqMarker: { 
      field: 'Flow', 
      convert: (v) => v ? v / 1000 : null, 
      getTime: () => batCall.endFreqTime_s !== null ? batCall.endFreqTime_s - selectionStartTime : null,
      color: 'marker-low', 
      label: 'Low Freq' 
    },
    kneeFreqMarker: { 
      field: 'kneeFreq_kHz', 
      getTime: () => batCall.kneeTime_ms !== null ? batCall.kneeTime_ms / 1000 : null,
      color: 'marker-knee', 
      label: 'Knee Freq' 
    },
    peakFreqMarker: { 
      field: 'peakFreq_kHz', 
      getTime: () => null,  // Peak 无时间戳
      color: 'marker-heel', 
      label: 'Peak Freq' 
    },
    charFreqMarker: { 
      field: 'characteristicFreq_kHz', 
      getTime: () => batCall.endFreqTime_s !== null ? batCall.endFreqTime_s - selectionStartTime : null,
      color: 'marker-cfstart', 
      label: 'Char Freq' 
    }
  };

  Object.entries(markerMap).forEach(([markerKey, config]) => {
    let freq = batCall[config.field];
    
    if (config.convert && freq !== null && freq !== undefined) {
      freq = config.convert(freq);
    }
    
    // 获取相对于 selection.startTime 的时间（秒）
    let timeValue = config.getTime?.();
    
    createOrUpdateMarker(selObj, markerKey, freq, config.color, config.label, timeValue);
  });
};
```

### 步骤 2：修复 batCallDetector.js 中的时间计算

确保 `kneeTime_ms` 的计算正确：

```javascript
// 在 batCallDetector.js 中验证
if (finalKneeIdx >= 0 && finalKneeIdx < frameFrequencies.length && finalKneeIdx < timeFrames.length) {
  call.kneeFreq_kHz = frameFrequencies[finalKneeIdx] / 1000;
  
  // kneeTime_ms 必须相对于 call.startTime_s
  if (call.startTime_s !== null) {
    const rawKneeTime_ms = (timeFrames[finalKneeIdx] - call.startTime_s) * 1000;
    
    if (rawKneeTime_ms >= 0 && rawKneeTime_ms <= call.duration_ms) {
      call.kneeTime_ms = rawKneeTime_ms;
    } else {
      call.kneeTime_ms = null;
      call.kneeFreq_kHz = null;
    }
  }
}
```

### 步骤 3：添加 Peak Frequency 的时间计算

虽然 Peak Frequency 没有特定的时间戳（在 Power Spectrum 中计算），但为了完整性，应该添加：

```javascript
// 可选：添加 peakFreqTime_s
call.peakFreqTime_s = null;  // Power Spectrum 方法中无明确的时间点
// 或者，如果需要，可以设置为峰值出现的 frame 的时间
```

### 步骤 4：添加 Characteristic Frequency 的时间计算

Characteristic Frequency 是在最后 20% 的频率，应该添加时间信息：

```javascript
// 目前 charFreq 使用 endFreqTime_s，这是正确的
// 因为 characteristic frequency 通常在最后阶段
// 但应该添加注释说明这一点
```

## 验证检查清单

- [ ] `startFreqTime_s` 和 `endFreqTime_s` 都是绝对时间（全局秒数）
- [ ] `kneeTime_ms` 是相对于 `call.startTime_s` 的毫秒数
- [ ] `call.startTime_s` 是蝙蝠叫声的绝对开始时间
- [ ] `selection.startTime` 是用户选择区域的绝对开始时间
- [ ] marker 位置计算使用 `(timeFrames[idx] - selection.startTime)` 得到相对时间
- [ ] tooltip 显示的时间是相对于 selection 开始的毫秒数

## 时间流程图

```
全局时间轴 (秒)
├── 0.0s ─────────────────────────────────────── 5.0s
│   │
│   ├─ Selection 区域: 2.0s - 3.0s
│   │   ├─ Selection.startTime = 2.0s
│   │   ├─ Selection.endTime = 3.0s
│   │   │
│   │   ├─ Bat Call 检测
│   │   │   ├─ call.startTime_s = 2.1s
│   │   │   ├─ call.endTime_s = 2.9s
│   │   │   ├─ startFreqTime_s = 2.1s (绝对)
│   │   │   ├─ endFreqTime_s = 2.9s (绝对)
│   │   │   ├─ kneeTime_ms = 350 (相对于 call.startTime_s)
│   │   │       → 实际时间 = 2.1s + 0.35s = 2.45s (绝对)
│   │   │
│   │   ├─ 转换为 marker 坐标系
│   │   │   ├─ startFreq marker: 2.1s - 2.0s = 0.1s (相对)
│   │   │   ├─ endFreq marker: 2.9s - 2.0s = 0.9s (相对)
│   │   │   ├─ knee marker: 2.45s - 2.0s = 0.45s (相对)
```
