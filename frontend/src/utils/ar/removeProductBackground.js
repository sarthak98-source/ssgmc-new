/**
 * removeProductBackground.js
 *
 * Optional client-side background removal.
 * This is a lightweight heuristic that turns near-white pixels transparent.
 *
 * NOTE: Will fail (and fall back to original src) for cross-origin images
 * without proper CORS headers because canvas becomes tainted.
 */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export async function removeBackground(src, opts = {}) {
  const threshold = Number.isFinite(opts.threshold) ? opts.threshold : 245;
  const soft = Number.isFinite(opts.soft) ? opts.soft : 18;

  const img = await loadImage(src);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return src;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, w, h);
  } catch {
    // CORS taint – can't read pixels
    return src;
  }

  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue;

    // near-white (typical catalog background)
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);

    if (min >= threshold) {
      data[i + 3] = 0;
    } else if (max >= threshold && min >= threshold - soft) {
      // soft edge
      const t = (min - (threshold - soft)) / soft;
      data[i + 3] = Math.round(a * (1 - t));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}
