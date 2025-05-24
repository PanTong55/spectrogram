// zoomControl.js

export function initZoomControls(ws, container, duration, applyZoomCallback) {
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');

  let zoomLevel = 500;

  function applyZoom() {
    ws.zoom(zoomLevel);
    const width = Math.min(duration() * zoomLevel, 10000);
    container.style.width = `${width}px`;
    applyZoomCallback(); 
  }

  function updateZoomButtons() {
    zoomInBtn.disabled = zoomLevel >= 2000;
    zoomOutBtn.disabled = zoomLevel <= 250;
  }

  zoomInBtn.onclick = () => {
    if (zoomLevel < 2000) {
      zoomLevel = Math.min(zoomLevel + 250, 2000);
      applyZoom();
    }
    updateZoomButtons();
  };

  zoomOutBtn.onclick = () => {
    if (zoomLevel > 250) {
      zoomLevel = Math.max(zoomLevel - 250, 250);
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
