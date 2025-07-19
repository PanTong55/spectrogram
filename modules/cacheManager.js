// Use Maps to preserve insertion order for a simple LRU strategy
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

function estimateCanvasSize(img) {
  if (!img) return 0;
  const w = img.width || 0;
  const h = img.height || 0;
  return w * h * 4;
}

export function getMemoryUsage() {
  let size = 0;
  for (const v of audioCache.values()) size += estimateAudioSize(v);
  for (const c of imageCache.values()) size += estimateCanvasSize(c);
  return size;
}

function ensureLimit() {
  let usage = getMemoryUsage();
  if (usage <= memoryLimit) return;
  // remove oldest entries until under the limit
  const removeOldest = () => {
    const aKey = audioCache.keys().next().value;
    const iKey = imageCache.keys().next().value;
    const aSize = aKey !== undefined ? estimateAudioSize(audioCache.get(aKey)) : 0;
    const iSize = iKey !== undefined ? estimateCanvasSize(imageCache.get(iKey)) : 0;
    if (aSize >= iSize && aKey !== undefined) {
      audioCache.delete(aKey);
    } else if (iKey !== undefined) {
      imageCache.delete(iKey);
    } else if (aKey !== undefined) {
      audioCache.delete(aKey);
    }
  };
  while (usage > memoryLimit && (audioCache.size || imageCache.size)) {
    removeOldest();
    usage = getMemoryUsage();
  }
}

export async function decodeAudio(file, audioCtx = null) {
  const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const buf = await file.arrayBuffer();
  const decoded = await ctx.decodeAudioData(buf.slice(0));
  if (!audioCtx) {
    try { ctx.close(); } catch (err) { /* noop */ }
  }
  return decoded;
}

export async function renderSpectrogram(buffer, fftSize = 1024, overlap = 0) {
  const worker = new Worker('./spectrogramWorker.js', { type: 'module' });
  return new Promise((resolve) => {
    worker.onmessage = (e) => {
      if (e.data.type === 'rendered') {
        const bmp = e.data.bitmap;
        worker.terminate();
        resolve(bmp);
      }
    };
    worker.postMessage({
      type: 'render',
      buffer: buffer.getChannelData(0),
      sampleRate: buffer.sampleRate,
      fftSize,
      overlap,
      returnBitmap: true
    }, [buffer.getChannelData(0).buffer]);
  });
}

export async function preloadFile(index, file, opts = {}) {
  if (!file || (audioCache.has(index) && imageCache.has(index))) return;
  try {
    const audio = await decodeAudio(file, opts.audioCtx);
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
  const buf = audioCache.get(index);
  if (buf) {
    // refresh entry for LRU
    audioCache.delete(index);
    audioCache.set(index, buf);
  }
  return buf;
}

export function getSpectrogramImage(index) {
  const img = imageCache.get(index);
  if (img) {
    imageCache.delete(index);
    imageCache.set(index, img);
  }
  return img;
}
