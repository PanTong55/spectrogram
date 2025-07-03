import { getCurrentIndex, getFileMetadata } from './fileState.js';

export function initMapPopup({
  buttonId = 'mapBtn',
  popupId = 'mapPopup',
  mapId = 'map'
} = {}) {
  const btn = document.getElementById(buttonId);
  const popup = document.getElementById(popupId);
  const mapDiv = document.getElementById(mapId);
  if (!btn || !popup || !mapDiv) return;
  mapDiv.style.cursor = 'grab';

  let map = null;
  let marker = null;

  function createMap(lat, lon) {
    map = L.map(mapDiv).setView([lat, lon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    marker = L.marker([lat, lon]).addTo(map);
  }

  function updateMap() {
    const idx = getCurrentIndex();
    if (idx < 0) return;
    const meta = getFileMetadata(idx);
    const lat = parseFloat(meta.latitude);
    const lon = parseFloat(meta.longitude);
    if (isNaN(lat) || isNaN(lon)) return;

    if (!map) {
      createMap(lat, lon);
    } else {
      map.setView([lat, lon]);
      marker.setLatLng([lat, lon]);
    }
  }

  function togglePopup() {
    if (popup.style.display === 'block') {
      popup.style.display = 'none';
      document.body.classList.remove('map-open');
    } else {
      popup.style.display = 'block';
      popup.style.width = `${lastWidth}px`;
      popup.style.height = `${lastHeight}px`;
      document.body.classList.add('map-open');
      if (map) {
        map.invalidateSize();
      }
      updateMap();
    }
  }

  let dragging = false;
  let resizing = false;
  let resizeCorner = null;
  let offsetX = 0;
  let offsetY = 0;
  const edgeThreshold = 20;
  const cornerThreshold = 10;

  let lastWidth = popup.offsetWidth;
  let lastHeight = popup.offsetHeight;

  function getResizeCorner(x, y) {
    const rect = popup.getBoundingClientRect();
    const nearLeft = x - rect.left <= cornerThreshold;
    const nearRight = rect.right - x <= cornerThreshold;
    const nearTop = y - rect.top <= cornerThreshold;
    const nearBottom = rect.bottom - y <= cornerThreshold;
    if (nearLeft && nearTop) return 'nw';
    if (nearRight && nearTop) return 'ne';
    if (nearLeft && nearBottom) return 'sw';
    if (nearRight && nearBottom) return 'se';
    return null;
  }

  function isNearEdge(x, y) {
    const rect = popup.getBoundingClientRect();
    const within = (
      x - rect.left <= edgeThreshold ||
      rect.right - x <= edgeThreshold ||
      y - rect.top <= edgeThreshold ||
      rect.bottom - y <= edgeThreshold
    );
    return within && !getResizeCorner(x, y);
  }

  popup.addEventListener('mousedown', (e) => {
    const corner = getResizeCorner(e.clientX, e.clientY);
    if (corner) {
      resizing = true;
      resizeCorner = corner;
      offsetX = e.clientX;
      offsetY = e.clientY;
      lastWidth = popup.offsetWidth;
      lastHeight = popup.offsetHeight;
      map?.dragging.disable();
      e.preventDefault();
      e.stopPropagation();
    } else if (isNearEdge(e.clientX, e.clientY)) {
      dragging = true;
      offsetX = e.clientX - popup.offsetLeft;
      offsetY = e.clientY - popup.offsetTop;
      map?.dragging.disable();
      e.preventDefault();
      e.stopPropagation();
    }
  });

  popup.addEventListener('mousemove', (e) => {
    if (!dragging && !resizing) {
      const corner = getResizeCorner(e.clientX, e.clientY);
      if (corner) {
        const cursors = { nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize' };
        popup.style.cursor = cursors[corner];
      } else if (isNearEdge(e.clientX, e.clientY)) {
        popup.style.cursor = 'move';
      } else {
        popup.style.cursor = 'default';
      }
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (dragging) {
      popup.style.left = `${e.clientX - offsetX}px`;
      popup.style.top = `${e.clientY - offsetY}px`;
    } else if (resizing) {
      const dx = e.clientX - offsetX;
      const dy = e.clientY - offsetY;
      let newWidth = lastWidth;
      let newHeight = lastHeight;
      let newLeft = popup.offsetLeft;
      let newTop = popup.offsetTop;

      switch (resizeCorner) {
        case 'nw':
          newWidth = lastWidth - dx;
          newHeight = lastHeight - dy;
          newLeft = popup.offsetLeft + dx;
          newTop = popup.offsetTop + dy;
          break;
        case 'ne':
          newWidth = lastWidth + dx;
          newHeight = lastHeight - dy;
          newTop = popup.offsetTop + dy;
          break;
        case 'sw':
          newWidth = lastWidth - dx;
          newHeight = lastHeight + dy;
          newLeft = popup.offsetLeft + dx;
          break;
        case 'se':
          newWidth = lastWidth + dx;
          newHeight = lastHeight + dy;
          break;
      }

      if (newWidth > 100) {
        popup.style.width = `${newWidth}px`;
        popup.style.left = `${newLeft}px`;
        lastWidth = newWidth;
      }
      if (newHeight > 100) {
        popup.style.height = `${newHeight}px`;
        popup.style.top = `${newTop}px`;
        lastHeight = newHeight;
      }
      if (map) map.invalidateSize();
    }
  });

  window.addEventListener('mouseup', () => {
    if (dragging || resizing) {
      dragging = false;
      resizing = false;
      map?.dragging.enable();
    }
  });

  btn.addEventListener('click', togglePopup);
  document.addEventListener('file-loaded', updateMap);
}
