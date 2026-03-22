/**
 * skeletonFitter.js
 *
 * Given a body skeleton (MediaPipe Pose → named keypoints in canvas pixels)
 * and a product skeleton (named keypoints in NORMALIZED image coords), warp
 * the product image onto the body using piecewise affine (per-triangle) mapping.
 */

function triangulateWithCentroid(points) {
  if (!points || points.length < 4) return [];

  // assumes last point is centroid
  const centroidIndex = points.length - 1;

  const cx = points[centroidIndex].x;
  const cy = points[centroidIndex].y;

  const sorted = points
    .slice(0, centroidIndex)
    .map((p, i) => ({ i, angle: Math.atan2(p.y - cy, p.x - cx) }))
    .sort((a, b) => a.angle - b.angle);

  const tris = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i].i;
    const b = sorted[(i + 1) % sorted.length].i;
    tris.push([a, b, centroidIndex]);
  }
  return tris;
}

// Destination triangle (x,y) ← Source triangle (u,v)
function triWarp(ctx, img, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();

  const d = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
  if (Math.abs(d) < 0.001) {
    ctx.restore();
    return;
  }

  const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / d;
  const b = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / d;
  const c = x0 - a * u0 - b * v0;
  const e = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / d;
  const f = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / d;
  const g = y0 - e * u0 - f * v0;

  ctx.transform(a, e, b, f, c, g);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function centroid(points) {
  const n = points.length || 1;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

function visibilityOk(pt) {
  return pt && (pt.visibility == null || pt.visibility >= 0.35);
}

function fallbackRigidRender(ctx, img, bodySkel, opacity) {
  const ls = bodySkel.leftShoulder;
  const rs = bodySkel.rightShoulder;
  if (!ls || !rs) return;

  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;

  const sw = Math.hypot(rs.x - ls.x, rs.y - ls.y);
  const scale = (sw / Math.max(imgW, 1)) * 1.35;
  const cx = (ls.x + rs.x) / 2;
  const cy = (ls.y + rs.y) / 2;
  const angle = Math.atan2(rs.y - ls.y, rs.x - ls.x);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(img, -(imgW * scale) / 2, -(imgH * scale) * 0.22, imgW * scale, imgH * scale);
  ctx.restore();
}

function drawDebugOverlay(ctx, points, triangles) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 200, 0, 0.42)';
  ctx.lineWidth = 0.8;

  for (const [i, j, k] of triangles) {
    const p0 = points[i];
    const p1 = points[j];
    const p2 = points[k];
    if (!p0 || !p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.stroke();
  }

  for (const p of points) {
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#F9CB42';
    ctx.fill();
  }

  ctx.restore();
}

export function renderFittedProduct(ctx, img, productSkelNorm, bodySkel, opts = {}) {
  const { debugSkeleton = false, opacity = 1 } = opts;

  if (!ctx || !img || !productSkelNorm || !bodySkel) return;

  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  if (!imgW || !imgH) return;

  const POINT_KEYS = [
    'leftShoulder',
    'rightShoulder',
    'leftHip',
    'rightHip',
    'neck',
    'leftElbow',
    'rightElbow',
    'leftWrist',
    'rightWrist',
    'centerTop',
    'centerBottom',
  ];

  const src = [];
  const dst = [];

  // Shoulders/hips are critical anchors for clothing. MediaPipe occasionally
  // reports low visibility even when the point is usable; if we drop them,
  // the garment will "detach" or skew.
  const CRITICAL_ANCHORS = new Set(['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'neck']);

  for (const key of POINT_KEYS) {
    const p = productSkelNorm[key];
    const b = bodySkel[key];
    if (!p || !b) continue;
    if (!CRITICAL_ANCHORS.has(key) && !visibilityOk(b)) continue;
    src.push({ x: p.x * imgW, y: p.y * imgH });
    dst.push({ x: b.x, y: b.y });
  }

  if (src.length < 3) {
    fallbackRigidRender(ctx, img, bodySkel, opacity);
    return;
  }

  // add image corners as anchors (mapped by nearest src→dst translation)
  const corners = [
    { x: 0, y: 0 },
    { x: imgW, y: 0 },
    { x: imgW, y: imgH },
    { x: 0, y: imgH },
  ];

  const extrapolated = corners.map((corner) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < src.length; i++) {
      const d = Math.hypot(corner.x - src[i].x, corner.y - src[i].y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const dx = dst[best].x - src[best].x;
    const dy = dst[best].y - src[best].y;
    return { x: corner.x + dx, y: corner.y + dy };
  });

  const allSrc = [...src, ...corners];
  const allDst = [...dst, ...extrapolated];

  const srcC = centroid(allSrc);
  const dstC = centroid(allDst);
  allSrc.push(srcC);
  allDst.push(dstC);

  const tris = triangulateWithCentroid(allSrc);

  ctx.save();
  ctx.globalAlpha = opacity;

  for (const [i, j, k] of tris) {
    const s0 = allSrc[i];
    const s1 = allSrc[j];
    const s2 = allSrc[k];
    const d0 = allDst[i];
    const d1 = allDst[j];
    const d2 = allDst[k];
    if (!s0 || !s1 || !s2 || !d0 || !d1 || !d2) continue;

    triWarp(ctx, img, d0.x, d0.y, s0.x, s0.y, d1.x, d1.y, s1.x, s1.y, d2.x, d2.y, s2.x, s2.y);
  }

  ctx.restore();

  if (debugSkeleton) {
    drawDebugOverlay(ctx, allDst, tris);
  }
}

export function drawBodySkeleton(ctx, bodySkel) {
  if (!bodySkel) return;

  const BONES = [
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
    ['leftHip', 'centerBottom'],
    ['rightHip', 'centerBottom'],
    ['leftHip', 'leftKnee'],
    ['leftKnee', 'leftAnkle'],
    ['rightHip', 'rightKnee'],
    ['rightKnee', 'rightAnkle'],
  ];

  ctx.save();
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';

  for (const [a, b] of BONES) {
    const pa = bodySkel[a];
    const pb = bodySkel[b];
    if (!pa || !pb) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  const DOT_COLORS = {
    leftShoulder: '#F9CB42',
    rightShoulder: '#F9CB42',
    leftHip: '#F9CB42',
    rightHip: '#F9CB42',
    leftElbow: '#EF8B2C',
    rightElbow: '#EF8B2C',
    leftWrist: '#EF8B2C',
    rightWrist: '#EF8B2C',
    leftKnee: '#EF8B2C',
    rightKnee: '#EF8B2C',
    leftAnkle: '#EF8B2C',
    rightAnkle: '#EF8B2C',
    neck: '#5DCAA5',
    centerTop: '#85B7EB',
    centerBottom: '#85B7EB',
  };

  for (const [key, color] of Object.entries(DOT_COLORS)) {
    const pt = bodySkel[key];
    if (!pt) continue;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}
