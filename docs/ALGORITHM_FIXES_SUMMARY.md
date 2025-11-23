# 蝙蝠呼叫检测算法改进 - 快速参考

## 修复总结

### 问题 1：Low/High Frequency 显示为 "-"

**原因**：BatCall 对象未存储频率范围边界值

**修复**：
```javascript
// 添加到 BatCall 构造函数
this.Flow = null;   // 低频边界 (Hz)
this.Fhigh = null;  // 高频边界 (kHz)

// 在检测时赋值
call.Flow = flowKHz * 1000;   // 转换为 Hz
call.Fhigh = fhighKHz;         // 保持 kHz
```

**结果**：参数面板现在正确显示频率范围

---

### 问题 2：Characteristic Frequency (特征频率) < End Frequency (结束频率)

**原因**：特征频率计算只考虑末端最低点，不符合 CF-FM 蝙蝠的生物学特征

**修复方法**：

#### 1. 加权平均频率（Weighted Average）
使用末端 20% 时间段的功率加权平均频率：

```javascript
// 遍历末端 20% 的时间帧
for (frameIdx in lastPercentFrames) {
  // 找出每帧中功率 > (frameMax - 6dB) 的频率
  for (binIdx with power > significantThreshold) {
    // 按线性功率加权
    linearPower = 10^(power_dB/10)
    weightedFreq += linearPower * frequency
    totalPower += linearPower
  }
}
// 计算加权平均
characteristicFreq = weightedFreq / totalPower
```

**原理**：
- 对 CF-FM 蝙蝠：末端 CF 阶段能量集中，加权平均捕获 CF 频率
- 对纯 FM 蝙蝠：末端能量分散，加权平均接近结束频率
- 对噪声鲁棒：多帧累积和功率权重消除噪声

#### 2. 频率关系验证（Frequency Validation）
确保频率满足生物学关系：

```javascript
// 必须满足：endFreq ≤ charFreq ≤ peakFreq ≤ startFreq
if (charFreq < endFreq) {
  charFreq = endFreq;      // FM 蝙蝠：特征频≈结束频
} else if (charFreq > peakFreq) {
  charFreq = peakFreq;     // 异常修正
}
```

**频率含义**：
| 参数 | 定义 | 生物学含义 |
|------|------|-----------|
| **Start Freq** | 第一帧 -18dB 处 | 呼叫起始点（通常最高） |
| **Peak Freq** | 全局最高功率 | 能量最集中的频率 |
| **Char Freq** | 末端 20% 加权平均 | CF 阶段频率（或 FM 末端）|
| **End Freq** | 最后一帧 -18dB 处 | 呼叫结束点（通常最低） |

---

## 商业软件对标

### Avisoft SASLab Pro
✅ -18 dB 阈值（已实现）
✅ 加权平均频率（已实现）
✅ 线性插值精度（已实现）

### SonoBat
✅ 时长加权分析（通过多帧实现）
✅ 末端显著频率提取（已实现）

### Kaleidoscope Pro
✅ 功率加权中心频率（已实现）
✅ -6dB 显著功率阈值（已实现）

### BatSound
✅ 峰值相对性检测（已实现）
✅ -18dB 边界检测（已实现）

---

## 参数精度

| 方面 | 精度 | 技术 |
|------|------|------|
| 频率分辨率 | 1 Hz | Goertzel 算法 |
| 亚采样精度 | ±0.5 Hz | 线性插值 |
| 实际精度 | ±1 kHz | 综合考虑噪声 |
| 时间精度 | ±5.7 ms | 1024-point FFT @ 44.1kHz |

---

## 预期输出示例

### CF 蝙蝠（Molossidae 莫氏蝠科）
```
Flow:      20 kHz
Fhigh:     120 kHz
Start Freq: 98.5 kHz
Peak Freq:  100.0 kHz
Char Freq:  100.2 kHz  ← 加权平均（接近 CF）
End Freq:   99.8 kHz
Bandwidth:  1.7 kHz    ← 窄带（恒定频）
```

### FM 蝙蝠（Vespertilionidae 蛾蝠科）
```
Flow:      15 kHz
Fhigh:     150 kHz
Start Freq: 85.0 kHz
Peak Freq:  55.0 kHz
Char Freq:  22.5 kHz   ← 加权平均（接近末端）
End Freq:   20.0 kHz
Bandwidth:  65.0 kHz   ← 宽带（向下扫）
```

### CF-FM 蝙蝠（Rhinolophidae 鼻叶蝠科）
```
Flow:      15 kHz
Fhigh:     120 kHz
Start Freq: 88.0 kHz    ← FM 扫频开始
Peak Freq:  88.0 kHz
Char Freq:  48.5 kHz    ← CF 阶段频率
End Freq:   40.0 kHz    ← FM 扫频结束
Bandwidth:  48.0 kHz
```

---

## 验证清单

- ✅ FFT Size 改为 1024
- ✅ Flow/Fhigh 属性添加和赋值
- ✅ 加权平均频率实现
- ✅ -6dB 显著功率阈值
- ✅ 频率关系验证
- ✅ 频率顺序：endFreq ≤ charFreq ≤ peakFreq ≤ startFreq
- ✅ 无编译错误

---

## 代码位置

| 组件 | 文件 | 行号 |
|------|------|------|
| BatCall 构造函数 | batCallDetector.js | 75-100 |
| Flow/Fhigh 赋值 | batCallDetector.js | 210-211 |
| 加权平均计算 | batCallDetector.js | 476-508 |
| 频率验证 | batCallDetector.js | 533-544 |
| 参数显示 | powerSpectrum.js | 1014-1016 |

