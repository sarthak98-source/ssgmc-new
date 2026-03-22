import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function isFinitePoint(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y)
}

function mirrorPosePx(lm, w, h) {
  return { x: (1 - lm.x) * w, y: lm.y * h, v: lm.visibility ?? 1 }
}

function toSceneXY(px, w, h) {
  return { x: px.x - w / 2, y: h / 2 - px.y }
}

function angle2D(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x)
}

function findBoneLike(root, keywords) {
  let found = null
  root.traverse((obj) => {
    if (found) return
    if (!obj.isBone) return
    const name = String(obj.name || '').toLowerCase()
    if (keywords.some((k) => name.includes(k))) found = obj
  })
  return found
}

function buildBoneMap(modelRoot) {
  // Mixamo-style names are common: mixamorig:LeftArm, LeftForeArm, etc.
  const keys = (arr) => arr.map((s) => s.toLowerCase())

  return {
    leftUpperArm: findBoneLike(modelRoot, keys(['leftarm', 'upperarm_l', 'l_upperarm'])),
    leftForeArm: findBoneLike(modelRoot, keys(['leftforearm', 'lowerarm_l', 'l_forearm'])),
    rightUpperArm: findBoneLike(modelRoot, keys(['rightarm', 'upperarm_r', 'r_upperarm'])),
    rightForeArm: findBoneLike(modelRoot, keys(['rightforearm', 'lowerarm_r', 'r_forearm'])),
  }
}

function computeTorsoTransform(poseLandmarks, w, h) {
  if (!poseLandmarks) return null

  const lsLm = poseLandmarks[11]
  const rsLm = poseLandmarks[12]
  const lhLm = poseLandmarks[23]
  const rhLm = poseLandmarks[24]
  if (!lsLm || !rsLm || !lhLm || !rhLm) return null

  const ls = mirrorPosePx(lsLm, w, h)
  const rs = mirrorPosePx(rsLm, w, h)
  const lh = mirrorPosePx(lhLm, w, h)
  const rh = mirrorPosePx(rhLm, w, h)

  if (![ls, rs, lh, rh].every((p) => isFinitePoint(p))) return null

  const shoulderCenter = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }
  const hipCenter = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 }

  const shoulderWidth = Math.hypot(rs.x - ls.x, rs.y - ls.y)
  const torsoHeight = Math.hypot(hipCenter.x - shoulderCenter.x, hipCenter.y - shoulderCenter.y)

  const roll = angle2D(ls, rs)

  // Expand slightly for a more natural drape.
  const targetWidth = shoulderWidth * 1.25
  const targetHeight = torsoHeight * 1.25

  const centerPx = {
    x: (shoulderCenter.x * 0.6 + hipCenter.x * 0.4),
    y: (shoulderCenter.y * 0.55 + hipCenter.y * 0.45),
  }

  // Confidence check
  const conf = Math.min(ls.v ?? 1, rs.v ?? 1, lh.v ?? 1, rh.v ?? 1)
  if (conf < 0.35) return null

  return {
    centerPx,
    targetWidth: clamp(targetWidth, 20, w * 2),
    targetHeight: clamp(targetHeight, 20, h * 2),
    roll,
    points: { ls, rs, lh, rh },
  }
}

export async function initThreeShirt({ canvas, modelUrl }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new THREE.Scene()

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000)
  camera.position.set(0, 0, 1000)
  scene.add(camera)

  const ambient = new THREE.AmbientLight(0xffffff, 0.9)
  scene.add(ambient)

  const dir = new THREE.DirectionalLight(0xffffff, 0.7)
  dir.position.set(200, 400, 800)
  scene.add(dir)

  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(modelUrl)

  const modelRoot = new THREE.Group()
  modelRoot.add(gltf.scene)
  scene.add(modelRoot)

  // Normalize model pivot: center it around its bounding box.
  const box = new THREE.Box3().setFromObject(modelRoot)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  gltf.scene.position.sub(center)

  const boneMap = buildBoneMap(modelRoot)

  return {
    renderer,
    scene,
    camera,
    modelRoot,
    baseBoxSize: { x: Math.max(size.x, 1e-3), y: Math.max(size.y, 1e-3) },
    boneMap,
    lastTransform: null,
  }
}

export function resizeThree(state, w, h) {
  if (!state?.renderer || !state?.camera) return
  state.renderer.setSize(w, h, false)

  // Map scene units to pixels (orthographic camera).
  state.camera.left = -w / 2
  state.camera.right = w / 2
  state.camera.top = h / 2
  state.camera.bottom = -h / 2
  state.camera.updateProjectionMatrix()
}

export function updateThreeShirt(state, poseLandmarks, w, h) {
  if (!state?.modelRoot) return
  const t = computeTorsoTransform(poseLandmarks, w, h)
  if (!t) return

  const centerScene = toSceneXY(t.centerPx, w, h)

  // Scale to match shoulder width (X axis).
  const sx = t.targetWidth / state.baseBoxSize.x
  const sy = t.targetHeight / state.baseBoxSize.y
  const s = Math.max(0.001, Math.min(sx, sy) * 1.05)

  state.modelRoot.position.set(centerScene.x, centerScene.y, 0)
  state.modelRoot.scale.setScalar(s)
  state.modelRoot.rotation.set(0, 0, -t.roll)

  // Optional arm bending if the model has suitable bones.
  // This is a best-effort mapping (works well for Mixamo rigs).
  if (poseLandmarks) {
    const leLm = poseLandmarks[13]
    const lwLm = poseLandmarks[15]
    const reLm = poseLandmarks[14]
    const rwLm = poseLandmarks[16]

    const { points } = t
    const le = leLm ? mirrorPosePx(leLm, w, h) : null
    const lw = lwLm ? mirrorPosePx(lwLm, w, h) : null
    const re = reLm ? mirrorPosePx(reLm, w, h) : null
    const rw = rwLm ? mirrorPosePx(rwLm, w, h) : null

    const bodyRoll = t.roll

    if (state.boneMap.leftUpperArm && isFinitePoint(points.ls) && isFinitePoint(le)) {
      const a = angle2D(points.ls, le)
      state.boneMap.leftUpperArm.rotation.z = -(a - bodyRoll)
    }
    if (state.boneMap.leftForeArm && isFinitePoint(le) && isFinitePoint(lw)) {
      const a = angle2D(le, lw)
      state.boneMap.leftForeArm.rotation.z = -(a - bodyRoll)
    }
    if (state.boneMap.rightUpperArm && isFinitePoint(points.rs) && isFinitePoint(re)) {
      const a = angle2D(points.rs, re)
      state.boneMap.rightUpperArm.rotation.z = -(a - bodyRoll)
    }
    if (state.boneMap.rightForeArm && isFinitePoint(re) && isFinitePoint(rw)) {
      const a = angle2D(re, rw)
      state.boneMap.rightForeArm.rotation.z = -(a - bodyRoll)
    }
  }

  state.lastTransform = t
}

export function renderThree(state) {
  if (!state?.renderer || !state?.scene || !state?.camera) return
  state.renderer.render(state.scene, state.camera)
}

export function disposeThree(state) {
  try {
    state?.renderer?.dispose?.()
  } catch {
    // ignore
  }
}

export function isModelSource(src) {
  const s = String(src || '').toLowerCase()
  return s.includes('.glb') || s.includes('.gltf')
}
