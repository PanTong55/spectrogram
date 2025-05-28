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
  
    // 🧠 動態反轉色彩：讀 canvas 背景像素
    const canvas = viewer.querySelector('canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const pixel = ctx.getImageData(10, y, 1, 1).data; // 抓 (x=10, y=y) 一個像素
      const r = pixel[0], g = pixel[1], b = pixel[2];
  
      // 亮度算法：Y = 0.299R + 0.587G + 0.114B
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  
      hoverLine.style.backgroundColor = luminance < 128 ? 'white' : 'black';
      freqLabel.style.color = luminance < 128 ? 'white' : 'black';
      freqLabel.style.backgroundColor = luminance < 128 ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
    }
  });

  // ✅ 改為監聽 wrapper（修正閃爍）
  wrapper.addEventListener('mouseleave', () => {
    hoverLine.style.display = 'none';
    freqLabel.style.display = 'none';
  });
}
