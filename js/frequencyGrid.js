export function drawFrequencyGrid(canvas, labelContainer, width, height) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  
  for (let f = 0; f <= 128; f += 10) {
    const y = (1 - f / 128) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  labelContainer.innerHTML = '';
  for (let f = 0; f <= 128; f += 10) {
    const y = (1 - f / 128) * height;
    const label = document.createElement('div');
    label.className = 'freq-label-static';
    label.style.top = `${y - 6}px`;
    label.textContent = `${f}kHz`;
    labelContainer.appendChild(label);
  }
}
