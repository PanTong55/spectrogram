export let ctx = null;
let canvasElem = null;
export function initColorBar({ canvasId, width = 512, height = 16 }) {
  canvasElem = document.getElementById(canvasId);
  if (!canvasElem) return;
  canvasElem.width = width;
  canvasElem.height = height;
  ctx = canvasElem.getContext('2d');
}

export function updateColorBar(colorMap) {
  if (!ctx || !Array.isArray(colorMap)) return;
  const width = canvasElem.width;
  const height = canvasElem.height;
  const step = width / colorMap.length;
  for (let i = 0; i < colorMap.length; i++) {
    const [r, g, b, a] = colorMap[i];
    ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
    ctx.fillRect(i * step, 0, step, height);
  }
}
