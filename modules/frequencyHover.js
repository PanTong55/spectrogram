export function initFrequencyHover({
  viewerId,
  wrapperId = 'viewer-wrapper',
  hoverLineHId,
  hoverLineVId,
  hoverLabelId,
  spectrogramHeight = 800,
  spectrogramWidth = 1024,
  maxFrequency = 128,
  minFrequency = 0,
  totalDuration = 1000, // in ms
}) {
  const viewer = document.getElementById(viewerId);
  const wrapper = document.getElementById(wrapperId);
  const hoverLineH = document.getElementById(hoverLineHId);
  const hoverLineV = document.getElementById(hoverLineVId);
  const hoverLabel = document.getElementById(hoverLabelId);

  viewer.addEventListener('mousemove', (e) => {
    const rect = viewer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const freq = (1 - y / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const time = (x / spectrogramWidth) * totalDuration;

    // 顯示水平線
    hoverLineH.style.top = `${y}px`;
    hoverLineH.style.display = 'block';

    // 顯示垂直線
    hoverLineV.style.left = `${x}px`;
    hoverLineV.style.display = 'block';

    // 顯示座標文字
    hoverLabel.style.top = `${y - 16}px`;
    hoverLabel.style.left = `${x + 8}px`;
    hoverLabel.style.display = 'block';
    hoverLabel.textContent = `${freq.toFixed(1)} kHz   ${time.toFixed(1)} ms`;
  });

  wrapper.addEventListener('mouseleave', () => {
    hoverLineH.style.display = 'none';
    hoverLineV.style.display = 'none';
    hoverLabel.style.display = 'none';
  });
}
