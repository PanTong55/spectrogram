import { initDropdown } from './dropdown.js';

export function initAutoIdPanel({
  buttonId = 'autoIdBtn',
  panelId = 'auto-id-panel',
  viewerId = 'viewer-container',
  containerId = 'spectrogram-only',
  overlayId = 'fixed-overlay',
  spectrogramHeight = 800,
  getDuration = () => 0,
  getFreqRange = () => ({ min: 0, max: 0 })
} = {}) {
  const btn = document.getElementById(buttonId);
  const panel = document.getElementById(panelId);
  const viewer = document.getElementById(viewerId);
  const container = document.getElementById(containerId);
  const overlay = document.getElementById(overlayId);

  if (!btn || !panel || !viewer) return;

  btn.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    document.body.classList.toggle('autoid-open', isOpen);
  });

  const callTypeDropdown = initDropdown('callTypeInput', ['CF-FM','FM-CF-FM','FM','FM-QCF','QCF']);
  callTypeDropdown.select(0);
  const harmonicDropdown = initDropdown('harmonicInput', ['0','1','2','3']);
  harmonicDropdown.select(0);

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

  const markers = {
    start: { el: null, freq: null, time: null },
    end: { el: null, freq: null, time: null },
    high: { el: null, freq: null, time: null },
    low: { el: null, freq: null, time: null },
    knee: { el: null, freq: null, time: null },
    heel: { el: null, freq: null, time: null }
  };

  let active = null;
  let startTime = null;
  let endTime = null;

  Object.entries(inputs).forEach(([key, el]) => {
    if (!el) return;
    el.dataset.key = key;
    el.readOnly = true;
    el.addEventListener('click', () => {
      if (active) active.classList.remove('active-get');
      active = el;
      el.classList.add('active-get');
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
    }
  }

  function createMarkerEl(key) {
    const el = document.createElement('i');
    el.className = `fa-solid fa-xmark freq-marker marker-${key}`;
    el.style.color = markerColors[key];
    overlay.appendChild(el);
    return el;
  }

  function updateMarkers() {
    const { min, max } = getFreqRange();
    const actualWidth = container.scrollWidth;
    Object.entries(markers).forEach(([key, m]) => {
      if (m.freq == null || m.time == null) return;
      if (!m.el) m.el = createMarkerEl(key);
      const x = (m.time / getDuration()) * actualWidth - viewer.scrollLeft;
      const y = (1 - (m.freq - min) / (max - min)) * spectrogramHeight;
      m.el.style.left = `${x}px`;
      m.el.style.top = `${y}px`;
      m.el.style.display = 'block';
    });
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
    active.classList.remove('active-get');
    active = null;
    updateDerived();
    updateMarkers();
  });

  viewer.addEventListener('scroll', updateMarkers);

  return { updateMarkers };
}
