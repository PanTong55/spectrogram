let canvas, ctx, sampleRate = 44100;

self.onmessage = (e) => {
  const { type } = e.data;
  if (type === 'init') {
    canvas = e.data.canvas;
    sampleRate = e.data.sampleRate || sampleRate;
    ctx = canvas.getContext('2d');
  } else if (type === 'render') {
    if (!ctx) return;
    // noiseCorrection flag optionally provided
    renderSpectrogram(e.data.buffer, e.data.sampleRate || sampleRate, e.data.fftSize || 1024, e.data.overlap || 0, !!e.data.noiseCorrection);
  }
};

function renderSpectrogram(signal, sr, fftSize, overlapPct, noiseCorrection) {
  const hop = Math.max(1, Math.floor(fftSize * (1 - overlapPct / 100)));
  const width = Math.max(1, Math.ceil((signal.length - fftSize) / hop));
  const height = fftSize / 2;
  canvas.width = width;
  canvas.height = height;
  // We'll first compute dB-like values for every time/frequency point,
  // optionally compute and apply a noise baseline per frequency, then map to image.
  const img = ctx.createImageData(width, height);
  const window = hannWindow(fftSize);
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  // Store dB values in flattened array: index = x + y * width
  const transformed = new Float32Array(width * height);

  for (let x = 0, i = 0; i + fftSize <= signal.length; i += hop, x++) {
    for (let j = 0; j < fftSize; j++) {
      real[j] = signal[i + j] * window[j];
      imag[j] = 0;
    }
    fft(real, imag);
    for (let y = 0; y < height; y++) {
      const mag = Math.sqrt(real[y] * real[y] + imag[y] * imag[y]);
      // Use log10(magnitude) as a dB-like value (consistent with prior behaviour)
      const db = Math.log10(mag + 1e-12);
      transformed[x + y * width] = db;
    }
  }

  // Noise baseline correction: approximate Batgizmo behaviour
  // - decimate in time to ~100 samples per frequency bin for performance
  // - compute 20th percentile (quickselect) per frequency bin
  // - subtract mean of baseline so average is zero
  // - apply a linear high-frequency uplift to avoid over-emphasising high freq noise
  if (noiseCorrection) {
    const baseline = new Float32Array(height);
    const targetSamplesToUse = 100; // aim for ~100 samples per frequency for percentile
    // decimation step (same for every bin for simplicity)
    const decimationStep = Math.max(1, Math.floor(width / targetSamplesToUse));
    let sum = 0;

    // quickselect to find k-th smallest (in-place on JS Array)
    function quickselect(arr, k) {
      if (arr.length === 0) return undefined;
      let left = 0, right = arr.length - 1;
      while (true) {
        if (left === right) return arr[left];
        let pivotIndex = left + Math.floor(Math.random() * (right - left + 1));
        pivotIndex = partition(arr, left, right, pivotIndex);
        if (k === pivotIndex) return arr[k];
        else if (k < pivotIndex) right = pivotIndex - 1;
        else left = pivotIndex + 1;
      }

      function partition(a, l, r, pIdx) {
        const pv = a[pIdx];
        swap(a, pIdx, r);
        let store = l;
        for (let i = l; i < r; i++) {
          if (a[i] < pv) { swap(a, store, i); store++; }
        }
        swap(a, store, r);
        return store;
      }

      function swap(a, i, j) { const t = a[i]; a[i] = a[j]; a[j] = t; }
    }

    for (let y = 0; y < height; y++) {
      // collect decimated column values
      const tmp = new Array();
      for (let x = 0; x < width; x += decimationStep) {
        tmp.push(transformed[x + y * width]);
      }

      // compute 20th percentile using quickselect (avoid full sort)
      let v = 0;
      if (tmp.length > 0) {
        const qIdx = Math.floor(0.2 * (tmp.length - 1));
        v = quickselect(tmp, qIdx);
      }
      baseline[y] = v;
      sum += v;
    }

    // subtract average so baseline mean is zero
    const avg = sum / height;
    for (let y = 0; y < height; y++) baseline[y] -= avg;

    // high-frequency linear adjustment (mirror Batgizmo smoothing)
    // parameters chosen to match Batgizmo's Kotlin: fCornerHz=80k, reductionFactor=10
    const fCornerHz = 80000;
    const reductionFactor = 10;
    const freqBinHz = sr / fftSize; // frequency per bin
    let freqCornerBucket = Math.round(fCornerHz / Math.max(1, freqBinHz));
    freqCornerBucket = Math.max(1, Math.min(freqCornerBucket, height - 1));
    for (let y = freqCornerBucket; y < height; y++) {
      const freqRatio = (y - freqCornerBucket) / freqCornerBucket;
      const deltaDb = freqRatio * reductionFactor;
      baseline[y] = baseline[y] + deltaDb;
    }

    // subtract baseline from transformed
    for (let y = 0; y < height; y++) {
      const b = baseline[y];
      for (let x = 0; x < width; x++) {
        transformed[x + y * width] = transformed[x + y * width] - b;
      }
    }
  }

  // Map transformed values to greyscale image (preserve previous scaling behaviour)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const db = transformed[x + y * width];
      let val = Math.max(0, Math.min(1, db / 5));
      const col = Math.floor(val * 255);
      const idx = (height - 1 - y) * width + x;
      img.data[idx * 4] = col;
      img.data[idx * 4 + 1] = col;
      img.data[idx * 4 + 2] = col;
      img.data[idx * 4 + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  self.postMessage({ type: 'rendered' });
}

function hannWindow(N) {
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  return win;
}

function fft(real, imag) {
  const n = real.length;
  let i = 0, j = 0, n1, n2, a, c, s, t1, t2;
  for (j = 1, i = 0; j < n - 1; j++) {
    n1 = n >> 1;
    while (i >= n1) { i -= n1; n1 >>= 1; }
    i += n1;
    if (j < i) { t1 = real[j]; real[j] = real[i]; real[i] = t1; t1 = imag[j]; imag[j] = imag[i]; imag[i] = t1; }
  }
  n1 = 0; n2 = 1;
  for (let l = 0; l < Math.log2(n); l++) {
    n1 = n2; n2 <<= 1; a = 0;
    for (j = 0; j < n1; j++) {
      c = Math.cos(-2 * Math.PI * j / n2);
      s = Math.sin(-2 * Math.PI * j / n2);
      for (i = j; i < n; i += n2) {
        const k = i + n1;
        t1 = c * real[k] - s * imag[k];
        t2 = s * real[k] + c * imag[k];
        real[k] = real[i] - t1; imag[k] = imag[i] - t2;
        real[i] += t1; imag[i] += t2;
      }
    }
  }
}
