// modules/brightnessControl.js

export function initBrightnessControl({
  brightnessSliderId,
  gainSliderId,
  brightnessValId,
  gainValId,
  resetBtnId,
  defaultBrightness = 0,
  defaultGain = 1,
  onColorMapUpdated,
}) {
  const brightnessSlider = document.getElementById(brightnessSliderId);
  const gainSlider = document.getElementById(gainSliderId);
  const brightnessVal = document.getElementById(brightnessValId);
  const gainVal = document.getElementById(gainValId);
  const resetBtn = document.getElementById(resetBtnId);

  function updateColorMap() {
    const brightness = parseFloat(brightnessSlider.value);
    const gain = parseFloat(gainSlider.value);

    brightnessVal.textContent = brightness.toFixed(2);
    gainVal.textContent = gain.toFixed(2);

    const colorMap = Array.from({ length: 256 }, (_, i) => {
      const t = Math.pow(i / 255, gain);
      let v = 1 - t + brightness;
      v = Math.max(0, Math.min(1, v));
      return [v, v, v, 1];
    });

    if (typeof onColorMapUpdated === 'function') {
      onColorMapUpdated(colorMap);
    }
  }

  brightnessSlider.addEventListener('input', updateColorMap);
  gainSlider.addEventListener('input', updateColorMap);

  resetBtn.addEventListener('click', () => {
    brightnessSlider.value = defaultBrightness;
    gainSlider.value = defaultGain;
    updateColorMap();
  });

  // 初次初始化
  updateColorMap();
}
