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
    const label = step >= 1000 ? `${(t / 1000)}s` : `${t}`;
    html.push(`<span style="position:absolute;left:${left}px;">${label}</span>`);
  }

  axisElement.innerHTML = html.join('');
  axisElement.style.width = `${totalWidth}px`;
  labelElement.textContent = step >= 1000 ? 'Time (s)' : 'Time (ms)';
}

export function drawFrequencyGrid({
  gridCanvas,
  labelContainer,
  containerElement, // <== ✅ 新增：用來抓正確 scrollWidth
  spectrogramHeight = 900,
  maxFrequency = 128,
}) {
  const width = containerElement.scrollWidth;  // ✅ 抓 spectrogram container 的 scrollWidth
  gridCanvas.width = width;
  gridCanvas.height = spectrogramHeight;
  gridCanvas.style.width = width + 'px';
  gridCanvas.style.height = spectrogramHeight + 'px';

  const ctx = gridCanvas.getContext('2d');
  ctx.clearRect(0, 0, width, spectrogramHeight);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;

  for (let f = 0; f <= maxFrequency; f += 10) {
    const y = (1 - f / maxFrequency) * spectrogramHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  labelContainer.innerHTML = '';
  for (let f = 0; f <= maxFrequency; f += 10) {
    const y = (1 - f / maxFrequency) * spectrogramHeight;
    const label = document.createElement('div');
    label.className = 'freq-label-static';
    label.style.top = `${y - 6}px`;
    label.textContent = `${f}kHz`;
    labelContainer.appendChild(label);
  }
}

