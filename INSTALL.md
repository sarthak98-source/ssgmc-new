# AR Try-On v3 — FIXED: Correct Orientation + Body Fit (ssgmcefinal)
## Install / Update Guide

This guide is based on the attached `ar-v3/INSTALL.md`, adjusted for this repo’s actual paths on Windows.

---

## What was wrong in v2 (now fixed in v3)

### Root cause (upside-down / flipped overlay)
- v2 mirrored the `<video>` using CSS (`transform: scaleX(-1)`)
- MediaPipe received the raw (un-mirrored) video frame
- Landmarks were in raw video space, but the user saw a mirrored video
- So landmark positions didn’t match what the user saw

### v3 fix
- The video is hidden (no CSS transforms)
- The canvas draws the video frame and applies mirroring in the canvas context
- Landmark X coordinates are mirrored in code (`x_screen = (1 - x_norm) * W`)

---

## Files to replace

Copy BOTH files into this repo’s folder:

```
ssgmcefinal/frontend/src/components/ar/
├── ARTryOn.jsx       ← REPLACE with v3
└── ARTryOnButton.jsx ← (same as v2; safe to replace too)
```

Note: On Windows, filesystem casing is case-insensitive, so this repo uses `components/ar/` (lowercase), not `components/AR/`.

---

## Integration (already wired in this repo)

### Product Card
In this repo, the product card is:
- `frontend/src/components/ui/ProductCard.jsx`

Correct import for this repo:

```jsx
import ARTryOnButton from '../ar/ARTryOnButton';

<div className="relative">  {/* needs position: relative */}
    <img src={product.image_url} alt={product.name} />
    <ARTryOnButton product={product} variant="card" />
</div>
```

### Product Detail Page
```jsx
<ARTryOnButton product={product} variant="page" />
```

---

## Tips for best overlay results

1. Use a transparent PNG for overlays (best quality)
2. White/solid backgrounds are auto-removed (works, but less perfect)
3. The AR component prefers these fields (first found wins):
     - `product.overlayImage`
     - `product.ar_overlay`
     - `product.imageUrl` / `product.image_url` / `product.image`
4. User should stand 1–2 metres from the camera with full torso visible
