// modules/frequencyRangeControl.js

export function initFrequencyRangeControl({
  freqMinInputId,
  freqMaxInputId,
  applyBtnId,
  spectrogramHeight,
  getCurrentColorMap,
  replacePlugin,
  getWavesurfer,
  zoomControl,
  onRangeUpdated = () => {},
}) {
  const freqMinInput = document.getElementById(freqMinInputId);
  const freqMaxInput = document.getElementById(freqMaxInputId);
  const applyBtn = document.getElementById(applyBtnId);

  let currentFreqMin = 0;
  let currentFreqMax = 128;

  function updateFrequencyRange(freqMin, freqMax) {
    const colorMap = getCurrentColorMap();
    currentFreqMin = freqMin;
    currentFreqMax = freqMax;

    replacePlugin(colorMap, spectrogramHeight, freqMin, freqMax);
    renderAxes();
    setTimeout(() => {
      const ws = getWavesurfer();
      if (ws) {
        zoomControl.applyZoom();
      }
      onRangeUpdated(freqMin, freqMax);
    }, 100);
  }

  applyBtn.addEventListener('click', () => {
    const min = Math.max(0, parseFloat(freqMinInput.value));
    const max = Math.min(128, parseFloat(freqMaxInput.value));

    if (isNaN(min) || isNaN(max) || min >= max) {
      alert('Please enter valid frequency values. Min must be less than Max.');
      return;
    }

    updateFrequencyRange(min, max);
  });

  return {
    getCurrentFreqMin: () => currentFreqMin,
    getCurrentFreqMax: () => currentFreqMax,
    updateFrequencyRange,
  };
}
