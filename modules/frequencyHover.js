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
  
    const canvas = viewer.querySelector('canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const canvasWidth = canvas.width;
  
      try {
        const imageData = ctx.getImageData(0, y, canvasWidth, 1); // 整條橫線像素
        const data = imageData.data;
  
        // 對每個 pixel 做反色
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];     // R
          data[i + 1] = 255 - data[i + 1]; // G
          data[i + 2] = 255 - data[i + 2]; // B
          // alpha 保留 data[i + 3]
        }
  
        // 放入新的 canvas 再轉為 data URL
        const lineCanvas = document.createElement('canvas');
        lineCanvas.width = canvasWidth;
        lineCanvas.height = 1;
        const lineCtx = lineCanvas.getContext('2d');
        lineCtx.putImageData(imageData, 0, 0);
        hoverLine.style.background = `url(${lineCanvas.toDataURL()})`;
      } catch (err) {
        console.warn('⚠️ Failed to generate hoverLine pattern:', err);
      }
    }
  });

  // ✅ 改為監聽 wrapper（修正閃爍）
  wrapper.addEventListener('mouseleave', () => {
    hoverLine.style.display = 'none';
    freqLabel.style.display = 'none';
  });
}
