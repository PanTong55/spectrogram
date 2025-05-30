// zoomControl.js (優化版，含修正)

export function initZoomControls(ws, container, duration, applyZoomCallback, wrapperElement) {
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const expandBtn = document.getElementById('expand-btn');

  let zoomLevel = 500;
  let minZoomLevel = 250;
  let isExpandMode = false;

  function computeMinZoomLevel() {
    let visibleWidth = wrapperElement.clientWidth;
    const dur = duration();
    if (dur > 0) {
      minZoomLevel = Math.floor((visibleWidth - 2) / dur);
    }
  }

  function applyZoom() {
    computeMinZoomLevel();
    zoomLevel = Math.max(zoomLevel, minZoomLevel);

    ws.zoom(zoomLevel);
    const width = duration() * zoomLevel;
    container.style.width = `${width}px`;

    wrapperElement.style.width = `${width}px`;

    applyZoomCallback();
    updateZoomButtons();
  }

  function updateZoomButtons() {
    computeMinZoomLevel();
    const disabled = isExpandMode;
    zoomInBtn.disabled = disabled || zoomLevel >= 2500;
    zoomOutBtn.disabled = disabled || zoomLevel <= minZoomLevel;
    expandBtn.classList.toggle('active', isExpandMode);
  }

  zoomInBtn.onclick = () => {
    if (!isExpandMode && zoomLevel < 2500) {
      zoomLevel = Math.min(zoomLevel + 500, 2500);
      applyZoom();
    }
  };

  zoomOutBtn.onclick = () => {
    if (!isExpandMode) {
      computeMinZoomLevel();
      if (zoomLevel > minZoomLevel) {
        zoomLevel = Math.max(zoomLevel - 500, minZoomLevel);
        applyZoom();
      }
    }
  };

  expandBtn.onclick = () => {
    isExpandMode = !isExpandMode;
    computeMinZoomLevel();
    if (isExpandMode) {
      zoomLevel = minZoomLevel;
    } else {
      zoomLevel = Math.max(minZoomLevel, 500);
    }
    applyZoom();
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
      computeMinZoomLevel();
      if (isExpandMode) {
        zoomLevel = minZoomLevel;
        applyZoom();
      }
    }
  };
}
