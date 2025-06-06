export function initFrequencyHover({
  viewerId,
  wrapperId = 'viewer-wrapper',
  hoverLineId,
  hoverLineVId,
  freqLabelId,
  spectrogramHeight = 800,
  spectrogramWidth = 1024,
  maxFrequency = 128,
  minFrequency = 0,
  totalDuration = 1000,
}) {
  const viewer = document.getElementById(viewerId);
  const wrapper = document.getElementById(wrapperId);
  const hoverLine = document.getElementById(hoverLineId);
  const hoverLineV = document.getElementById(hoverLineVId);
  const freqLabel = document.getElementById(freqLabelId);
  const fixedOverlay = document.getElementById('fixed-overlay');
  const zoomControls = document.getElementById('zoom-controls');

  const scrollbarThickness = 2;
  let suppressHover = false;
  const persistentLines = [];  // 儲存所有固定橫線

  const hideAll = () => {
    hoverLine.style.display = 'none';
    hoverLineV.style.display = 'none';
    freqLabel.style.display = 'none';
  };

  const updateHoverDisplay = (e) => {
    if (suppressHover) return;

    const rect = viewer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y > (viewer.clientHeight - scrollbarThickness)) {
      hideAll();
      return;
    }

    const scrollLeft = viewer.scrollLeft || 0;
    const freq = (1 - y / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const time = ((x + scrollLeft) / spectrogramWidth) * totalDuration;

    hoverLine.style.top = `${y}px`;
    hoverLine.style.display = 'block';

    hoverLineV.style.left = `${x}px`;
    hoverLineV.style.display = 'block';

    const viewerWidth = viewer.clientWidth;
    const labelOffset = 12;
    let labelLeft;

    if ((viewerWidth - x) < 120) {
      freqLabel.style.transform = 'translate(-100%, -50%)';
      labelLeft = `${x - labelOffset}px`;
    } else {
      freqLabel.style.transform = 'translate(0, -50%)';
      labelLeft = `${x + labelOffset}px`;
    }

    freqLabel.style.top = `${y}px`;
    freqLabel.style.left = labelLeft;
    freqLabel.style.display = 'block';
    freqLabel.textContent = `${freq.toFixed(1)} kHz   ${time.toFixed(1)} ms`;
  };

  viewer.addEventListener('mousemove', updateHoverDisplay);

  wrapper.addEventListener('mouseleave', () => {
    hideAll();
  });

  viewer.addEventListener('mouseenter', () => {
    viewer.classList.add('hide-cursor');
  });

  viewer.addEventListener('mouseleave', () => {
    viewer.classList.remove('hide-cursor');
  });

  if (zoomControls) {
    zoomControls.addEventListener('mouseenter', () => {
      suppressHover = true;
      hideAll();
    });

    zoomControls.addEventListener('mouseleave', () => {
      suppressHover = false;
    });
  }

  viewer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  
    const rect = fixedOverlay.getBoundingClientRect();
    const y = e.clientY - rect.top;
  
    // 反算出 frequency
    const freq = (1 - y / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
  
    // 判斷是否已有同位置頻率線
    const threshold = 1;  // 1 kHz 誤差範圍
    const existingIndex = persistentLines.findIndex(line =>
      Math.abs(line.freq - freq) < threshold
    );
  
    if (existingIndex !== -1) {
      // 刪除該線
      fixedOverlay.removeChild(persistentLines[existingIndex].div);
      persistentLines.splice(existingIndex, 1);
    } else {
      if (persistentLines.length >= 5) return;
  
      // 正向計算應該插入的 y 位置 (頻率轉換公式)
      const yPos = (1 - (freq - minFrequency) / (maxFrequency - minFrequency)) * spectrogramHeight;
  
      const line = document.createElement('div');
      line.style.position = 'absolute';
      line.style.top = `${yPos}px`;
      line.style.left = '0';
      line.style.width = '100%';
      line.style.height = '1px';
      line.style.background = 'red';
      line.style.zIndex = '15';
      fixedOverlay.appendChild(line);
  
      persistentLines.push({ freq, div: line });
    }
  });

  function updatePersistentLines() {
    persistentLines.forEach(line => {
      const yPos = (1 - (line.freq - minFrequency) / (maxFrequency - minFrequency)) * spectrogramHeight;
      line.div.style.top = `${yPos}px`;
    });
  }

  return {
    updatePersistentLines,
    setFrequencyRange: (min, max) => {
      minFrequency = min;
      maxFrequency = max;
      updatePersistentLines();
    }
  };  
}
