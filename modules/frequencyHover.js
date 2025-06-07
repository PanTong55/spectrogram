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
  const fixedOverlay = document.getElementById('fixed-overlay');
  const hoverLine = document.getElementById(hoverLineId);
  const hoverLineV = document.getElementById(hoverLineVId);
  const freqLabel = document.getElementById(freqLabelId);
  const scrollbarThickness = 2;

  let suppressHover = false;
  const persistentLines = [];
  const selections = [];

  function hideAll() {
    hoverLine.style.display = 'none';
    hoverLineV.style.display = 'none';
    freqLabel.style.display = 'none';
  }

  function updateHoverDisplay(e) {
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
    let labelLeft = (viewerWidth - x) < 120 ? `${x - labelOffset}px` : `${x + labelOffset}px`;
    freqLabel.style.transform = (viewerWidth - x) < 120 ? 'translate(-100%, -50%)' : 'translate(0, -50%)';

    freqLabel.style.top = `${y}px`;
    freqLabel.style.left = labelLeft;
    freqLabel.style.display = 'block';
    freqLabel.textContent = `${freq.toFixed(1)} kHz   ${time.toFixed(1)} ms`;
  }

  viewer.addEventListener('mousemove', updateHoverDisplay);
  wrapper.addEventListener('mouseleave', hideAll);

  viewer.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    const rect = fixedOverlay.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const freq = (1 - y / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;

    const threshold = 0.5;
    const existingIndex = persistentLines.findIndex(line =>
      Math.abs(line.freq - freq) < threshold
    );

    if (existingIndex !== -1) {
      fixedOverlay.removeChild(persistentLines[existingIndex].div);
      persistentLines.splice(existingIndex, 1);
    } else {
      if (persistentLines.length >= 5) return;
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

  // 矩形拖拉功能

  let isDrawing = false, startX = 0, startY = 0, selectionRect = null;

  viewer.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const rect = viewer.getBoundingClientRect();
    startX = e.clientX - rect.left + viewer.scrollLeft;
    startY = e.clientY - rect.top;
    if (startY > (viewer.clientHeight - scrollbarThickness)) return;
    isDrawing = true;

    selectionRect = document.createElement('div');
    selectionRect.style.position = 'absolute';
    selectionRect.style.border = '1px solid black';
    selectionRect.style.backgroundColor = 'rgba(0,0,0,0.1)';
    selectionRect.style.left = `${startX}px`;
    selectionRect.style.top = `${startY}px`;
    selectionRect.style.zIndex = '20';
    viewer.appendChild(selectionRect);
  });

  viewer.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const rect = viewer.getBoundingClientRect();
    const currentX = e.clientX - rect.left + viewer.scrollLeft;
    const currentY = e.clientY - rect.top;
    const x = Math.min(currentX, startX);
    const y = Math.min(currentY, startY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    Object.assign(selectionRect.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` });
  });

  viewer.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;

    const rect = selectionRect.getBoundingClientRect();
    const viewerRect = viewer.getBoundingClientRect();
    const left = rect.left - viewerRect.left + viewer.scrollLeft;
    const top = rect.top - viewerRect.top;
    const width = rect.width;
    const height = rect.height;

    const Flow = (1 - (top + height) / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const Fhigh = (1 - top / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const Bandwidth = Fhigh - Flow;
    const startTime = (left / spectrogramWidth) * totalDuration;
    const endTime = ((left + width) / spectrogramWidth) * totalDuration;
    const Duration = endTime - startTime;

    createTooltip(left, top, width, height, Fhigh, Flow, Bandwidth, Duration);
  });

  function createTooltip(left, top, width, height, Fhigh, Flow, Bandwidth, Duration) {
    const tooltip = document.createElement('div');
    tooltip.className = 'draggable-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.left = `${left + width + 10}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.zIndex = '30';
    tooltip.style.padding = '6px 10px';
    tooltip.style.background = 'white';
    tooltip.style.border = '1px solid black';
    tooltip.style.fontSize = '12px';
    tooltip.style.fontFamily = 'Noto Sans HK';
    tooltip.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.2)';
    tooltip.style.cursor = 'move';
    tooltip.innerHTML = `
      <div>F.high: ${Fhigh.toFixed(1)}kHz</div>
      <div>F.Low: ${Flow.toFixed(1)}kHz</div>
      <div><b>Bandwidth:</b> ${Bandwidth.toFixed(1)}kHz</div>
      <div><b>Duration:</b> ${Duration.toFixed(1)}ms</div>
      <div style="position:absolute; top:2px; right:6px; cursor:pointer;" class="close-btn">×</div>
    `;

    viewer.appendChild(tooltip);
    viewer.removeChild(selectionRect);
    selections.push({ Fhigh, Flow, startTime, endTime, tooltip });

    enableDrag(tooltip);
    tooltip.querySelector('.close-btn').addEventListener('click', () => {
      viewer.removeChild(tooltip);
    });
  }

  function enableDrag(element) {
    let offsetX, offsetY, isDragging = false;
    element.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('close-btn')) return;
      isDragging = true;
      const rect = element.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const viewerRect = viewer.getBoundingClientRect();
      const newX = e.clientX - viewerRect.left + viewer.scrollLeft - offsetX;
      const newY = e.clientY - viewerRect.top - offsetY;
      Object.assign(element.style, { left: `${newX}px`, top: `${newY}px` });
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

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
    },
    setSpectrogramWidth: (newWidth) => { spectrogramWidth = newWidth; },
    setTotalDuration: (newDuration) => { totalDuration = newDuration; }
  };
}
