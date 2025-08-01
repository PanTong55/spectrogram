import { initDropdown } from "./dropdown.js";
import { autoIdHK } from "./autoid_HK.js";

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
  const dragBar = panel.querySelector('.popup-drag-bar');
  const closeBtn = panel.querySelector('.popup-close-btn');
  const viewer = document.getElementById(viewerId);
  const container = document.getElementById(containerId);
  const overlay = document.getElementById(overlayId);

  const svgNS = 'http://www.w3.org/2000/svg';
  const linesSvg = document.createElementNS(svgNS, 'svg');
  linesSvg.id = 'autoid-lines';
  overlay.appendChild(linesSvg);

  const layout = document.getElementById('layout');
  if (layout && panel && panel.parentElement !== layout) {
    layout.appendChild(panel);
  }
  const resetTabBtn = document.getElementById('autoIdTabResetBtn');
  const tabsContainer = document.getElementById("autoid-tabs");
  const tabs = [];
  const TAB_COUNT = 5;
  const tabData = Array.from({ length: TAB_COUNT }, () => ({
    callType: 3,
    harmonic: 0,
    result: null,
    showValidation: false,
    inputs: {
      start: "",
      end: "",
      high: "",
      low: "",
      knee: "",
      heel: "",
      cfStart: "",
      cfEnd: ""
    },
    startTime: null,
    endTime: null,
    markers: {
      start: { el: null, freq: null, time: null },
      end: { el: null, freq: null, time: null },
      high: { el: null, freq: null, time: null },
      low: { el: null, freq: null, time: null },
      knee: { el: null, freq: null, time: null },
      heel: { el: null, freq: null, time: null },
      cfStart: { el: null, freq: null, time: null },
      cfEnd: { el: null, freq: null, time: null }
    },
    line: null
  }));
  let currentTab = 0;

  if (!btn || !panel || !viewer) return;

  function togglePanel() {
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    document.body.classList.toggle('autoid-open', !isVisible);
    document.dispatchEvent(new Event(isVisible ? 'autoid-close' : 'autoid-open'));
  }

  btn.addEventListener('click', togglePanel);
  closeBtn?.addEventListener('click', togglePanel);

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function onDrag(e) {
    if (!dragging) return;
    panel.style.left = `${e.clientX - offsetX}px`;
    panel.style.top = `${e.clientY - offsetY}px`;
  }

  function stopDrag() {
    dragging = false;
    document.removeEventListener('mousemove', onDrag);
    hideHover();
  }

  dragBar?.addEventListener('mousedown', (e) => {
    dragging = true;
    offsetX = e.clientX - panel.offsetLeft;
    offsetY = e.clientY - panel.offsetTop;
    hideHover();
    document.addEventListener('mousemove', onDrag, { passive: true });
    document.addEventListener('mouseup', stopDrag, { once: true });
    e.preventDefault();
  });

  resetTabBtn?.addEventListener('click', resetCurrentTab);

  const callTypeDropdown = initDropdown('callTypeInput', ['CF-FM','FM-CF-FM','FM','FM-QCF','QCF']);
  const harmonicDropdown = initDropdown('harmonicInput', ['0','1','2','3']);
  function handleHarmonicChange(value, idx) {
    tabData[currentTab].harmonic = idx;
    if (!suppressResultReset) clearResult();
  }
  harmonicDropdown.onChange = handleHarmonicChange;
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
    cfStart: document.getElementById('cfStartFreqInput'),
    cfEnd: document.getElementById('cfEndFreqInput'),
  };
  const rows = {
    start: document.getElementById('startFreqRow'),
    end: document.getElementById('endFreqRow'),
    high: document.getElementById('highFreqRow'),
    low: document.getElementById('lowFreqRow'),
    knee: document.getElementById('kneeFreqRow'),
    heel: document.getElementById('heelFreqRow'),
    cfStart: document.getElementById('cfStartFreqRow'),
    cfEnd: document.getElementById('cfEndFreqRow'),
  };
  const bandwidthEl = document.getElementById('bandwidthVal');
  const durationEl = document.getElementById('durationVal');
  const pulseIdBtn = document.getElementById('pulseIdBtn');
  const sequenceIdBtn = document.getElementById('sequenceIdBtn');
  const resultEl = document.getElementById('autoIdResult');
  const bandwidthWarning = document.getElementById('bandwidth-warning');
  const freqOrderWarning = document.getElementById('freq-order-warning');
  const kneeOrderWarning = document.getElementById('knee-order-warning');
  const timeOrderWarning = document.getElementById('time-order-warning');

  function updateWarnings(high, low, knee, bw, startT, endT) {
    const callType = callTypeDropdown.items[callTypeDropdown.selectedIndex];
    const showBandwidth = callType === 'QCF' && bw != null && bw > 5;
    const showOrder = !isNaN(high) && !isNaN(low) && low > high;
    const showKneeOrder = !isNaN(knee) && !isNaN(low) && knee < low;
    const showTimeOrder = startT != null && endT != null && endT < startT;
    const hasWarnings = showBandwidth || showOrder || showKneeOrder || showTimeOrder;
    if (inputs.high) inputs.high.classList.toggle('warning', showBandwidth || showOrder);
    if (inputs.low) inputs.low.classList.toggle('warning', showBandwidth || showOrder || showKneeOrder);
    if (inputs.knee) inputs.knee.classList.toggle('warning', showKneeOrder);
    if (inputs.start) inputs.start.classList.toggle('warning', showTimeOrder);
    if (inputs.end) inputs.end.classList.toggle('warning', showTimeOrder);
    if (bandwidthWarning) bandwidthWarning.style.display = showBandwidth ? 'flex' : 'none';
    if (freqOrderWarning) freqOrderWarning.style.display = showOrder ? 'flex' : 'none';
    if (kneeOrderWarning) kneeOrderWarning.style.display = showKneeOrder ? 'flex' : 'none';
    if (timeOrderWarning) timeOrderWarning.style.display = showTimeOrder ? 'flex' : 'none';
    if (pulseIdBtn) pulseIdBtn.disabled = hasWarnings;
    if (sequenceIdBtn) sequenceIdBtn.disabled = hasWarnings;
  }

  const markerColors = {
    start: '#e74c3c',
    end: '#004cff',
    high: '#3498db',
    low: '#9b59b6',
    knee: '#f39c12',
    heel: '#16a085',
    cfStart: '#e67e22',
    cfEnd: '#1abc9c'
  };

  const markerTitles = {
    start: 'Start freq.',
    end: 'End freq.',
    high: 'High freq.',
    low: 'Low freq.',
    knee: 'Knee freq.',
    heel: 'Heel freq.',
    cfStart: 'CF start',
    cfEnd: 'CF end'
  };

  let markers = tabData[currentTab].markers;

  let active = null;
  let startTime = null;
  let endTime = null;
  let draggingKey = null;
  let markersEnabled = true;
  let suppressResultReset = false;

  function updateResultDisplay() {
    const res = tabData[currentTab].result;
    if (resultEl) {
      if (res) {
        resultEl.innerHTML = formatSpeciesResult(res);
      } else {
        resultEl.textContent = '-';
      }
    }
  }

  function clearResult() {
    if (tabData[currentTab].result != null) {
      tabData[currentTab].result = null;
      updateResultDisplay();
    }
  }
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
    suppressResultReset = true;
    callTypeDropdown.select(data.callType);
    harmonicDropdown.select(data.harmonic);
    suppressResultReset = false;
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
    updateResultDisplay();
    validateMandatoryInputs();
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

  Object.entries(inputs).forEach(([key, el]) => {
    if (!el) return;
    el.dataset.key = key;
    el.readOnly = true;
    el.addEventListener('click', () => {
      if (active === el) {
        el.classList.remove('active-get');
        active = null;
        setMarkerInteractivity(true);
        return;
      }
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
    input.classList.remove('invalid');
    input.classList.remove('warning');
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
    clearResult();
    validateMandatoryInputs();
  }

  const resetButtons = {};
  panel.querySelectorAll('.autoid-marker[data-key]').forEach(btn => {
    const key = btn.dataset.key;
    resetButtons[key] = btn;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      resetField(key);
    });
  });

  function toggleRow(key, show) {
    const row = rows[key];
    if (!row) return;
    row.style.display = show ? 'flex' : 'none';
    if (inputs[key]) inputs[key].disabled = !show;
    const btn = resetButtons[key];
    if (btn) btn.disabled = !show;
    if (!show) resetField(key);
    validateMandatoryInputs();
  }

  function handleCallTypeChange(value, idx) {
    const hideHighLow = ['CF-FM', 'FM-CF-FM'].includes(value);
    const hideKneeHeel = ['CF-FM', 'FM-CF-FM', 'QCF'].includes(value);
    const hideCf = ['QCF', 'FM-QCF', 'FM'].includes(value);
    toggleRow('high', !hideHighLow);
    toggleRow('low', !hideHighLow);
    toggleRow('knee', !hideKneeHeel);
    toggleRow('heel', !hideKneeHeel);
    toggleRow('cfStart', !hideCf);
    toggleRow('cfEnd', !hideCf);
    tabData[currentTab].callType = idx;
    if (!suppressResultReset) clearResult();
    updateDerived();
    updateLines();
    validateMandatoryInputs();
  }

  callTypeDropdown.onChange = handleCallTypeChange;
  harmonicDropdown.select(0);
  callTypeDropdown.select(3);
  loadTab(0);

  function updateDerived() {
    const callType = callTypeDropdown.items[callTypeDropdown.selectedIndex];
    const high = parseFloat(inputs.high.value);
    const low = parseFloat(inputs.low.value);
    const knee = parseFloat(inputs.knee.value);
    const cfStartVal = parseFloat(inputs.cfStart.value);
    const endVal = parseFloat(inputs.end.value);
    let bandwidth = null;
    if (['FM-CF-FM', 'CF-FM'].includes(callType)) {
      if (!isNaN(cfStartVal) && !isNaN(endVal)) {
        bandwidth = cfStartVal - endVal;
        bandwidthEl.textContent = bandwidth.toFixed(1);
      } else {
        bandwidthEl.textContent = '-';
      }
    } else if (!isNaN(high) && !isNaN(low)) {
      bandwidth = high - low;
      bandwidthEl.textContent = bandwidth.toFixed(1);
    } else {
      bandwidthEl.textContent = '-';
    }
    if (startTime != null && endTime != null) {
      durationEl.textContent = ((endTime - startTime) * 1000).toFixed(1);
    } else if (markers.high.time != null && markers.low.time != null) {
      durationEl.textContent = ((markers.low.time - markers.high.time) * 1000).toFixed(1);
    } else {
      durationEl.textContent = '-';
    }
    updateWarnings(high, low, knee, bandwidth, startTime, endTime);
  }

  function createMarkerEl(key, tabIdx) {
    const el = document.createElement('i');
    el.className = `fa-solid fa-xmark freq-marker marker-${key}`;
    el.style.color = markerColors[key];
    el.dataset.key = key;
    el.dataset.tab = tabIdx;
    const title = markerTitles[key] || key;
    el.dataset.title = title;
    el.setAttribute('aria-label', title);
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
        m.el.dataset.freq = m.freq;
        m.el.dataset.time = m.time;
      });
    });
    updateLines();
  }

  function updateLines() {
    const { min, max } = getFreqRange();
    const actualWidth = container.scrollWidth;
    tabData.forEach((tab, idx) => {
      if (!tab.line) {
        tab.line = document.createElementNS(svgNS, 'path');
        tab.line.dataset.tab = idx;
        linesSvg.appendChild(tab.line);
      }
      const points = Object.entries(tab.markers)
        .filter(([_, m]) => m.freq != null && m.time != null)
        .sort((a, b) => a[1].time - b[1].time)
        .map(([key, m]) => {
          const x = (m.time / getDuration()) * actualWidth - viewer.scrollLeft;
          const y = (1 - (m.freq - min) / (max - min)) * spectrogramHeight;
          return { x, y, key };
        });
      if (points.length < 2) {
        tab.line.setAttribute('d', '');
        tab.line.style.display = 'none';
        return;
      }
      const d = makeRoundedPath(points);
      tab.line.setAttribute('stroke-linejoin', 'round');
      tab.line.setAttribute('d', d);
      tab.line.style.display = 'block';
      tab.line.style.opacity = idx === currentTab ? '1' : '0.5';
    });
  }

  function makeRoundedPath(points, tension = 0.5) {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    const maxVerticalOffset = 10;  // 全域最大垂直偏移限制
  
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
  
      const isLastSegment = (i === points.length - 2);
      const yDiff = Math.abs(p1.y - p2.y);
  
      if (p1.key === 'cfStart' && p2.key === 'cfEnd') {
        // CF start到CF end間保持直線，無弧度
        d += ` L ${p2.x} ${p2.y}`;
      } else if (isLastSegment && yDiff < 5) {
        // 最後一段且Y差小於5px → 使用L形直線
        d += ` L ${p1.x} ${p2.y} L ${p2.x} ${p2.y}`;
      } else {
        const cp1x = p1.x + (p2.x - p0.x) * tension / 6;
        const cp1y = p1.y + (p2.y - p0.y) * tension / 6;
  
        let cp2x = p2.x - (p3.x - p1.x) * tension / 6;
        let cp2y = p2.y - (p3.y - p1.y) * tension / 6;
  
        if (p2.key !== 'cfStart' && p2.key !== 'end') {
          const dy = Math.abs(p1.y - p2.y);
          const localMaxOffset = Math.min(maxVerticalOffset, dy * 0.6);
          cp2y = Math.min(cp2y, p2.y + localMaxOffset);
          cp2x = Math.min(cp2x, p2.x);
        }
  
        d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
      }
    }
  
    return d;
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
    validateMandatoryInputs();
    clearResult();
  }

  function setMarkerAt(key, freq, time) {
    const input = inputs[key];
    if (!input) return;
    input.value = freq.toFixed(1);
    input.dataset.time = time;
    markers[key].freq = freq;
    markers[key].time = time;
    if (key === 'start') startTime = time;
    if (key === 'end') endTime = time;
    tabData[currentTab].startTime = startTime;
    tabData[currentTab].endTime = endTime;
    updateDerived();
    updateMarkers();
    clearResult();
    validateMandatoryInputs();
  }

  function removeMarker(key) {
    resetField(key);
  }

  function isFieldEnabled(key) {
    const input = inputs[key];
    return input && !input.disabled;
  }

  function resetTabData(tab) {
    tab.callType = 3;
    tab.harmonic = 0;
    tab.result = null;
    tab.showValidation = false;
    Object.keys(tab.inputs).forEach(k => { tab.inputs[k] = ""; });
    tab.startTime = null;
    tab.endTime = null;
    Object.values(tab.markers).forEach(m => {
      m.freq = null;
      m.time = null;
      if (m.el) m.el.style.display = 'none';
    });
    if (tab.line) {
      tab.line.setAttribute('d', '');
      tab.line.style.display = 'none';
    }
  }

  function resetCurrentTab() {
    tabData[currentTab].showValidation = false;
    resetTabData(tabData[currentTab]);
    callTypeDropdown.select(3);
    harmonicDropdown.select(0);
    Object.values(inputs).forEach(el => {
      if (!el) return;
      el.value = "";
      delete el.dataset.time;
      el.classList.remove('active-get');
      el.classList.remove('invalid');
      el.classList.remove('warning');
    });
    bandwidthEl.textContent = '-';
    durationEl.textContent = '-';
    startTime = null;
    endTime = null;
    active = null;
    tabData[currentTab].result = null;
    setMarkerInteractivity(true);
    loadTab(currentTab);
  }

  function reset() {
    tabData.forEach(d => {
      d.showValidation = false;
      d.callType = 3;
      d.harmonic = 0;
      d.result = null;
      Object.keys(d.inputs).forEach(k => { d.inputs[k] = ""; });
      d.startTime = null;
      d.endTime = null;
      Object.keys(d.markers).forEach(k => { d.markers[k].freq = null; d.markers[k].time = null; });
      if (d.line) {
        d.line.setAttribute('d', '');
        d.line.style.display = 'none';
      }
    });
    callTypeDropdown.select(3);
    harmonicDropdown.select(0);
    Object.values(inputs).forEach(el => {
      if (!el) return;
      el.value = "";
      delete el.dataset.time;
      el.classList.remove('active-get');
      el.classList.remove('invalid');
      el.classList.remove('warning');
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
    clearResult();
  });

  viewer.addEventListener('scroll', updateMarkers);

  function formatSpeciesResult(res) {
    return res.split(' / ').map(name => {
      if (name.endsWith('sp.')) {
        const genus = name.replace(' sp.', '');
        return `<i>${genus}</i> sp.`;
      }
      if (name === 'TBC' || name === '-' || name === 'No species matched') return name;
      return `<i>${name}</i>`;
    }).join(' / ');
  }

  function showPlaceholderResult() {
    updateResultDisplay();
  }

  function validateMandatoryInputs(forceShow = false) {
    const tab = tabData[currentTab];
    if (forceShow) tab.showValidation = true;
    const showValidation = tab.showValidation;
    const callType = callTypeDropdown.items[callTypeDropdown.selectedIndex];
    const requiredMap = {
      'CF-FM': ['cfStart', 'cfEnd'],
      'FM-CF-FM': ['cfStart', 'cfEnd'],
      'FM': ['high', 'low'],
      'FM-QCF': ['high', 'low', 'knee'],
      'QCF': ['high', 'low'],
    };
    const required = requiredMap[callType] || [];
    let allValid = true;
    Object.entries(inputs).forEach(([key, el]) => {
      if (!el) return;
      if (required.includes(key)) {
        const val = parseFloat(el.value);
        const isValid = !isNaN(val);
        if (showValidation) {
          el.classList.toggle('invalid', !isValid);
        } else {
          el.classList.remove('invalid');
        }
        if (!isValid) allValid = false;
      } else {
        el.classList.remove('invalid');
      }
    });
    return allValid;
  }
  function runPulseId() {
    if (!validateMandatoryInputs(true)) {
      if (resultEl) resultEl.textContent = "-";
      return;
    }
    const callType = callTypeDropdown.items[callTypeDropdown.selectedIndex];
    const high = parseFloat(inputs.high.value);
    const low = parseFloat(inputs.low.value);
    const knee = parseFloat(inputs.knee.value);
    const heel = parseFloat(inputs.heel.value);
    const start = parseFloat(inputs.start.value);
    const end = parseFloat(inputs.end.value);
    const cfStart = parseFloat(inputs.cfStart.value);
    const cfEnd = parseFloat(inputs.cfEnd.value);

    let duration = null;
    if (startTime != null && endTime != null) {
      duration = (endTime - startTime) * 1000;
    } else if (markers.high.time != null && markers.low.time != null) {
      duration = (markers.low.time - markers.high.time) * 1000;
    }

    let bandwidth = null;
    if (["FM-CF-FM", "CF-FM"].includes(callType)) {
      if (!isNaN(cfStart) && !isNaN(end)) bandwidth = cfStart - end;
    } else if (!isNaN(high) && !isNaN(low)) {
      bandwidth = high - low;
    }

    const kneeLowTime =
      markers.knee.time != null && markers.low.time != null
        ? (markers.knee.time - markers.low.time) * 1000
        : null;
    const kneeLowBandwidth = !isNaN(knee) && !isNaN(low) ? knee - low : null;
    const heelLowBandwidth = !isNaN(heel) && !isNaN(low) ? heel - low : null;
    const kneeHeelBandwidth = !isNaN(knee) && !isNaN(heel) ? knee - heel : null;
    const harmonic = parseInt(
      harmonicDropdown.items[harmonicDropdown.selectedIndex],
      10
    );

    const res = autoIdHK({
      callType,
      harmonic,
      highestFreq: high,
      lowestFreq: low,
      kneeFreq: knee,
      heelFreq: heel,
      startFreq: start,
      endFreq: end,
      cfStart,
      cfEnd,
      duration,
      bandwidth,
      kneeLowTime,
      kneeLowBandwidth,
      heelLowBandwidth,
      kneeHeelBandwidth
    });
    tabData[currentTab].result = res;
    updateResultDisplay();
  }

  function runSequenceId() {
    runPulseId();
  }

  pulseIdBtn?.addEventListener('click', runPulseId);
  sequenceIdBtn?.addEventListener('click', runSequenceId);

  return {
    updateMarkers,
    reset,
    resetCurrentTab,
    setMarkerAt,
    removeMarker,
    isFieldEnabled,
    getFreqRange,
    getDuration: () => getDuration(),
    spectrogramHeight
  };
}
