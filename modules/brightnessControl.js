// modules/brightnessControl.js

/**
 * Simplified Brightness/Contrast/Gain Control
 * Acts as a "dumb" UI controller that emits slider values.
 * The Spectrogram instance handles the actual image processing.
 */
export function initBrightnessControl({
  brightnessSliderId,
  gainSliderId,
  contrastSliderId,
  brightnessValId,
  gainValId,
  contrastValId,
  resetBtnId,
  defaultBrightness = 0.0,
  defaultGain = 1.0,
  defaultContrast = 1.0,
  onSettingsChanged, // Callback for slider value changes
}) {
  const brightnessSlider = document.getElementById(brightnessSliderId);
  const gainSlider = document.getElementById(gainSliderId);
  const contrastSlider = document.getElementById(contrastSliderId);
  const brightnessVal = document.getElementById(brightnessValId);
  const gainVal = document.getElementById(gainValId);
  const contrastVal = document.getElementById(contrastValId);
  const resetBtn = document.getElementById(resetBtnId);

  console.log('[BrightnessControl] Initializing controls...');

  // Initialize slider DOM attributes
  function initAttributes() {
    if (brightnessSlider) {
      brightnessSlider.min = -1;
      brightnessSlider.max = 1;
      brightnessSlider.step = 0.01;
      brightnessSlider.value = defaultBrightness;
    }
    if (gainSlider) {
      gainSlider.min = 0;
      gainSlider.max = 5;
      gainSlider.step = 0.01;
      gainSlider.value = defaultGain;
    }
    if (contrastSlider) {
      contrastSlider.min = 0;
      contrastSlider.max = 5;
      contrastSlider.step = 0.01;
      contrastSlider.value = defaultContrast;
    }
    updateLabels();
    console.log('[BrightnessControl] Sliders initialized:', {
      brightness: defaultBrightness,
      gain: defaultGain,
      contrast: defaultContrast
    });
  }

  // Update label text based on slider values
  function updateLabels() {
    if (brightnessVal && brightnessSlider) {
      brightnessVal.textContent = parseFloat(brightnessSlider.value).toFixed(2);
    }
    if (gainVal && gainSlider) {
      gainVal.textContent = parseFloat(gainSlider.value).toFixed(2);
    }
    if (contrastVal && contrastSlider) {
      contrastVal.textContent = parseFloat(contrastSlider.value).toFixed(2);
    }
  }

  // Emit the current settings to the callback
  function emitChanges() {
    updateLabels();
    
    const settings = {
      brightness: parseFloat(brightnessSlider.value),
      contrast: parseFloat(contrastSlider.value),
      gain: parseFloat(gainSlider.value)
    };
    
    console.log('[BrightnessControl] Settings changed:', settings);
    
    if (typeof onSettingsChanged === 'function') {
      onSettingsChanged(settings);
    }
  }

  // Bind slider events
  [brightnessSlider, gainSlider, contrastSlider].forEach(slider => {
    if (slider) {
      // Update label on input (live preview during drag)
      slider.addEventListener('input', updateLabels);
      // Emit to callback when slider is released (change event)
      slider.addEventListener('change', emitChanges);
    }
  });

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (brightnessSlider) brightnessSlider.value = defaultBrightness;
      if (gainSlider) gainSlider.value = defaultGain;
      if (contrastSlider) contrastSlider.value = defaultContrast;
      emitChanges();
    });
  }

  // Initialize
  initAttributes();
  // Emit initial settings
  emitChanges();
}

