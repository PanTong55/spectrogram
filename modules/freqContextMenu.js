export function initFreqContextMenu({
  viewerId,
  wrapperId = 'viewer-wrapper',
  containerId = 'spectrogram-only',
  spectrogramHeight = 800,
  getDuration,
  getFreqRange,
  autoId
}) {
  const viewer = document.getElementById(viewerId);
  const wrapper = document.getElementById(wrapperId);
  const container = document.getElementById(containerId);
  if (!viewer || !wrapper) return null;
  const defaultScrollbarThickness = 20;
  const getScrollbarThickness = () =>
    container.scrollWidth > viewer.clientWidth ? 0 : defaultScrollbarThickness;
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
    heel: 'Heel freq.',
    cfStart: 'CF start',
    cfEnd: 'CF end'
  };
  const keys = Object.keys(labels);
  let deleteKey = null;
  keys.forEach(key => {
    const item = document.createElement('div');
    item.className = 'freq-menu-item';
    item.textContent = labels[key];
    item.dataset.key = key;
    item.addEventListener('click', () => {
      if (item.classList.contains('disabled')) return;
      const isDelete = deleteKey === key;
      hide();
      if (isDelete) {
        if (autoId && typeof autoId.removeMarker === 'function') {
          autoId.removeMarker(key);
        }
      } else if (autoId && typeof autoId.setMarkerAt === 'function') {
        autoId.setMarkerAt(key, currentFreq, currentTime);
      }
    });
    menu.appendChild(item);
  });
  document.body.appendChild(menu);

  let currentFreq = 0;
  let currentTime = 0;

  function show(clientX, clientY, freq, time, delKey = null) {
    currentFreq = freq;
    currentTime = time;
    deleteKey = delKey;
    keys.forEach(k => {
      const el = menu.querySelector(`[data-key="${k}"]`);
      const enabled = !autoId || (typeof autoId.isFieldEnabled === 'function' && autoId.isFieldEnabled(k));
      el.classList.toggle('disabled', !enabled);
      el.style.display = enabled ? 'block' : 'none';
      if (k === deleteKey) {
        el.textContent = `Delete ${labels[k]}`;
        el.classList.add('delete');
      } else {
        el.textContent = labels[k];
        el.classList.remove('delete');
      }
    });
    menu.style.display = 'block';
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;
    let menuRect = menu.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    if (menuRect.bottom > wrapperRect.bottom) {
      const newTop = clientY - menuRect.height;
      menu.style.top = `${Math.max(wrapperRect.top, newTop)}px`;
      menuRect = menu.getBoundingClientRect();
    }
    if (menuRect.right > wrapperRect.right) {
      const newLeft = clientX - menuRect.width;
      menu.style.left = `${Math.max(wrapperRect.left, newLeft)}px`;
    }
  }

  function hide() {
    menu.style.display = 'none';
    deleteKey = null;
  }

  wrapper.addEventListener('contextmenu', (e) => {
    if (!document.body.classList.contains('autoid-open')) return;
    if (e.target.closest('#zoom-controls')) return;
    const rect = viewer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const threshold = getScrollbarThickness();
    const overHScrollbar = y > (viewer.clientHeight - threshold);
    const overVScrollbar = viewer.scrollHeight > viewer.clientHeight && x > viewer.clientWidth;
    if (overHScrollbar || overVScrollbar) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    let freq, time, delKey = null;
    if (e.target.classList.contains('freq-marker')) {
      delKey = e.target.dataset.key;
      freq = parseFloat(e.target.dataset.freq);
      time = parseFloat(e.target.dataset.time);
    } else {
      const scrollLeft = viewer.scrollLeft || 0;
      const { min, max } = getFreqRange();
      freq = (1 - y / spectrogramHeight) * (max - min) + min;
      time = ((x + scrollLeft) / container.scrollWidth) * getDuration();
    }
    show(e.clientX, e.clientY, freq, time, delKey);
  });

  document.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    if (menu.style.display === 'none') return;
    if (!menu.contains(ev.target)) hide();
  });

  return { hide };
}
