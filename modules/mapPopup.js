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
    } else {
      popup.style.display = 'block';
      if (map) {
        map.invalidateSize();
      }
      updateMap();
    }
  }

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  popup.addEventListener('mousedown', (e) => {
    dragging = true;
    offsetX = e.clientX - popup.offsetLeft;
    offsetY = e.clientY - popup.offsetTop;
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    popup.style.left = `${e.clientX - offsetX}px`;
    popup.style.top = `${e.clientY - offsetY}px`;
  });

  window.addEventListener('mouseup', () => { dragging = false; });

  btn.addEventListener('click', togglePopup);
  document.addEventListener('file-loaded', updateMap);
}
