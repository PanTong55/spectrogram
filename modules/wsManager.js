// modules/wsManager.js

import WaveSurfer from './wavesurfer.esm.js';
import Spectrogram from './spectrogram.esm.js';

let ws = null;
let plugin = null;
let currentColorMap = null;
let currentFftSize = 1024;
let currentWindowType = 'hann';
let currentPeakMode = false;
let currentPeakThreshold = 0.4;

export function initWavesurfer({
  container,
  url,
  sampleRate = 256000,
}) {
  ws = WaveSurfer.create({
    container,
    height: 0,
    interact: false,
    cursorWidth: 0,
    url,
    sampleRate,
  });

  return ws;
}

export function createSpectrogramPlugin({
  colorMap,
  height = 800,
  frequencyMin = 10,
  frequencyMax = 128,
  fftSamples = 1024,
  noverlap = null,
  windowFunc = 'hann',
  peakMode = false,
  peakThreshold = 0.4,
}) {
  const baseOptions = {
    labels: false,
    height,
    fftSamples,
    frequencyMin: frequencyMin * 1000,
    frequencyMax: frequencyMax * 1000,
    scale: 'linear',
    windowFunc,
    colorMap,
    peakMode,
    peakThreshold,
  };

  if (noverlap !== null) {
    baseOptions.noverlap = noverlap;
  }

  return Spectrogram.create(baseOptions);
}

export function replacePlugin(
  colorMap,
  height = 800,
  frequencyMin = 10,
  frequencyMax = 128,
  overlapPercent = null,
  onRendered = null,  // ✅ 傳入 callback
  fftSamples = currentFftSize,
  windowFunc = currentWindowType,
  peakMode = currentPeakMode,
  peakThreshold = currentPeakThreshold
) {
  if (!ws) throw new Error('Wavesurfer not initialized.');
  const container = document.getElementById("spectrogram-only");

  // ✅ 改進：完全清理舊 plugin 和 canvas
  const oldCanvas = container.querySelector("canvas");
  if (oldCanvas) {
    oldCanvas.remove();
  }

  if (plugin?.destroy) {
    plugin.destroy();
    plugin = null;  // ✅ 確保 plugin 引用被清空
  }

  // ✅ 強制重新設置 container 寬度為預設值（避免殘留的大尺寸）
  container.style.width = '100%';

  currentColorMap = colorMap;

  currentFftSize = fftSamples;
  currentWindowType = windowFunc;
  const noverlap = overlapPercent !== null
    ? Math.floor(fftSamples * (overlapPercent / 100))
    : null;

  plugin = createSpectrogramPlugin({
    colorMap,
    height,
    frequencyMin,
    frequencyMax,
    fftSamples,
    noverlap,
    windowFunc,
    peakMode,
    peakThreshold,
  });

  ws.registerPlugin(plugin);

  try {
    plugin.render();
    requestAnimationFrame(() => {
      if (typeof onRendered === 'function') onRendered();
    });
  } catch (err) {
    console.warn('⚠️ Spectrogram render failed:', err);
  }
}

export function getWavesurfer() {
  return ws;
}

export function getPlugin() {
  return plugin;
}

export function getCurrentColorMap() {
  return currentColorMap;
}

export function getCurrentFftSize() {
  return currentFftSize;
}

export function getCurrentWindowType() {
  return currentWindowType;
}

export function setPeakMode(peakMode) {
  currentPeakMode = peakMode;
}

export function setPeakThreshold(peakThreshold) {
  currentPeakThreshold = peakThreshold;
}

export function getPeakThreshold() {
  return currentPeakThreshold;
}

export function initScrollSync({
  scrollSourceId,
  scrollTargetId,
}) {
  const source = document.getElementById(scrollSourceId);
  const target = document.getElementById(scrollTargetId);

  if (!source || !target) {
    console.warn(`[scrollSync] One or both elements not found.`);
    return;
  }

  source.addEventListener('scroll', () => {
    target.scrollLeft = source.scrollLeft;
  });
}

// 計算指定音頻段的峰值頻率 - 使用與 spectrogram 一致的 FFT 算法
export function calculatePeakFrequencyInRange(audioData, sampleRate, fftSize, windowFunc, freqMin, freqMax) {
  if (!audioData || audioData.length < fftSize) return null;

  try {
    // 創建臨時的 FFT 實例進行計算
    // 這裡我們使用與 spectrogram.esm.js 相同的窗函數
    const FFTCalc = new (function() {
      const bufferSize = fftSize;
      const SR = sampleRate;
      
      // 初始化窗函數值
      const windowValues = new Float32Array(bufferSize);
      const reverseBits = (num, bits) => {
        let result = 0;
        for (let i = 0; i < bits; i++) {
          result = (result << 1) | (num & 1);
          num >>= 1;
        }
        return result;
      };
      
      // 設置窗函數（與 spectrogram 一致）
      for (let i = 0; i < bufferSize; i++) {
        let w = 1.0;
        if (windowFunc === 'hann') {
          w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (bufferSize - 1)));
        } else if (windowFunc === 'hamming') {
          w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (bufferSize - 1));
        } else if (windowFunc === 'blackman') {
          w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (bufferSize - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (bufferSize - 1));
        }
        windowValues[i] = w;
      }
      
      this.windowValues = windowValues;
      this.bufferSize = bufferSize;
      this.sampleRate = SR;
      this.peak = 0;
      this.peakBand = 0;
      
      // 初始化 FFT 表
      const bits = Math.floor(Math.log2(bufferSize));
      const reverseTable = new Uint32Array(bufferSize);
      for (let i = 0; i < bufferSize; i++) {
        reverseTable[i] = reverseBits(i, bits);
      }
      this.reverseTable = reverseTable;
      
      // Sin/Cos 表
      this.sinTable = new Float32Array(bufferSize);
      this.cosTable = new Float32Array(bufferSize);
      for (let i = 0; i < bufferSize; i++) {
        this.sinTable[i] = Math.sin(-Math.PI / i);
        this.cosTable[i] = Math.cos(-Math.PI / i);
      }
      
      // 臨時數組
      this._o = new Float32Array(bufferSize);
      this._l = new Float32Array(bufferSize);
      this._f = new Float32Array(bufferSize >> 1);
      
      // calculateSpectrum - 與 spectrogram.esm.js 相同的實現
      this.calculateSpectrum = function(frame) {
        const t = frame;
        const i = this.bufferSize;
        const a = this.cosTable;
        const n = this.sinTable;
        const h = this.reverseTable;
        const o = this._o;
        const l = this._l;
        const c = 2 / this.bufferSize;
        const u = Math.sqrt;
        const f = this._f;
        
        if (i !== t.length) throw "Buffer size mismatch";
        
        // Bit-reversal permutation
        for (let k = 0; k < i; k++) {
          o[k] = t[h[k]] * this.windowValues[h[k]];
          l[k] = 0;
        }
        
        // Cooley-Tukey FFT
        let T = 1;
        while (T < i) {
          const d = a[T];
          const w = n[T];
          let g = 1;
          let b = 0;
          
          for (let z = 0; z < T; z++) {
            for (let k = z; k < i; ) {
              const M = k + T;
              const m = g * o[M] - b * l[M];
              const y = g * l[M] + b * o[M];
              o[M] = o[k] - m;
              l[M] = l[k] - y;
              o[k] += m;
              l[k] += y;
              k += T << 1;
            }
            const v = g;
            g = v * d - b * w;
            b = v * w + b * d;
          }
          T <<= 1;
        }
        
        // 計算譜幅度並找峰值
        let maxMag = 0;
        let peakBin = 0;
        const nyquist = i / 2;
        const freqMinBin = Math.floor(freqMin * 1000 * i / SR);
        const freqMaxBin = Math.ceil(freqMax * 1000 * i / SR);
        
        for (let k = Math.max(1, freqMinBin); k < Math.min(nyquist, freqMaxBin); k++) {
          const e = o[k];
          const s = l[k];
          const r = c * u(e * e + s * s);
          f[k] = r;
          
          if (r > maxMag) {
            maxMag = r;
            peakBin = k;
          }
        }
        
        this.peak = maxMag;
        this.peakBand = peakBin;
        return f;
      };
    })();
    
    // 計算滑動窗口的平均峰值
    let totalPeakFreq = 0;
    let windowCount = 0;
    const hopSize = Math.floor(fftSize / 2);
    
    for (let i = 0; i + fftSize <= audioData.length; i += hopSize) {
      const frame = audioData.slice(i, i + fftSize);
      FFTCalc.calculateSpectrum(frame);
      
      if (FFTCalc.peakBand > 0) {
        const freqHz = (FFTCalc.peakBand * sampleRate) / fftSize;
        const freqKHz = freqHz / 1000;
        totalPeakFreq += freqKHz;
        windowCount++;
      }
    }
    
    if (windowCount > 0) {
      return totalPeakFreq / windowCount;
    }
    
    return null;
  } catch (err) {
    console.warn('calculatePeakFrequencyInRange 錯誤:', err);
    return null;
  }
}
