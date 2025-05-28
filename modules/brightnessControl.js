// modules/brightnessControl.js

export function initBrightnessControl({
  brightnessSliderId,
  gainSliderId,
  brightnessValId,
  gainValId,
  resetBtnId,
  onColorMapUpdated,
  defaultBrightness = 0,
  defaultGain = 2,
}) {
  const brightnessSlider = document.getElementById(brightnessSliderId);
  const gainSlider = document.getElementById(gainSliderId);
  const brightnessVal = document.getElementById(brightnessValId);
  const gainVal = document.getElementById(gainValId);
  const resetButton = document.getElementById(resetBtnId);

  function updateVisualValues() {
    brightnessVal.textContent = parseFloat(brightnessSlider.value).toFixed(2);
    gainVal.textContent = parseFloat(gainSlider.value).toFixed(2);
  }

  function generateColorMap(brightness, gain) {
    const colorMap = [];
    for (let i = 0; i < 256; i++) {
      let value = i / 255;
      value = Math.pow(value, gain) * brightness;
      value = Math.max(0, Math.min(1, value));

      const rgb = Math.floor(value * 255);
      colorMap.push([rgb, rgb, rgb, 255]);
    }
    return colorMap;
  }

  let updateTimeout = null;
  function scheduleColorMapUpdate() {
    updateVisualValues();

    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
      const brightness = parseFloat(brightnessSlider.value);
      const gain = parseFloat(gainSlider.value);
      const colorMap = generateColorMap(brightness, gain);
      onColorMapUpdated(colorMap);
    }, 120);
  }

  brightnessSlider.addEventListener('input', scheduleColorMapUpdate);
  gainSlider.addEventListener('input', scheduleColorMapUpdate);

  resetButton.addEventListener('click', () => {
    brightnessSlider.value = defaultBrightness;
    gainSlider.value = defaultGain;
    updateVisualValues();

    const colorMap = generateColorMap(defaultBrightness, defaultGain);
    onColorMapUpdated(colorMap);
  });

  // ✅ 初始化 slider value 與 colorMap
  brightnessSlider.value = defaultBrightness;
  gainSlider.value = defaultGain;
  updateVisualValues();
  const initialColorMap = generateColorMap(defaultBrightness, defaultGain);
  onColorMapUpdated(initialColorMap);
}
