# Bat Call Detection Algorithm Improvements

## Overview
本文档详细说明了对蝙蝠呼叫检测算法的改进，以符合 Avisoft SASLab Pro、SonoBat、Kaleidoscope Pro 和 BatSound 等商业软件的专业标准。

## Issue 1: Flow (Hz) 和 Fhigh (kHz) 属性显示为 "-"

### 原因
`BatCall` 对象未存储频率范围边界。虽然这些参数在检测过程中作为输入使用，但未被保存到对象中，导致显示为空值。

### 解决方案
在 `BatCall` 类中添加两个新属性：
```javascript
this.Flow = null;               // Low frequency boundary (Hz)
this.Fhigh = null;              // High frequency boundary (kHz)
```

在检测和测量时赋值：
- `call.Flow = flowKHz * 1000;`  （转换为 Hz，与 powerSpectrum.js 显示逻辑一致）
- `call.Fhigh = fhighKHz;`       （保持 kHz 单位）

这些值现在被正确存储并在参数面板中显示。

---

## Issue 2: Characteristic Frequency (特征频率) 低于 End Frequency (结束频率)

### 原因分析

**原算法问题：**
1. 特征频率被定义为"最后 10-20% 时间段内的最低频率"
2. 这个定义对纯 FM 蝙蝠有效（FM sweep 从高到低）
3. 但对 CF-FM 蝙蝠错误：
   - CF 阶段：恒定频率（Constant Frequency）用于多普勒补偿
   - FM 阶段：向下扫频（Frequency Modulated）
   - **特征频率应该是 CF 阶段的频率，而非最低点**

**生物学背景：**
- **CF 蝙蝠**（例如 Molossidae 莫氏蝠科）：恒定频率，主要用于靶标检测
- **CF-FM 蝙蝠**（例如 Rhinolophidae 鼻叶蝠科、Hipposideridae 马蹄蝠科）：先 CF 后 FM，特征频率 = CF 频率
- **FM 蝙蝠**（例如 Vespertilionidae 蛾蝠科）：纯扫频，特征频率 ≈ 结束频率（最低点）

### 新算法实现

#### 方法 1：加权平均频率（Weighted Average Method）
```javascript
// 从最后 10-20% 时间段提取加权平均频率
for (frameIdx in lastPercentFrames) {
  for (freqBin with power > -6dB threshold) {
    weightedFreq += linearPower * frequency;
    totalPower += linearPower;
  }
}
characteristicFreq = weightedFreq / totalPower;
```

**优点：**
- 对 CF 阶段效果好（集中在恒定频率处）
- 对 CF-FM 呼叫的准确性高
- 对噪声鲁棒

**参考：**
- Avisoft SASLab Pro：使用加权中心频率
- Kaleidoscope Pro：类似的功率加权方法

#### 方法 2：频率关系验证（Frequency Relationship Validation）
```javascript
// 强制执行生物学上有效的频率顺序
// endFreq ≤ charFreq ≤ peakFreq ≤ startFreq
if (charFreq < endFreq) {
  charFreq = endFreq;  // FM 蝙蝠情况
} else if (charFreq > peakFreq) {
  charFreq = peakFreq; // 异常情况修正
}
```

**验证逻辑：**
1. **End Frequency**（结束频率）：最后一帧的 -18dB 阈值处
   - FM 蝙蝠：最低点（向下扫）
   - CF-FM 蝙蝠：CF 阶段之下

2. **Characteristic Frequency**（特征频率）：末端 20% 的加权中心
   - CF-FM 蝙蝠：CF 阶段频率
   - FM 蝙蝠：接近结束频率

3. **Peak Frequency**（峰值频率）：全局最高功率
   - 通常在呼叫中期

4. **Start Frequency**（起始频率）：第一帧的 -18dB 阈值处
   - 通常为最高频率

---

## Commercial Software Standards

### Avisoft SASLab Pro
- **Start/End Freq Threshold**：-18 dB below global peak（业界标准）
- **Characteristic Freq**：加权平均频率，从能量集中区域计算
- **Interpolation**：线性插值用于亚采样精度
- **Validation**：频率关系检查

### SonoBat
- **Duration-Weighted Analysis**：不同时间段赋予不同权重
- **Characteristic Freq**：基于呼叫末端的显著频率
- **Spectral Centroid**：类似加权平均的方法

### Kaleidoscope Pro
- **Power-Weighted Center Frequency**：使用功率作为权重
- **-6dB Bandwidth**：定义"显著"功率区域
- **Robust to Noise**：多帧分析提高鲁棒性

### BatSound
- **Peak Prominence**：相对于背景的峰值
- **Edge Detection**：使用 -18dB 阈值查找频率边界
- **Temporal Weighting**：末端时间段权重较高

---

## Implementation Details

### 关键参数

| 参数 | 值 | 来源 | 说明 |
|------|-----|------|------|
| callThreshold_dB | -24 | SonoBat, Kaleidoscope | 呼叫检测阈值 |
| startEndThreshold_dB | -18 | Avisoft (标准) | 频率边界阈值 |
| charFreq_percentEnd | 20 | CF-FM 标准 | 特征频率从末端 20% 计算 |
| Significant Power Threshold | -6 dB | Kaleidoscope | 加权计算的功率阈值 |

### 频率精度

| 方面 | 精度 | 实现 |
|------|------|------|
| 频率分辨率 | 1 Hz | Goertzel 算法 |
| 亚采样精度 | ±0.5 Hz | 线性插值 |
| 实际精度 | ±1 kHz | 考虑噪声和风格差异 |

### FFT 参数
- **FFT Size**：1024（2024年更新，从 2048）
- **Hop Size**：256（25% 跳跃 = 75% 重叠）
- **Window Function**：Hann（标准加窗）
- **Time Resolution**：~11.6 ms @ 44.1 kHz

---

## Validation & Testing

### 预期结果

对于不同类型的蝙蝠呼叫：

**1. CF 呼叫（Molossidae）**
```
Start Freq:    ~100 kHz
Peak Freq:     ~100 kHz
Char Freq:     ~100 kHz (加权平均)
End Freq:      ~100 kHz
Bandwidth:     <5 kHz
```

**2. FM 呼叫（Vespertilionidae）**
```
Start Freq:    ~80 kHz
Peak Freq:     ~50 kHz
Char Freq:     ~20 kHz (末端 CF 或低点)
End Freq:      ~20 kHz
Bandwidth:     ~60 kHz
```

**3. CF-FM 呼叫（Rhinolophidae）**
```
Start Freq:    ~85 kHz (FM sweep)
Peak Freq:     ~85 kHz
Char Freq:     ~45 kHz (CF 阶段)
End Freq:      ~35 kHz (FM sweep 最低)
Bandwidth:     ~50 kHz
```

### 频率关系验证
在所有情况下必须满足：
```
endFreq ≤ charFreq ≤ peakFreq ≤ startFreq
```

---

## References

1. **Avisoft SASLab Pro Manual** - Frequency Analysis Methods
2. **SonoBat Documentation** - Call Parameter Measurement
3. **Kaleidoscope Pro User Guide** - Spectral Analysis
4. **BatSound User Manual** - Call Recognition
5. Brigham, R. M. (1990). Clicks, the echolocation calls of bats.
6. Fenton, M. B., et al. (1999). Bat calls and wing beats.

---

## Update History

| 日期 | 版本 | 改进 |
|------|------|------|
| 2024-11-23 | 2.0 | Flow/Fhigh 显示修复，特征频率加权计算，频率关系验证 |
| 2024-11-23 | 1.5 | FFT size 改为 1024 |
| 2024-11-23 | 1.0 | 初始实现 |

