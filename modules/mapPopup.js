import { getCurrentIndex, getFileMetadata, getFileList } from './fileState.js';

let importKmlFileFn = null;

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
  mapDiv.style.cursor = 'default';

  const edgeThreshold = 5;

  function getEdgeState(clientX, clientY) {
    const rect = popup.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
  
    const withinVertical = y >= -edgeThreshold && y <= rect.height + edgeThreshold;
    const withinHorizontal = x >= -edgeThreshold && x <= rect.width + edgeThreshold;
  
    const onLeft   = Math.abs(x - 0) <= edgeThreshold && withinVertical;
    const onRight  = Math.abs(x - rect.width) <= edgeThreshold && withinVertical;
    const onTop    = Math.abs(y - 0) <= edgeThreshold && withinHorizontal;
    const onBottom = Math.abs(y - rect.height) <= edgeThreshold && withinHorizontal;
  
    return { onLeft, onRight, onTop, onBottom };
  }

  function edgeCursor(state) {
    const { onLeft, onRight, onTop, onBottom } = state;
    let cursor = '';
    if ((onLeft && onTop) || (onRight && onBottom)) {
      cursor = 'nwse-resize';
    } else if ((onRight && onTop) || (onLeft && onBottom)) {
      cursor = 'nesw-resize';
    } else if (onLeft || onRight) {
      cursor = 'ew-resize';
    } else if (onTop || onBottom) {
      cursor = 'ns-resize';
    }
    return cursor;
  }
  let popupWidth = parseInt(localStorage.getItem('mapPopupWidth'), 10);
  let popupHeight = parseInt(localStorage.getItem('mapPopupHeight'), 10);
  if (isNaN(popupWidth) || popupWidth <= 0) popupWidth = 500;
  if (isNaN(popupHeight) || popupHeight <= 0) popupHeight = 500;
  popup.style.width = `${popupWidth}px`;
  popup.style.height = `${popupHeight}px`;

  let map = null;
  let markers = [];
  let polylines = [];
  let routeBtn = null;
  let kmlPolylines = [];
  let importBtn = null;
  let clearKmlBtn = null;
  let drawBtn = null;
  let textBtn = null;
  let textMode = false;
  let textMarkers = [];
  let activeTextInput = null;
  let suppressNextTextClick = false;
  let drawControl = null;
  let drawnItems = null;
  let drawControlVisible = false;
  let layersControl = null;
  let hkgridLayer = null;
  const coordScaleWrapper = mapDiv.querySelector('.coord-scale-wrapper');
  const coordDisplay = mapDiv.querySelector('#coord-display');
  const noCoordMsg = mapDiv.querySelector('#no-coord-message');
  const copyCoordMsg = mapDiv.querySelector('#copy-coord-message');
  let copyMsgTimer = null;
  let scaleControl = null;
  let isMapDragging = false;
  const kmlInput = document.createElement('input');
  kmlInput.type = 'file';
  kmlInput.accept = '.kml';
  kmlInput.style.display = 'none';
  popup.appendChild(kmlInput);
  const mapDropOverlay = document.getElementById('map-drop-overlay');
  let dropCounter = 0;

  function updateCursor() {
    if (isMapDragging) {
      mapDiv.style.cursor = 'grabbing';
    } else if (textMode) {
      mapDiv.style.cursor = 'text';
    } else {
      mapDiv.style.cursor = 'default';
    }
  }

  function showMapDropOverlay() {
    if (mapDropOverlay) {
      mapDropOverlay.style.display = 'flex';
      mapDropOverlay.style.pointerEvents = 'auto';
    }
    map?.dragging.disable();
  }

  function hideMapDropOverlay() {
    if (mapDropOverlay) {
      mapDropOverlay.style.display = 'none';
      mapDropOverlay.style.pointerEvents = 'none';
    }
    map?.dragging.enable();
  }

  function showNoCoordMessage() {
    if (noCoordMsg) noCoordMsg.style.display = 'flex';
  }

  function hideNoCoordMessage() {
    if (noCoordMsg) noCoordMsg.style.display = 'none';
  }

  function showCopyCoordMessage() {
    if (!copyCoordMsg) return;
    copyCoordMsg.style.display = 'flex';
    clearTimeout(copyMsgTimer);
    copyMsgTimer = setTimeout(() => {
      copyCoordMsg.style.display = 'none';
    }, 3000);
  }

  mapDiv.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer.types?.includes('Files')) return;
    e.preventDefault();
    dropCounter++;
    showMapDropOverlay();
  });

  mapDiv.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types?.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  mapDiv.addEventListener('dragleave', (e) => {
    if (!e.dataTransfer.types?.includes('Files')) return;
    e.preventDefault();
    dropCounter--;
    if (dropCounter <= 0) hideMapDropOverlay();
  });

  mapDiv.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropCounter = 0;
    hideMapDropOverlay();
    const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith('.kml'));
    if (file) {
      await importKml(file);
    }
  });

  function createMap(lat, lon) {
    map = L.map(mapDiv).setView([lat, lon], 13);
    map.on('dragstart', () => { isMapDragging = true; updateCursor(); });
    map.on('dragend', () => { isMapDragging = false; updateCursor(); });
    updateCursor();
    scaleControl = L.control.scale({
      position: 'bottomleft',
      metric: true,
      imperial: false,
    }).addTo(map);
    if (coordScaleWrapper) {
      const scaleEl = scaleControl.getContainer();
      scaleEl.style.position = 'static';
      coordScaleWrapper.appendChild(scaleEl);
    }
    function updateCoords(latlng) {
      if (!coordDisplay) return;
      const { lat, lng } = latlng;
      coordDisplay.textContent = `${lat.toFixed(4)} ${lng.toFixed(4)}`;
    }
    map.on('mousemove', (e) => updateCoords(e.latlng));
    map.on('move', () => updateCoords(map.getCenter()));
    updateCoords(map.getCenter());

    map.on('contextmenu', (e) => {
      const { lat, lng } = e.latlng;
      const text = `${lat.toFixed(6)}\t${lng.toFixed(6)}`;
      navigator.clipboard?.writeText(text).catch(() => {});
      showCopyCoordMessage();
    });

    const osmAttr = { attribution: '&copy; OpenStreetMap contributors' };
    const esriAttr = { attribution: '&copy; Esri' };
    const cartoAttr = { attribution: '&copy; CARTO' };
    const googleAttr = { attribution: '&copy; Google' };
    const imageryAttr = { attribution: '&copy; HKSAR Government' };
    const landsdAttr = { attribution: '&copy; HKSAR Government' };

    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', osmAttr).addTo(map);
    const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', esriAttr);
    const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', cartoAttr);
    const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', cartoAttr);
    const googleStreets = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', googleAttr);
    const googleSatellite = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', googleAttr);
    const googleHybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', googleAttr);

    const hkImageryLayer = L.tileLayer(
      'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/wgs84/{z}/{x}/{y}.png',
      { ...imageryAttr, minZoom: 0, maxZoom: 19 }
    );

    const hkVectorBase = L.tileLayer(
      'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/wgs84/{z}/{x}/{y}.png',
      { ...landsdAttr, maxZoom: 20, minZoom: 10 }
    );

    const hkVectorLabel = L.tileLayer(
      'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/tc/wgs84/{z}/{x}/{y}.png',
      { attribution: false, maxZoom: 20, minZoom: 0 }
    );

    const hkVectorGroup = L.layerGroup([hkVectorBase, hkVectorLabel]);
    const hkImageryGroup = L.layerGroup([hkImageryLayer, hkVectorLabel]);

    const baseLayers = {
      'OpenStreetMap': streets,
      'Esri Satellite': esriSatellite,
      'Carto Light': cartoLight,
      'Carto Dark': cartoDark,
      'Google Streets': googleStreets,
      'Google Satellite': googleSatellite,
      'Google Hybrid': googleHybrid,
      'HK Vector': hkVectorGroup,
      'HK Imagery': hkImageryGroup,
    };

    layersControl = L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

    fetch("https://raw.githubusercontent.com/PanTong55/spectrogram/main/hkgrid.geojson")
      .then((r) => r.json())
      .then((hkgriddata) => {
        hkgridLayer = L.geoJSON(hkgriddata, {
          interactive: false,
          style: {
            color: '#3388ff',
            weight: 2,
            fillColor: '#3388ff',
            fillOpacity: 0,
          },
        });
        layersControl.addOverlay(hkgridLayer, '1km Grid');
      });

    drawnItems = new L.FeatureGroup().addTo(map);
    drawControl = new L.Control.Draw({
      position: 'topleft',
      edit: { featureGroup: drawnItems },
      draw: { circlemarker: false }
    });
    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.addLayer(e.layer);
    });

    const RouteControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-route-control');
        const link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.title = 'Route';
        link.innerHTML = '<i class="fa-solid fa-route"></i>';
        routeBtn = link;
        L.DomEvent.on(link, 'click', L.DomEvent.stop)
          .on(link, 'click', toggleRoute);
        return container;
      }
    });
    map.addControl(new RouteControl());

    const ImportControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-import-kml-control');
        const link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.title = 'Import KML';
        link.innerHTML = '<i class="fa-solid fa-file-import"></i>';
        importBtn = link;
        L.DomEvent.on(link, 'click', L.DomEvent.stop)
          .on(link, 'click', () => { kmlInput.value = ''; kmlInput.click(); });
        return container;
      }
    });
    map.addControl(new ImportControl());

    const ClearKmlControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-clear-kml-control');
        const link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.title = 'Clear KML';
        link.innerHTML = '<i class="fa-solid fa-trash"></i>';
        clearKmlBtn = link;
        L.DomEvent.on(link, 'click', L.DomEvent.stop)
          .on(link, 'click', clearKmlRoute);
        return container;
      }
    });
    map.addControl(new ClearKmlControl());

    const TextToggleControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-text-toggle-control');
        const link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.title = 'Text';
        link.innerHTML = '<i class="fa-solid fa-font"></i>';
        textBtn = link;
        L.DomEvent.on(link, 'click', L.DomEvent.stop)
          .on(link, 'click', toggleTextMode);
        return container;
      }
    });
    map.addControl(new TextToggleControl());

    const DrawToggleControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-draw-toggle-control');
        const link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.title = 'Draw';
        link.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
        drawBtn = link;
        L.DomEvent.on(link, 'click', L.DomEvent.stop)
          .on(link, 'click', toggleDrawControl);
        return container;
      }
    });
    map.addControl(new DrawToggleControl());
  }

  function refreshMarkers() {
    if (!map) return;
    markers.forEach(m => m.remove());
    markers = [];
    const list = getFileList();
    const curIdx = getCurrentIndex();

    const groups = {};
    list.forEach((file, idx) => {
      const meta = getFileMetadata(idx);
      const lat = parseFloat(meta.latitude);
      const lon = parseFloat(meta.longitude);
      if (isNaN(lat) || isNaN(lon)) return;
      const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ file, idx, meta, lat, lon });
    });

    function getTimestamp(meta) {
      if (!meta) return '';
      const d = (meta.date || '').replace(/\D/g, '');
      const t = meta.time || '';
      return `${d}${t}`;
    }

    Object.values(groups).forEach(group => {
      group.sort((a, b) => getTimestamp(a.meta).localeCompare(getTimestamp(b.meta)));
      const first = group[0];
      const { lat, lon } = first;
      const isCurrent = group.some(g => g.idx === curIdx);
      const cls = isCurrent ? 'map-marker-current' : 'map-marker-other';
      const icon = L.divIcon({
        html: '<i class="fa-solid fa-location-dot"></i>',
        className: cls,
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      });
      const fileNames = group.map(g => g.file.name.replace(/\.wav$/i, ''));
      const names = (fileNames.length <= 5)
        ? fileNames.join('<br>')
        : `${fileNames[0]}<br>⋮<br>${fileNames[fileNames.length - 1]}`;
      const zIndexOffset = isCurrent ? 1000 : 0;
      const marker = L.marker([lat, lon], { icon, zIndexOffset });
      marker.on('click', () => {
        document.dispatchEvent(new CustomEvent('map-file-selected', { detail: { index: first.idx } }));
      });
      marker.bindTooltip(names, {
        direction: 'top',
        offset: [-3, -32],
        className: 'map-tooltip'
      });
      marker.addTo(map);
      markers.push(marker);
    });
  }

  function clearRoute() {
    polylines.forEach(l => l.remove());
    polylines = [];
    routeBtn?.classList.remove('active');
  }

  function clearKmlRoute() {
    kmlPolylines.forEach(l => l.remove());
    kmlPolylines = [];
  }

  async function importKml(file) {
    if (!file) return;
    const text = await file.text();
    const lines = parseKml(text);
    clearKmlRoute();
    const allCoords = [];
    lines.forEach(coords => {
      const line = L.polyline(coords, { color: 'deeppink', weight: 2, opacity: 0.8 }).addTo(map);
      kmlPolylines.push(line);
      allCoords.push(...coords);
    });
    if (allCoords.length > 0) {
      map.fitBounds(allCoords);
      updateMap();
    }
  }

  importKmlFileFn = importKml;

  function parseKml(text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const lines = [];
    const lineStrings = doc.getElementsByTagName('LineString');
    for (let i = 0; i < lineStrings.length; i++) {
      const coordsEl = lineStrings[i].getElementsByTagName('coordinates')[0];
      if (!coordsEl) continue;
      const coordsText = coordsEl.textContent.trim();
      const coords = coordsText.split(/\s+/).map(pair => {
        const [lon, lat] = pair.split(',').map(Number);
        return (!isNaN(lat) && !isNaN(lon)) ? [lat, lon] : null;
      }).filter(Boolean);
      if (coords.length > 1) lines.push(coords);
    }
    return lines;
  }

  kmlInput.addEventListener('change', async () => {
    const file = kmlInput.files[0];
    if (file) {
      await importKml(file);
    }
  });

  function drawRoute() {
    if (!map) return;
    clearRoute();
    const list = getFileList();
    const points = [];
    list.forEach((_f, idx) => {
      const meta = getFileMetadata(idx);
      const lat = parseFloat(meta.latitude);
      const lon = parseFloat(meta.longitude);
      const d = (meta.date || '').replace(/\D/g, '');
      const t = meta.time || '';
      const ts = `${d}${t}`;
      if (!isNaN(lat) && !isNaN(lon) && ts) {
        points.push({ lat, lon, ts });
      }
    });
    points.sort((a, b) => a.ts.localeCompare(b.ts));

    let current = [];
    let prev = null;
    points.forEach(p => {
      if (prev) {
        const dist = map.distance([prev.lat, prev.lon], [p.lat, p.lon]);
        if (dist >= 1000) {
          if (current.length > 1) polylines.push(L.polyline(current, { color: 'black', weight: 2, opacity: 0.8 }).addTo(map));
          current = [];
        }
      }
      current.push([p.lat, p.lon]);
      prev = p;
    });
    if (current.length > 1) polylines.push(L.polyline(current, { color: 'black', weight: 2, opacity: 0.8 }).addTo(map));
  }

  function toggleRoute() {
    if (polylines.length > 0) {
      clearRoute();
    } else {
      drawRoute();
      routeBtn?.classList.add('active');
    }
  }

  function toggleDrawControl() {
    if (!drawControl) return;
    const willShow = !drawControlVisible;
    if (willShow && textMode) {
      toggleTextMode();
    }
    if (drawControlVisible) {
      map.removeControl(drawControl);
      drawBtn?.classList.remove('active');
      drawControlVisible = false;
    } else {
      drawControl.addTo(map);
      drawBtn?.classList.add('active');
      drawControlVisible = true;
    }
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"]/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    })[c]);
  }

  function createTextIcon(text, showTooltip = false) {
    const titleAttr = showTooltip
      ? ' title="Left click to edit\nRight click to delete"'
      : '';
    return L.divIcon({
      className: 'map-text-icon',
      html: `<span class="map-text-label"${titleAttr}>${escapeHtml(text)}</span>`,
      iconSize: null, // 可保持 null 讓其自適應
      iconAnchor: [0, 0], // 將 anchor 設為左上角
      popupAnchor: [0, 0]
    });
  }

  function editTextMarker(marker) {
    if (!map || activeTextInput) return;
    const latlng = marker.getLatLng();
    const point = map.latLngToContainerPoint(latlng);
  const input = document.createElement('textarea');
  input.value = marker.text || '';
  input.className = 'map-text-input';
  input.rows = 1;
  input.style.left = `${point.x}px`;
  input.style.top = `${point.y}px`;
  map.getContainer().appendChild(input);
  activeTextInput = input;
  map.dragging.disable();
  input.focus();
  const adjustHeight = () => {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  };
  adjustHeight();
  input.addEventListener('input', adjustHeight);
  const finish = () => {
      if (!activeTextInput) return;
      const val = input.value.trim();
      map.getContainer().removeChild(input);
      activeTextInput = null;
      map.dragging.enable();
      if (val) {
        marker.text = val;
        marker.setIcon(createTextIcon(val, textMode));
      } else {
        map.removeLayer(marker);
        textMarkers = textMarkers.filter(m => m !== marker);
      }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finish();
      }
    });
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    input.addEventListener('blur', () => {
      suppressNextTextClick = true;
      setTimeout(() => {
        if (document.activeElement !== input) finish();
      });
    });
  }

  function createTextMarker(latlng, text) {
    const marker = L.marker(latlng, { icon: createTextIcon(text, textMode), draggable: textMode });
    marker.text = text;
    marker.on('dblclick', () => { if (textMode) editTextMarker(marker); });
    marker.on('click', (e) => {
      if (textMode && !activeTextInput) {
        e.originalEvent.stopPropagation();
        editTextMarker(marker);
      }
    });
    marker.on('contextmenu', () => {
      if (textMode && !activeTextInput) {
        map.removeLayer(marker);
        textMarkers = textMarkers.filter(m => m !== marker);
      }
    });
    return marker;
  }

  function updateTextMarkersDraggable() {
    textMarkers.forEach(m => {
      if (textMode) m.dragging.enable();
      else m.dragging.disable();
      const txt = m.text || '';
      m.setIcon(createTextIcon(txt, textMode));
    });
  }

  function onMapTextClick(e) {
    if (suppressNextTextClick) {
      suppressNextTextClick = false;
      return;
    }
    if (activeTextInput) return;
    const marker = createTextMarker(e.latlng, '');
    marker.addTo(map);
    textMarkers.push(marker);
    editTextMarker(marker);
  }

  function toggleTextMode() {
    const newMode = !textMode;
    if (newMode && drawControlVisible) {
      toggleDrawControl();
    }
    textMode = newMode;
    textBtn?.classList.toggle('active', textMode);
    if (textMode) {
      map.on('click', onMapTextClick);
    } else {
      map.off('click', onMapTextClick);
      if (activeTextInput) {
        activeTextInput.blur();
      }
    }
    updateTextMarkersDraggable();
    updateCursor();
  }

  function showDeviceLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const icon = L.divIcon({
        html: '<i class="fa-solid fa-location-crosshairs"></i>',
        className: 'map-marker-device',
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      });
      if (!map) {
        createMap(lat, lon);
      } else {
        map.setView([lat, lon]);
      }
      const marker = L.marker([lat, lon], { icon, zIndexOffset: 1001 });
      marker.addTo(map);
      markers.push(marker);
    });
  }

  const DEFAULT_ZOOM = 13;

  function updateMap() {
    const idx = getCurrentIndex();
    if (idx < 0) {
      refreshMarkers();
      showDeviceLocation();
      hideNoCoordMessage();
      return;
    }
    const meta = getFileMetadata(idx);
    const lat = parseFloat(meta.latitude);
    const lon = parseFloat(meta.longitude);
    if (isNaN(lat) || isNaN(lon)) {
      refreshMarkers();
      showNoCoordMessage();
      return;
    }
    hideNoCoordMessage();

    if (!map) {
      createMap(lat, lon);
    } else {
      if (popup.style.display !== 'block') {
        map.setView([lat, lon], DEFAULT_ZOOM);
      } else {
        map.setView([lat, lon]);
      }
    }
    refreshMarkers();
  }

  function togglePopup() {
    if (popup.style.display === 'block') {
      popup.style.display = 'none';
      document.body.classList.remove('map-open');
      if (textMode) toggleTextMode();
    } else {
      popup.style.display = 'block';
      document.body.classList.add('map-open');
      popup.style.width = `${popupWidth}px`;
      popup.style.height = `${popupHeight}px`;
      if (map) {
        map.invalidateSize();
      }
      updateMap();
      updateCursor();
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
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;
  let startLeft = 0;
  let startTop = 0;

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
    const state = getEdgeState(e.clientX, e.clientY);
    const cursor = edgeCursor(state) || 'default';
    popup.style.cursor = cursor;
  });

  popup.addEventListener('mousedown', (e) => {
    if (e.target === dragBar || dragBar.contains(e.target)) return;
    const state = getEdgeState(e.clientX, e.clientY);
    if (state.onLeft || state.onRight || state.onTop || state.onBottom) {
      resizing = true;
      resizeLeft = state.onLeft;
      resizeRight = state.onRight;
      resizeTop = state.onTop;
      resizeBottom = state.onBottom;
      const cursor = edgeCursor(state) || 'default';
      popup.style.cursor = cursor;
      document.body.style.cursor = cursor;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = popup.offsetWidth;
      startHeight = popup.offsetHeight;
      startLeft = popup.offsetLeft;
      startTop = popup.offsetTop;
      map?.dragging.disable();
      e.preventDefault();
      e.stopPropagation();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (dragging || resizing || popup.style.display !== 'block') return;
    const state = getEdgeState(e.clientX, e.clientY);
    const cursor = edgeCursor(state);
    document.body.style.cursor = cursor || '';
  });

  document.addEventListener('mousedown', (e) => {
    if (dragging || resizing || popup.style.display !== 'block') return;
    if (e.target === dragBar || dragBar.contains(e.target)) return;
    const state = getEdgeState(e.clientX, e.clientY);
    if (state.onLeft || state.onRight || state.onTop || state.onBottom) {
      resizing = true;
      resizeLeft = state.onLeft;
      resizeRight = state.onRight;
      resizeTop = state.onTop;
      resizeBottom = state.onBottom;
      const cursor = edgeCursor(state) || 'default';
      document.body.style.cursor = cursor;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = popup.offsetWidth;
      startHeight = popup.offsetHeight;
      startLeft = popup.offsetLeft;
      startTop = popup.offsetTop;
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
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      document.body.style.cursor = document.body.style.cursor || popup.style.cursor;
      if (resizeRight) {
        popupWidth = Math.max(200, startWidth + dx);
        popup.style.width = `${popupWidth}px`;
      }
      if (resizeBottom) {
        popupHeight = Math.max(200, startHeight + dy);
        popup.style.height = `${popupHeight}px`;
      }
      if (resizeLeft) {
        popupWidth = Math.max(200, startWidth - dx);
        popup.style.width = `${popupWidth}px`;
        popup.style.left = `${startLeft + dx}px`;
      }
      if (resizeTop) {
        popupHeight = Math.max(200, startHeight - dy);
        popup.style.height = `${popupHeight}px`;
        popup.style.top = `${startTop + dy}px`;
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
      document.body.style.cursor = '';
      popup.style.cursor = '';
    }
  });

  btn.addEventListener('click', togglePopup);
  if (closeBtn) {
    closeBtn.addEventListener('click', togglePopup);
  }
  document.addEventListener('file-loaded', updateMap);
  document.addEventListener('file-list-cleared', () => refreshMarkers());
}

export async function importKmlFile(file) {
  if (importKmlFileFn && file) {
    await importKmlFileFn(file);
  }
}
