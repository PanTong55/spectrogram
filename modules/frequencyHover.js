export function initFrequencyHover({
  viewerId,
  wrapperId = 'viewer-wrapper',
  hoverLineId,
  hoverLineVId,
  freqLabelId,
  spectrogramHeight = 800,
  spectrogramWidth = 1024,
  maxFrequency = 128,
  minFrequency = 10,
  totalDuration = 1000,
  getZoomLevel,
  getDuration,
  isExpandMode = () => false
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
  let persistentLinesEnabled = true;
  let disablePersistentLinesForScrollbar = false;
  const defaultScrollbarThickness = 20;
  const getScrollbarThickness = () => isExpandMode() ? defaultScrollbarThickness : 0;
  const edgeThreshold = 5;
  
  let suppressHover = false;
  let isOverTooltip = false;
  let isResizing = false;
  let isDrawing = false;
  let startX = 0, startY = 0;
  let selectionRect = null;
  let lastClientX = null, lastClientY = null;

  const hideAll = () => {
    hoverLine.style.display = 'none';
    hoverLineV.style.display = 'none';
    freqLabel.style.display = 'none';
  };

  const updateHoverDisplay = (e) => {
    lastClientX = e.clientX;
    lastClientY = e.clientY;    
    if (suppressHover || isResizing) {
      hideAll();
      return;
    }
    
    const rect = viewer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y > (viewer.clientHeight - getScrollbarThickness())) {
      hideAll();
      viewer.classList.remove('hide-cursor');
      disablePersistentLinesForScrollbar = true;
      return;
    }
    disablePersistentLinesForScrollbar = false;
    viewer.classList.add('hide-cursor');

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

  viewer.addEventListener('mousemove', updateHoverDisplay, { passive: true });
  wrapper.addEventListener('mouseleave', hideAll);
  viewer.addEventListener('mouseenter', () => viewer.classList.add('hide-cursor'));
  viewer.addEventListener('mouseleave', () => viewer.classList.remove('hide-cursor'));

  const cancelDrawing = () => {
    if (!isDrawing) return;
    isDrawing = false;
    if (selectionRect && viewer.contains(selectionRect)) {
      viewer.removeChild(selectionRect);
    }
    selectionRect = null;
    suppressHover = false;
  };

  viewer.addEventListener('mouseleave', (e) => {
    if (isDrawing) {
      cancelDrawing();
      hideAll();
    }
  });

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
    if (startY > (viewer.clientHeight - getScrollbarThickness())) return;
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

    const insideX = e.clientX >= rect.left && e.clientX <= rect.right;
    const insideY = e.clientY >= rect.top && e.clientY <= (rect.bottom - getScrollbarThickness());
    if (!insideX || !insideY) {
      // Cancel drawing when cursor leaves the spectrogram area
      viewer.removeChild(selectionRect);
      selectionRect = null;
      isDrawing = false;
      suppressHover = false;
      hideAll();
      return;
    }

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
  }, { passive: true });

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
      suppressHover = false;
      updateHoverDisplay(e);
      return;
    }
    const Flow = (1 - (top + height) / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const Fhigh = (1 - top / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const Bandwidth = Fhigh - Flow;
    const actualWidth = getDuration() * getZoomLevel();
    const startTime = (left / actualWidth) * getDuration();
    const endTime = ((left + width) / actualWidth) * getDuration();
    const Duration = endTime - startTime;
    createTooltip(left, top, width, height, Fhigh, Flow, Bandwidth, Duration, selectionRect, startTime, endTime);
    selectionRect = null;
    suppressHover = false;
  });

  viewer.addEventListener('contextmenu', (e) => {
    if (!persistentLinesEnabled || disablePersistentLinesForScrollbar || isOverTooltip) return;
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

  function createTooltip(left, top, width, height, Fhigh, Flow, Bandwidth, Duration, rectObj, startTime, endTime) {
    let tooltip = null;
    if (Duration * 1000 <= 100) {
      tooltip = document.createElement('div');
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
        <div><b>F.Low:</b> <span class="flow">${Flow.toFixed(1)}</span> kHz</div>
        <div><b>Bandwidth:</b> <span class="bandwidth">${Bandwidth.toFixed(1)}</span> kHz</div>
        <div><b>Duration:</b> <span class="duration">${(Duration * 1000).toFixed(1)}</span> ms</div>
        <div style="position:absolute; top:2px; right:6px; cursor:pointer;" class="close-btn">×</div>
      `;
      tooltip.addEventListener('mouseenter', () => { isOverTooltip = true; suppressHover = true; hideAll(); });
      tooltip.addEventListener('mouseleave', () => { isOverTooltip = false; suppressHover = false; });
      viewer.appendChild(tooltip);
    }

    let expandBtn = null;
    let closeBtn = null;
    let durationLabel = null;
    if (Duration * 1000 > 100) {
      expandBtn = document.createElement('i');
      expandBtn.className = 'fa-solid fa-arrows-left-right-to-line selection-expand-btn';
      expandBtn.title = 'Crop and expand this session';
      expandBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        viewer.dispatchEvent(new CustomEvent('expand-selection', {
          detail: { startTime, endTime }
        }));
      });
      expandBtn.addEventListener('mouseenter', () => { suppressHover = true; hideAll(); });
      expandBtn.addEventListener('mouseleave', () => { suppressHover = false; });
      rectObj.appendChild(expandBtn);

      closeBtn = document.createElement('i');
      closeBtn.className = 'fa-solid fa-xmark selection-close-btn';
      closeBtn.title = 'Close selection';
      closeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const index = selections.findIndex(sel => sel.rect === rectObj);
        if (index !== -1) {
          viewer.removeChild(selections[index].rect);
          if (selections[index].tooltip) viewer.removeChild(selections[index].tooltip);
          selections.splice(index, 1);
        }
        suppressHover = false;
      });
      // Prevent resize initiation when interacting with the close button
      closeBtn.addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
      });
      closeBtn.addEventListener('mouseenter', () => { suppressHover = true; hideAll(); });
      closeBtn.addEventListener('mouseleave', () => { suppressHover = false; });
      rectObj.appendChild(closeBtn);
    }

    durationLabel = document.createElement('div');
    durationLabel.className = 'selection-duration';
    durationLabel.textContent = `${(Duration * 1000).toFixed(1)} ms`;
    rectObj.appendChild(durationLabel);

    const selObj = { data: { startTime, endTime, Flow, Fhigh }, rect: rectObj, tooltip, expandBtn, closeBtn, durationLabel };
    selections.push(selObj);
    if (tooltip) {
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
    enableResize(selObj);
  }

  function enableResize(sel) {
    const rect = sel.rect;
    let resizing = false;
    let lockedHorizontal = null;
    let lockedVertical = null;
  
    // 只負責顯示滑鼠 cursor
    rect.addEventListener('mousemove', (e) => {
      if (isDrawing || resizing) return;
      if (e.target.closest('.selection-close-btn')) {
        rect.style.cursor = 'default';
        return;
      }
  
      const rectBox = rect.getBoundingClientRect();
      const offsetX = e.clientX - rectBox.left;
      const offsetY = e.clientY - rectBox.top;
      let cursor = 'default';

      const onLeft = offsetX < edgeThreshold;
      const onRight = offsetX > rectBox.width - edgeThreshold;
      const onTop = offsetY < edgeThreshold;
      const onBottom = offsetY > rectBox.height - edgeThreshold;

      if ((onLeft && onTop) || (onRight && onBottom)) {
        cursor = 'nwse-resize';
      } else if ((onRight && onTop) || (onLeft && onBottom)) {
        cursor = 'nesw-resize';
      } else if (onLeft || onRight) {
        cursor = 'ew-resize';
      } else if (onTop || onBottom) {
        cursor = 'ns-resize';
      }

      rect.style.cursor = cursor;
    }, { passive: true });
  
    // mousedown 時一次性決定 edge
    rect.addEventListener('mousedown', (e) => {
      if (resizing) return;
      if (e.target.closest('.selection-close-btn')) return;
      const rectBox = rect.getBoundingClientRect();
      const offsetX = e.clientX - rectBox.left;
      const offsetY = e.clientY - rectBox.top;
  
      const onLeft = offsetX < edgeThreshold;
      const onRight = offsetX > rectBox.width - edgeThreshold;
      const onTop = offsetY < edgeThreshold;
      const onBottom = offsetY > rectBox.height - edgeThreshold;

      lockedHorizontal = onLeft ? 'left' : onRight ? 'right' : null;
      lockedVertical = onTop ? 'top' : onBottom ? 'bottom' : null;

      if (!lockedHorizontal && !lockedVertical) return;
  
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

        if (lockedHorizontal === 'left') {
          let newStartTime = (mouseX / actualWidth) * getDuration();
          newStartTime = Math.min(newStartTime, sel.data.endTime - 0.001);
          sel.data.startTime = newStartTime;
        }

        if (lockedHorizontal === 'right') {
          let newEndTime = (mouseX / actualWidth) * getDuration();
          newEndTime = Math.max(newEndTime, sel.data.startTime + 0.001);
          sel.data.endTime = newEndTime;
        }

        if (lockedVertical === 'top') {
          let newFhigh = (1 - mouseY / spectrogramHeight) * freqRange + minFrequency;
          newFhigh = Math.max(newFhigh, sel.data.Flow + 0.1);
          sel.data.Fhigh = newFhigh;
        }

        if (lockedVertical === 'bottom') {
          let newFlow = (1 - mouseY / spectrogramHeight) * freqRange + minFrequency;
          newFlow = Math.min(newFlow, sel.data.Fhigh - 0.1);
          sel.data.Flow = newFlow;
        }
  
        updateSelections();
      };
  
      const upHandler = () => {
        resizing = false;
        isResizing = false;
        lockedHorizontal = null;
        lockedVertical = null;
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', upHandler);
      };
  
      window.addEventListener('mousemove', moveHandler, { passive: true });
      window.addEventListener('mouseup', upHandler);
    });
  }
  
  function updateTooltipValues(sel, left, top, width, height) {
    const { data, tooltip } = sel;
    const Flow = data.Flow;
    const Fhigh = data.Fhigh;
    const Bandwidth = Fhigh - Flow;
    const Duration = (data.endTime - data.startTime);
    if (!tooltip) {
      if (sel.durationLabel) sel.durationLabel.textContent = `${(Duration * 1000).toFixed(1)} ms`;
      return;
    }
    if (sel.durationLabel) sel.durationLabel.textContent = `${(Duration * 1000).toFixed(1)} ms`;

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

      if (sel.tooltip) {
        const tooltipLeft = left + width + 10;
        sel.tooltip.style.left = `${tooltipLeft}px`;
        sel.tooltip.style.top = `${top}px`;

        updateTooltipValues(sel, left, top, width, height);
      } else {
        updateTooltipValues(sel, left, top, width, height);
      }
    });
  }

  function clearSelections() {
    selections.forEach(sel => {
      viewer.removeChild(sel.rect);
      if (sel.tooltip) viewer.removeChild(sel.tooltip);
    });
    selections.length = 0;
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
    }, { passive: true });
    window.addEventListener('mouseup', () => { isDragging = false; });
  }

  return {
    updateSelections,
    clearSelections,
    setFrequencyRange: (min, max) => {
      minFrequency = min;
      maxFrequency = max;
      updateSelections();
    },
    hideHover: hideAll,
    refreshHover: () => {
      if (lastClientX !== null && lastClientY !== null) {
        updateHoverDisplay({ clientX: lastClientX, clientY: lastClientY });
      }
    },
    setPersistentLinesEnabled: (val) => { persistentLinesEnabled = val; }
  };
}
