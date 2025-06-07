// modules/axisRenderer.js

export function drawTimeAxis({
  containerWidth,
  duration,
  zoomLevel,
  axisElement,
  labelElement,
}) {
  const pxPerSec = zoomLevel;
  const totalWidth = duration * pxPerSec;

  const offsetX = 45; // ✅ 預留 freq label 寬度

  let step = 1000;
  if (pxPerSec >= 800) step = 100;
  else if (pxPerSec >= 500) step = 200;
  else if (pxPerSec >= 300) step = 500;

  const html = [];
  for (let t = 0; t < duration * 1000; t += step) {
    const left = (t / 1000) * pxPerSec;

    // 主刻度線
    html.push(`
      <div style="
        position: absolute;
        top: -1px;
        left: ${left}px;
        width: 1px;
        height: 5px;
        background: black;
        opacity: 0.7;
      "></div>
    `);

    // 副刻度線 (在主刻度與下一個主刻度之間的中間位置)
    const midLeft = left + (step / 1000 / 2) * pxPerSec;
    if (midLeft <= totalWidth) {
      html.push(`
        <div style="
          position: absolute;
          top: -1px;
          left: ${midLeft}px;
          width: 1px;
          height: 3px;
          background: black;
          opacity: 0.7;
        "></div>
      `);
    }

    // 置中數字
    const label = step >= 1000 ? `${(t / 1000)}s` : `${t}`;
    html.push(`
      <span style="
        position: absolute;
        top: 1px;
        left: ${left}px;
        transform: translateX(-50%);
        font-size: 12px;
      ">${label}</span>
    `);
  }

  axisElement.innerHTML = html.join('');
  axisElement.style.width = `${totalWidth}px`;
  labelElement.textContent = step >= 1000 ? 'Time (s)' : 'Time (ms)';
}

export function drawFrequencyGrid({
  gridCanvas,
  labelContainer,
  containerElement,
  spectrogramHeight = 800,
  maxFrequency = 128,
  offsetKHz = 0,
}) {
  const width = containerElement.scrollWidth;
  gridCanvas.width = width;
  gridCanvas.height = spectrogramHeight;
  gridCanvas.style.width = width + 'px';
  gridCanvas.style.height = spectrogramHeight + 'px';

  const ctx = gridCanvas.getContext('2d');
  ctx.clearRect(0, 0, width, spectrogramHeight);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 0.4;

  const majorStep = 10;
  const minorStep = 5;
  const range = maxFrequency;

  for (let f = 0; f <= range; f += majorStep) {
    const y = (1 - f / range) * spectrogramHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  labelContainer.innerHTML = '';

  for (let f = 0; f <= range; f += majorStep) {
    const y = Math.round((1 - f / range) * spectrogramHeight);

    // 主刻度線
    const tick = document.createElement('div');
    tick.style.position = 'absolute';
    tick.style.left = '40px';
    tick.style.top = `${y}px`;
    tick.style.transform = 'translateY(-50%)';
    tick.style.width = '5px';
    tick.style.height = '1px';
    tick.style.background = 'black';
    labelContainer.appendChild(tick);

    // 文字
    const label = document.createElement('div');
    label.className = 'freq-label-static';
    label.style.position = 'absolute';
    label.style.right = '8px';
    label.style.top = `${y - 1}px`;
    label.style.transform = 'translateY(-50%)';
    label.textContent = `${f + offsetKHz}kHz`;
    labelContainer.appendChild(label);
  }

  // 新增次刻度 (minor tick)
  for (let f = 0; f <= range; f += minorStep) {
    if (f % majorStep === 0) continue;

    const y = Math.round((1 - f / range) * spectrogramHeight);

    const minorTick = document.createElement('div');
    minorTick.style.position = 'absolute';
    minorTick.style.left = '42px';
    minorTick.style.top = `${y}px`;
    minorTick.style.transform = 'translateY(-50%)';
    minorTick.style.width = '3px';
    minorTick.style.height = '1px';
    minorTick.style.background = 'black';
    labelContainer.appendChild(minorTick);
  }
}
