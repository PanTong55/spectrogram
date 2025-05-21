// modules/frequencyHover.js

export function initFrequencyHover({
  viewerId,
  hoverLineId,
  freqLabelId,
  spectrogramHeight = 900,
  maxFrequency = 128,
}) {
  const viewer = document.getElementById(viewerId);
  const hoverLine = document.getElementById(hoverLineId);
  const freqLabel = document.getElementById(freqLabelId);

  viewer.addEventListener('mousemove', (e) => {
    const rect = viewer.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    const scrollbarThickness = 1;
    if (mouseY > viewer.clientHeight - scrollbarThickness) {
      hoverLine.style.display = 'none';
      freqLabel.style.display = 'none';
      return;
    }

    const y = e.offsetY;
    const freq = Math.max(0, Math.min(maxFrequency, (1 - y / spectrogramHeight) * maxFrequency));

    hoverLine.style.top = `${y}px`;
    hoverLine.style.display = 'block';

    freqLabel.style.top = `${y - 12}px`;
    freqLabel.style.display = 'block';
    freqLabel.textContent = `${freq.toFixed(1)} kHz`;
  });

  viewer.addEventListener('mouseleave', () => {
    hoverLine.style.display = 'none';
    freqLabel.style.display = 'none';
  });
}
