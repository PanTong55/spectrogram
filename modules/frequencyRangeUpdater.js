export function createFrequencyRangeUpdater({
  getCurrentColorMap,
  replacePlugin,
  getPlugin,
  getWavesurfer,
  spectrogramHeight,
  zoomControl,
  renderAxes,
  onUpdate = () => {}
}) {
  return {
    updateFrequencyRange(min, max) {
      const colorMap = getCurrentColorMap();
      onUpdate(min, max);

      replacePlugin(colorMap, spectrogramHeight, min, max);

      duration = getWavesurfer().getDuration();
      zoomControl.applyZoom();
    
      renderAxes();
    }
  };
}
