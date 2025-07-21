import { initDropdown } from './dropdown.js';

export function initAutoIdPanel({
  buttonId = 'autoIdBtn',
  panelId = 'auto-id-panel',
  viewerId = 'viewer-container',
  containerId = 'spectrogram-only',
  overlayId = 'fixed-overlay',
  spectrogramHeight = 800,
  getDuration = () => 0,
  getFreqRange = () => ({ min: 0, max: 0 }),
  hideHover = () => {},
  refreshHover = () => {}
} = {}) {
  const btn = document.getElementById(buttonId);
  const panel = document.getElementById(panelId);
  const viewer = document.getElementById(viewerId);
  const container = document.getElementById(containerId);
  const overlay = document.getElementById(overlayId);
  const resetTabBtn = document.getElementById('autoIdTabResetBtn');
  const tabsContainer = document.getElementById("autoid-tabs");
  const dragBar = panel.querySelector('.popup-drag-bar');
  const closeBtn = panel.querySelector('.popup-close-btn');
  const controlBar = document.getElementById('control-bar');
  const sidebar = document.getElementById('sidebar');
  const tabs = [];
  const TAB_COUNT = 5;
  const tabData = Array.from({ length: TAB_COUNT }, () => ({
    callType: 0,
    harmonic: 0,
    inputs: { start: "", end: "", high: "", low: "", knee: "", heel: "" },
    startTime: null,
    endTime: null,
    markers: {
      start: { el: null, freq: null, time: null },
      end: { el: null, freq: null, time: null },
      high: { el: null, freq: null, time: null },
      low: { el: null, freq: null, time: null },
      knee: { el: null, freq: null, time: null },
      heel: { el: null, freq: null, time: null }
    }
  }));
  let currentTab = 0;

  if (!btn || !panel || !viewer) return;

  function togglePanel() {
    if (panel.style.display === 'block') {
      panel.style.display = 'none';
      document.body.classList.remove('autoid-open');
    } else {
      panel.style.display = 'block';
      document.body.classList.add('autoid-open');
    }
  }

  btn.addEventListener('click', togglePanel);
  closeBtn?.addEventListener('click', togglePanel);

  const edgeThreshold = 5;

  function getEdgeState(clientX, clientY) {
    const rect = panel.getBoundingClientRect();
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

  let panelWidth = parseInt(localStorage.getItem('autoIdPanelWidth'), 10);
  let panelHeight = parseInt(localStorage.getItem('autoIdPanelHeight'), 10);
  if (isNaN(panelWidth) || panelWidth <= 0) panelWidth = 400;
  if (isNaN(panelHeight) || panelHeight <= 0) panelHeight = panel.offsetHeight;
  panel.style.width = `${panelWidth}px`;
  panel.style.height = `${panelHeight}px`;

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

  function disableUiPointerEvents() {
    if (viewer) {
      viewer.style.pointerEvents = 'none';
      viewer.classList.remove('hide-cursor');
    }
    if (controlBar) controlBar.style.pointerEvents = 'none';
    if (sidebar) sidebar.style.pointerEvents = 'none';
  }

  function enableUiPointerEvents() {
    if (viewer) viewer.style.pointerEvents = '';
    if (controlBar) controlBar.style.pointerEvents = '';
    if (sidebar) sidebar.style.pointerEvents = '';
  }

  if (dragBar) {
    dragBar.addEventListener('mousedown', (e) => {
      dragging = true;
      offsetX = e.clientX - panel.offsetLeft;
      offsetY = e.clientY - panel.offsetTop;
      disableUiPointerEvents();
      document.dispatchEvent(new Event('hide-spectrogram-hover'));
      e.preventDefault();
      e.stopPropagation();
    });
  }

  panel.addEventListener('mousemove', (e) => {
    if (dragging || resizing) {
      e.stopPropagation();
      return;
    }
    const state = getEdgeState(e.clientX, e.clientY);
    const cursor = edgeCursor(state) || 'default';
    panel.style.cursor = cursor;
    if (cursor !== 'default') {
      document.body.style.cursor = cursor;
      disableUiPointerEvents();
      document.dispatchEvent(new Event('hide-spectrogram-hover'));
      e.stopPropagation();
    } else {
      document.body.style.cursor = '';
      enableUiPointerEvents();
    }
  });

  panel.addEventListener('mousedown', (e) => {
    if (e.target === dragBar || dragBar.contains(e.target)) return;
    const state = getEdgeState(e.clientX, e.clientY);
    if (state.onLeft || state.onRight || state.onTop || state.onBottom) {
      resizing = true;
      resizeLeft = state.onLeft;
      resizeRight = state.onRight;
      resizeTop = state.onTop;
      resizeBottom = state.onBottom;
      const cursor = edgeCursor(state) || 'default';
      panel.style.cursor = cursor;
      document.body.style.cursor = cursor;
      disableUiPointerEvents();
      document.dispatchEvent(new Event('hide-spectrogram-hover'));
      startX = e.clientX;
      startY = e.clientY;
      startWidth = panel.offsetWidth;
      startHeight = panel.offsetHeight;
      startLeft = panel.offsetLeft;
      startTop = panel.offsetTop;
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener('mousemove', (e) => {
    if (panel.style.display !== 'block') return;
    if (dragging || resizing) {
      e.stopPropagation();
      return;
    }
    const state = getEdgeState(e.clientX, e.clientY);
    const cursor = edgeCursor(state);
    if (cursor) {
      document.body.style.cursor = cursor;
      disableUiPointerEvents();
      document.dispatchEvent(new Event('hide-spectrogram-hover'));
      e.stopPropagation();
    } else {
      document.body.style.cursor = '';
      enableUiPointerEvents();
    }
  }, true);

  window.addEventListener('mousemove', (e) => {
    if (dragging) {
      panel.style.left = `${e.clientX - offsetX}px`;
      panel.style.top = `${e.clientY - offsetY}px`;
      e.stopPropagation();
      return;
    }
    if (resizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      document.body.style.cursor = panel.style.cursor;
      disableUiPointerEvents();
      if (resizeRight) {
        panelWidth = Math.max(200, startWidth + dx);
        panel.style.width = `${panelWidth}px`;
      }
      if (resizeBottom) {
        panelHeight = Math.max(200, startHeight + dy);
        panel.style.height = `${panelHeight}px`;
      }
      if (resizeLeft) {
        panelWidth = Math.max(200, startWidth - dx);
        panel.style.width = `${panelWidth}px`;
        panel.style.left = `${startLeft + dx}px`;
      }
      if (resizeTop) {
        panelHeight = Math.max(200, startHeight - dy);
        panel.style.height = `${panelHeight}px`;
        panel.style.top = `${startTop + dy}px`;
      }
      e.stopPropagation();
    }
  }, true);

  window.addEventListener('mouseup', (e) => {
    if (dragging) {
      dragging = false;
      enableUiPointerEvents();
      e.stopPropagation();
    }
    if (resizing) {
      resizing = false;
      localStorage.setItem('autoIdPanelWidth', panelWidth);
      localStorage.setItem('autoIdPanelHeight', panelHeight);
      document.body.style.cursor = '';
      panel.style.cursor = '';
      enableUiPointerEvents();
      e.stopPropagation();
    }
  }, true);

  resetTabBtn?.addEventListener('click', resetCurrentTab);

  const callTypeDropdown = initDropdown('callTypeInput', ['CF-FM','FM-CF-FM','FM','FM-QCF','QCF']);
  callTypeDropdown.select(0);
  const harmonicDropdown = initDropdown('harmonicInput', ['0','1','2','3']);
  harmonicDropdown.select(0);
  if (tabsContainer) {
    for (let i = 0; i < TAB_COUNT; i++) {
      const t = document.createElement("button");
      t.textContent = `${i + 1}`;
      t.className = "tab-btn";
      if (i === 0) t.classList.add("active");
      t.addEventListener("click", () => switchTab(i));
      tabsContainer.appendChild(t);
      tabs.push(t);
    }
  }

  const inputs = {
    start: document.getElementById('startFreqInput'),
    end: document.getElementById('endFreqInput'),
    high: document.getElementById('highFreqInput'),
    low: document.getElementById('lowFreqInput'),
    knee: document.getElementById('kneeFreqInput'),
    heel: document.getElementById('heelFreqInput'),
  };
  const bandwidthEl = document.getElementById('bandwidthVal');
  const durationEl = document.getElementById('durationVal');

  const markerColors = {
    start: '#e74c3c',
    end: '#27ae60',
    high: '#3498db',
    low: '#9b59b6',
    knee: '#f39c12',
    heel: '#16a085'
  };

  let markers = tabData[currentTab].markers;

  let active = null;
  let startTime = null;
  let endTime = null;
  let draggingKey = null;
  let markersEnabled = true;
  function saveCurrentTab() {
    const data = tabData[currentTab];
    data.callType = callTypeDropdown.selectedIndex;
    data.harmonic = harmonicDropdown.selectedIndex;
    data.startTime = startTime;
    data.endTime = endTime;
    Object.keys(inputs).forEach(k => {
      data.inputs[k] = inputs[k].value;
    });
  }

  function loadTab(idx) {
    const data = tabData[idx];
    markers = data.markers;
    callTypeDropdown.select(data.callType);
    harmonicDropdown.select(data.harmonic);
    Object.keys(inputs).forEach(k => {
      inputs[k].value = data.inputs[k] || "" ;
      if (data.markers[k].time != null) {
        inputs[k].dataset.time = data.markers[k].time;
      } else {
        delete inputs[k].dataset.time;
      }
    });
    startTime = data.startTime;
    endTime = data.endTime;
    updateDerived();
    updateMarkers();
  }

  function switchTab(idx) {
    if (idx === currentTab) return;
    saveCurrentTab();
    if (tabs[currentTab]) tabs[currentTab].classList.remove("active");
    currentTab = idx;
    if (tabs[currentTab]) tabs[currentTab].classList.add("active");
    loadTab(idx);
  }

  function setMarkerInteractivity(enabled) {
    markersEnabled = enabled;
    document.body.classList.toggle('markers-disabled', !enabled);
  }

  setMarkerInteractivity(true);
  loadTab(0);

  Object.entries(inputs).forEach(([key, el]) => {
    if (!el) return;
    el.dataset.key = key;
    el.readOnly = true;
    el.addEventListener('click', () => {
      if (active) active.classList.remove('active-get');
      active = el;
      el.classList.add('active-get');
      setMarkerInteractivity(false);
    });
  });

  function resetField(key) {
    const input = inputs[key];
    if (!input) return;
    input.value = '';
    delete input.dataset.time;
    input.classList.remove('active-get');
    markers[key].freq = null;
    markers[key].time = null;
    if (markers[key].el) markers[key].el.style.display = 'none';
    if (key === 'start') startTime = null;
    if (key === 'end') endTime = null;
    tabData[currentTab].inputs[key] = '';
    tabData[currentTab].markers[key].freq = null;
    tabData[currentTab].markers[key].time = null;
    tabData[currentTab].startTime = startTime;
    tabData[currentTab].endTime = endTime;
    updateDerived();
    updateMarkers();
  }

  const resetButtons = panel.querySelectorAll('.autoid-marker[data-key]');
  resetButtons.forEach(btn => {
    const key = btn.dataset.key;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      resetField(key);
    });
  });

  function updateDerived() {
    const high = parseFloat(inputs.high.value);
    const low = parseFloat(inputs.low.value);
    if (!isNaN(high) && !isNaN(low)) {
      bandwidthEl.textContent = (high - low).toFixed(1);
    }
    if (startTime != null && endTime != null) {
      durationEl.textContent = ((endTime - startTime) * 1000).toFixed(1);
    } else if (markers.high.time != null && markers.low.time != null) {
      durationEl.textContent = ((markers.low.time - markers.high.time) * 1000).toFixed(1);
    }
  }

  function createMarkerEl(key, tabIdx) {
    const el = document.createElement('i');
    el.className = `fa-solid fa-xmark freq-marker marker-${key}`;
    el.style.color = markerColors[key];
    el.dataset.key = key;
    el.dataset.tab = tabIdx;
    el.title = `${key.charAt(0).toUpperCase() + key.slice(1)} freq. marker`;
    el.addEventListener('mouseenter', hideHover);
    el.addEventListener('mouseleave', refreshHover);
    el.addEventListener('mousedown', (ev) => {
      if (!markersEnabled) return;
      ev.stopPropagation();
      hideHover();
      draggingKey = key;
      document.addEventListener('mousemove', onMarkerDrag, { passive: true });
      document.addEventListener('mouseup', stopMarkerDrag, { once: true });
    });
    el.addEventListener('click', (ev) => ev.stopPropagation());
    overlay.appendChild(el);
    return el;
  }

  function updateMarkers() {
    const { min, max } = getFreqRange();
    const actualWidth = container.scrollWidth;
    tabData.forEach((tab, idx) => {
      Object.entries(tab.markers).forEach(([key, m]) => {
        if (!m.el) m.el = createMarkerEl(key, idx);
        if (m.freq == null || m.time == null) {
          m.el.style.display = 'none';
          return;
        }
        const x = (m.time / getDuration()) * actualWidth - viewer.scrollLeft;
        const y = (1 - (m.freq - min) / (max - min)) * spectrogramHeight;
        m.el.style.left = `${x}px`;
        m.el.style.top = `${y}px`;
        m.el.style.display = 'block';
        m.el.style.pointerEvents = idx === currentTab ? 'auto' : 'none';
        m.el.style.opacity = idx === currentTab ? '1' : '0.5';
      });
    });
  }

  function onMarkerDrag(e) {
    if (!draggingKey || !markersEnabled) return;
    const rect = viewer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scrollLeft = viewer.scrollLeft || 0;
    const { min, max } = getFreqRange();
    const freq = (1 - y / spectrogramHeight) * (max - min) + min;
    const time = ((x + scrollLeft) / container.scrollWidth) * getDuration();
    const input = inputs[draggingKey];
    if (input) {
      input.value = freq.toFixed(1);
      input.dataset.time = time;
      if (input === inputs.start) startTime = time;
      if (input === inputs.end) endTime = time;
    }
    tabData[currentTab].startTime = startTime;
    tabData[currentTab].endTime = endTime;
    markers[draggingKey].freq = freq;
    markers[draggingKey].time = time;
    updateDerived();
    updateMarkers();
  }

  function stopMarkerDrag() {
    draggingKey = null;
    document.removeEventListener('mousemove', onMarkerDrag);
    refreshHover();
  }

  function resetTabData(tab) {
    tab.callType = 0;
    tab.harmonic = 0;
    Object.keys(tab.inputs).forEach(k => { tab.inputs[k] = ""; });
    tab.startTime = null;
    tab.endTime = null;
    Object.values(tab.markers).forEach(m => {
      m.freq = null;
      m.time = null;
      if (m.el) m.el.style.display = 'none';
    });
  }

  function resetCurrentTab() {
    resetTabData(tabData[currentTab]);
    callTypeDropdown.select(0);
    harmonicDropdown.select(0);
    Object.values(inputs).forEach(el => {
      if (!el) return;
      el.value = "";
      delete el.dataset.time;
      el.classList.remove('active-get');
    });
    bandwidthEl.textContent = '-';
    durationEl.textContent = '-';
    startTime = null;
    endTime = null;
    active = null;
    setMarkerInteractivity(true);
    loadTab(currentTab);
  }

  function reset() {
    tabData.forEach(d => {
      d.callType = 0;
      d.harmonic = 0;
      Object.keys(d.inputs).forEach(k => { d.inputs[k] = ""; });
      d.startTime = null;
      d.endTime = null;
      Object.keys(d.markers).forEach(k => { d.markers[k].freq = null; d.markers[k].time = null; });
    });
    callTypeDropdown.select(0);
    harmonicDropdown.select(0);
    Object.values(inputs).forEach(el => {
      if (!el) return;
      el.value = "";
      delete el.dataset.time;
      el.classList.remove('active-get');
    });
    bandwidthEl.textContent = '-';
    durationEl.textContent = '-';
    startTime = null;
    endTime = null;
    tabData.forEach(tab => {
      Object.values(tab.markers).forEach(m => {
        m.freq = null;
        m.time = null;
        if (m.el) m.el.style.display = 'none';
      });
    });
    active = null;
    setMarkerInteractivity(true);
    loadTab(currentTab);
  }
  viewer.addEventListener('click', (e) => {
    if (!active) return;
    const rect = viewer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scrollLeft = viewer.scrollLeft || 0;
    const { min, max } = getFreqRange();
    const freq = (1 - y / spectrogramHeight) * (max - min) + min;
    const time = ((x + scrollLeft) / container.scrollWidth) * getDuration();
    const key = active.dataset.key;
    active.value = freq.toFixed(1);
    active.dataset.time = time;
    markers[key].freq = freq;
    markers[key].time = time;
    if (active === inputs.start) startTime = time;
    if (active === inputs.end) endTime = time;
    tabData[currentTab].startTime = startTime;
    tabData[currentTab].endTime = endTime;
    active.classList.remove('active-get');
    active = null;
    setMarkerInteractivity(true);
    updateDerived();
    updateMarkers();
  });

  viewer.addEventListener('scroll', updateMarkers);

  return { updateMarkers, reset, resetCurrentTab };
}
