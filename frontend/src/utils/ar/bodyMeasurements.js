/**
 * bodyMeasurements.js
 *
 * Extracts named keypoints + computes pixel-space body measurements from
 * MediaPipe Pose landmarks.
 *
 * Storage keys (as requested):
 * - localStorage['vivmart_body_measurements']
 * - localStorage['vivmart_pose_snapshot']
 */

const STORAGE_KEY_MEASUREMENTS = 'vivmart_body_measurements'
const STORAGE_KEY_SNAPSHOT = 'vivmart_pose_snapshot'

// MediaPipe Pose landmark indices
const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
}

function dist(a, b) {
  if (!a || !b) return null
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Extract named keypoints from `results.poseLandmarks`.
 * By default we mirror X so keypoints match a mirrored selfie canvas.
 */
export function extractKeypoints(poseLandmarks, canvasW, canvasH, opts = {}) {
  if (!poseLandmarks) return null
  const mirrorX = opts.mirrorX !== false

  const kp = (idx) => {
    const lm = poseLandmarks[idx]
    if (!lm) return null
    const xNorm = mirrorX ? 1 - lm.x : lm.x
    return {
      x: xNorm * canvasW,
      y: lm.y * canvasH,
      visibility: lm.visibility ?? 1,
    }
  }

  // Raw anatomical points from MediaPipe, converted into canvas pixel space.
  // When mirrorX=true, x is flipped to match a mirrored selfie canvas.
  let leftShoulder = kp(LM.LEFT_SHOULDER)
  let rightShoulder = kp(LM.RIGHT_SHOULDER)
  let leftHip = kp(LM.LEFT_HIP)
  let rightHip = kp(LM.RIGHT_HIP)
  let leftElbow = kp(LM.LEFT_ELBOW)
  let rightElbow = kp(LM.RIGHT_ELBOW)
  let leftWrist = kp(LM.LEFT_WRIST)
  let rightWrist = kp(LM.RIGHT_WRIST)
  let leftKnee = kp(LM.LEFT_KNEE)
  let rightKnee = kp(LM.RIGHT_KNEE)
  let leftAnkle = kp(LM.LEFT_ANKLE)
  let rightAnkle = kp(LM.RIGHT_ANKLE)

  // IMPORTANT:
  // MediaPipe landmark "LEFT_*" is anatomical-left. In a mirrored selfie view,
  // anatomical-left appears on the viewer's RIGHT side.
  // Our product skeleton annotations (and what users expect visually) are
  // viewer-left/viewer-right. So after mirroring, normalize so "left*" means
  // left-most on the canvas.
  if (mirrorX) {
    // Decide swapping based on the first reliable L/R pair we have.
    // This keeps labels stable even if one pair is temporarily missing.
    const pickSwap = (...pairs) => {
      for (const [l, r] of pairs) {
        if (l && r) return l.x > r.x
      }
      return false
    }

    const shouldSwap = pickSwap(
      [leftShoulder, rightShoulder],
      [leftHip, rightHip],
      [leftWrist, rightWrist],
      [leftAnkle, rightAnkle],
      [leftKnee, rightKnee]
    )

    if (shouldSwap) {
      ;[leftShoulder, rightShoulder] = [rightShoulder, leftShoulder]
      ;[leftHip, rightHip] = [rightHip, leftHip]
      ;[leftElbow, rightElbow] = [rightElbow, leftElbow]
      ;[leftWrist, rightWrist] = [rightWrist, leftWrist]
      ;[leftKnee, rightKnee] = [rightKnee, leftKnee]
      ;[leftAnkle, rightAnkle] = [rightAnkle, leftAnkle]
    }
  }

  const centerTop = leftShoulder && rightShoulder
    ? {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
        visibility: Math.min(leftShoulder.visibility ?? 1, rightShoulder.visibility ?? 1),
      }
    : null

  const centerBottom = leftHip && rightHip
    ? {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
        visibility: Math.min(leftHip.visibility ?? 1, rightHip.visibility ?? 1),
      }
    : null

  const neck = leftShoulder && rightShoulder
    ? {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y:
          Math.min(leftShoulder.y, rightShoulder.y) -
          Math.abs(leftShoulder.x - rightShoulder.x) * 0.15,
        visibility: Math.min(leftShoulder.visibility ?? 1, rightShoulder.visibility ?? 1),
      }
    : null

  const torsoCenter = centerTop && centerBottom
    ? {
        x: (centerTop.x + centerBottom.x) / 2,
        y: (centerTop.y + centerBottom.y) / 2,
        visibility: Math.min(centerTop.visibility ?? 1, centerBottom.visibility ?? 1),
      }
    : leftShoulder && rightShoulder && leftHip && rightHip
      ? {
          x: (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4,
          y: (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4,
          visibility: Math.min(
            leftShoulder.visibility ?? 1,
            rightShoulder.visibility ?? 1,
            leftHip.visibility ?? 1,
            rightHip.visibility ?? 1
          ),
        }
      : null

  return {
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    neck,
    centerTop,
    centerBottom,
    torsoCenter,
  }
}

/**
 * Compute pixel-space measurements from keypoints.
 * If you pass `pixelsPerCm > 0`, cm values are also computed.
 */
export function computeMeasurements(keypoints, pixelsPerCm = 0) {
  if (!keypoints) return null

  const {
    leftShoulder: ls,
    rightShoulder: rs,
    leftHip: lh,
    rightHip: rh,
    leftElbow: le,
    rightElbow: re,
    leftWrist: lw,
    rightWrist: rw,
  } = keypoints

  const pxToCm = (px) => (px && pixelsPerCm > 0 ? +(px / pixelsPerCm).toFixed(1) : null)

  const shoulderWidthPx = dist(ls, rs)
  const hipWidthPx = dist(lh, rh)

  const shoulderCenter = ls && rs ? { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 } : null
  const hipCenter = lh && rh ? { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 } : null
  const torsoHeightPx = shoulderCenter && hipCenter ? dist(shoulderCenter, hipCenter) : null

  const leftSleevePx = dist(ls, le) != null && dist(le, lw) != null ? dist(ls, le) + dist(le, lw) : null
  const rightSleevePx = dist(rs, re) != null && dist(re, rw) != null ? dist(rs, re) + dist(re, rw) : null

  const chestWidthPx = shoulderWidthPx ? shoulderWidthPx * 0.9 : null

  return {
    px: {
      shoulderWidth: shoulderWidthPx ? +shoulderWidthPx.toFixed(1) : null,
      chestWidth: chestWidthPx ? +chestWidthPx.toFixed(1) : null,
      hipWidth: hipWidthPx ? +hipWidthPx.toFixed(1) : null,
      torsoHeight: torsoHeightPx ? +torsoHeightPx.toFixed(1) : null,
      leftSleeve: leftSleevePx ? +leftSleevePx.toFixed(1) : null,
      rightSleeve: rightSleevePx ? +rightSleevePx.toFixed(1) : null,
    },
    cm: {
      shoulderWidth: pxToCm(shoulderWidthPx),
      chestWidth: pxToCm(chestWidthPx),
      hipWidth: pxToCm(hipWidthPx),
      torsoHeight: pxToCm(torsoHeightPx),
      leftSleeve: pxToCm(leftSleevePx),
      rightSleeve: pxToCm(rightSleevePx),
    },
  }
}

export function saveMeasurements(measurements, keypoints) {
  try {
    localStorage.setItem(
      STORAGE_KEY_MEASUREMENTS,
      JSON.stringify({
        timestamp: Date.now(),
        measurements,
      })
    )
    localStorage.setItem(
      STORAGE_KEY_SNAPSHOT,
      JSON.stringify({
        timestamp: Date.now(),
        keypoints,
      })
    )
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[bodyMeasurements] localStorage write failed', e)
  }
}

export function loadMeasurements() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEASUREMENTS)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function loadKeypointSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SNAPSHOT)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Returns true when the torso center moved suddenly (tracking glitch).
 */
export function hasTrackingJumped(prevKeypoints, currKeypoints, thresholdPx = 60) {
  if (!prevKeypoints || !currKeypoints) return false
  const prevMid = prevKeypoints.torsoCenter
  const currMid = currKeypoints.torsoCenter
  if (!prevMid || !currMid) return false
  const d = Math.sqrt((prevMid.x - currMid.x) ** 2 + (prevMid.y - currMid.y) ** 2)
  return d > thresholdPx
}

/**
 * Convenience helper to compute a basic shirt transform from measurements.
 */
export function computeShirtTransform(keypoints, measurements) {
  const ls = keypoints?.leftShoulder
  const rs = keypoints?.rightShoulder
  if (!ls || !rs) return null

  const shirtScale = 1.35
  const shoulderW = measurements?.px?.shoulderWidth ?? dist(ls, rs) ?? 120
  const shirtWidth = shoulderW * shirtScale
  const shirtHeight = shirtWidth * 1.3

  const angle = Math.atan2(rs.y - ls.y, rs.x - ls.x)
  const cx = (ls.x + rs.x) / 2
  const cy = (ls.y + rs.y) / 2 - shirtHeight * 0.08

  return {
    cx,
    cy,
    width: shirtWidth,
    height: shirtHeight,
    angle,
    x: cx - shirtWidth / 2,
    y: cy,
  }
}
