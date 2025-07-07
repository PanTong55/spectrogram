const cache = new WeakMap();

export function saveSpectrogram(key, dataUrl) {
  if (key && dataUrl) {
    cache.set(key, dataUrl);
  }
}

export function getSpectrogram(key) {
  return cache.get(key) || null;
}

export function displayCachedSpectrogram(key, containerId = 'spectrogram-only') {
  const dataUrl = cache.get(key);
  const container = document.getElementById(containerId);
  const img = container ? container.querySelector('#spectrogram-img') : null;
  const canvas = container ? container.querySelector('canvas') : null;
  if (!container || !img) return false;
  if (dataUrl) {
    img.src = dataUrl;
    img.style.display = 'block';
    if (canvas) canvas.style.display = 'none';
    return true;
  } else {
    img.style.display = 'none';
    if (canvas) canvas.style.display = 'block';
    return false;
  }
}
