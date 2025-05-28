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

  const scrollbarThickness = 1;
  let suppressHover = false; // 🔧 控制是否暫時停用 hover 顯示

  const hideAll = () => {
    hoverLine.style.display = 'none';
    hoverLineV.style.display = 'none';
    freqLabel.style.display = 'none';
  };

const updateHoverDisplay = (e) => {
  if (suppressHover) return;

  const rect = viewer.getBoundingClientRect();
  const scrollLeft = viewer.scrollLeft;
  const scrollTop = viewer.scrollTop;

  // X 軸不加 scrollLeft，因為用 transform 調整 overlay
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top + scrollTop;

  // 若超出底部不顯示
  if (y > (viewer.clientHeight - scrollbarThickness)) {
    hideAll();
    return;
  }

  const freq = (1 - y / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
  const time = ((x + scrollLeft) / spectrogramWidth) * totalDuration;

  // 跟著 viewer scroll 的補償 transform
  const overlay = document.getElementById('fixed-overlay');
  overlay.style.transform = `translateX(-${scrollLeft}px)`;

  hoverLine.style.top = `${y}px`;
  hoverLine.style.display = 'block';

  hoverLineV.style.left = `${x}px`;
  hoverLineV.style.display = 'block';

  freqLabel.style.top = `${y - 16}px`;
  freqLabel.style.left = `${Math.min(x + 8, viewer.clientWidth - 100)}px`;
  freqLabel.style.display = 'block';
  freqLabel.textContent = `${freq.toFixed(1)} kHz   ${time.toFixed(1)} ms`;
};

  viewer.addEventListener('mousemove', updateHoverDisplay);

  wrapper.addEventListener('mouseleave', () => {
    hideAll();
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
