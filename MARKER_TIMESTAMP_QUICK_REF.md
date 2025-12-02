# Marker 时间参数快速参考 - 2025

## 各 Frequency Marker 的时间戳信息

### 完整对照表

| Marker | 频率字段 | 时间戳字段 | 时间基准 | 用途 | 状态 |
|--------|---------|----------|--------|------|------|
| 🔴 High Freq | Fhigh (kHz) | startFreqTime_s | 第一帧时间 | 呼声开始频率 | ✅ |
| 🟠 Low Freq | Flow (Hz→kHz) | endFreqTime_s | 最后一帧时间 | 呼声结束频率 | ✅ |
| 🔵 Knee Freq | kneeFreq_kHz | kneeTime_ms | 相对于 startTime_s | CF-FM 转折点 | ✅ |
| 🟡 Peak Freq | peakFreq_kHz | peakFreqTime_s | 峰值出现的帧 | 绝对最大功率点 | ✅ **新** |
| 🟣 Char Freq | characteristicFreq_kHz | charFreqTime_s | 最后 20% 加权 | 特征频率 | ✅ **改进** |

## 时间坐标转换流程

```
batCallDetector.js (绝对或相对时间)
         ↓
      frequencyHover.js (updateMarkersFromBatCall)
         ↓
   时间 - selection.startTime
         ↓
  相对于 selection 的秒数 (timeValue)
         ↓
    createOrUpdateMarker
         ↓
   Tooltip 格式化显示
```

### 具体转换公式

```javascript
// 高频 / 低频 / 峰值 / 特征频
timeValue = absoluteTime_s - selection.startTime_s

// 膝频（特殊处理相对时间）
timeValue = (call.startTime_s + kneeTime_ms/1000) - selection.startTime_s
```

## 调试：查看实际时间值

打开浏览器控制台 (F12) 后的输出格式：

```
🔍 updateMarkersFromBatCall - batCall fields: {
  Fhigh: 82.5,
  Flow: 12340,  // Hz
  kneeFreq_kHz: 45.67,
  kneeTime_ms: 3.45,  // 相对时间
  peakFreq_kHz: 88.90,
  peakFreqTime_s: 0.025,  // 新
  characteristicFreq_kHz: 50.00,
  charFreqTime_s: 0.055,  // 改进
  startFreqTime_s: 0.010,
  endFreqTime_s: 0.060,
  startTime_s: 0.010,
  duration_ms: 50
}
```

### 解读指南

1. **startFreqTime_s** (0.010s): 高频时间点
2. **kneeTime_ms** (3.45ms): 膝频出现在 startTime 后 3.45ms
3. **peakFreqTime_s** (0.025s): 峰值出现在 0.025s
4. **charFreqTime_s** (0.055s): 特征频率出现在 0.055s  
5. **endFreqTime_s** (0.060s): 低频时间点

## Marker Tooltip 显示格式

```
High Freq (82.50kHz 10.00ms)
Low Freq (12.34kHz 60.00ms)
Knee Freq (45.67kHz 3.45ms)
Peak Freq (88.90kHz 25.00ms)
Char Freq (50.00kHz 55.00ms)
```

## 验证清单

使用浏览器控制台验证修复：

- [ ] 创建 selection 区域
- [ ] 执行蝙蝠叫声检测
- [ ] 检查控制台是否输出 `🔍 updateMarkersFromBatCall`
- [ ] 确认 `peakFreqTime_s` 不再为 undefined
- [ ] 确认 `charFreqTime_s` 不再为 undefined
- [ ] 鼠标悬停各个 marker，确认 tooltip 显示完整信息
- [ ] Knee Freq marker 应该现在可见

## 代码位置速查

| 文件 | 位置 | 作用 |
|------|------|------|
| batCallDetector.js | 115-122 行 | BatCall 类定义（新增字段）|
| batCallDetector.js | 1407 行 | peakFreqTime_s 赋值 |
| batCallDetector.js | 2204 行 | charFreqTime_s 赋值 |
| frequencyHover.js | 556 行 | 调试日志 |
| frequencyHover.js | 640-660 行 | Marker 映射（更新） |

## 已知状态

- ✅ 所有 5 个频率参数都有时间戳
- ✅ 时间坐标系统统一
- ✅ Knee Freq marker 应该现在可显示（如果检测到 knee 点）
- ✅ Peak Freq marker 现在有精确时间
- ✅ Char Freq marker 使用加权时间而非单纯的 endTime
- ⚠️ 如果仍然看不到 Knee Freq marker，检查浏览器控制台输出

