// modules/brightnessControl.js

export function initBrightnessControl({
  brightnessSliderId,
  gainSliderId,
  contrastSliderId,
  brightnessValId,
  gainValId,
  contrastValId,
  resetBtnId,
  defaultBrightness = 0,
  defaultGain = 2,
  defaultContrast = 1,
  onColorMapUpdated,
}) {
  const brightnessSlider = document.getElementById(brightnessSliderId);
  const gainSlider = document.getElementById(gainSliderId);
  const contrastSlider = document.getElementById(contrastSliderId);
  const brightnessVal = document.getElementById(brightnessValId);
  const gainVal = document.getElementById(gainValId);
  const contrastVal = document.getElementById(contrastValId);
  const resetBtn = document.getElementById(resetBtnId);

  // 👉 滑動中只更新顯示文字，不更新圖
  function updateSliderValues() {
    const brightness = parseFloat(brightnessSlider.value);
    const gain = parseFloat(gainSlider.value);
    const contrast = parseFloat(contrastSlider.value);
    brightnessVal.textContent = brightness.toFixed(2);
    gainVal.textContent = gain.toFixed(2);
    contrastVal.textContent = contrast.toFixed(2);
  }

  // 👉 真正重新生成 colorMap 並觸發外部 callback
  function updateColorMap() {
    const brightness = parseFloat(brightnessSlider.value);
    const gain = parseFloat(gainSlider.value);
    const contrast = parseFloat(contrastSlider.value);

    // 同步更新 UI
    brightnessVal.textContent = brightness.toFixed(2);
    gainVal.textContent = gain.toFixed(2);
    contrastVal.textContent = contrast.toFixed(2);

    const colorMap = Array.from({ length: 256 }, (_, i) => {
      const t = Math.pow(i / 255, gain);
      let v = 1 - t + brightness;
      v = (v - 0.5) * contrast + 0.5;
      v = Math.max(0, Math.min(1, v));
      return [v, v, v, 1];
    });

    if (typeof onColorMapUpdated === 'function') {
      onColorMapUpdated(colorMap);
    }
  }

  // 事件綁定 - 滑動時僅更新文字，放開後才更新圖表
  function handleInput() {
    updateSliderValues();
  }

  function handleChange() {
    updateColorMap();
  }

  brightnessSlider.addEventListener('input', handleInput);
  gainSlider.addEventListener('input', handleInput);
  contrastSlider.addEventListener('input', handleInput);
  brightnessSlider.addEventListener('change', handleChange);
  gainSlider.addEventListener('change', handleChange);
  contrastSlider.addEventListener('change', handleChange);

  resetBtn.addEventListener('click', () => {
    brightnessSlider.value = defaultBrightness;
    gainSlider.value = defaultGain;
    contrastSlider.value = defaultContrast;
    updateColorMap();
  });

  // 初次初始化
  updateColorMap();
}
