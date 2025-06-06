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

  let step = 1000;
  if (pxPerSec >= 800) step = 100;
  else if (pxPerSec >= 500) step = 200;
  else if (pxPerSec >= 300) step = 500;

  const html = [];
  for (let t = 0; t < duration * 1000; t += step) {
    const left = (t / 1000) * pxPerSec;

    // 刻度線 (細細的直線)
    html.push(`
      <div style="
        position: absolute;
        top: 0;
        bottom: 0;
        left: ${left}px;
        width: 1px;
        background: black;
        opacity: 0.7;
      "></div>
    `);

    // 時間文字，置中於刻度線
    const label = step >= 1000 ? `${(t / 1000)}s` : `${t}`;
    html.push(`
      <span style="
        position: absolute;
        top: 2px;
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

  const step = 10;
  const range = maxFrequency;
  for (let f = 0; f <= range; f += step) {
    const y = (1 - f / range) * spectrogramHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  labelContainer.innerHTML = '';
  for (let f = 0; f <= range; f += step) {
    const y = (1 - f / range) * spectrogramHeight;
    const label = document.createElement('div');
    label.className = 'freq-label-static';
    label.style.top = `${y - 6}px`;
    label.textContent = `${f + offsetKHz}kHz`;
    labelContainer.appendChild(label);
  }
}

