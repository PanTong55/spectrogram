// modules/wsManager.js 的增强版本

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';
import Spectrogram from 'https://unpkg.com/wavesurfer.js@7.9.5/dist/plugins/spectrogram.esm.js';

let ws = null;
let plugin = null;
let currentColorMap = null;
let actualNoverlap = null; // ✅ 存储实际使用的 noverlap 值

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
  frequencyMin = 0,
  frequencyMax = 128000,
  noverlap = null,
}) {
  const baseOptions = {
    labels: false,
    height,
    fftSamples: 1024,
    frequencyMin: frequencyMin * 1000,
    frequencyMax: frequencyMax * 1000,
    scale: 'linear',
    windowFunc: 'hann',
    colorMap,
  };

  if (noverlap !== null) {
    baseOptions.noverlap = noverlap;
  }

  return Spectrogram.create(baseOptions);
}

// ✅ 方案1: 通过反射获取插件内部属性
function extractActualNoverlap(plugin) {
  try {
    // 尝试多种可能的属性路径
    const possiblePaths = [
      'noverlap',
      'options.noverlap', 
      '_noverlap',
      'params.noverlap',
      'config.noverlap'
    ];
    
    for (const path of possiblePaths) {
      const value = getNestedProperty(plugin, path);
      if (typeof value === 'number') {
        console.log(`✅ 找到 noverlap 在: ${path} = ${value}`);
        return value;
      }
    }
    
    // 尝试检查所有可枚举属性
    console.log('🔍 插件的所有属性:', Object.keys(plugin));
    console.log('🔍 插件原型属性:', Object.getOwnPropertyNames(Object.getPrototypeOf(plugin)));
    
    return null;
  } catch (error) {
    console.warn('⚠️ 获取 noverlap 时出错:', error);
    return null;
  }
}

// ✅ 方案2: 通过 Canvas 分析推断 overlap
function estimateOverlapFromCanvas(plugin) {
  try {
    const canvas = document.querySelector('#spectrogram-only canvas');
    if (!canvas) return null;
    
    // 获取音频持续时间和 canvas 宽度
    const duration = ws?.getDuration();
    const canvasWidth = canvas.width;
    
    if (!duration || !canvasWidth) return null;
    
    // 根据 STFT 原理计算
    const sampleRate = ws?.options?.sampleRate || 256000;
    const fftSize = 1024;
    const hopSize = fftSize - (actualNoverlap || 0);
    
    // 通过时间分辨率反推
    const expectedTimeFrames = Math.floor((duration * sampleRate - fftSize) / hopSize) + 1;
    const actualTimeFrames = canvasWidth;
    
    // 如果匹配，说明我们的推测正确
    const ratio = actualTimeFrames / expectedTimeFrames;
    console.log(`🔍 时间帧比例: ${ratio}, 预期: ${expectedTimeFrames}, 实际: ${actualTimeFrames}`);
    
    return null; // 这个方法比较复杂，暂时返回 null
  } catch (error) {
    console.warn('⚠️ Canvas 分析出错:', error);
    return null;
  }
}

// ✅ 方案3: 创建测试插件来获取默认值（推荐）
async function getDefaultNoverlap() {
  try {
    // 创建一个临时的 spectrogram 插件来获取默认配置
    const tempOptions = {
      labels: false,
      height: 100,
      fftSamples: 1024,
      frequencyMin: 0,
      frequencyMax: 128000,
      scale: 'linear',
      windowFunc: 'hann',
      colorMap: [],
    };
    
    const tempPlugin = Spectrogram.create(tempOptions);
    
    // 尝试访问内部属性
    const noverlap = extractActualNoverlap(tempPlugin);
    
    // 清理临时插件
    if (tempPlugin?.destroy) {
      tempPlugin.destroy();
    }
    
    return noverlap;
  } catch (error) {
    console.warn('⚠️ 获取默认 noverlap 失败:', error);
    return null;
  }
}

function getNestedProperty(obj, path) {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

export function replacePlugin(
  colorMap,
  height = 800,
  frequencyMin = 0,
  frequencyMax = 128,
  overlapPercent = null,
  onRendered = null
) {
  if (!ws) throw new Error('Wavesurfer not initialized.');
  const container = document.getElementById("spectrogram-only");

  const oldCanvas = container.querySelector("canvas");
  if (oldCanvas) oldCanvas.remove();

  if (plugin?.destroy) plugin.destroy();

  currentColorMap = colorMap;

  const fftSamples = 1024;
  const noverlap = overlapPercent !== null
    ? Math.floor(fftSamples * (overlapPercent / 100))
    : null;

  plugin = createSpectrogramPlugin({
    colorMap,
    height,
    frequencyMin,
    frequencyMax,
    noverlap,
  });

  ws.registerPlugin(plugin);

  try {
    plugin.render();
    
    // ✅ 渲染完成后尝试获取实际的 noverlap 值
    requestAnimationFrame(async () => {
      if (overlapPercent === null) {
        // 当设置为 Auto 时，尝试获取实际值
        let detectedNoverlap = extractActualNoverlap(plugin);
        
        if (detectedNoverlap === null) {
          // 如果直接获取失败，尝试获取默认值
          detectedNoverlap = await getDefaultNoverlap();
        }
        
        if (detectedNoverlap === null) {
          // 最后尝试 Canvas 分析
          detectedNoverlap = estimateOverlapFromCanvas(plugin);
        }
        
        actualNoverlap = detectedNoverlap;
        console.log(`🎯 检测到的 noverlap: ${actualNoverlap}`);
      } else {
        actualNoverlap = noverlap;
      }
      
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

// ✅ 获取实际使用的 noverlap 值
export function getActualNoverlap() {
  return actualNoverlap;
}
