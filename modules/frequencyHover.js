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
  let suppressHover = false; // 🔧 控制是否暫時停用 hover 顯示

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

  // 如果 viewer.scrollLeft 不存在，預設為 0
  const scrollLeft = viewer.scrollLeft || 0;

  const freq = (1 - y / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
  const time = ((x + scrollLeft) / spectrogramWidth) * totalDuration;

  // 顯示橫線
  hoverLine.style.top = `${y}px`;
  hoverLine.style.display = 'block';

  // 顯示直線
  hoverLineV.style.left = `${x}px`;
  hoverLineV.style.display = 'block';

  // 動態決定 freqLabel 的 left/right 顯示
  const viewerWidth = viewer.clientWidth;
  const labelOffset = 12;
  let labelLeft;

  if ((viewerWidth - x) < 120) {
    // 靠近右邊 => 顯示在左邊
    freqLabel.style.transform = 'translate(-100%, -50%)';
    labelLeft = `${x - labelOffset}px`;
  } else {
    // 正常在右側
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
  
  // ✅ 進入 spectrogram canvas 區隱藏Cursor
  viewer.addEventListener('mouseenter', () => {
    viewer.classList.add('hide-cursor');
  });
  
  viewer.addEventListener('mouseleave', () => {
    viewer.classList.remove('hide-cursor');
  });
  
  // ✅ 進入 zoom-control 區時，暫停 hover 顯示
  if (zoomControls) {
    zoomControls.addEventListener('mouseenter', () => {
      suppressHover = true;
      hideAll();
    });

    // ✅ 離開 zoom-control 時恢復 hover 功能
    zoomControls.addEventListener('mouseleave', () => {
      suppressHover = false;
    });
  }
}
