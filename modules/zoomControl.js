// zoomControl.js

export function initZoomControls(ws, container, duration, applyZoomCallback, wrapperElement) {
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const expandBtn = document.getElementById('expand-btn');

  let zoomLevel = 500;
  let minZoomLevel = 250;
  let isExpandMode = false;

  function computeMinZoomLevel() {
    const visibleWidth = wrapperElement.clientWidth;
    const dur = duration();
    if (dur > 0) {
      minZoomLevel = Math.ceil(visibleWidth / dur);
    }
  }

  function applyZoom() {
    computeMinZoomLevel();
    zoomLevel = Math.max(zoomLevel, minZoomLevel);

    ws.zoom(zoomLevel);
    const width = duration() * zoomLevel;
    container.style.width = `${width}px`;

    applyZoomCallback();
    updateZoomButtons();
  }

  function updateZoomButtons() {
    computeMinZoomLevel();
    const disabled = isExpandMode;
    zoomInBtn.disabled = disabled || zoomLevel >= 2000;
    zoomOutBtn.disabled = disabled || zoomLevel <= minZoomLevel;
    expandBtn.classList.toggle('active', isExpandMode);
  }

  zoomInBtn.onclick = () => {
    if (!isExpandMode && zoomLevel < 2000) {
      zoomLevel = Math.min(zoomLevel + 250, 2000);
      applyZoom();
    }
  };

  zoomOutBtn.onclick = () => {
    if (!isExpandMode) {
      computeMinZoomLevel();
      if (zoomLevel > minZoomLevel) {
        zoomLevel = Math.max(zoomLevel - 250, minZoomLevel);
        applyZoom();
      }
    }
  };

  expandBtn.onclick = () => {
    isExpandMode = !isExpandMode;
    if (isExpandMode) {
      computeMinZoomLevel();
      zoomLevel = minZoomLevel;
      applyZoom();
    } else {
      zoomLevel = Math.max(minZoomLevel, 500);
      applyZoom();
    }
    updateZoomButtons();
  };

  return {
    applyZoom,
    updateZoomButtons,
    getZoomLevel: () => zoomLevel,
    setZoomLevel: (newZoom) => {
      computeMinZoomLevel();
      zoomLevel = Math.max(newZoom, minZoomLevel);
      applyZoom();
    },
    isExpandMode: () => isExpandMode,
    forceExpandMode: () => {
      if (isExpandMode) {
        computeMinZoomLevel();
        zoomLevel = minZoomLevel;
        applyZoom();
      }
    }
  };
}
