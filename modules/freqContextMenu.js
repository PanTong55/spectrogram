export function initFreqContextMenu({
  viewerId,
  containerId = 'spectrogram-only',
  spectrogramHeight = 800,
  getDuration,
  getFreqRange,
  autoId
}) {
  const viewer = document.getElementById(viewerId);
  const container = document.getElementById(containerId);
  if (!viewer) return null;
  const menu = document.createElement('div');
  menu.id = 'freq-context-menu';
  menu.className = 'freq-context-menu';
  menu.style.display = 'none';
  const labels = {
    start: 'Start freq.',
    end: 'End freq.',
    high: 'High freq.',
    low: 'Low freq.',
    knee: 'Knee freq.',
    heel: 'Heel freq.'
  };
  const keys = Object.keys(labels);
  keys.forEach(key => {
    const item = document.createElement('div');
    item.className = 'freq-menu-item';
    item.textContent = labels[key];
    item.dataset.key = key;
    item.addEventListener('click', () => {
      if (item.classList.contains('disabled')) return;
      hide();
      if (autoId && typeof autoId.setMarkerAt === 'function') {
        autoId.setMarkerAt(key, currentFreq, currentTime);
      }
    });
    menu.appendChild(item);
  });
  document.body.appendChild(menu);

  let currentFreq = 0;
  let currentTime = 0;

  function show(clientX, clientY, freq, time) {
    currentFreq = freq;
    currentTime = time;
    keys.forEach(k => {
      const el = menu.querySelector(`[data-key="${k}"]`);
      const enabled = !autoId || (typeof autoId.isFieldEnabled === 'function' && autoId.isFieldEnabled(k));
      el.classList.toggle('disabled', !enabled);
    });
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;
    menu.style.display = 'block';
  }

  function hide() {
    menu.style.display = 'none';
  }

  viewer.addEventListener('contextmenu', (e) => {
    if (!document.body.classList.contains('autoid-open')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const rect = viewer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scrollLeft = viewer.scrollLeft || 0;
    const { min, max } = getFreqRange();
    const freq = (1 - y / spectrogramHeight) * (max - min) + min;
    const time = ((x + scrollLeft) / container.scrollWidth) * getDuration();
    show(e.clientX, e.clientY, freq, time);
  });

  document.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    if (menu.style.display === 'none') return;
    if (!menu.contains(ev.target)) hide();
  });

  return { hide };
}
