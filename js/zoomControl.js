export function setupZoom(ws, container, timeAxis, label, zoomInBtn, zoomOutBtn, onZoomChange) {
  let zoomLevel = 500;
  let duration = 0;

  function applyZoom() {
    ws.zoom(zoomLevel);
    const width = Math.min(duration * zoomLevel, 10000);
    container.style.width = `${width}px`;
    onZoomChange?.(zoomLevel);
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
    applyZoomExternally: () => applyZoom(),
    setDuration: (d) => { duration = d; applyZoom(); }
  };
}
