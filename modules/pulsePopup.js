import WaveSurfer from './wavesurfer.esm.js';
import { createSpectrogramPlugin, getCurrentColorMap, getCurrentFftSize, getWavesurfer } from './wsManager.js';
import { initFrequencyHover } from './frequencyHover.js';

let ws = null;
let plugin = null;
let hover = null;
let popup, viewer, wrapper, hoverLine, hoverLineV, hoverLabel, spectroContainer;
let dragBar, closeBtn;

export function initPulsePopup({
  popupId = 'pulsePopup',
  viewerId = 'pulse-viewer-container',
  wrapperId = 'pulse-viewer-wrapper',
  hoverLineId = 'pulse-hover-line',
  hoverLineVId = 'pulse-hover-line-vertical',
  hoverLabelId = 'pulse-hover-label'
} = {}) {
  popup = document.getElementById(popupId);
  viewer = document.getElementById(viewerId);
  wrapper = document.getElementById(wrapperId);
  spectroContainer = document.getElementById('pulse-spectrogram-only');
  hoverLine = document.getElementById(hoverLineId);
  hoverLineV = document.getElementById(hoverLineVId);
  hoverLabel = document.getElementById(hoverLabelId);
  dragBar = popup?.querySelector('.popup-drag-bar');
  closeBtn = popup?.querySelector('.popup-close-btn');
  if (!popup || !viewer) return;

  popup.style.display = 'none';

  let popupWidth = parseInt(localStorage.getItem('pulsePopupWidth'), 10);
  let popupHeight = parseInt(localStorage.getItem('pulsePopupHeight'), 10);
  if (isNaN(popupWidth) || popupWidth <= 0) popupWidth = 350;
  if (isNaN(popupHeight) || popupHeight <= 0) popupHeight = 250;
  popup.style.width = `${popupWidth}px`;
  popup.style.height = `${popupHeight}px`;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let resizing = false;
  let resizeLeft = false, resizeRight = false, resizeTop = false, resizeBottom = false;
  let startX = 0, startY = 0, startWidth = 0, startHeight = 0, startLeft = 0, startTop = 0;
  const edgeThreshold = 5;

  const getEdgeState = (x, y) => {
    const rect = popup.getBoundingClientRect();
    const relX = x - rect.left;
    const relY = y - rect.top;
    const onLeft = relX <= edgeThreshold;
    const onRight = relX >= rect.width - edgeThreshold;
    const onTop = relY <= edgeThreshold;
    const onBottom = relY >= rect.height - edgeThreshold;
    return { onLeft, onRight, onTop, onBottom };
  };

  const edgeCursor = ({ onLeft, onRight, onTop, onBottom }) => {
    if ((onLeft && onTop) || (onRight && onBottom)) return 'nwse-resize';
    if ((onRight && onTop) || (onLeft && onBottom)) return 'nesw-resize';
    if (onLeft || onRight) return 'ew-resize';
    if (onTop || onBottom) return 'ns-resize';
    return '';
  };

  if (dragBar) {
    dragBar.addEventListener('mousedown', (e) => {
      dragging = true;
      offsetX = e.clientX - popup.offsetLeft;
      offsetY = e.clientY - popup.offsetTop;
      e.preventDefault();
      e.stopPropagation();
    });
  }

  popup.addEventListener('mousedown', (e) => {
    if (e.target === dragBar || dragBar?.contains(e.target)) return;
    const state = getEdgeState(e.clientX, e.clientY);
    if (state.onLeft || state.onRight || state.onTop || state.onBottom) {
      resizing = true;
      resizeLeft = state.onLeft;
      resizeRight = state.onRight;
      resizeTop = state.onTop;
      resizeBottom = state.onBottom;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = popup.offsetWidth;
      startHeight = popup.offsetHeight;
      startLeft = popup.offsetLeft;
      startTop = popup.offsetTop;
      e.preventDefault();
      e.stopPropagation();
    }
  });

  popup.addEventListener('mousemove', (e) => {
    if (dragging || resizing) return;
    const state = getEdgeState(e.clientX, e.clientY);
    popup.style.cursor = edgeCursor(state) || 'default';
  });

  window.addEventListener('mousemove', (e) => {
    if (dragging) {
      popup.style.left = `${e.clientX - offsetX}px`;
      popup.style.top = `${e.clientY - offsetY}px`;
    } else if (resizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (resizeRight) {
        popupWidth = Math.max(200, startWidth + dx);
        popup.style.width = `${popupWidth}px`;
      }
      if (resizeBottom) {
        popupHeight = Math.max(200, startHeight + dy);
        popup.style.height = `${popupHeight}px`;
      }
      if (resizeLeft) {
        popupWidth = Math.max(200, startWidth - dx);
        popup.style.width = `${popupWidth}px`;
        popup.style.left = `${startLeft + dx}px`;
      }
      if (resizeTop) {
        popupHeight = Math.max(200, startHeight - dy);
        popup.style.height = `${popupHeight}px`;
        popup.style.top = `${startTop + dy}px`;
      }
    }
  }, true);

  window.addEventListener('mouseup', () => {
    if (dragging) dragging = false;
    if (resizing) {
      resizing = false;
      localStorage.setItem('pulsePopupWidth', popupWidth);
      localStorage.setItem('pulsePopupHeight', popupHeight);
    }
  }, true);

  closeBtn?.addEventListener('click', () => {
    popup.style.display = 'none';
    ws?.destroy();
    ws = null;
    plugin = null;
  });
}

export async function openPulsePopup(blob, freqMin, freqMax) {
  if (!popup || !viewer) return;
  popup.style.display = 'block';

  if (!ws) {
    const baseWs = getWavesurfer();
    const sampleRate = baseWs?.options?.sampleRate || 256000;
    ws = WaveSurfer.create({
      container: viewer,
      height: 0,
      interact: false,
      cursorWidth: 0,
      sampleRate
    });
  }

  const colorMap = getCurrentColorMap() || [];
  const fftSize = getCurrentFftSize();

  if (plugin?.destroy) plugin.destroy();
  plugin = createSpectrogramPlugin({
    container: spectroContainer,
    colorMap,
    height: viewer.clientHeight,
    frequencyMin: freqMin,
    frequencyMax: freqMax,
    fftSamples: fftSize
  });
  ws.registerPlugin(plugin);
  const oldCanvas = spectroContainer.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();
  await ws.loadBlob(blob);
  try {
    plugin.render();
  } catch (err) {
    console.warn('Pulse spectrogram render failed:', err);
  }

  const duration = ws.getDuration();

  if (!hover) {
    hover = initFrequencyHover({
      viewerId: viewer.id,
      wrapperId: wrapper.id,
      hoverLineId: hoverLine.id,
      hoverLineVId: hoverLineV.id,
      freqLabelId: hoverLabel.id,
      spectrogramHeight: viewer.clientHeight,
      spectrogramWidth: viewer.scrollWidth,
      maxFrequency: freqMax,
      minFrequency: freqMin,
      totalDuration: duration,
      getZoomLevel: () => 1,
      getDuration: () => duration
    });
  } else {
    hover.setFrequencyRange(freqMin, freqMax);
    hover.clearSelections();
  }
}
