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
  getZoomLevel,
  getDuration,
  analyzer
}) {
  const viewer = document.getElementById(viewerId);
  const wrapper = document.getElementById(wrapperId);
  const hoverLine = document.getElementById(hoverLineId);
  const hoverLineV = document.getElementById(hoverLineVId);
  const freqLabel = document.getElementById(freqLabelId);
  const fixedOverlay = document.getElementById('fixed-overlay');
  const zoomControls = document.getElementById('zoom-controls');
  const container = document.getElementById('spectrogram-only');
  const persistentLines = [];
  const selections = [];
  const scrollbarThickness = 2;
  const edgeThreshold = 5;
  
  let suppressHover = false;
  let isOverTooltip = false;
  let isResizing = false;
  let isDrawing = false;
  let startX = 0, startY = 0;
  let selectionRect = null;

  const hideAll = () => {
    hoverLine.style.display = 'none';
    hoverLineV.style.display = 'none';
    freqLabel.style.display = 'none';
  };

  const updateHoverDisplay = (e) => {
    if (suppressHover || isResizing) {
      hideAll();
      return;
    }
    
    const rect = viewer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y > (viewer.clientHeight - scrollbarThickness)) {
      hideAll();
      return;
    }

    const scrollLeft = viewer.scrollLeft || 0;
    const freq = (1 - y / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const actualWidth = container.scrollWidth;
    const time = ((x + scrollLeft) / actualWidth) * getDuration();

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
    freqLabel.textContent = `${freq.toFixed(1)} kHz   ${(time * 1000).toFixed(1)} ms`;
  };

  viewer.addEventListener('mousemove', updateHoverDisplay);
  wrapper.addEventListener('mouseleave', hideAll);
  viewer.addEventListener('mouseenter', () => viewer.classList.add('hide-cursor'));
  viewer.addEventListener('mouseleave', () => viewer.classList.remove('hide-cursor'));

  if (zoomControls) {
    zoomControls.addEventListener('mouseenter', () => { suppressHover = true; hideAll(); });
    zoomControls.addEventListener('mouseleave', () => { suppressHover = false; });
  }

  viewer.addEventListener('mousedown', (e) => {
    if (isOverTooltip || isResizing) return;
    if (e.button !== 0) return;
    const rect = viewer.getBoundingClientRect();
    startX = e.clientX - rect.left + viewer.scrollLeft;
    startY = e.clientY - rect.top;
    if (startY > (viewer.clientHeight - scrollbarThickness)) return;
    isDrawing = true;
    suppressHover = true;
    hideAll();
    selectionRect = document.createElement('div');
    selectionRect.style.position = 'absolute';
    selectionRect.style.border = '1px solid black';
    selectionRect.style.backgroundColor = 'rgba(0,0,0,0.05)';
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
    selectionRect.style.left = `${x}px`;
    selectionRect.style.top = `${y}px`;
    selectionRect.style.width = `${width}px`;
    selectionRect.style.height = `${height}px`;
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
    const minThreshold = 3;
    if (width <= minThreshold || height <= minThreshold) {
      viewer.removeChild(selectionRect);
      selectionRect = null;
      return;
    }
    const Flow = (1 - (top + height) / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const Fhigh = (1 - top / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const Bandwidth = Fhigh - Flow;
    const actualWidth = getDuration() * getZoomLevel();
    const startTime = (left / actualWidth) * getDuration();
    const endTime = ((left + width) / actualWidth) * getDuration();
    const Duration = endTime - startTime;

    let Fmax = null;
    if (analyzer) {
      Fmax = analyzer.getFmaxFromSelection({
        startTime, endTime, Flow, Fhigh, totalDuration: getDuration()
      });
    }    
    
    createTooltip(left, top, width, height, Fhigh, Flow, Bandwidth, Duration, selectionRect, startTime, endTime, Fmax);
    selectionRect = null;
    suppressHover = false;
  });

  viewer.addEventListener('contextmenu', (e) => {
    if (isOverTooltip) return;
    e.preventDefault();
    const rect = fixedOverlay.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const freq = (1 - y / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const threshold = 1;
    const existingIndex = persistentLines.findIndex(line => Math.abs(line.freq - freq) < threshold);

    if (existingIndex !== -1) {
      fixedOverlay.removeChild(persistentLines[existingIndex].div);
      persistentLines.splice(existingIndex, 1);
    } else {
      if (persistentLines.length >= 5) return;
      const yPos = Math.round((1 - (freq - minFrequency) / (maxFrequency - minFrequency)) * spectrogramHeight);
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

  function createTooltip(left, top, width, height, Fhigh, Flow, Bandwidth, Duration, rectObj, startTime, endTime, Fmax) {
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
      <div><b>F.high:</b> <span class="fhigh">${Fhigh.toFixed(1)}</span> kHz</div>
      <div><b>F.low:</b> <span class="flow">${Flow.toFixed(1)}</span> kHz</div>
      <div><b>Bandwidth:</b> <span class="bandwidth">${Bandwidth.toFixed(1)}</span> kHz</div>
      <div><b>Duration:</b> <span class="duration">${(Duration * 1000).toFixed(1)}</span> ms</div>
      <div><b>F.max:</b> <span class="fmax">${Fmax ? Fmax.toFixed(1) : '-'}</span> kHz</div>
      <div style="position:absolute; top:2px; right:6px; cursor:pointer;" class="close-btn">×</div>
    `;
    tooltip.addEventListener('mouseenter', () => { isOverTooltip = true; suppressHover = true; hideAll(); });
    tooltip.addEventListener('mouseleave', () => { isOverTooltip = false; suppressHover = false; });
    viewer.appendChild(tooltip);

    const selObj = { data: { startTime, endTime, Flow, Fhigh, Fmax }, rect: rectObj, tooltip };
    selections.push(selObj);
    enableDrag(tooltip);
    tooltip.querySelector('.close-btn').addEventListener('click', () => {
      const index = selections.findIndex(sel => sel.tooltip === tooltip);
      if (index !== -1) {
        viewer.removeChild(selections[index].rect);
        viewer.removeChild(selections[index].tooltip);
        selections.splice(index, 1);
      }
      isOverTooltip = false;
      suppressHover = false;
    });
  }

  function enableResize(sel) {
    const rect = sel.rect;
    let resizing = false;
    let lockedEdge = null;
  
    // 只負責顯示滑鼠 cursor
    rect.addEventListener('mousemove', (e) => {
      if (isDrawing || resizing) return;
  
      const rectBox = rect.getBoundingClientRect();
      const offsetX = e.clientX - rectBox.left;
      const offsetY = e.clientY - rectBox.top;
      let cursor = 'default';
  
      if (offsetX < edgeThreshold) {
        cursor = 'ew-resize';
      } else if (offsetX > rectBox.width - edgeThreshold) {
        cursor = 'ew-resize';
      } else if (offsetY < edgeThreshold) {
        cursor = 'ns-resize';
      } else if (offsetY > rectBox.height - edgeThreshold) {
        cursor = 'ns-resize';
      }
      rect.style.cursor = cursor;
    });
  
    // mousedown 時一次性決定 edge
    rect.addEventListener('mousedown', (e) => {
      if (resizing) return;
      const rectBox = rect.getBoundingClientRect();
      const offsetX = e.clientX - rectBox.left;
      const offsetY = e.clientY - rectBox.top;
  
      // 先決定是哪個 edge
      if (offsetX < edgeThreshold) {
        lockedEdge = 'left';
      } else if (offsetX > rectBox.width - edgeThreshold) {
        lockedEdge = 'right';
      } else if (offsetY < edgeThreshold) {
        lockedEdge = 'top';
      } else if (offsetY > rectBox.height - edgeThreshold) {
        lockedEdge = 'bottom';
      } else {
        lockedEdge = null;
      }
  
      if (!lockedEdge) return;
  
      resizing = true;
      isResizing = true;
      e.preventDefault();
  
      const moveHandler = (e) => {
        if (!resizing) return;
  
        const viewerRect = viewer.getBoundingClientRect();
        const scrollLeft = viewer.scrollLeft || 0;
        const mouseX = e.clientX - viewerRect.left + scrollLeft;
        const mouseY = e.clientY - viewerRect.top;
  
        const actualWidth = getDuration() * getZoomLevel();
        const freqRange = maxFrequency - minFrequency;
  
        if (lockedEdge === 'left') {
          let newStartTime = (mouseX / actualWidth) * getDuration();
          newStartTime = Math.min(newStartTime, sel.data.endTime - 0.001);
          sel.data.startTime = newStartTime;
        }
  
        if (lockedEdge === 'right') {
          let newEndTime = (mouseX / actualWidth) * getDuration();
          newEndTime = Math.max(newEndTime, sel.data.startTime + 0.001);
          sel.data.endTime = newEndTime;
        }
  
        if (lockedEdge === 'top') {
          let newFhigh = (1 - mouseY / spectrogramHeight) * freqRange + minFrequency;
          newFhigh = Math.max(newFhigh, sel.data.Flow + 0.1);
          sel.data.Fhigh = newFhigh;
        }
  
        if (lockedEdge === 'bottom') {
          let newFlow = (1 - mouseY / spectrogramHeight) * freqRange + minFrequency;
          newFlow = Math.min(newFlow, sel.data.Fhigh - 0.1);
          sel.data.Flow = newFlow;
        }
  
        updateSelections();
      };
  
      const upHandler = () => {
        resizing = false;
        isResizing = false;
        lockedEdge = null;
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', upHandler);
      };
  
      window.addEventListener('mousemove', moveHandler);
      window.addEventListener('mouseup', upHandler);
    });
  }
  
  function updateTooltipValues(sel, left, top, width, height) {
    const { data, tooltip } = sel;
    const Flow = data.Flow;
    const Fhigh = data.Fhigh;
    const Bandwidth = Fhigh - Flow;
    const Duration = (data.endTime - data.startTime);
    
    tooltip.querySelector('.fhigh').textContent = Fhigh.toFixed(1);
    tooltip.querySelector('.flow').textContent = Flow.toFixed(1);
    tooltip.querySelector('.bandwidth').textContent = Bandwidth.toFixed(1);
    tooltip.querySelector('.duration').textContent = (Duration * 1000).toFixed(1);
  }
  
  function updateSelections() {
    const actualWidth = getDuration() * getZoomLevel();
    const freqRange = maxFrequency - minFrequency;
  
    selections.forEach(sel => {
      const { startTime, endTime, Flow, Fhigh } = sel.data;
      const left = (startTime / getDuration()) * actualWidth;
      const width = ((endTime - startTime) / getDuration()) * actualWidth;
      const top = (1 - (Fhigh - minFrequency) / freqRange) * spectrogramHeight;
      const height = ((Fhigh - Flow) / freqRange) * spectrogramHeight;
  
      sel.rect.style.left = `${left}px`;
      sel.rect.style.top = `${top}px`;
      sel.rect.style.width = `${width}px`;
      sel.rect.style.height = `${height}px`;
  
      const tooltipLeft = left + width + 10;
      sel.tooltip.style.left = `${tooltipLeft}px`;
      sel.tooltip.style.top = `${top}px`;
  
      updateTooltipValues(sel, left, top, width, height);
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
      element.style.left = `${newX}px`;
      element.style.top = `${newY}px`;
    });
    window.addEventListener('mouseup', () => { isDragging = false; });
  }

  return {
    updateSelections,
    setFrequencyRange: (min, max) => {
      minFrequency = min;
      maxFrequency = max;
      updateSelections();
    }
  };
}
