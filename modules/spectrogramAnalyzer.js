import FFT from 'https://cdn.jsdelivr.net/npm/fft.js@0.3.0/dist/fft.min.js';

export class SpectrogramAnalyzer {
  constructor({
    audioBuffer,
    fftSamples = 1024,
    overlap = 0.75,
    frequencyMin = 0,
    frequencyMax = 128,
  }) {
    this.buffer = audioBuffer.getChannelData(0);
    this.sampleRate = audioBuffer.sampleRate;
    this.fftSamples = fftSamples;
    this.overlap = overlap;
    this.frequencyMin = frequencyMin;
    this.frequencyMax = frequencyMax;
    this.spectrogram = [];
    this.generateSpectrogram();
  }

  generateSpectrogram() {
    const hopSize = Math.floor(this.fftSamples * (1 - this.overlap));
    const fft = new FFT(this.fftSamples);
    const window = this.hannWindow(this.fftSamples);
    const bins = this.fftSamples / 2;
    const totalFrames = Math.floor((this.buffer.length - this.fftSamples) / hopSize);
    
    for (let i = 0; i < totalFrames; i++) {
      const start = i * hopSize;
      const segment = new Float32Array(this.fftSamples);
      for (let j = 0; j < this.fftSamples; j++) {
        segment[j] = (this.buffer[start + j] || 0) * window[j];
      }
      const out = fft.createComplexArray();
      fft.realTransform(out, segment);
      fft.completeSpectrum(out);

      const magnitudes = [];
      for (let k = 0; k < bins; k++) {
        const re = out[2 * k];
        const im = out[2 * k + 1];
        const mag = Math.sqrt(re * re + im * im);
        const db = 20 * Math.log10(mag + 1e-10);
        magnitudes.push(db);
      }
      this.spectrogram.push(magnitudes);
    }
  }

  hannWindow(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return window;
  }

  getSpectrogramData() {
    return this.spectrogram;
  }

  getFmaxFromSelection({
    startTime, endTime, Flow, Fhigh, totalDuration
  }) {
    const data = this.spectrogram;
    const timeBins = data.length;
    const freqBins = data[0].length;

    const timeStart = Math.max(0, Math.floor((startTime / totalDuration) * timeBins));
    const timeEnd = Math.min(timeBins - 1, Math.ceil((endTime / totalDuration) * timeBins));

    const freqStart = Math.max(0, Math.floor((Flow / this.frequencyMax) * freqBins));
    const freqEnd = Math.min(freqBins - 1, Math.ceil((Fhigh / this.frequencyMax) * freqBins));

    let maxDb = -Infinity;
    let maxFreqBin = freqStart;

    for (let t = timeStart; t <= timeEnd; t++) {
      for (let f = freqStart; f <= freqEnd; f++) {
        if (data[t][f] > maxDb) {
          maxDb = data[t][f];
          maxFreqBin = f;
        }
      }
    }

    const Fmax = (maxFreqBin / freqBins) * this.frequencyMax;
    return Fmax;
  }
}
