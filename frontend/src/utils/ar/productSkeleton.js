/**
 * productSkeleton.js
 *
 * Defines the "skeleton" of a product image — named anchor points in NORMALIZED
 * coordinates (0..1 relative to image width/height).
 *
 * These points are matched to the body skeleton keypoints extracted from
 * MediaPipe Pose to drive piecewise affine warping.
 */

export const PRODUCT_SKELETONS = {
  '/tshirt.png': {
    neck: { x: 0.5, y: 0.08 },
    leftShoulder: { x: 0.27, y: 0.17 },
    rightShoulder: { x: 0.73, y: 0.17 },
    leftElbow: { x: 0.1, y: 0.38 },
    rightElbow: { x: 0.9, y: 0.38 },
    leftWrist: { x: 0.06, y: 0.55 },
    rightWrist: { x: 0.94, y: 0.55 },
    leftHip: { x: 0.25, y: 0.92 },
    rightHip: { x: 0.75, y: 0.92 },
    centerTop: { x: 0.5, y: 0.17 },
    centerBottom: { x: 0.5, y: 0.92 },
  },
};

export function getDefaultSkeleton(type = 'tshirt') {
  const defaults = {
    tshirt: {
      neck: { x: 0.5, y: 0.08 },
      leftShoulder: { x: 0.27, y: 0.17 },
      rightShoulder: { x: 0.73, y: 0.17 },
      leftElbow: { x: 0.1, y: 0.38 },
      rightElbow: { x: 0.9, y: 0.38 },
      leftWrist: { x: 0.06, y: 0.55 },
      rightWrist: { x: 0.94, y: 0.55 },
      leftHip: { x: 0.25, y: 0.92 },
      rightHip: { x: 0.75, y: 0.92 },
      centerTop: { x: 0.5, y: 0.17 },
      centerBottom: { x: 0.5, y: 0.92 },
    },
    hoodie: {
      neck: { x: 0.5, y: 0.1 },
      leftShoulder: { x: 0.25, y: 0.18 },
      rightShoulder: { x: 0.75, y: 0.18 },
      leftElbow: { x: 0.09, y: 0.4 },
      rightElbow: { x: 0.91, y: 0.4 },
      leftWrist: { x: 0.05, y: 0.6 },
      rightWrist: { x: 0.95, y: 0.6 },
      leftHip: { x: 0.24, y: 0.94 },
      rightHip: { x: 0.76, y: 0.94 },
      centerTop: { x: 0.5, y: 0.18 },
      centerBottom: { x: 0.5, y: 0.94 },
    },
    dress: {
      neck: { x: 0.5, y: 0.06 },
      leftShoulder: { x: 0.3, y: 0.14 },
      rightShoulder: { x: 0.7, y: 0.14 },
      leftElbow: { x: 0.15, y: 0.35 },
      rightElbow: { x: 0.85, y: 0.35 },
      leftWrist: { x: 0.12, y: 0.52 },
      rightWrist: { x: 0.88, y: 0.52 },
      leftHip: { x: 0.22, y: 0.55 },
      rightHip: { x: 0.78, y: 0.55 },
      centerTop: { x: 0.5, y: 0.14 },
      centerBottom: { x: 0.5, y: 0.98 },
    },
    jacket: {
      neck: { x: 0.5, y: 0.09 },
      leftShoulder: { x: 0.24, y: 0.18 },
      rightShoulder: { x: 0.76, y: 0.18 },
      leftElbow: { x: 0.08, y: 0.42 },
      rightElbow: { x: 0.92, y: 0.42 },
      leftWrist: { x: 0.04, y: 0.62 },
      rightWrist: { x: 0.96, y: 0.62 },
      leftHip: { x: 0.23, y: 0.9 },
      rightHip: { x: 0.77, y: 0.9 },
      centerTop: { x: 0.5, y: 0.18 },
      centerBottom: { x: 0.5, y: 0.9 },
    },
  };

  return defaults[type] ?? defaults.tshirt;
}

const _warnedMissing = new Set();

function _candidateKeys(src) {
  const keys = [];
  if (!src) return keys;

  const s = String(src);
  keys.push(s);

  try {
    const url = new URL(s, window.location.href);
    if (url.pathname) keys.push(url.pathname);
    const base = url.pathname?.split('/').pop();
    if (base) keys.push('/' + base);
  } catch {
    // not a URL; treat as path
    const base = s.split('/').pop();
    if (base) keys.push('/' + base);
  }

  return [...new Set(keys)];
}

export function getProductSkeleton(src, type = 'tshirt') {
  for (const key of _candidateKeys(src)) {
    if (PRODUCT_SKELETONS[key]) return PRODUCT_SKELETONS[key];
  }

  if (src && !_warnedMissing.has(String(src))) {
    _warnedMissing.add(String(src));
    // eslint-disable-next-line no-console
    console.warn(
      '[AR skeleton-fit] No annotated product skeleton for:',
      src,
      '\nUsing default skeleton. For best fit, annotate via SkeletonAnnotator.html and add to PRODUCT_SKELETONS.'
    );
  }
  return getDefaultSkeleton(type);
}

export function denormaliseSkeleton(skeleton, imgWidth, imgHeight) {
  const out = {};
  for (const [key, pt] of Object.entries(skeleton || {})) {
    out[key] = { x: pt.x * imgWidth, y: pt.y * imgHeight };
  }
  return out;
}

export function drawProductSkeleton(ctx, skeleton, offsetX = 0, offsetY = 0, scale = 1) {
  if (!ctx || !skeleton) return;

  const COLORS = {
    shoulder: '#F9CB42',
    hip: '#F9CB42',
    elbow: '#EF8B2C',
    wrist: '#EF8B2C',
    neck: '#5DCAA5',
    center: '#85B7EB',
  };

  const CONNECTIONS = [
    ['neck', 'leftShoulder'],
    ['neck', 'rightShoulder'],
    ['leftShoulder', 'rightShoulder'],
    ['leftShoulder', 'leftElbow'],
    ['leftElbow', 'leftWrist'],
    ['rightShoulder', 'rightElbow'],
    ['rightElbow', 'rightWrist'],
    ['leftShoulder', 'leftHip'],
    ['rightShoulder', 'rightHip'],
    ['leftHip', 'rightHip'],
    ['centerTop', 'centerBottom'],
  ];

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';

  for (const [a, b] of CONNECTIONS) {
    if (!skeleton[a] || !skeleton[b]) continue;
    ctx.beginPath();
    ctx.moveTo(offsetX + skeleton[a].x * scale, offsetY + skeleton[a].y * scale);
    ctx.lineTo(offsetX + skeleton[b].x * scale, offsetY + skeleton[b].y * scale);
    ctx.stroke();
  }

  for (const [key, pt] of Object.entries(skeleton)) {
    const color =
      key.includes('Shoulder') || key.includes('Hip')
        ? COLORS.shoulder
        : key.includes('Elbow')
          ? COLORS.elbow
          : key.includes('Wrist')
            ? COLORS.wrist
            : key.includes('neck')
              ? COLORS.neck
              : COLORS.center;

    ctx.beginPath();
    ctx.arc(offsetX + pt.x * scale, offsetY + pt.y * scale, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText(key, offsetX + pt.x * scale + 7, offsetY + pt.y * scale + 4);
  }

  ctx.restore();
}
