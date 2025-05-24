// zoomControl.js

export function initZoomControls(ws, container, duration, applyZoomCallback) {
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');

  let zoomLevel = 500;

  function applyZoom() {
    ws.zoom(zoomLevel);
    const width = Math.min(duration() * zoomLevel, 10000);
    container.style.width = `${width}px`;
    applyZoomCallback(); // 呼叫主程式的 timeAxis & grid 畫法
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
