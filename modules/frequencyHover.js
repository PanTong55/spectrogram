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
  
      // ✅ 修正比例差：實際 canvas 寬高與 CSS 對應
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;
      const realY = Math.floor(y * scaleY);
      const width = canvas.width;
  
      try {
        const imageData = ctx.getImageData(0, realY, width, 1);
        const data = imageData.data;
  
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];       // R
          data[i + 1] = 255 - data[i + 1]; // G
          data[i + 2] = 255 - data[i + 2]; // B
        }
  
        const lineCanvas = document.createElement('canvas');
        lineCanvas.width = width;
        lineCanvas.height = 1;
        lineCanvas.getContext('2d').putImageData(imageData, 0, 0);
  
        hoverLine.style.background = `url(${lineCanvas.toDataURL()})`;
      } catch (err) {
        console.warn('⚠️ Cannot read canvas pixel data for hoverLine:', err);
      }
    }
  });

  // ✅ 改為監聽 wrapper（修正閃爍）
  wrapper.addEventListener('mouseleave', () => {
    hoverLine.style.display = 'none';
    freqLabel.style.display = 'none';
  });
}
