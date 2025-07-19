export const audioCache = new Map();
export const imageCache = new Map();
let memoryLimit = 100 * 1024 * 1024; // 100MB approx

export function setMemoryLimit(bytes) {
  memoryLimit = bytes;
}

export function clearCache() {
  audioCache.clear();
  imageCache.clear();
}

function estimateAudioSize(buf) {
  if (!buf) return 0;
  if (buf.byteLength) return buf.byteLength;
  if (buf.length) return buf.length * 4;
  if (buf.numberOfChannels) {
    let size = 0;
    for (let i = 0; i < buf.numberOfChannels; i++) {
      size += buf.getChannelData(i).byteLength;
    }
    return size;
  }
  return 0;
}

function estimateCanvasSize(canvas) {
  if (!canvas) return 0;
  return canvas.width * canvas.height * 4;
}

export function getMemoryUsage() {
  let size = 0;
  for (const v of audioCache.values()) size += estimateAudioSize(v);
  for (const c of imageCache.values()) size += estimateCanvasSize(c);
  return size;
}

function ensureLimit() {
  if (getMemoryUsage() > memoryLimit) {
    clearCache();
  }
}

export async function decodeAudio(file) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await file.arrayBuffer();
  return ctx.decodeAudioData(buf.slice(0));
}

export async function renderSpectrogram(buffer, fftSize = 1024, overlap = 0) {
  const canvas = new OffscreenCanvas(1, 1);
  const worker = new Worker('./spectrogramWorker.js', { type: 'module' });
  return new Promise((resolve) => {
    worker.onmessage = () => {
      worker.terminate();
      resolve(canvas);
    };
    worker.postMessage({ type: 'init', canvas, sampleRate: buffer.sampleRate }, [canvas]);
    worker.postMessage({ type: 'render', buffer: buffer.getChannelData(0), sampleRate: buffer.sampleRate, fftSize, overlap });
  });
}

export async function preloadFile(index, file, opts = {}) {
  if (!file || audioCache.has(index)) return;
  try {
    const audio = await decodeAudio(file);
    audioCache.set(index, audio);
    ensureLimit();
    const img = await renderSpectrogram(audio, opts.fftSize, opts.overlap);
    imageCache.set(index, img);
    ensureLimit();
  } catch (err) {
    console.warn('Preload failed', err);
  }
}

export function preloadNeighbors(currentIndex, fileList, opts = {}) {
  setTimeout(() => {
    if (currentIndex > 0) preloadFile(currentIndex - 1, fileList[currentIndex - 1], opts);
    if (currentIndex < fileList.length - 1) preloadFile(currentIndex + 1, fileList[currentIndex + 1], opts);
  }, 0);
}

export function getAudioBuffer(index) {
  return audioCache.get(index);
}

export function getSpectrogramImage(index) {
  return imageCache.get(index);
}
