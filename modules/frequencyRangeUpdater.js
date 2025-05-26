export function createFrequencyRangeUpdater({
  getCurrentColorMap,
  replacePlugin,
  getPlugin,              // <--- 加上這一行
  getWavesurfer,
  spectrogramHeight,
  zoomControl,
  renderAxes,
  onUpdate = () => {}
}) {
  return {
    updateFrequencyRange(min, max) {
      const colorMap = getCurrentColorMap();
      onUpdate(min, max); // 通知主程式更新 currentFreqMin, Max

      replacePlugin(colorMap, spectrogramHeight, min, max);

      setTimeout(() => {
        const plugin = getPlugin();
        plugin?.render();
        const duration = getWavesurfer().getDuration();
        zoomControl.applyZoom();
        renderAxes();
      }, 50); // 可依你 plugin 實際 render 耗時微調
    }
  };
}
