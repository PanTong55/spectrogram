let previousMouseMoveHandler = null;

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
  const zoomControls = document.getElementById('zoom-controls');

  const scrollbarThickness = 2;
  let suppressHover = false;

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

  // 先移除舊的
  if (previousMouseMoveHandler) {
    viewer.removeEventListener('mousemove', previousMouseMoveHandler);
  }

  // 再綁定新的
  previousMouseMoveHandler = updateHoverDisplay;
  viewer.addEventListener('mousemove', updateHoverDisplay);

  wrapper.addEventListener('mouseleave', hideAll);
  viewer.addEventListener('mouseenter', () => viewer.classList.add('hide-cursor'));
  viewer.addEventListener('mouseleave', () => viewer.classList.remove('hide-cursor'));

  if (zoomControls) {
    zoomControls.addEventListener('mouseenter', () => {
      suppressHover = true;
      hideAll();
    });
    zoomControls.addEventListener('mouseleave', () => {
      suppressHover = false;
    });
  }
}

let suppressHoverExternal = false;

export function setSuppressHover(value) {
  suppressHoverExternal = value;
}

const updateHoverDisplay = (e) => {
  if (suppressHover || suppressHoverExternal) return;
  ...
};
