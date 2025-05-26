// modules/frequencyRangeUpdater.js

export function createFrequencyRangeUpdater({
  getCurrentColorMap,
  replacePlugin,
  getWavesurfer,
  spectrogramHeight,
  zoomControl,
  renderAxes,
  onUpdate = () => {},
}) {
  let currentFreqMin = 0;
  let currentFreqMax = 128;

  function updateFrequencyRange(freqMin, freqMax) {
    const colorMap = getCurrentColorMap();
    currentFreqMin = freqMin;
    currentFreqMax = freqMax;

    replacePlugin(colorMap, spectrogramHeight, freqMin, freqMax);

    const ws = getWavesurfer();
    if (ws) {
      zoomControl.applyZoom();
    }

    renderAxes();

    onUpdate(freqMin, freqMax);
  }

  return {
    updateFrequencyRange,
    getCurrentFreqMin: () => currentFreqMin,
    getCurrentFreqMax: () => currentFreqMax,
  };
}
