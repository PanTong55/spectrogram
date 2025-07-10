// zoomControl.js (優化版，含修正)

export function initZoomControls(ws, container, duration, applyZoomCallback,
                                wrapperElement, onBeforeZoom = null,
                                onAfterZoom = null, isSelectionExpandMode = () => false) {
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const expandBtn = document.getElementById('expand-btn');

  let zoomLevel = 500;
  let minZoomLevel = 250;

  function computeMaxZoomLevel() {
    const dur = duration();

    if (dur > 15000) return 1500;
    if (dur > 10000) return 2000;

    if (isSelectionExpandMode()) {
      if (dur > 0) {
        if (dur < 1000) return 8000;
        if (dur < 3000) return 3000;
      }
    }
    return 2500;
  }

  function computeMinZoomLevel() {
    // Use the parent's width rather than the wrapper's current width.
    // The wrapper width may be expanded when zoomed in, leading to an
    // overestimated min zoom on subsequent file loads.
    let visibleWidth = wrapperElement.parentElement
      ? wrapperElement.parentElement.clientWidth
      : wrapperElement.clientWidth;
    const dur = duration();
    if (dur > 0) {
      minZoomLevel = Math.floor((visibleWidth - 2) / dur);
    }
  }

  function applyZoom() {
    computeMinZoomLevel();
    if (typeof onBeforeZoom === 'function') onBeforeZoom();
    const maxZoom = computeMaxZoomLevel();
    zoomLevel = Math.min(Math.max(zoomLevel, minZoomLevel), maxZoom);

    if (ws && typeof ws.zoom === 'function' &&
        typeof ws.getDuration === 'function' && ws.getDuration() > 0) {
      ws.zoom(zoomLevel);
    }
    const width = duration() * zoomLevel;
    container.style.width = `${width}px`;

    wrapperElement.style.width = `${width}px`;

    applyZoomCallback();
    if (typeof onAfterZoom === 'function') onAfterZoom();    
    updateZoomButtons();
  }

  function setZoomLevel(newZoom) {
    computeMinZoomLevel();
    const maxZoom = computeMaxZoomLevel();
    zoomLevel = Math.min(Math.max(newZoom, minZoomLevel), maxZoom);
    applyZoom();
  }

  function updateZoomButtons() {
    computeMinZoomLevel();
    const maxZoom = computeMaxZoomLevel();
    zoomInBtn.disabled = zoomLevel >= maxZoom;
    zoomOutBtn.disabled = zoomLevel <= minZoomLevel;
  }

  zoomInBtn.onclick = () => {
    const maxZoom = computeMaxZoomLevel();
    if (zoomLevel < maxZoom) {
      zoomLevel = Math.min(zoomLevel + 500, maxZoom);
      applyZoom();
    }
  };

  zoomOutBtn.onclick = () => {
    computeMinZoomLevel();
    if (zoomLevel > minZoomLevel) {
      zoomLevel = Math.max(zoomLevel - 500, minZoomLevel);
      applyZoom();
    }
  };

  expandBtn.onclick = () => {
    setZoomLevel(minZoomLevel);
  };

  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey) return;  // 只監聽 Ctrl + *

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        zoomInBtn.click();
        break;
      case 'ArrowDown':
        e.preventDefault();
        zoomOutBtn.click();
        break;
      case '0':
        e.preventDefault();
        expandBtn.click();
        break;
    }
  });  

  return {
    applyZoom,
    updateZoomButtons,
    getZoomLevel: () => zoomLevel,
    setZoomLevel,
  };
}
