// zoomControl.js

export function initZoomControls(ws, container, getDuration, applyZoomCallback) {
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');

  let zoomLevel = 500;

  function applyZoom() {
    const duration = getDuration?.() || 0;
    if (!duration) return;

    // ⚠️ 計算目前 scroll 中心點在總寬度中的比例
    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    const scrollCenterRatio = (scrollLeft + containerWidth / 2) / container.scrollWidth;

    // ✅ 設定新的縮放寬度（限制最大寬度）
    const width = Math.min(duration * zoomLevel, 10000);
    container.style.width = `${width}px`;

    // ✅ 根據 scroll 比例還原中心點位置
    const newScrollLeft = scrollCenterRatio * width - containerWidth / 2;
    container.scrollLeft = newScrollLeft;

    // ✅ 應用 wavesurfer zoom
    ws.zoom(zoomLevel);

    // ✅ 重繪 timeAxis 與 frequency grid
    applyZoomCallback();
  }

  function updateZoomButtons() {
    zoomInBtn.disabled = zoomLevel >= 4000;
    zoomOutBtn.disabled = zoomLevel <= 250;
  }

  zoomInBtn.onclick = () => {
    if (zoomLevel < 4000) {
      zoomLevel = Math.min(zoomLevel + 500, 4000);
      applyZoom();
    }
    updateZoomButtons();
  };

  zoomOutBtn.onclick = () => {
    if (zoomLevel > 250) {
      zoomLevel = Math.max(zoomLevel - 500, 250);
      applyZoom();
    }
    updateZoomButtons();
  };

  return {
    applyZoom,
    updateZoomButtons,
    getZoomLevel: () => zoomLevel,
    setZoomLevel: (newZoom) => {
      zoomLevel = newZoom;
      applyZoom();
      updateZoomButtons();
    }
  };
}
