// modules/wsManager.js

import WaveSurfer from './wavesurfer.esm.js';
import Spectrogram from './spectrogram.esm.js';
import SpectrogramFlash from './spectrogram-flash.esm.js';

let ws = null;
let plugin = null;
let currentColorMap = null;
let currentFftSize = 1024;
let currentWindowType = 'hann';

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
  };

  if (noverlap !== null) {
    baseOptions.noverlap = noverlap;
  }

  return Spectrogram.create(baseOptions);
}

export function createSpectrogramFlashPlugin({
  colorMap,
  height = 800,
  frequencyMin = 10,
  frequencyMax = 128,
  fftSamples = 1024,
  noverlap = null,
  windowFunc = 'hann',
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
  };

  if (noverlap !== null) {
    baseOptions.noverlap = noverlap;
  }

  return SpectrogramFlash.create(baseOptions);
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
  useFlash = false
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

  // Choose the optimized 'flash' plugin for lower overlap percentages when requested
  if (useFlash) {
    plugin = createSpectrogramFlashPlugin({
      colorMap,
      height,
      frequencyMin,
      frequencyMax,
      fftSamples,
      noverlap,
      windowFunc,
    });
    // mark which plugin type we created for consumers to check
    plugin.isFlashPlugin = true;
  } else {
    plugin = createSpectrogramPlugin({
      colorMap,
      height,
      frequencyMin,
      frequencyMax,
      fftSamples,
      noverlap,
      windowFunc,
    });
    plugin.isFlashPlugin = false;
  }
  

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

export function initScrollSync({
  scrollSourceId,
  scrollTargetId,
}) {
  let source = document.getElementById(scrollSourceId);
  let target = document.getElementById(scrollTargetId);

  if (!source || !target) {
    console.warn(`[scrollSync] One or both elements not found.`);
    return;
  }

  // Debounce flag to prevent excessive updates
  let isUpdatingTarget = false;
  let isUpdatingSource = false;

  const syncSourceToTarget = () => {
    if (isUpdatingTarget) return;
    isUpdatingSource = true;
    target.scrollLeft = source.scrollLeft;
    isUpdatingSource = false;
  };

  const syncTargetToSource = () => {
    if (isUpdatingSource) return;
    isUpdatingTarget = true;
    source.scrollLeft = target.scrollLeft;
    isUpdatingTarget = false;
  };

  // Use passive listeners for better scroll performance
  source.addEventListener('scroll', syncSourceToTarget, { passive: true });
  target.addEventListener('scroll', syncTargetToSource, { passive: true });

  // Also handle resize events to ensure sync works after zoom
  const resizeObserver = new ResizeObserver(() => {
    // Force sync when size changes
    syncSourceToTarget();
  });

  resizeObserver.observe(source);
  resizeObserver.observe(target);

  // Return cleanup function for potential future use
  return () => {
    source.removeEventListener('scroll', syncSourceToTarget);
    target.removeEventListener('scroll', syncTargetToSource);
    resizeObserver.disconnect();
  };
}
