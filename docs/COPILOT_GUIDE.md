# Skeleton Fitting — Copilot Integration Guide

This repo now supports a **product skeleton → body skeleton** fitting pipeline for AR try-on.

## Files added/updated

Frontend:
- `frontend/src/components/ar/ARTryOnAdvanced.jsx` (updated): clothes mode now prefers skeleton-fit warp.
- `frontend/src/utils/ar/productSkeleton.js` (new): per-product keypoints (normalized 0..1).
- `frontend/src/utils/ar/skeletonFitter.js` (new): piecewise affine warp engine.
- `frontend/src/utils/ar/removeProductBackground.js` (new): optional heuristic background removal.
- `frontend/src/utils/ar/bodyMeasurements.js` (updated): adds `centerTop` + `centerBottom` keypoints.
- `frontend/src/utils/ar/SkeletonAnnotator.html` (new): offline tool to annotate product keypoints.

## How fitting works

- MediaPipe Pose gives a **body skeleton** each frame: shoulders, elbows, wrists, hips, neck, etc.
- Each product overlay image has a **product skeleton** (same point names) defined in normalized image coordinates.
- The engine matches named points (e.g. `leftShoulder` ↔ `leftShoulder`) and performs **piecewise affine warp**:
  - the product image is triangulated
  - each triangle is warped independently into the target body triangle
  - sleeves follow elbows/wrists naturally when the user moves

## Most important step: annotate product images

1. Open `frontend/src/utils/ar/SkeletonAnnotator.html` directly in a browser (double-click).
2. Drop your product image.
3. Click each keypoint name, then click on the image to place it.
4. Click **Copy JS**.
5. Paste the output into `frontend/src/utils/ar/productSkeleton.js` under `PRODUCT_SKELETONS`.

Tip: If your product overlay URL is a full URL (e.g. `http://.../uploads/shirt.png`), add an entry keyed by either the full URL or the pathname (`/uploads/shirt.png`).

## Debugging

In the AR view (Clothes Try-On mode), enable:
- **Body skeleton**: confirms Pose is tracking shoulders/elbows/hips.
- **Product mesh**: shows the triangulation mesh so you can see if the product skeleton is mis-annotated.

Common symptoms:
- Shirt wrong size/misaligned → re-annotate keypoints in the annotator.
- Shirt not visible → ensure at least 3 body keypoints are visible; check console for image load/CORS issues.
- Left/right swapped → ensure you’re using mirrored keypoints (the component uses `mirrorX: true`).

## CORS note (important)

If `tshirtSrc` is served from a different domain without CORS headers, pixel operations (background removal) may fail.
The code automatically falls back to loading the original image, but for best results configure:
- `Access-Control-Allow-Origin: *` on the image server, or
- proxy the image via your backend.
