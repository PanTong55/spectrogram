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

  const scrollbarThickness = 1; // ✅ 滑到底部時避免干擾
  const hideAll = () => {
    hoverLine.style.display = 'none';
    hoverLineV.style.display = 'none';
    freqLabel.style.display = 'none';
  };

  viewer.addEventListener('mousemove', (e) => {
    const rect = viewer.getBoundingClientRect();
    const x = e.clientX - rect.left + viewer.scrollLeft;
    const y = e.clientY - rect.top;

    // ✅ 如果滑鼠在 scrollbar 區域，隱藏
    if (y > (viewer.clientHeight - scrollbarThickness)) {
      hideAll();
      return;
    }

    const freq = (1 - y / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const time = (x / spectrogramWidth) * totalDuration;

    hoverLine.style.top = `${y}px`;
    hoverLine.style.display = 'block';

    hoverLineV.style.left = `${x}px`;
    hoverLineV.style.display = 'block';

    freqLabel.style.top = `${y - 16}px`;
    freqLabel.style.left = `${x + 8}px`;
    freqLabel.style.display = 'block';
    freqLabel.textContent = `${freq.toFixed(1)} kHz   ${time.toFixed(1)} ms`;
  });

  // ✅ 滑出 wrapper 時也隱藏，避免閃爍
  wrapper.addEventListener('mouseleave', () => {
    hideAll();
  });
}
