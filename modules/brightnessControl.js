// modules/brightnessControl.js

/**
 * Simplified Brightness/Contrast/Gain Control
 * Acts as a "dumb" UI controller that emits slider values.
 * The Spectrogram instance handles the actual image processing.
 * 
 * Returns a control object with a getter for current settings,
 * allowing main.js to restore settings when the plugin is recreated.
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
  onSettingsChanged,
  getResetValues, // [NEW] Callback to get dynamic defaults based on active color map
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
      // Do not overwrite value if it's already set (preserves state across re-inits if elements persist)
      if (!brightnessSlider.value) brightnessSlider.value = defaultBrightness;
    }
    if (gainSlider) {
      gainSlider.min = 0;
      gainSlider.max = 5;
      gainSlider.step = 0.01;
      if (!gainSlider.value) gainSlider.value = defaultGain;
    }
    if (contrastSlider) {
      contrastSlider.min = 0;
      contrastSlider.max = 5;
      contrastSlider.step = 0.01;
      if (!contrastSlider.value) contrastSlider.value = defaultContrast;
    }
    updateLabels();
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

  // Get current settings - used by main.js to restore settings
  function getCurrentSettings() {
    return {
      brightness: brightnessSlider ? parseFloat(brightnessSlider.value) : defaultBrightness,
      contrast: contrastSlider ? parseFloat(contrastSlider.value) : defaultContrast,
      gain: gainSlider ? parseFloat(gainSlider.value) : defaultGain
    };
  }

  // Set slider values programmatically (used for auto-applying color map defaults)
  // Does not emit events
  function setValues({ brightness, contrast, gain }) {
    if (brightnessSlider) {
      brightnessSlider.value = brightness;
      if (brightnessVal) brightnessVal.textContent = parseFloat(brightness).toFixed(2);
    }
    if (contrastSlider) {
      contrastSlider.value = contrast;
      if (contrastVal) contrastVal.textContent = parseFloat(contrast).toFixed(2);
    }
    if (gainSlider) {
      gainSlider.value = gain;
      if (gainVal) gainVal.textContent = parseFloat(gain).toFixed(2);
    }
  }

  // Emit the current settings to the callback
  function emitChanges() {
    updateLabels();
    const settings = getCurrentSettings();
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
      let defaults = {
        brightness: defaultBrightness,
        contrast: defaultContrast,
        gain: defaultGain
      };
      // If a callback was provided for getting reset values (e.g., current colormap defaults),
      // use those instead of the hardcoded defaults
      if (typeof getResetValues === 'function') {
        const callbackDefaults = getResetValues();
        if (callbackDefaults) {
          defaults = callbackDefaults;
        }
      }
      setValues(defaults);
      emitChanges();
    });
  }

  // Initialize
  initAttributes();
  // Don't emit immediately on init to avoid double-render during startup,
  // Main.js will pull values when needed.

  // Return the control interface with getter and setter
  return {
    getSettings: getCurrentSettings,
    setValues: setValues
  };
}

