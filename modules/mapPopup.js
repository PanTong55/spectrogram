import { getCurrentIndex, getFileMetadata } from './fileState.js';

export function initMapPopup({
  buttonId = 'mapBtn',
  popupId = 'mapPopup',
  mapId = 'map'
} = {}) {
  const btn = document.getElementById(buttonId);
  const popup = document.getElementById(popupId);
  const mapDiv = document.getElementById(mapId);
  const dragBar = popup.querySelector('.popup-drag-bar');
  const closeBtn = popup.querySelector('.popup-close-btn');
  if (!btn || !popup || !mapDiv) return;
  mapDiv.style.cursor = 'grab';

  const edgeThreshold = 5;
  let popupWidth = parseInt(localStorage.getItem('mapPopupWidth')) || popup.offsetWidth;
  let popupHeight = parseInt(localStorage.getItem('mapPopupHeight')) || popup.offsetHeight;
  popup.style.width = `${popupWidth}px`;
  popup.style.height = `${popupHeight}px`;

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
      document.body.classList.add('map-open');
      popup.style.width = `${popupWidth}px`;
      popup.style.height = `${popupHeight}px`;
      if (map) {
        map.invalidateSize();
      }
      updateMap();
    }
  }

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let resizing = false;
  let resizeLeft = false;
  let resizeRight = false;
  let resizeTop = false;
  let resizeBottom = false;

  if (dragBar) {
    dragBar.addEventListener('mousedown', (e) => {
      dragging = true;
      offsetX = e.clientX - popup.offsetLeft;
      offsetY = e.clientY - popup.offsetTop;
      map?.dragging.disable();
      e.preventDefault();
      e.stopPropagation();
    });
  }

  popup.addEventListener('mousemove', (e) => {
    if (dragging || resizing) return;
    const rect = popup.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const onLeft = x < edgeThreshold;
    const onRight = x > rect.width - edgeThreshold;
    const onTop = y < edgeThreshold;
    const onBottom = y > rect.height - edgeThreshold;
    let cursor = 'default';
    if ((onLeft && onTop) || (onRight && onBottom)) {
      cursor = 'nwse-resize';
    } else if ((onRight && onTop) || (onLeft && onBottom)) {
      cursor = 'nesw-resize';
    } else if (onLeft || onRight) {
      cursor = 'ew-resize';
    } else if (onTop || onBottom) {
      cursor = 'ns-resize';
    }
    popup.style.cursor = cursor;
  });

  popup.addEventListener('mousedown', (e) => {
    if (e.target === dragBar || dragBar.contains(e.target)) return;
    const rect = popup.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const onLeft = x < edgeThreshold;
    const onRight = x > rect.width - edgeThreshold;
    const onTop = y < edgeThreshold;
    const onBottom = y > rect.height - edgeThreshold;
    if (onLeft || onRight || onTop || onBottom) {
      resizing = true;
      resizeLeft = onLeft;
      resizeRight = onRight;
      resizeTop = onTop;
      resizeBottom = onBottom;
      map?.dragging.disable();
      e.preventDefault();
      e.stopPropagation();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (dragging) {
      popup.style.left = `${e.clientX - offsetX}px`;
      popup.style.top = `${e.clientY - offsetY}px`;
      return;
    }
    if (resizing) {
      const rect = popup.getBoundingClientRect();
      if (resizeRight) {
        popupWidth = Math.max(200, e.clientX - rect.left);
        popup.style.width = `${popupWidth}px`;
      }
      if (resizeBottom) {
        popupHeight = Math.max(200, e.clientY - rect.top);
        popup.style.height = `${popupHeight}px`;
      }
      if (resizeLeft) {
        const newLeft = e.clientX;
        popupWidth = Math.max(200, rect.right - newLeft);
        popup.style.width = `${popupWidth}px`;
        popup.style.left = `${newLeft}px`;
      }
      if (resizeTop) {
        const newTop = e.clientY;
        popupHeight = Math.max(200, rect.bottom - newTop);
        popup.style.height = `${popupHeight}px`;
        popup.style.top = `${newTop}px`;
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      map?.dragging.enable();
    }
    if (resizing) {
      resizing = false;
      map?.dragging.enable();
      localStorage.setItem('mapPopupWidth', popupWidth);
      localStorage.setItem('mapPopupHeight', popupHeight);
      map?.invalidateSize();
    }
  });

  btn.addEventListener('click', togglePopup);
  if (closeBtn) {
    closeBtn.addEventListener('click', togglePopup);
  }
  document.addEventListener('file-loaded', updateMap);
}
