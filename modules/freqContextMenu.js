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

    // Submenu helpers
    function createSubmenu(options, onClick) {
      const submenu = document.createElement('div');
      submenu.className = 'freq-context-submenu';
      options.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'freq-menu-item';
        item.textContent = opt.label;
        item.dataset.key = opt.key;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          hide();
          onClick(opt.key);
        });
        submenu.appendChild(item);
      });
      return submenu;
    }

    // 取得所有 call type options
    function getCallTypeOptions() {
      return [
        { key: 'CF-FM', label: 'CF-FM' },
        { key: 'FM-CF-FM', label: 'FM-CF-FM' },
        { key: 'FM', label: 'FM' },
        { key: 'FM-QCF', label: 'FM-QCF' },
        { key: 'FM-QCF-FM', label: 'FM-QCF-FM' },
        { key: 'QCF', label: 'QCF' }
      ];
    }

    // 取得 optional freq 欄位
    function getOptionalFreqKeys() {
      if (!autoId || typeof autoId.getOptionalFreqKeys !== 'function') return [];
      return autoId.getOptionalFreqKeys();
    }

    // Optional freq submenu
    let optionalFreqItem = null;
    let optionalFreqSubmenu = null;
    let callTypeItem = null;
    let callTypeSubmenu = null;

    function showOptionalFreqSubmenu() {
      if (optionalFreqSubmenu) optionalFreqSubmenu.remove();
      const keys = getOptionalFreqKeys();
      if (!keys.length) return;
      const options = keys.map(k => ({ key: k, label: labels[k] || k }));
      optionalFreqSubmenu = createSubmenu(options, (key) => {
        if (autoId && typeof autoId.setMarkerAt === 'function') {
          autoId.setMarkerAt(key, currentFreq, currentTime);
        }
      });
      optionalFreqSubmenu.style.position = 'absolute';
      optionalFreqSubmenu.style.left = menu.offsetWidth + 'px';
      optionalFreqSubmenu.style.top = optionalFreqItem.offsetTop + 'px';
      menu.appendChild(optionalFreqSubmenu);
    }

    function showCallTypeSubmenu() {
      if (callTypeSubmenu) callTypeSubmenu.remove();
      const options = getCallTypeOptions();
      callTypeSubmenu = createSubmenu(options, (key) => {
        if (autoId && typeof autoId.setCallType === 'function') {
          autoId.setCallType(key);
        }
      });
      callTypeSubmenu.style.position = 'absolute';
      callTypeSubmenu.style.left = menu.offsetWidth + 'px';
      callTypeSubmenu.style.top = callTypeItem.offsetTop + 'px';
      menu.appendChild(callTypeSubmenu);
    }
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
    // 插入 Optional freq. 與 Call type option（如有可用）
    function insertSpecialOptions() {
      // Optional freq.
      const optionalKeys = getOptionalFreqKeys();
      if (optionalKeys.length) {
        optionalFreqItem = document.createElement('div');
        optionalFreqItem.className = 'freq-menu-item';
        optionalFreqItem.textContent = 'Optional freq.';
        optionalFreqItem.style.justifyContent = 'space-between';
        optionalFreqItem.innerHTML += '<span style="float:right">&gt;</span>';
        optionalFreqItem.addEventListener('click', (e) => {
          e.stopPropagation();
          showOptionalFreqSubmenu();
        });
        menu.appendChild(optionalFreqItem);
      }
      // Call type
      callTypeItem = document.createElement('div');
      callTypeItem.className = 'freq-menu-item';
      callTypeItem.textContent = 'Call type';
      callTypeItem.style.justifyContent = 'space-between';
      callTypeItem.innerHTML += '<span style="float:right">&gt;</span>';
      callTypeItem.addEventListener('click', (e) => {
        e.stopPropagation();
        showCallTypeSubmenu();
      });
      menu.appendChild(callTypeItem);
    }
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
      // 插入 special options（在 Reset 之前）
      insertSpecialOptions();
  // 新增 Reset option
  const resetItem = document.createElement('div');
  resetItem.className = 'freq-menu-item';
  resetItem.textContent = 'Reset ↺';
  resetItem.style.color = 'red';
  resetItem.addEventListener('click', () => {
    hide();
    if (autoId && typeof autoId.resetCurrentTab === 'function') {
      autoId.resetCurrentTab();
    }
  });
  menu.appendChild(resetItem);
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
