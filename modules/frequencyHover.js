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
    const x = e.clientX - rect.left; // 滑鼠在 viewer 中的 x 座標（不加 scrollLeft）
    const y = e.clientY - rect.top;
  
    if (y > (viewer.clientHeight - scrollbarThickness)) {
      hideAll();
      return;
    }
  
    const freq = (1 - y / spectrogramHeight) * (maxFrequency - minFrequency) + minFrequency;
    const time = ((x + viewer.scrollLeft) / spectrogramWidth) * totalDuration;
  
    // 顯示水平線
    hoverLine.style.top = `${y}px`;
    hoverLine.style.display = 'block';
  
    // 顯示垂直線
    hoverLineV.style.left = `${x}px`;
    hoverLineV.style.display = 'block';
  
    // 設定 freq label 位置：動態在左或右
    const rightBoundary = viewer.clientWidth;
    const labelOffset = 8;
  
    let labelLeft;
    if (x + 120 > rightBoundary) { // 如果太靠右（可視區剩餘寬度 < 120px）
      freqLabel.style.transform = 'translate(-100%, -50%)'; // 向左偏移
      labelLeft = `${x - labelOffset}px`;
    } else {
      freqLabel.style.transform = 'translate(0, -50%)'; // 原本偏右
      labelLeft = `${x + labelOffset}px`;
    }
  
    freqLabel.style.top = `${y}px`;
    freqLabel.style.left = labelLeft;
    freqLabel.style.display = 'block';
    freqLabel.textContent = `${freq.toFixed(1)} kHz   ${time.toFixed(1)} ms`;
  };
}
