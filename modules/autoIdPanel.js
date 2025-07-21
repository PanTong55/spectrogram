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

  btn.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    document.body.classList.toggle('autoid-open', isOpen);
  });

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
