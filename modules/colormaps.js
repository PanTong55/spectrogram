// modules/colormaps.js
// Provides predefined color maps for the spectrogram viewer.

function generateGrayscale() {
  const arr = [];
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    arr.push([v, v, v, 1]);
  }
  return arr;
}

function interpolateStops(stops) {
  const result = [];
  const n = stops.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const seg = Math.min(n - 1, Math.floor(t * n));
    const localT = (t - seg / n) * n;
    const [r1, g1, b1] = stops[seg];
    const [r2, g2, b2] = stops[seg + 1];
    const r = r1 + (r2 - r1) * localT;
    const g = g1 + (g2 - g1) * localT;
    const b = b1 + (b2 - b1) * localT;
    result.push([r, g, b, 1]);
  }
  return result;
}

function generateViridis() {
  const stops = [
    [68 / 255, 1 / 255, 84 / 255],    // #440154
    [59 / 255, 82 / 255, 139 / 255],  // #3b528b
    [33 / 255, 145 / 255, 140 / 255], // #21908c
    [94 / 255, 201 / 255, 98 / 255],  // #5ec962
    [253 / 255, 231 / 255, 37 / 255]  // #fde725
  ];
  return interpolateStops(stops);
}

function generateRGB() {
  const arr = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r = 0, g = 0, b = 0;
    if (t < 0.5) {
      const u = t * 2;
      r = 1 - u;
      g = u;
    } else {
      const u = (t - 0.5) * 2;
      g = 1 - u;
      b = u;
    }
    arr.push([r, g, b, 1]);
  }
  return arr;
}

export const COLOR_MAPS = {
  grayscale: generateGrayscale(),
  viridis: generateViridis(),
  rgb: generateRGB(),
};

export const COLOR_MAP_ITEMS = [
  { label: 'Grayscale', value: 'grayscale' },
  { label: 'Viridis', value: 'viridis' },
  { label: 'Red, Green, Blue', value: 'rgb' },
];

export function getColorMap(name) {
  return COLOR_MAPS[name] || COLOR_MAPS.grayscale;
}
