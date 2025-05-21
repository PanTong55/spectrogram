export function generateColorMap(brightness, gain) {
  return Array.from({ length: 256 }, (_, i) => {
    const t = Math.pow(i / 255, gain);
    let v = 1 - t + brightness;
    v = Math.max(0, Math.min(1, v));
    return [v, v, v, 1];
  });
}

export function applyColorMap(ws, Spectrogram, brightness, gain, height = 900) {
  const colorMap = generateColorMap(brightness, gain);

  const plugin = Spectrogram.create({
    labels: false,
    height,
    fftSamples: 1024,
    frequencyMin: 0,
    frequencyMax: 128000,
    scale: 'linear',
    windowFunc: 'hann',
    colorMap
  });

  ws.registerPlugin(plugin);
  setTimeout(() => plugin.render(), 50);
  return plugin;
}
