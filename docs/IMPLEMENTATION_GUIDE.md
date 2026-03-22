# AR Try-On Upgrade — Complete Implementation Guide
# Hand this file (along with the code files) to GitHub Copilot in VS Code

---

## What's in this upgrade

```
frontend/src/components/ar/ARTryOnAdvanced.jsx        ← updated in-place
frontend/src/utils/ar/ClothingPhysics.js             ← existing engine (already sleeve-aware)
frontend/src/utils/ar/bodyMeasurements.js            ← NEW — keypoints + measurements utilities
frontend/src/utils/ar/cameraUtils.js                 ← NEW — always opens front/user-facing camera
```

---

## Fix 1 — Body keypoints + measurements

`bodyMeasurements.js` exports:

| Function | What it does |
|---|---|
| `extractKeypoints()` | Converts raw Pose landmarks → named `{x,y,visibility}` points (mirror-aware) |
| `computeMeasurements()` | Returns `px` and `cm` measurements (cm optional) |
| `saveMeasurements()` | Writes to `localStorage['vivmart_body_measurements']` and `localStorage['vivmart_pose_snapshot']` |
| `hasTrackingJumped()` | Detects sudden torso-center jumps |
| `computeShirtTransform()` | Convenience transform helper |

In `ARTryOnAdvanced.jsx`, pose landmarks are processed each frame and stored periodically via `saveMeasurements()`.

---

## Fix 2 — Natural arm bending

Sleeve-following is implemented in the existing cloth mesh physics (driven by elbow/wrist landmarks). The try-on uses deformable mesh warping (`triWarp`) so fabric moves with arms instead of staying rigid.

---

## Fix 3 — Always front/laptop camera

`cameraUtils.js` exports `openFrontCamera()` which:

1) Enumerates video devices and prefers labels matching `front|user|webcam|integrated|facetime|built-in`
2) Requests `facingMode: { ideal: 'user' }`
3) Falls back to any camera if needed

`ARTryOnAdvanced.jsx` now uses `openFrontCamera()` + `attachStreamToVideo()`.

---

## LocalStorage schema

### `vivmart_body_measurements`

```
{
  "timestamp": 1710000000000,
  "measurements": {
    "px": {
      "shoulderWidth": 312.4,
      "chestWidth": 281.2,
      "hipWidth": 290.1,
      "torsoHeight": 420.8,
      "leftSleeve": 380.5,
      "rightSleeve": 377.2
    },
    "cm": {
      "shoulderWidth": null,
      "chestWidth": null,
      "hipWidth": null,
      "torsoHeight": null,
      "leftSleeve": null,
      "rightSleeve": null
    }
  }
}
```

### `vivmart_pose_snapshot`

```
{
  "timestamp": 1710000000000,
  "keypoints": {
    "leftShoulder": {"x":320,"y":210,"visibility":0.98},
    "rightShoulder":{"x":560,"y":215,"visibility":0.97},
    "leftHip":      {"x":335,"y":480,"visibility":0.95},
    "rightHip":     {"x":545,"y":482,"visibility":0.95}
  }
}
```
