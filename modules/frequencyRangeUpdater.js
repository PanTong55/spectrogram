export function createFrequencyRangeUpdater({
  getCurrentColorMap,
  replacePlugin,
  getWavesurfer,
  spectrogramHeight,
  zoomControl,
  renderAxes,
  onUpdate = () => {}
}) {
  return {
    updateFrequencyRange(min, max) {
      const colorMap = getCurrentColorMap();
      onUpdate(min, max); // 更新外部 state，例如 currentFreqMin

      replacePlugin(colorMap, spectrogramHeight, min, max);

      setTimeout(() => {
        const plugin = getPlugin();
        plugin?.render();
        const duration = getWavesurfer().getDuration();
        zoomControl.applyZoom();
        renderAxes();
      }, 50);
    }
  };
}
