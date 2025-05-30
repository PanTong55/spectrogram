// zoomControl.js (優化版，含修正)

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
      minZoomLevel = visibleWidth / dur;  // ✅ 改成 float，不取整數
    }
  }

  function applyZoom() {
    computeMinZoomLevel();
    zoomLevel = Math.max(zoomLevel, minZoomLevel);

    ws.zoom(zoomLevel);
    const width = duration() * zoomLevel;
    container.style.width = `${width}px`;

    // ✅ 方案二：同步 wrapper 寬度，解決 scroll bar 問題
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
      wrapperElement.style.overflowX = 'hidden';  // ✅ Expand mode 禁用 scroll bar
    } else {
      zoomLevel = Math.max(minZoomLevel, 500);
      wrapperElement.style.overflowX = 'auto';    // ✅ 普通 mode 允許 scroll bar
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
        wrapperElement.style.overflowX = 'hidden';
        applyZoom();
      }
    }
  };
}
