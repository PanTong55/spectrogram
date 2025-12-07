// modules/brightnessControl.js

/**
 * Redesigned Brightness/Contrast/Gain Controller
 * Adapted for modern color map systems (Viridis/Inferno) where Dark=Low Signal.
 */
export function initBrightnessControl({
  brightnessSliderId,
  gainSliderId,
  contrastSliderId,
  brightnessValId,
  gainValId,
  contrastValId,
  resetBtnId,
  // New defaults optimized for non-inverted logic
  defaultBrightness = 0.0,
  defaultGain = 1.0,
  defaultContrast = 1.0,
  onColorMapUpdated,
  onSpectrogramRender,
}) {
  const brightnessSlider = document.getElementById(brightnessSliderId);
  const gainSlider = document.getElementById(gainSliderId);
  const contrastSlider = document.getElementById(contrastSliderId);
  const brightnessVal = document.getElementById(brightnessValId);
  const gainVal = document.getElementById(gainValId);
  const contrastVal = document.getElementById(contrastValId);
  const resetBtn = document.getElementById(resetBtnId);

  // Initialize slider attributes to fit the new algorithms
  function initSliderAttributes() {
    // Brightness: -1.0 to 1.0 (0 is neutral)
    setSliderAttributes(brightnessSlider, -1.0, 1.0, 0.01, defaultBrightness);
    
    // Gain: 0.0 to 5.0 (1 is neutral, linear multiplier)
    setSliderAttributes(gainSlider, 0.0, 5.0, 0.01, defaultGain);
    
    // Contrast: 0.0 to 5.0 (1 is neutral)
    setSliderAttributes(contrastSlider, 0.0, 5.0, 0.01, defaultContrast);
    
    console.log('[BrightnessControl] Initialized sliders:', {
      brightness: brightnessSlider?.value,
      gain: gainSlider?.value,
      contrast: contrastSlider?.value
    });
  }

  function setSliderAttributes(el, min, max, step, value) {
    if (el) {
      el.min = min;
      el.max = max;
      el.step = step;
      el.value = value;
    }
  }

  // Update display text only
  function updateSliderValues() {
    const brightness = parseFloat(brightnessSlider.value);
    const gain = parseFloat(gainSlider.value);
    const contrast = parseFloat(contrastSlider.value);
    
    if (brightnessVal) brightnessVal.textContent = brightness.toFixed(2);
    if (gainVal) gainVal.textContent = gain.toFixed(2);
    if (contrastVal) contrastVal.textContent = contrast.toFixed(2);
  }

  // Calculate and generate the filter map
  function updateColorMap() {
    const brightness = parseFloat(brightnessSlider.value);
    const gain = parseFloat(gainSlider.value);
    const contrast = parseFloat(contrastSlider.value);

    // Sync UI
    updateSliderValues();

    console.log('[BrightnessControl] updateColorMap:', { brightness, gain, contrast });

    // Generate 256 intensity multipliers
    // The Spectrogram plugin will multiply the original RGB by these values.
    const colorMap = Array.from({ length: 256 }, (_, i) => {
      // 1. Normalize input (0.0 - 1.0)
      let v = i / 255;

      // 2. Apply Contrast
      // Expand from center (0.5). Contrast > 1 makes darks darker, brights brighter.
      // Good for removing background noise.
      v = (v - 0.5) * contrast + 0.5;

      // 3. Apply Brightness
      // Linear offset.
      v = v + brightness;

      // 4. Apply Gain
      // Linear amplification.
      v = v * gain;

      // 5. Clamping
      // Lower bound 0 (black).
      // Upper bound is not strictly clamped to 1 here to allow "overexposure" effects,
      // but Uint8ClampedArray in the consumer will handle > 255 automatically.
      v = Math.max(0, v);

      // Return format: [R_mult, G_mult, B_mult, Alpha]
      return [v, v, v, 1];
    });

    // Callback to pass the map to spectrogram
    if (typeof onColorMapUpdated === 'function') {
      onColorMapUpdated(colorMap);
    }
    
    // Trigger re-render
    if (typeof onSpectrogramRender === 'function') {
      onSpectrogramRender();
    }
  }

  function handleInput() {
    updateSliderValues();
    // Optional: Call updateColorMap() here if live preview during drag is desired and performant
  }

  function handleChange() {
    console.log('[BrightnessControl] handleChange triggered');
    updateColorMap();
  }

  // Bind Events
  [brightnessSlider, gainSlider, contrastSlider].forEach(slider => {
    if (slider) {
      slider.addEventListener('input', handleInput);
      slider.addEventListener('change', handleChange);
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      brightnessSlider.value = defaultBrightness;
      gainSlider.value = defaultGain;
      contrastSlider.value = defaultContrast;
      updateColorMap();
    });
  }

  // Execute initialization
  initSliderAttributes();
  updateColorMap();
}
