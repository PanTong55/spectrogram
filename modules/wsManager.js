// modules/wsManager.js

import WaveSurfer from './wavesurfer.esm.js';
import Spectrogram from './spectrogram.esm.js';

const SEGMENT_PX = 3000;

function drawSpectrogramSegmented(data) {
  if (isNaN(data[0][0])) data = [data];
  this.wrapper.style.height = this.height * data.length + 'px';
  const totalWidth = this.getWidth();
  this.canvas.width = totalWidth;
  this.canvas.height = this.height * data.length;
  const ctx = this.spectrCc;
  const chHeight = this.height;
  const nyquist = this.buffer.sampleRate / 2;
  const fmin = this.frequencyMin;
  const fmax = this.frequencyMax;
  if (!ctx) return;
  if (fmax > nyquist) {
    const col = this.colorMap[this.colorMap.length - 1];
    ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${col[3]})`;
    ctx.fillRect(0, 0, totalWidth, chHeight * data.length);
  }

  const done = new Array(data.length).fill(false);

  const drawChunk = (channel, start) => {
    const resampled = this._resampled[channel] || this.resample(data[channel]);
    this._resampled[channel] = resampled;
    const sliceHeight = resampled[0].length;
    const end = Math.min(start + SEGMENT_PX, resampled.length);
    const segWidth = end - start;
    const image = new ImageData(segWidth, sliceHeight);

    for (let x = start; x < end; x++) {
      for (let y = 0; y < resampled[x].length; y++) {
        const col = this.colorMap[resampled[x][y]];
        const idx = 4 * ((sliceHeight - y - 1) * segWidth + (x - start));
        image.data[idx] = 255 * col[0];
        image.data[idx + 1] = 255 * col[1];
        image.data[idx + 2] = 255 * col[2];
        image.data[idx + 3] = 255 * col[3];
      }
    }

    const u = this.hzToScale(fmin) / this.hzToScale(nyquist);
    const f = this.hzToScale(fmax) / this.hzToScale(nyquist);
    const p = Math.min(1, f);

    createImageBitmap(image, 0, Math.round(sliceHeight * (1 - p)), segWidth,
      Math.round(sliceHeight * (p - u))).then(bitmap => {
      ctx.drawImage(bitmap, start, chHeight * (channel + 1 - p / f), segWidth,
        chHeight * p / f);
      if (end < resampled.length) {
        requestAnimationFrame(() => drawChunk(channel, end));
      } else {
        done[channel] = true;
        if (done.every(Boolean)) {
          if (this.options.labels) {
            this.loadLabels(
              this.options.labelsBackground,
              '12px',
              '12px',
              '',
              this.options.labelsColor,
              this.options.labelsHzColor || this.options.labelsColor,
              'center',
              '#specLabels',
              data.length,
            );
          }
          this.emit('ready');
        }
      }
    });
  };

  this._resampled = [];
  for (let c = 0; c < data.length; c++) {
    drawChunk(c, 0);
  }
}

let ws = null;
let plugin = null;
let currentColorMap = null;
let currentFftSize = 1024;

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
}) {
  const baseOptions = {
    labels: false,
    height,
    fftSamples,
    frequencyMin: frequencyMin * 1000,
    frequencyMax: frequencyMax * 1000,
    scale: 'linear',
    windowFunc: 'hann',
    colorMap,
  };

  if (noverlap !== null) {
    baseOptions.noverlap = noverlap;
  }

  const inst = Spectrogram.create(baseOptions);
  const originalDraw = inst.drawSpectrogram;
  inst.drawSpectrogram = function(data) {
    if (this.getWidth() > SEGMENT_PX) {
      drawSpectrogramSegmented.call(this, data);
    } else {
      originalDraw.call(this, data);
    }
  };
  return inst;
}

export function replacePlugin(
  colorMap,
  height = 800,
  frequencyMin = 10,
  frequencyMax = 128,
  overlapPercent = null,
  onRendered = null,  // ✅ 傳入 callback
  fftSamples = currentFftSize
) {
  if (!ws) throw new Error('Wavesurfer not initialized.');
  const container = document.getElementById("spectrogram-only");

  const oldCanvas = container.querySelector("canvas");
  if (oldCanvas) oldCanvas.remove();

  if (plugin?.destroy) plugin.destroy();

  currentColorMap = colorMap;

  currentFftSize = fftSamples;
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
