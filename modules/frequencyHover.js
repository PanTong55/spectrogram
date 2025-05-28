export function initFrequencyHover({
  viewerId,
  hoverLineId,
  freqLabelId,
  spectrogramHeight = 800,
  maxFrequency = 128,
  minFrequency = 0,
  wrapperId = 'viewer-wrapper',
}) {
  const viewer = document.getElementById(viewerId);
  const wrapper = document.getElementById(wrapperId);
  const hoverLine = document.getElementById(hoverLineId);
  const freqLabel = document.getElementById(freqLabelId);

  viewer.addEventListener('mousemove', (e) => {
    const rect = viewer.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    const scrollbarThickness = 1;
    if (mouseY > (viewer.clientHeight - scrollbarThickness)) {
      hoverLine.style.display = 'none';
      freqLabel.style.display = 'none';
      return;
    }

    const y = e.offsetY;
    const freq = (1 - y / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;

    hoverLine.style.top = `${y}px`;
    hoverLine.style.display = 'block';

    freqLabel.style.top = `${y - 12}px`;
    freqLabel.style.display = 'block';
    freqLabel.textContent = `${freq.toFixed(1)} kHz`;
  });

  // ✅ 改為監聽 wrapper（修正閃爍）
  wrapper.addEventListener('mouseleave', () => {
    hoverLine.style.display = 'none';
    freqLabel.style.display = 'none';
  });
}
