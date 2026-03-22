import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Pose } from '@mediapipe/pose'
import { FaceMesh } from '@mediapipe/face_mesh'
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation'
import { ClothingPhysics } from '../../utils/ar/ClothingPhysics'
import { extractKeypoints, computeMeasurements, saveMeasurements, hasTrackingJumped } from '../../utils/ar/bodyMeasurements'
import { getProductSkeleton } from '../../utils/ar/productSkeleton'
import { drawBodySkeleton, renderFittedProduct } from '../../utils/ar/skeletonFitter'
import { removeBackground } from '../../utils/ar/removeProductBackground'
import { openFrontCamera, stopStream, attachStreamToVideo } from '../../utils/ar/cameraUtils'
import {
  disposeThree,
  initThreeShirt,
  isModelSource,
  renderThree,
  resizeThree,
  updateThreeShirt,
} from '../../utils/ar/threeShirt'

/**
 * ARTryOnAdvanced
 *
 * Implements:
 * - Webcam (hidden <video>)
 * - Canvas output
 * - Background removal using MediaPipe SelfieSegmentation
 * - Body tracking using MediaPipe Pose
 * - Face AR using MediaPipe FaceMesh
 * - Overlay pipeline using the exact compositing steps:
 *    1) Draw segmentation mask
 *    2) source-in to keep only person
 *    3) Draw video frame
 *    4) Reset to source-over
 *    5) Draw overlays (cloth / glasses / necklace)
 */

const MODES = {
  clothes: 'clothes',
  glasses: 'glasses',
  jewelry: 'jewelry',
}

function distance(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function safeLocalStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore (private mode/quota)
  }
}

function computeBodyMeasurements(poseLandmarks, w, h) {
  if (!poseLandmarks) return null

  // Mirror-aware extraction so the keypoints match the mirrored canvas output.
  const keypoints = extractKeypoints(poseLandmarks, w, h, { mirrorX: true })
  if (!keypoints?.leftShoulder || !keypoints?.rightShoulder || !keypoints?.leftHip || !keypoints?.rightHip) return null

  const measurements = computeMeasurements(keypoints)

  const shoulderCenter = {
    x: (keypoints.leftShoulder.x + keypoints.rightShoulder.x) / 2,
    y: (keypoints.leftShoulder.y + keypoints.rightShoulder.y) / 2,
  }
  const hipsCenter = {
    x: (keypoints.leftHip.x + keypoints.rightHip.x) / 2,
    y: (keypoints.leftHip.y + keypoints.rightHip.y) / 2,
  }
  const shoulderTiltRad = Math.atan2(
    keypoints.rightShoulder.y - keypoints.leftShoulder.y,
    keypoints.rightShoulder.x - keypoints.leftShoulder.x
  )

  return {
    ts: Date.now(),
    keypoints,
    measurements,
    pointsPx: {
      leftShoulder: keypoints.leftShoulder,
      rightShoulder: keypoints.rightShoulder,
      leftHip: keypoints.leftHip,
      rightHip: keypoints.rightHip,
      shoulderCenter,
      hipsCenter,
      neck: keypoints.neck,
      leftArm:
        keypoints.leftElbow && keypoints.leftWrist
          ? { elbow: keypoints.leftElbow, wrist: keypoints.leftWrist }
          : null,
      rightArm:
        keypoints.rightElbow && keypoints.rightWrist
          ? { elbow: keypoints.rightElbow, wrist: keypoints.rightWrist }
          : null,
    },
    measuresPx: {
      shoulderWidthPx: measurements?.px?.shoulderWidth ?? null,
      hipWidthPx: measurements?.px?.hipWidth ?? null,
      torsoHeightPx: measurements?.px?.torsoHeight ?? null,
      shoulderTiltRad,
    },
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function smoothBox(smoothRef, next, alpha = 0.25) {
  const prev = smoothRef.current
  if (!prev) {
    smoothRef.current = next
    return next
  }
  const smoothed = {
    cx: lerp(prev.cx, next.cx, alpha),
    cy: lerp(prev.cy, next.cy, alpha),
    w: lerp(prev.w, next.w, alpha),
    h: lerp(prev.h, next.h, alpha),
    a: lerp(prev.a ?? 0, next.a ?? 0, alpha),
  }
  smoothRef.current = smoothed
  return smoothed
}

const _imgBoundsCache = new WeakMap()
function getImageContentBounds(img) {
  const cached = _imgBoundsCache.get(img)
  if (cached) return cached

  const iw = img?.naturalWidth || img?.width || 0
  const ih = img?.naturalHeight || img?.height || 0
  if (!iw || !ih) return { sx: 0, sy: 0, sw: iw, sh: ih }

  const canvas = document.createElement('canvas')
  canvas.width = iw
  canvas.height = ih
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)

  let data
  try {
    data = ctx.getImageData(0, 0, iw, ih).data
  } catch {
    const full = { sx: 0, sy: 0, sw: iw, sh: ih }
    _imgBoundsCache.set(img, full)
    return full
  }

  let minX = iw,
    minY = ih,
    maxX = -1,
    maxY = -1

  const alphaThreshold = 8
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const a = data[(y * iw + x) * 4 + 3]
      if (a > alphaThreshold) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    const full = { sx: 0, sy: 0, sw: iw, sh: ih }
    _imgBoundsCache.set(img, full)
    return full
  }

  const pad = 2
  const sx = clamp(minX - pad, 0, iw - 1)
  const sy = clamp(minY - pad, 0, ih - 1)
  const ex = clamp(maxX + pad, 0, iw - 1)
  const ey = clamp(maxY + pad, 0, ih - 1)

  const bounds = { sx, sy, sw: ex - sx + 1, sh: ey - sy + 1 }
  _imgBoundsCache.set(img, bounds)
  return bounds
}

function triWarp(ctx, img, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2) {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.closePath()
  ctx.clip()

  const d = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)
  if (Math.abs(d) < 0.001) {
    ctx.restore()
    return
  }

  const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / d
  const b = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / d
  const c = x0 - a * u0 - b * v0
  const e = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / d
  const f = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / d
  const g = y0 - e * u0 - f * v0
  ctx.transform(a, e, b, f, c, g)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}

function drawClothMesh(ctx, clothImage, physicsState) {
  if (!physicsState?.pts?.length) return
  if (!clothImage || !clothImage.complete || !clothImage.naturalWidth) return

  const { pts, cols, rows } = physicsState
  const bounds = getImageContentBounds(clothImage)
  const sw = (bounds.sw || clothImage.naturalWidth) / (cols - 1)
  const sh = (bounds.sh || clothImage.naturalHeight) / (rows - 1)
  const uBase = bounds.sx || 0
  const vBase = bounds.sy || 0

  ctx.save()
  ctx.globalAlpha = 0.93
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c
      const p00 = pts[i]
      const p10 = pts[i + 1]
      const p01 = pts[i + cols]
      const p11 = pts[i + cols + 1]

      const u0 = uBase + c * sw
      const u1 = uBase + (c + 1) * sw
      const v0 = vBase + r * sh
      const v1 = vBase + (r + 1) * sh

      triWarp(ctx, clothImage, p00.x, p00.y, u0, v0, p10.x, p10.y, u1, v0, p01.x, p01.y, u0, v1)
      triWarp(ctx, clothImage, p10.x, p10.y, u1, v0, p11.x, p11.y, u1, v1, p01.x, p01.y, u0, v1)
    }
  }
  ctx.restore()
}

function drawClothDeformable(ctx, w, h, poseLandmarks, clothImage, physicsRef, bodyMeasurements) {
  if (!poseLandmarks) return
  if (!clothImage || !clothImage.complete || !clothImage.naturalWidth) return

  // Our canvas is already mirrored when drawing the video frame, so we flip x here
  // to keep pose space consistent with what the user sees.
  const mirrored = poseLandmarks.map((lm) => (lm ? { ...lm, x: 1 - lm.x } : lm))

  if (!physicsRef.current) physicsRef.current = new ClothingPhysics()

  // If body proportions jump (tracking glitch), reset to avoid “exploding” mesh.
  const m = bodyMeasurements?.measuresPx
  if (m) {
    const last = physicsRef.current.__lastMeasures
    const cur = { sw: m.shoulderWidthPx, th: m.torsoHeightPx }
    if (last) {
      const jump =
        (Math.abs(cur.sw - last.sw) / Math.max(last.sw, 1) > 0.35) ||
        (Math.abs(cur.th - last.th) / Math.max(last.th, 1) > 0.35)
      if (jump) physicsRef.current.reset()
    }
    physicsRef.current.__lastMeasures = cur
  }

  physicsRef.current.update(mirrored, w, h)
  drawClothMesh(ctx, clothImage, physicsRef.current.getState())
}

/**
 * drawCloth
 * - Uses Pose landmarks: 11, 12, 23, 24
 * - Calculates shoulder width + torso height
 * - Preserves image aspect ratio (no stretching)
 * - Applies rotation based on shoulder tilt
 * - Applies smoothing to reduce jitter
 */
function drawCloth(ctx, w, h, poseLandmarks, clothImage, smoothStateRef, config = {}) {
  if (!poseLandmarks) return
  if (!clothImage || !clothImage.complete || !clothImage.naturalWidth) return

  const ls = poseLandmarks[11]
  const rs = poseLandmarks[12]
  const lh = poseLandmarks[23]
  const rh = poseLandmarks[24]
  if (!ls || !rs || !lh || !rh) return

  // Mirror-aware pixel coordinates: we mirror the video on canvas, so flip X.
  const px = (lm) => ({ x: (1 - lm.x) * w, y: lm.y * h })
  let pLS = px(ls)
  let pRS = px(rs)
  const pLH = px(lh)
  const pRH = px(rh)

  // After mirroring, MediaPipe left/right can appear swapped in canvas space.
  // Normalize so pLS is the left-most point in canvas coordinates.
  if (pLS.x > pRS.x) {
    const tmp = pLS
    pLS = pRS
    pRS = tmp
  }

  const shoulderWidth = distance(pLS, pRS)
  const hipWidth = distance(pLH, pRH)

  const shoulderCenter = { x: (pLS.x + pRS.x) / 2, y: (pLS.y + pRS.y) / 2 }
  const hipsCenter = { x: (pLH.x + pRH.x) / 2, y: (pLH.y + pRH.y) / 2 }
  const torsoHeight = distance(shoulderCenter, hipsCenter)

  // Rotation from shoulder line
  const angle = Math.atan2(pRS.y - pLS.y, pRS.x - pLS.x)

  // --- Tuning knobs (manual offsets & realism multipliers) ---
  // Size tuning (shoulder-fit first; hips provide a minimum width)
  const shoulderWidthMultiplier = config.shoulderWidthMultiplier ?? 1.65
  const hipWidthMultiplier = config.hipWidthMultiplier ?? 1.25
  const heightMultiplier = config.heightMultiplier ?? 1.22
  const xOffset = config.xOffset ?? 0
  const yOffset = config.yOffset ?? 0
  // How far below shoulder line the garment should sit (fraction of torso height)
  const shoulderYOffset = config.shoulderYOffset ?? 0.03
  const rotationMultiplier = config.rotationMultiplier ?? 1.0
  const smoothAlpha = config.smoothAlpha ?? 0.3 // smoothValue = prev*0.7 + cur*0.3

  // Image anchor (where the user's shoulder line should map inside the image)
  // 0..1 relative to image dimensions.
  const anchorX = config.anchorX ?? 0.5
  const anchorY = config.anchorY ?? 0.22

  // Depth simulation: shoulders closer => smaller, wider => bigger
  const shoulderNorm = shoulderWidth / Math.max(w, 1)
  const depthScale = clamp(shoulderNorm / 0.35, 0.75, 1.35)

  // Target size based on body proportions
  const targetW = Math.max(shoulderWidth * shoulderWidthMultiplier, hipWidth * hipWidthMultiplier) * depthScale
  const targetH = torsoHeight * heightMultiplier * depthScale

  // Maintain aspect ratio: scale by max so it covers the torso area.
  // Use content bounds so transparent padding doesn't shift/scale the garment.
  const bounds = getImageContentBounds(clothImage)
  const imgW = bounds.sw || clothImage.naturalWidth
  const imgH = bounds.sh || clothImage.naturalHeight
  const scale = Math.max(targetW / imgW, targetH / imgH)
  const drawW = imgW * scale
  const drawH = imgH * scale

  // Position: align the garment's shoulder line to the user's shoulder line.
  // We still allow a small downward offset to sit naturally.
  const rawCenterX = shoulderCenter.x + xOffset
  const rawCenterY = shoulderCenter.y + torsoHeight * shoulderYOffset + yOffset

  // Smoothing (reduce jitter)
  const prev = smoothStateRef.current
  const next = {
    cx: rawCenterX,
    cy: rawCenterY,
    w: drawW,
    h: drawH,
    a: angle * rotationMultiplier,
  }
  if (!prev) {
    smoothStateRef.current = next
  } else {
    smoothStateRef.current = {
      cx: prev.cx * (1 - smoothAlpha) + next.cx * smoothAlpha,
      cy: prev.cy * (1 - smoothAlpha) + next.cy * smoothAlpha,
      w: prev.w * (1 - smoothAlpha) + next.w * smoothAlpha,
      h: prev.h * (1 - smoothAlpha) + next.h * smoothAlpha,
      a: prev.a * (1 - smoothAlpha) + next.a * smoothAlpha,
    }
  }

  const s = smoothStateRef.current

  // Texture / rendering quality
  ctx.imageSmoothingEnabled = true
  // Some browsers support it
  try {
    ctx.imageSmoothingQuality = 'high'
  } catch {
    // ignore
  }

  // Drawing pipeline:
  // Save -> translate to center -> rotate -> draw -> restore
  ctx.save()
  ctx.globalAlpha = 0.95
  ctx.translate(s.cx, s.cy)
  ctx.rotate(s.a)
  // Draw so that (anchorX, anchorY) in the image maps to (0,0) in this rotated space.
  const ax = s.w * anchorX
  const ay = s.h * anchorY
  ctx.drawImage(
    clothImage,
    bounds.sx || 0,
    bounds.sy || 0,
    imgW,
    imgH,
    -ax,
    -ay,
    s.w,
    s.h
  )
  ctx.restore()
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

export default function ARTryOnAdvanced({
  // Public/ URL assets (defaults to /public/*)
  tshirtSrc = '/tshirt.png',
  glassesSrc = '/glasses.png',
  necklaceSrc = '/necklace.png',
  initialMode = MODES.clothes,
  garmentType = 'tshirt',
  useSkeletonFit = true,
  showSkeleton = false,
  showProductSkeleton = false,
}) {
  const [mode, setMode] = useState(initialMode)
  const [status, setStatus] = useState('loading') // loading | active | error
  const [errorMsg, setErrorMsg] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [runId, setRunId] = useState(0)

  const [debugBodySkeleton, setDebugBodySkeleton] = useState(Boolean(showSkeleton))
  const [debugProductSkeleton, setDebugProductSkeleton] = useState(Boolean(showProductSkeleton))

  const debugBodySkeletonRef = useRef(Boolean(showSkeleton))
  const debugProductSkeletonRef = useRef(Boolean(showProductSkeleton))
  const useSkeletonFitRef = useRef(Boolean(useSkeletonFit))

  const modeRef = useRef(initialMode)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const threeCanvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  const threeStateRef = useRef(null)

  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])

  // MediaPipe instances
  const segRef = useRef(null)
  const poseRef = useRef(null)
  const faceRef = useRef(null)

  // Latest detections (written by pose/facemesh callbacks)
  const lastPoseLandmarksRef = useRef(null)
  const lastFaceLandmarksRef = useRef(null)
  const lastBodyRef = useRef(null)
  const lastPersistRef = useRef(0)

  // Overlay images
  const overlaysRef = useRef({ tshirt: null, glasses: null, necklace: null })

  const productSkeletonRef = useRef(getProductSkeleton(tshirtSrc, garmentType))

  useEffect(() => {
    productSkeletonRef.current = getProductSkeleton(tshirtSrc, garmentType)
  }, [tshirtSrc, garmentType])

  useEffect(() => {
    debugBodySkeletonRef.current = Boolean(debugBodySkeleton)
  }, [debugBodySkeleton])

  useEffect(() => {
    debugProductSkeletonRef.current = Boolean(debugProductSkeleton)
  }, [debugProductSkeleton])

  useEffect(() => {
    useSkeletonFitRef.current = Boolean(useSkeletonFit)
  }, [useSkeletonFit])

  const clothSmoothRef = useRef(null)
  const glassesSmoothRef = useRef(null)
  const necklaceSmoothRef = useRef(null)
  const clothPhysicsRef = useRef(null)

  const skelSmoothRef = useRef(null)
  const skelPrevRef = useRef(null)

  const getCameraErrorMessage = (err) => {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '[::1]')

    if (typeof window !== 'undefined' && !window.isSecureContext && !isLocalhost) {
      return 'Camera requires a secure origin. Use HTTPS (or use http://localhost on this PC). If you opened via a LAN IP like 192.168.x.x, you must use HTTPS.'
    }

    switch (err?.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera permission denied. Allow camera access in the browser site settings and retry.'
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera device found.'
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Camera is busy/unavailable (another app may be using it). Close other apps using the camera and retry.'
      case 'OverconstrainedError':
        return 'Camera does not support the requested resolution. Try again.'
      default:
        return err?.message || 'Could not access camera.'
    }
  }

  const assetsReady = useMemo(() => {
    return Boolean(overlaysRef.current.tshirt && overlaysRef.current.glasses && overlaysRef.current.necklace)
  }, [status])

  const stopAll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null

    try {
      mediaRecorderRef.current?.stop?.()
    } catch {
      // ignore
    }
    mediaRecorderRef.current = null
    recordedChunksRef.current = []
    setIsRecording(false)

    stopStream(streamRef.current)
    streamRef.current = null

    try {
      disposeThree(threeStateRef.current)
    } catch {
      // ignore
    }
    threeStateRef.current = null

    try {
      segRef.current?.close?.()
    } catch {
      // ignore
    }
    try {
      poseRef.current?.close?.()
    } catch {
      // ignore
    }
    try {
      faceRef.current?.close?.()
    } catch {
      // ignore
    }

    segRef.current = null
    poseRef.current = null
    faceRef.current = null

    try {
      clothPhysicsRef.current?.reset?.()
    } catch {
      // ignore
    }
    clothPhysicsRef.current = null
  }

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  // Utility: keep canvas resolution matched to video
  const ensureCanvasSize = () => {
    const v = videoRef.current
    const c = canvasRef.current
    if (!v || !c) return null
    const w = v.videoWidth || 640
    const h = v.videoHeight || 480
    if (c.width !== w) c.width = w
    if (c.height !== h) c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: false })

     // Keep WebGL canvas in sync too (if enabled)
    if (threeStateRef.current) {
      resizeThree(threeStateRef.current, w, h)
    }

    return { ctx, w, h }
  }

  const startRecording = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Prefer codecs most likely supported in Chromium-based browsers
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ]
    const mimeType = candidates.find((t) => {
      try {
        return window.MediaRecorder && MediaRecorder.isTypeSupported(t)
      } catch {
        return false
      }
    })

    if (!window.MediaRecorder) {
      // Browser does not support recording
      return
    }

    recordedChunksRef.current = []
    const stream = canvas.captureStream(30)
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data)
    }

    rec.onstop = () => {
      try {
        const blob = new Blob(recordedChunksRef.current, { type: rec.mimeType || 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ar-tryon-${modeRef.current || 'video'}.webm`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1500)
      } finally {
        recordedChunksRef.current = []
      }
    }

    mediaRecorderRef.current = rec
    rec.start(250)
    setIsRecording(true)
  }

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop?.()
    } catch {
      // ignore
    }
    mediaRecorderRef.current = null
    setIsRecording(false)
  }

  // Draw helpers

  const drawGlasses = (ctx, w, h, faceLandmarks) => {
    const img = overlaysRef.current.glasses
    if (!faceLandmarks) return

    // Landmarks:
    // - 33/263: outer eye corners (stable for roll)
    // - 234/454: left/right temples/cheek (stable width anchor)
    // - 168: nose bridge (stable vertical anchor)
    const pt = (i) => ({
      x: (1 - faceLandmarks[i].x) * w,
      y: faceLandmarks[i].y * h,
      z: faceLandmarks[i].z ?? 0,
    })

    const leftEyeOuter = pt(263)
    const rightEyeOuter = pt(33)
    const leftTemple = pt(234)
    const rightTemple = pt(454)
    const noseBridge = pt(168)

    // Roll: eye line
    const roll = Math.atan2(leftEyeOuter.y - rightEyeOuter.y, leftEyeOuter.x - rightEyeOuter.x)

    // Face width anchored at temples (more stable than eye distance)
    const faceW = Math.sqrt(
      (leftTemple.x - rightTemple.x) * (leftTemple.x - rightTemple.x) +
        (leftTemple.y - rightTemple.y) * (leftTemple.y - rightTemple.y)
    )

    // Depth-based scale (FaceMesh z is roughly in image-width units; closer face => more negative z)
    const zAvg = (leftTemple.z + rightTemple.z) / 2
    const depthScale = clamp(1 + (-zAvg) * 0.35, 0.85, 1.25)

    // Preserve overlay image aspect
    const aspect = img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.42

    const width = faceW * 0.92 * depthScale
    const height = width * aspect

    // Center: nose bridge slightly above it (most frames look better than pure eye-center)
    const eyeY = (leftEyeOuter.y + rightEyeOuter.y) / 2
    const centerX = (leftTemple.x + rightTemple.x) / 2
    const centerY = lerp(eyeY, noseBridge.y, 0.35) - height * 0.12

    // Smooth to reduce jitter
    const s = smoothBox(
      glassesSmoothRef,
      { cx: centerX, cy: centerY, w: width, h: height, a: roll },
      0.25
    )

    if (img && img.complete && img.naturalWidth) {
      ctx.save()
      ctx.globalAlpha = 0.96
      ctx.translate(s.cx, s.cy)
      ctx.rotate(s.a)
      ctx.translate(-s.w / 2, -s.h / 2)
      ctx.drawImage(img, 0, 0, s.w, s.h)
      ctx.restore()
    } else {
      // Vector fallback
      ctx.save()
      ctx.globalAlpha = 0.85
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = clamp(s.w / 70, 2, 6)
      ctx.strokeRect(s.cx - s.w / 2, s.cy - s.h / 2, s.w, s.h)
      ctx.restore()
    }
  }

  const drawNecklace = (ctx, w, h, faceLandmarks) => {
    const img = overlaysRef.current.necklace
    if (!faceLandmarks) return

    const pt = (i) => ({
      x: (1 - faceLandmarks[i].x) * w,
      y: faceLandmarks[i].y * h,
      z: faceLandmarks[i].z ?? 0,
    })
    const jawL = pt(234)
    const jawR = pt(454)
    const chin = pt(152)
    const noseBridge = pt(168)

    const jawW = Math.sqrt((jawL.x - jawR.x) * (jawL.x - jawR.x) + (jawL.y - jawR.y) * (jawL.y - jawR.y))
    const zAvg = (jawL.z + jawR.z) / 2
    const depthScale = clamp(1 + (-zAvg) * 0.25, 0.9, 1.2)

    const aspect = img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.35

    const width = jawW * 0.75 * depthScale
    const height = width * aspect

    const centerX = (jawL.x + jawR.x) / 2

    // Necklace should sit below chin; use face height to adapt to distance
    const faceH = Math.max(1, Math.abs(chin.y - noseBridge.y))
    const centerY = chin.y + faceH * 0.55

    const s = smoothBox(necklaceSmoothRef, { cx: centerX, cy: centerY, w: width, h: height, a: 0 }, 0.22)

    if (img && img.complete && img.naturalWidth) {
      ctx.save()
      ctx.globalAlpha = 0.96
      ctx.translate(s.cx, s.cy)
      ctx.translate(-s.w / 2, -s.h / 2)
      ctx.drawImage(img, 0, 0, s.w, s.h)
      ctx.restore()
    } else {
      // Vector fallback
      ctx.save()
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = '#F59E0B'
      ctx.lineWidth = clamp(s.w / 110, 2, 5)
      ctx.beginPath()
      ctx.arc(s.cx, s.cy - s.h * 0.2, s.w / 2.4, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
      ctx.restore()
    }
  }

  // Initialize assets + MediaPipe + camera
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      setStatus('loading')
      setErrorMsg('')
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Camera API not available in this browser/context.')
        }

        // 1) Camera first (prefer user/front camera; fall back safely)
        const stream = await openFrontCamera({ width: 1280, height: 720 })
        if (cancelled) {
          stopStream(stream)
          return
        }
        streamRef.current = stream

        const v = videoRef.current
        await attachStreamToVideo(stream, v)
        try {
          await v.play()
        } catch (e) {
          // If autoplay is blocked, keep going; the frames may still flow.
          // eslint-disable-next-line no-console
          console.warn('video.play() blocked:', e)
        }

        if (cancelled) return

        // 2) Load overlay assets
        const use3DShirt = isModelSource(tshirtSrc)
        let tshirt = null
        if (!use3DShirt) {
          // Try a lightweight background removal. If it fails (CORS/tainted canvas), fall back.
          let processedSrc = tshirtSrc
          try {
            processedSrc = await removeBackground(tshirtSrc)
          } catch {
            processedSrc = tshirtSrc
          }
          tshirt = await loadImage(processedSrc)
        }
        const [glasses, necklace] = await Promise.all([loadImage(glassesSrc), loadImage(necklaceSrc)])
        overlaysRef.current = { tshirt, glasses, necklace }

        // Optional: initialize Three.js shirt renderer when a GLB/GLTF is provided.
        if (use3DShirt) {
          const canvas3d = threeCanvasRef.current
          if (canvas3d) {
            threeStateRef.current = await initThreeShirt({ canvas: canvas3d, modelUrl: tshirtSrc })
          }
        }

        if (cancelled) return

        // 3) Create MediaPipe instances
        const seg = new SelfieSegmentation({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`,
        })
        seg.setOptions({
          modelSelection: 0, // performance mode
        })
        segRef.current = seg

        const pose = new Pose({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`,
        })
        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.45,
          minTrackingConfidence: 0.45,
        })
        pose.onResults((r) => {
          lastPoseLandmarksRef.current = r.poseLandmarks || null

          // Compute measurements in pixel space for sizing/mapping.
          // We persist it occasionally for debugging and reuse.
          const size = ensureCanvasSize()
          if (size && r.poseLandmarks) {
            const m = computeBodyMeasurements(r.poseLandmarks, size.w, size.h)
            lastBodyRef.current = m

            const now = Date.now()
            if (m && now - (lastPersistRef.current || 0) > 800) {
              lastPersistRef.current = now
              if (m.measurements && m.keypoints) saveMeasurements(m.measurements, m.keypoints)
            }
          }
        })
        poseRef.current = pose

        const face = new FaceMesh({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
        })
        face.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
        face.onResults((r) => {
          lastFaceLandmarksRef.current = r.multiFaceLandmarks?.[0] || null
        })
        faceRef.current = face

        // 5) Segmentation results -> main draw pipeline
        seg.onResults((results) => {
          const size = ensureCanvasSize()
          if (!size) return
          const { ctx, w, h } = size

          // Clear
          ctx.clearRect(0, 0, w, h)

          // --- Pipeline required by spec ---
          // Step 1: Draw segmentation mask (mirrored)
          ctx.save()
          ctx.scale(-1, 1)
          ctx.drawImage(results.segmentationMask, -w, 0, w, h)
          ctx.restore()

          // Step 2: Apply source-in to keep only person
          ctx.globalCompositeOperation = 'source-in'

          // Step 3: Draw video frame (mirrored)
          ctx.save()
          ctx.scale(-1, 1)
          ctx.drawImage(results.image, -w, 0, w, h)
          ctx.restore()

          // Step 4: Reset to source-over
          ctx.globalCompositeOperation = 'source-over'

          // Step 5: Overlays (based on latest pose/face tracking)
          const currentMode = modeRef.current

          if (currentMode === MODES.clothes) {
            if (threeStateRef.current) {
              // 3D try-on (rigged shirt). Render on the WebGL overlay canvas.
              updateThreeShirt(threeStateRef.current, lastPoseLandmarksRef.current, w, h)
              renderThree(threeStateRef.current)
            } else {
              // 2D skeleton-fit warp try-on (piecewise affine)
              const poseLm = lastPoseLandmarksRef.current
              const productImg = overlaysRef.current.tshirt
              const productSkelNorm = productSkeletonRef.current

              const canFit = Boolean(useSkeletonFitRef.current && poseLm && productImg && productSkelNorm)
              if (canFit) {
                const rawBodyKp = extractKeypoints(poseLm, w, h, { mirrorX: true })
                if (rawBodyKp) {
                  // reset smoothing if tracking jumps
                  if (hasTrackingJumped(skelPrevRef.current, rawBodyKp, 90)) {
                    skelSmoothRef.current = null
                  }
                  skelPrevRef.current = rawBodyKp

                  const alpha = 0.35
                  const prev = skelSmoothRef.current
                  const bodyKp = prev
                    ? Object.fromEntries(
                        Object.entries(rawBodyKp).map(([k, p]) => {
                          if (!p) return [k, null]
                          const q = prev[k]
                          if (!q) return [k, p]
                          return [
                            k,
                            {
                              ...p,
                              x: q.x + (p.x - q.x) * alpha,
                              y: q.y + (p.y - q.y) * alpha,
                              visibility: p.visibility ?? q.visibility ?? 1,
                            },
                          ]
                        })
                      )
                    : rawBodyKp
                  skelSmoothRef.current = bodyKp

                  renderFittedProduct(ctx, productImg, productSkelNorm, bodyKp, {
                    debugSkeleton: debugProductSkeletonRef.current,
                    opacity: 0.95,
                  })
                  if (debugBodySkeletonRef.current) {
                    drawBodySkeleton(ctx, bodyKp)
                  }
                } else {
                  // Fallback: original deformable mesh
                  drawClothDeformable(
                    ctx,
                    w,
                    h,
                    poseLm,
                    productImg,
                    clothPhysicsRef,
                    lastBodyRef.current
                  )
                }
              } else {
                // Fallback: original deformable mesh
                drawClothDeformable(
                  ctx,
                  w,
                  h,
                  poseLm,
                  productImg,
                  clothPhysicsRef,
                  lastBodyRef.current
                )
              }
            }
          }
          if (currentMode === MODES.glasses) {
            drawGlasses(ctx, w, h, lastFaceLandmarksRef.current)
          }
          if (currentMode === MODES.jewelry) {
            drawNecklace(ctx, w, h, lastFaceLandmarksRef.current)
          }
        })

        // 6) Animation loop: send frames
        const tick = async () => {
          if (cancelled) return
          const video = videoRef.current
          if (!video || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(tick)
            return
          }

          try {
            // Always run segmentation (background removal)
            await segRef.current?.send?.({ image: video })

            // Only run the additional models needed for the active mode
            const currentMode = modeRef.current

            if (currentMode === MODES.clothes) {
              await poseRef.current?.send?.({ image: video })
            } else if (currentMode === MODES.glasses || currentMode === MODES.jewelry) {
              await faceRef.current?.send?.({ image: video })
            }
          } catch {
            // ignore per-frame errors
          }

          rafRef.current = requestAnimationFrame(tick)
        }

        setStatus('active')
        rafRef.current = requestAnimationFrame(tick)
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setErrorMsg(getCameraErrorMessage(e))
        }
      }
    }

    init()

    return () => {
      cancelled = true
      stopAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  // When mode changes, we don't need to re-init anything; the per-frame tick
  // automatically switches which model runs.

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-800">AR Try-On (Advanced)</p>
          <p className="text-xs text-gray-500">Background removal + Pose + FaceMesh</p>
        </div>
        <div className="flex items-center gap-2">
          {status === 'active' && (
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                isRecording
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
              }`}
            >
              {isRecording ? 'Stop' : 'Record'}
            </button>
          )}
          <div className="text-xs text-gray-400">{assetsReady ? '' : ''}</div>
        </div>
      </div>

      {/* UI buttons */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <button
          onClick={() => setMode(MODES.clothes)}
          className={`px-3 py-2 text-xs font-semibold rounded-xl border transition ${
            mode === MODES.clothes
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
          }`}
        >
          Clothes Try-On
        </button>
        <button
          onClick={() => setMode(MODES.glasses)}
          className={`px-3 py-2 text-xs font-semibold rounded-xl border transition ${
            mode === MODES.glasses
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
          }`}
        >
          Glasses Try-On
        </button>
        <button
          onClick={() => setMode(MODES.jewelry)}
          className={`px-3 py-2 text-xs font-semibold rounded-xl border transition ${
            mode === MODES.jewelry
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
          }`}
        >
          Jewelry Try-On
        </button>
      </div>

      {mode === MODES.clothes && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
            <input
              type="checkbox"
              className="accent-brand-600"
              checked={debugBodySkeleton}
              onChange={(e) => setDebugBodySkeleton(e.target.checked)}
            />
            Body skeleton
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
            <input
              type="checkbox"
              className="accent-brand-600"
              checked={debugProductSkeleton}
              onChange={(e) => setDebugProductSkeleton(e.target.checked)}
            />
            Product mesh
          </label>
        </div>
      )}

      {/* Hidden webcam */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Output canvas */}
      <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3]">
        <canvas ref={canvasRef} className="w-full h-full object-cover" />
        <canvas
          ref={threeCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {status === 'loading' && (
          <div className="ar-overlay">
            <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === 'error' && (
          <div className="ar-overlay">
            <div className="text-center text-white px-6">
              <p className="text-sm font-semibold">Could not start AR</p>
              <p className="text-xs text-gray-200 mt-1">{errorMsg || 'Allow camera permission and retry.'}</p>
              <button
                type="button"
                onClick={() => {
                  stopAll()
                  setRunId((n) => n + 1)
                }}
                className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-xl border border-white/20 bg-white/10 hover:bg-white/15"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-500">
        <p>
          Uses MediaPipe SelfieSegmentation to remove background in real-time. Overlays load from{' '}
          <span className="font-semibold">/public</span>.
        </p>
      </div>
    </div>
  )
}
