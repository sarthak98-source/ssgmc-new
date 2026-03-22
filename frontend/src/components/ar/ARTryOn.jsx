/**
 * ARTryOn.jsx  v3  —  Fixed: correct orientation, mirror sync, proper body fit
 *
 * ROOT CAUSE OF v2 BUG:
 *   The video element was mirrored via CSS (scaleX(-1)).
 *   MediaPipe receives the RAW (un-mirrored) video frame.
 *   So landmark x=0.1 (left side in MediaPipe) was actually on the
 *   RIGHT side of the mirrored video the user sees.
 *
 * FIX:
 *   - Video element has NO css transform (not mirrored).
 *   - We draw the video onto canvas ourselves, applying mirror there.
 *   - When mirror=true we flip the canvas context before drawing video,
 *     AND we flip landmark X coordinates (x → 1-x) so they match.
 *   - The garment is then drawn AFTER restoring context, in screen-space
 *     coordinates that already account for the mirror flip.
 *   - NO rotation transform is applied to the garment image itself — only
 *     position + scale. Body tilt is handled by measuring the actual
 *     pixel distance between landmarks.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";

// ── MediaPipe CDN ─────────────────────────────────────────────────────────────
const MP_POSE_JS = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js";
const MP_POSE_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/";
const MP_FACE_JS =
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js";
const MP_FACE_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/";

// ── Pose landmark indices ─────────────────────────────────────────────────────
const P = {
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
};

// ── FaceMesh landmark indices ─────────────────────────────────────────────────
const F = {
  L_EYE: 33,
  R_EYE: 263,
  L_EAR: 234,
  R_EAR: 454,
  BROW: 10,
  CHIN: 175,
};

// ── Categories ────────────────────────────────────────────────────────────────
const FACE_CATS = new Set([
  "glasses",
  "sunglasses",
  "eyewear",
  "hat",
  "cap",
  "earrings",
  "necklace",
  "jewelry",
  "ring",
]);

// ── Script loader (idempotent) ────────────────────────────────────────────────
const _scripts = {};
function loadScript(src) {
  if (_scripts[src]) return _scripts[src];
  _scripts[src] = new Promise((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const el = document.createElement("script");
    el.src = src;
    el.crossOrigin = "anonymous";
    el.onload = ok;
    el.onerror = fail;
    document.head.appendChild(el);
  });
  return _scripts[src];
}

// ── Dual-stage smoothing (position + velocity damping) ──────────────────────
// More stable than a single EWMA and greatly reduces shirt jitter.
function dualSmooth(state, next) {
  if (!state || !state.pos || !state.vel) {
    return {
      pos: next.map((l) => ({ ...l })),
      vel: next.map(() => ({ x: 0, y: 0 })),
    };
  }

  const ALPHA_P = 0.35; // lower = more stable position
  const ALPHA_V = 0.25; // lower = more damping

  const pos = next.map((lm, i) => {
    const prev = state.pos[i] || lm;
    const prevVel = state.vel[i] || { x: 0, y: 0 };
    const vx = lm.x - prev.x;
    const vy = lm.y - prev.y;
    const svx = prevVel.x * (1 - ALPHA_V) + vx * ALPHA_V;
    const svy = prevVel.y * (1 - ALPHA_V) + vy * ALPHA_V;
    return {
      x: prev.x * (1 - ALPHA_P) + (prev.x + svx) * ALPHA_P,
      y: prev.y * (1 - ALPHA_P) + (prev.y + svy) * ALPHA_P,
      z: lm.z || 0,
      visibility: lm.visibility,
    };
  });

  const vel = next.map((lm, i) => {
    const prev = state.pos[i] || lm;
    const prevVel = state.vel[i] || { x: 0, y: 0 };
    return {
      x: (lm.x - prev.x) * ALPHA_V + prevVel.x * (1 - ALPHA_V),
      y: (lm.y - prev.y) * ALPHA_V + prevVel.y * (1 - ALPHA_V),
    };
  });

  return { pos, vel };
}

// ── Affine texture warp triangle ────────────────────────────────────────────
function drawTexTri(ctx, img, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2) {
  const d = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
  if (Math.abs(d) < 0.5) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();

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

// ── 4-corner quad warp (tessellated) ────────────────────────────────────────
function drawWarpedQuad(ctx, img, TL, TR, BL, BR, COLS = 8, ROWS = 10) {
  if (!img?.complete || !img.naturalWidth) return;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const u0 = (col / COLS) * iw;
      const v0 = (row / ROWS) * ih;
      const u1 = ((col + 1) / COLS) * iw;
      const v1 = v0;
      const u2 = u0;
      const v2 = ((row + 1) / ROWS) * ih;
      const u3 = u1;
      const v3 = v2;

      const s0 = col / COLS;
      const s1 = (col + 1) / COLS;
      const t0 = row / ROWS;
      const t1 = (row + 1) / ROWS;

      const blerp = (s, t) => ({
        x: TL.x * (1 - s) * (1 - t) + TR.x * s * (1 - t) + BL.x * (1 - s) * t + BR.x * s * t,
        y: TL.y * (1 - s) * (1 - t) + TR.y * s * (1 - t) + BL.y * (1 - s) * t + BR.y * s * t,
      });

      const p00 = blerp(s0, t0);
      const p10 = blerp(s1, t0);
      const p01 = blerp(s0, t1);
      const p11 = blerp(s1, t1);

      drawTexTri(ctx, img, p00.x, p00.y, u0, v0, p10.x, p10.y, u1, v1, p01.x, p01.y, u2, v2);
      drawTexTri(ctx, img, p10.x, p10.y, u1, v1, p11.x, p11.y, u3, v3, p01.x, p01.y, u2, v2);
    }
  }
}

function drawPlaceholderQuad(ctx, TL, TR, BL, BR, cat, color) {
  ctx.save();
  ctx.globalAlpha = 0.72;
  const cx = (TL.x + TR.x + BL.x + BR.x) / 4;
  const cy = (TL.y + TR.y + BL.y + BR.y) / 4;
  const grad = ctx.createRadialGradient(
    cx,
    cy * 0.7,
    0,
    cx,
    cy,
    Math.hypot(TR.x - TL.x, TR.y - TL.y)
  );
  grad.addColorStop(0, `${color}ff`);
  grad.addColorStop(1, `${color}88`);
  ctx.fillStyle = grad;

  if (cat === "pants" || cat === "trousers") {
    const mx = (BL.x + BR.x) / 2;
    ctx.beginPath();
    ctx.moveTo(TL.x, TL.y);
    ctx.lineTo(TR.x, TR.y);
    ctx.lineTo(mx + (BR.x - BL.x) * 0.1, BR.y);
    ctx.lineTo(mx, (BL.y + BR.y) / 2);
    ctx.lineTo(mx - (BR.x - BL.x) * 0.1, BL.y);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(TL.x, TL.y);
    ctx.lineTo(TR.x, TR.y);
    ctx.lineTo(BR.x, BR.y);
    ctx.lineTo(BL.x, BL.y);
    ctx.closePath();
    ctx.fill();

    const neckMX = (TL.x + TR.x) / 2;
    const neckMY = (TL.y + TR.y) / 2;
    const nw = Math.hypot(TR.x - TL.x, TR.y - TL.y) * 0.12;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(neckMX - nw, neckMY);
    ctx.quadraticCurveTo(neckMX, neckMY + nw * 1.2, neckMX + nw, neckMY);
    ctx.stroke();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ARTryOn({ product, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const ar = useRef({
    running: false,
    raf: null,
    tracker: null,
    poseRes: null,
    faceRes: null,
    overlayImg: null,
    smoothState: null,
    mirror: true,
    showSkel: false,
    mode: "body",
  });

  const [phase, setPhase] = useState("permission");
  const [status, setStatus] = useState("");
  const [fps, setFps] = useState(0);
  const [mirror, setMirror] = useState(true);
  const [showSkel, setSkel] = useState(false);
  const [snap, setSnap] = useState(null);

  const cat = (product?.category || "clothing").toLowerCase();
  const mode = FACE_CATS.has(cat) ? "face" : "body";

  useEffect(() => {
    ar.current.mirror = mirror;
  }, [mirror]);
  useEffect(() => {
    ar.current.showSkel = showSkel;
  }, [showSkel]);

  useEffect(
    () => () => {
      ar.current.running = false;
      if (ar.current.raf) cancelAnimationFrame(ar.current.raf);
      try {
        ar.current.tracker?.close?.();
      } catch (_) {}
      videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  function getCameraErrorMessage(err) {
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "[::1]");

    // `isSecureContext` is the most reliable signal across browsers.
    if (typeof window !== "undefined" && !window.isSecureContext && !isLocalhost) {
      return "Camera requires a secure origin. Open the site over HTTPS (or use http://localhost on this PC). If you opened via a LAN IP like 192.168.x.x, use HTTPS.";
    }

    switch (err?.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Camera permission denied. Allow camera access in the browser site settings and retry.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No camera device found.";
      case "NotReadableError":
      case "TrackStartError":
        return "Camera is busy or unavailable (another app may be using it). Close other apps using the camera and retry.";
      case "OverconstrainedError":
        return "Camera does not support the requested resolution. Try again.";
      default:
        return err?.message || "Could not access camera.";
    }
  }

  const start = useCallback(async () => {
    setPhase("loading");
    setStatus("Starting camera…");
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setStatus("Camera API not available in this browser/context.");
        setPhase("error");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      const vid = videoRef.current;
      vid.srcObject = stream;
      await new Promise((ok, fail) => {
        vid.onloadedmetadata = () => vid.play().then(ok).catch(fail);
      });

      setStatus("Processing product image…");
      await loadOverlay(product);

      if (mode === "face") {
        setStatus("Loading FaceMesh…");
        await loadScript(MP_FACE_JS);
        await initFace();
      } else {
        setStatus("Loading Pose model…");
        await loadScript(MP_POSE_JS);
        await initPose();
      }

      setPhase("ready");
      ar.current.running = true;
      loop();
    } catch (err) {
      setStatus(getCameraErrorMessage(err));
      setPhase("error");
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }, [mode, product]);

  async function loadOverlay(productArg) {
    const src =
      productArg?.overlayImage ||
      productArg?.ar_overlay ||
      productArg?.imageUrl ||
      productArg?.image_url ||
      productArg?.image;
    if (!src) return;
    await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        ar.current.overlayImg = img;
        resolve();
      };
      img.onerror = resolve;
      img.src = src;
    });
  }

  async function initPose() {
    setStatus("Initialising Pose…");
    const pose = new window.Pose({
      locateFile: (f) => `${MP_POSE_WASM}${f}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
    pose.onResults((r) => {
      if (r.poseLandmarks) {
        ar.current.smoothState = dualSmooth(ar.current.smoothState, r.poseLandmarks);
        ar.current.poseRes = { ...r, poseLandmarks: ar.current.smoothState.pos };
      }
    });
    await pose.initialize();
    ar.current.tracker = pose;
    ar.current.mode = "body";
    setStatus("Pose ready ✓");
  }

  async function initFace() {
    setStatus("Initialising FaceMesh…");
    const fm = new window.FaceMesh({
      locateFile: (f) => `${MP_FACE_WASM}${f}`,
    });
    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
    fm.onResults((r) => {
      ar.current.faceRes = r;
    });
    await fm.initialize();
    ar.current.tracker = fm;
    ar.current.mode = "face";
    setStatus("FaceMesh ready ✓");
  }

  const fpsRef = useRef({ n: 0, t: performance.now() });
  const sendingRef = useRef(false);

  function loop() {
    if (!ar.current.running) return;
    ar.current.raf = requestAnimationFrame(loop);
    drawFrame();

    if (!sendingRef.current) {
      sendingRef.current = true;
      ar.current.tracker
        ?.send({ image: videoRef.current })
        .catch(() => {})
        .finally(() => {
          sendingRef.current = false;
        });
    }

    const fc = fpsRef.current;
    fc.n++;
    const now = performance.now();
    if (now - fc.t >= 1000) {
      setFps(Math.round((fc.n * 1000) / (now - fc.t)));
      fc.n = 0;
      fc.t = now;
    }
  }

  function drawFrame() {
    const cvs = canvasRef.current;
    const vid = videoRef.current;
    if (!cvs || !vid || vid.readyState < 2) return;

    const rect = cvs.parentElement.getBoundingClientRect();
    const dpr = 1;
    const W = Math.round(rect.width * dpr);
    const H = Math.round(rect.height * dpr);
    if (cvs.width !== W || cvs.height !== H) {
      cvs.width = W;
      cvs.height = H;
    }

    const ctx = cvs.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const { mirror, showSkel, mode: m, poseRes, faceRes, overlayImg } = ar.current;

    // 1) draw video
    ctx.save();
    if (mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(vid, 0, 0, W, H);
    ctx.restore();

    // 2) landmark conversion into screen pixels
    const lmToScreen = (lm) => ({
      x: mirror ? (1 - lm.x) * W : lm.x * W,
      y: lm.y * H,
      v: lm.visibility ?? 1,
    });

    // 3) overlays
    const normalizeLR = (lmArr) => {
      // Ensure left/right indices match what the user SEE on the mirrored canvas.
      // After `lmToScreen`, X is already mirror-adjusted, so left-most must be `L_*`.
      const ls = lmArr[P.L_SHOULDER];
      const rs = lmArr[P.R_SHOULDER];
      const pickSwap = (...pairs) => {
        for (const [l, r] of pairs) {
          const lp = lmArr[l];
          const rp = lmArr[r];
          if (lp && rp) return lp.x > rp.x;
        }
        return false;
      };

      const shouldSwap = pickSwap(
        [P.L_SHOULDER, P.R_SHOULDER],
        [P.L_HIP, P.R_HIP],
        [P.L_WRIST, P.R_WRIST],
        [P.L_ANKLE, P.R_ANKLE],
        [P.L_KNEE, P.R_KNEE]
      );

      if (!shouldSwap) return lmArr;
      const swap = (a, b) => {
        const t = lmArr[a];
        lmArr[a] = lmArr[b];
        lmArr[b] = t;
      };
      swap(P.L_SHOULDER, P.R_SHOULDER);
      swap(P.L_ELBOW, P.R_ELBOW);
      swap(P.L_WRIST, P.R_WRIST);
      swap(P.L_HIP, P.R_HIP);
      swap(P.L_KNEE, P.R_KNEE);
      swap(P.L_ANKLE, P.R_ANKLE);
      return lmArr;
    };

    if (m === "body" && poseRes?.poseLandmarks) {
      const lm = normalizeLR(poseRes.poseLandmarks.map(lmToScreen));
      if (showSkel) drawSkeleton(ctx, lm);
      drawGarment(ctx, lm, W, H, overlayImg, cat, product);
    }
    if (m === "face" && faceRes?.multiFaceLandmarks?.[0]) {
      const lm = faceRes.multiFaceLandmarks[0].map(lmToScreen);
      if (showSkel) drawFaceDots(ctx, lm);
      drawFaceItem(ctx, lm, W, H, overlayImg, cat);
    }
  }

  function takeSnap() {
    const url = canvasRef.current?.toDataURL("image/png");
    if (url) setSnap(url);
  }

  return (
    <div style={S.root}>
      <div style={S.backdrop} onClick={onClose} />
      <div style={S.modal}>
        <div style={S.hdr}>
          <div style={S.hdrL}>
            <span style={S.badge}>AR TRY-ON</span>
            <span style={S.pname}>{product?.name || "Product"}</span>
            <span style={S.modeTag}>{mode === "face" ? "👁 Face" : "🧍 Body"}</span>
          </div>
          <button style={S.xBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={S.viewport}>
          <video ref={videoRef} style={S.hiddenVid} playsInline muted />
          <canvas ref={canvasRef} style={S.canvas} />
          {phase === "ready" && <div style={S.fps}>{fps} FPS</div>}
          {phase === "ready" && <div style={S.hint}>Stand 1–2 m away · Full torso visible</div>}
        </div>

        {phase === "permission" && (
          <div style={S.screen}>
            <div style={S.card}>
              <div style={{ fontSize: 54, lineHeight: 1 }}>📷</div>
              <h3 style={S.cardTitle}>Camera Access Needed</h3>
              <p style={S.cardDesc}>
                Your video is processed locally.<br />Nothing leaves your device.
              </p>
              <button style={S.primaryBtn} onClick={start}>
                Enable Camera
              </button>
              <button style={S.ghostBtn} onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div style={S.screen}>
            <div style={S.spinner} />
            <p style={S.loadMsg}>{status}</p>
          </div>
        )}

        {phase === "error" && (
          <div style={S.screen}>
            <p style={{ color: "#f87171", fontSize: 13, textAlign: "center", maxWidth: 300 }}>⚠ {status}</p>
            <button style={S.primaryBtn} onClick={start}>
              Retry
            </button>
            <button style={S.ghostBtn} onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {snap && (
          <div style={S.screen}>
            <img
              src={snap}
              alt="snap"
              style={{ maxWidth: "84%", maxHeight: "72%", borderRadius: 12, boxShadow: "0 8px 40px #000c" }}
            />
            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              <button
                style={S.primaryBtn}
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = snap;
                  a.download = `ar-${(product?.name || "tryon").replace(/\s+/g, "-")}.png`;
                  a.click();
                  setSnap(null);
                }}
              >
                ⬇ Save Photo
              </button>
              <button style={S.ghostBtn} onClick={() => setSnap(null)}>
                ✕ Dismiss
              </button>
            </div>
          </div>
        )}

        {phase === "ready" && !snap && (
          <div style={S.ctrlBar}>
            <Btn active={mirror} onClick={() => setMirror((m) => !m)}>
              ⟷ Mirror
            </Btn>
            <Btn active={showSkel} onClick={() => setSkel((s) => !s)}>
              🦴 Skeleton
            </Btn>
            <button style={S.snapBtn} onClick={takeSnap}>
              📸 Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Btn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ ...S.ctrlBtn, ...(active ? S.ctrlOn : {}) }}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  GARMENT RENDERER
//  lm[] is already in SCREEN pixels (mirror-adjusted)
// ─────────────────────────────────────────────────────────────────────────────
function drawGarment(ctx, lm, W, H, img, cat, product) {
  if (cat === "watch") {
    const lw = lm[P.L_WRIST],
      le = lm[P.L_ELBOW];
    if (lw && le) drawWatch(ctx, lw, le, img, W, H);
    return;
  }

  const ls = lm[P.L_SHOULDER],
    rs = lm[P.R_SHOULDER];
  if (!ls || !rs) return;

  // Shoulder span is our ruler for the entire fit.
  const shoulSpan = Math.hypot(rs.x - ls.x, rs.y - ls.y);
  if (!shoulSpan || shoulSpan < 20) return;

  const shoulMidX = (ls.x + rs.x) / 2;
  const shoulMidY = (ls.y + rs.y) / 2;

  // ── Hip position ─────────────────────────────────────────────────────────
  // Use detected hips if visible; otherwise estimate them directly BELOW shoulders.
  const lh = lm[P.L_HIP];
  const rh = lm[P.R_HIP];
  const hipVisible = lh?.v > 0.3 && rh?.v > 0.3;

  let lhX, lhY, rhX, rhY;
  if (hipVisible) {
    lhX = lh.x;
    lhY = lh.y;
    rhX = rh.x;
    rhY = rh.y;
  } else {
    // Reliable human proportion: hips are ~1.45× shoulder span below shoulders.
    lhX = ls.x;
    lhY = ls.y + shoulSpan * 1.45;
    rhX = rs.x;
    rhY = rs.y + shoulSpan * 1.45;
  }

  // ── Category sizing (v5) ────────────────────────────────────────────────
  const SIZE =
    {
      shirt: { side: 0.32, top: 0.22, bot: 0.08 },
      tshirt: { side: 0.3, top: 0.2, bot: 0.05 },
      top: { side: 0.28, top: 0.18, bot: 0.02 },
      clothing: { side: 0.32, top: 0.22, bot: 0.08 },
      jacket: { side: 0.42, top: 0.26, bot: 0.1 },
      hoodie: { side: 0.38, top: 0.24, bot: 0.12 },
      coat: { side: 0.38, top: 0.24, bot: 1.1 },
      dress: { side: 0.32, top: 0.22, bot: 1.2 },
      kurta: { side: 0.32, top: 0.22, bot: 0.9 },
      pants: { side: 0.28, top: 0.0, bot: 0.1, hips: true },
      trousers: { side: 0.28, top: 0.0, bot: 0.1, hips: true },
    }[cat] || { side: 0.32, top: 0.22, bot: 0.08 };

  const sidePad = shoulSpan * SIZE.side;

  // Torso length used for bottom extension
  const hipMidX = (lhX + rhX) / 2;
  const hipMidY = (lhY + rhY) / 2;
  const torsoLen = Math.hypot(hipMidX - shoulMidX, hipMidY - shoulMidY) || shoulSpan;
  const bottomY = hipMidY + torsoLen * SIZE.bot;

  // Body tilt
  const tiltAngle = Math.atan2(rs.y - ls.y, rs.x - ls.x);
  const perpX = -(rs.y - ls.y) / shoulSpan;
  const perpY = (rs.x - ls.x) / shoulSpan;

  let TL, TR, BL, BR;

  if (SIZE.hips) {
    // Pants: top at hips, bottom at ankles
    const lAnk = lm[P.L_ANKLE];
    const rAnk = lm[P.R_ANKLE];
    const ankleY = lAnk?.v > 0.3 && rAnk?.v > 0.3 ? Math.max(lAnk.y, rAnk.y) : hipMidY + shoulSpan * 1.8;
    TL = { x: lhX - sidePad, y: lhY };
    TR = { x: rhX + sidePad, y: rhY };
    BL = { x: lhX - sidePad * 0.6, y: ankleY };
    BR = { x: rhX + sidePad * 0.6, y: ankleY };
  } else {
    // Upper body: top follows shoulder tilt; collar lift along perpendicular
    const collarLift = shoulSpan * SIZE.top;

    TL = {
      x: ls.x - sidePad * Math.cos(tiltAngle) + perpX * collarLift,
      y: ls.y - sidePad * Math.sin(tiltAngle) + perpY * collarLift,
    };
    TR = {
      x: rs.x + sidePad * Math.cos(tiltAngle) + perpX * collarLift,
      y: rs.y + sidePad * Math.sin(tiltAngle) + perpY * collarLift,
    };

    // Bottom at/below hips with slight taper
    BL = { x: lhX - sidePad * 0.55, y: bottomY };
    BR = { x: rhX + sidePad * 0.55, y: bottomY };
  }

  ctx.save();
  ctx.globalAlpha = 0.94;
  if (img?.complete && img.naturalWidth > 0) {
    drawWarpedQuad(ctx, img, TL, TR, BL, BR, 10, 12);
  } else {
    drawPlaceholderQuad(ctx, TL, TR, BL, BR, cat, product?.color || "#6366f1");
  }
  ctx.restore();
}

function drawWatch(ctx, wrist, elbow, img, W, H) {
  const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
  const size = Math.hypot(W, H) * 0.065;
  ctx.save();
  ctx.translate(wrist.x, wrist.y);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.94;
  if (img?.complete && img.naturalWidth) {
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-size * 0.55, -size * 1.3, size * 1.1, size * 0.5);
    ctx.fillRect(-size * 0.55, size * 0.8, size * 1.1, size * 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = "#334155";
    ctx.fill();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.74, 0, Math.PI * 2);
    ctx.fillStyle = "#f8fafc";
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -size * 0.48);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size * 0.33, 0);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFaceItem(ctx, lm, W, H, img, cat) {
  switch (cat) {
    case "glasses":
    case "sunglasses":
    case "eyewear":
      faceGlasses(ctx, lm, W, H, img, cat);
      break;
    case "hat":
    case "cap":
      faceHat(ctx, lm, W, H, img);
      break;
    case "earrings":
      faceEarrings(ctx, lm, W, H, img);
      break;
    case "necklace":
    case "jewelry":
      faceNecklace(ctx, lm, W, H, img);
      break;
    case "ring":
      faceRing(ctx, lm, W, H, img);
      break;
    default:
      faceGlasses(ctx, lm, W, H, img, cat);
  }
}

function faceGlasses(ctx, lm, W, H, img, cat) {
  const lE = lm[F.L_EYE],
    rE = lm[F.R_EYE];
  if (!lE || !rE) return;
  const span = Math.hypot(rE.x - lE.x, rE.y - lE.y);
  const cx = (lE.x + rE.x) / 2,
    cy = (lE.y + rE.y) / 2;
  const iw = span * 1.36,
    ih = iw * 0.41;
  const angle = Math.atan2(rE.y - lE.y, rE.x - lE.x);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.95;
  if (img?.complete && img.naturalWidth) {
    ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  } else {
    const lw = iw * 0.38,
      bw = iw * 0.09;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.fillStyle = cat === "sunglasses" ? "rgba(0,0,0,0.62)" : "rgba(120,180,255,0.22)";
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.ellipse(s * (lw / 2 + bw / 2), 0, lw / 2, ih / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(-bw / 2, 0);
    ctx.lineTo(bw / 2, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-lw - bw / 2, 0);
    ctx.lineTo(-lw - bw / 2 - iw * 0.18, 0);
    ctx.moveTo(lw + bw / 2, 0);
    ctx.lineTo(lw + bw / 2 + iw * 0.18, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function faceHat(ctx, lm, W, H, img) {
  const le = lm[F.L_EAR],
    re = lm[F.R_EAR],
    br = lm[F.BROW];
  if (!le || !re) return;
  const span = Math.hypot(re.x - le.x, re.y - le.y);
  const cx = (le.x + re.x) / 2,
    cy = br ? br.y - span * 0.05 : le.y - span * 0.5;
  const iw = span * 1.62,
    ih = iw * 0.78;
  const angle = Math.atan2(re.y - le.y, re.x - le.x);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.95;
  if (img?.complete && img.naturalWidth) {
    ctx.drawImage(img, -iw / 2, -ih, iw, ih);
  } else {
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.ellipse(0, 0, iw / 2, ih * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(-iw * 0.32, 0);
    ctx.lineTo(-iw * 0.27, -ih * 0.9);
    ctx.lineTo(iw * 0.27, -ih * 0.9);
    ctx.lineTo(iw * 0.32, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function faceEarrings(ctx, lm, W, H, img) {
  [F.L_EAR, F.R_EAR].forEach((idx) => {
    const ear = lm[idx];
    if (!ear) return;
    const headW = Math.abs((lm[F.L_EAR]?.x || 0) - (lm[F.R_EAR]?.x || 0));
    const ew = headW * 0.13,
      eh = ew * 2.6;
    ctx.save();
    ctx.translate(ear.x, ear.y + headW * 0.07);
    ctx.globalAlpha = 0.95;
    if (img?.complete && img.naturalWidth) {
      ctx.drawImage(img, -ew / 2, 0, ew, eh);
    } else {
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(0, ew * 0.3, ew * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d97706";
      ctx.beginPath();
      ctx.ellipse(0, eh * 0.56, ew * 0.2, eh * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function faceNecklace(ctx, lm, W, H, img) {
  const le = lm[F.L_EAR],
    re = lm[F.R_EAR];
  if (!le || !re) return;
  const headW = Math.abs(re.x - le.x);
  const cx = (le.x + re.x) / 2,
    cy = Math.max(le.y, re.y) + headW * 0.36;
  const iw = headW * 0.97,
    ih = iw * 0.43;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = 0.95;
  if (img?.complete && img.naturalWidth) {
    ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  } else {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -ih * 0.25, iw * 0.46, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = "#d97706";
    ctx.beginPath();
    ctx.arc(0, ih * 0.16, ih * 0.33, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function faceRing(ctx, lm, W, H, img) {
  const le = lm[F.L_EAR],
    re = lm[F.R_EAR];
  if (!le || !re) return;
  const hw = Math.abs(re.x - le.x);
  const cx = (le.x + re.x) / 2,
    cy = (le.y + re.y) / 2 + hw * 0.82,
    sz = hw * 0.14;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = 0.95;
  if (img?.complete && img.naturalWidth) {
    ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
  } else {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.fillStyle = "rgba(245,158,11,0.3)";
    ctx.beginPath();
    ctx.arc(0, 0, sz / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkeleton(ctx, lm) {
  const CONN = [
    [11, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [11, 23],
    [12, 24],
    [23, 24],
    [23, 25],
    [25, 27],
    [24, 26],
    [26, 28],
  ];
  ctx.save();
  ctx.strokeStyle = "rgba(99,102,241,0.75)";
  ctx.lineWidth = 2.5;
  for (const [a, b] of CONN) {
    if (!lm[a] || !lm[b]) continue;
    ctx.beginPath();
    ctx.moveTo(lm[a].x, lm[a].y);
    ctx.lineTo(lm[b].x, lm[b].y);
    ctx.stroke();
  }
  for (const p of lm) {
    if (!p || p.v < 0.4) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#818cf8";
    ctx.fill();
  }
  ctx.restore();
}

function drawFaceDots(ctx, lm) {
  ctx.save();
  ctx.fillStyle = "rgba(99,102,241,0.5)";
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const S = {
  root: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter',system-ui,sans-serif",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.90)",
    backdropFilter: "blur(14px)",
  },
  modal: {
    position: "relative",
    zIndex: 1,
    width: "min(940px,96vw)",
    background: "#0c0c10",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 20,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 40px 120px rgba(0,0,0,0.95)",
  },
  hdr: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "13px 20px",
    background: "#111116",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  hdrL: { display: "flex", alignItems: "center", gap: 10 },
  badge: {
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    padding: "3px 11px",
    borderRadius: 20,
  },
  pname: { color: "#e2e8f0", fontSize: 15, fontWeight: 500 },
  modeTag: {
    background: "rgba(99,102,241,0.14)",
    color: "#818cf8",
    fontSize: 10,
    padding: "3px 9px",
    borderRadius: 20,
  },
  xBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "none",
    color: "#9ca3af",
    width: 32,
    height: 32,
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
  },
  viewport: { position: "relative", width: "100%", aspectRatio: "16/9", background: "#000", overflow: "hidden" },
  hiddenVid: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0,
    pointerEvents: "none",
  },
  canvas: { position: "absolute", inset: 0, width: "100%", height: "100%" },
  fps: {
    position: "absolute",
    top: 10,
    right: 12,
    background: "rgba(0,0,0,0.55)",
    color: "#4ade80",
    fontSize: 11,
    fontFamily: "monospace",
    padding: "3px 8px",
    borderRadius: 6,
  },
  hint: {
    position: "absolute",
    bottom: 10,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(0,0,0,0.55)",
    color: "#94a3b8",
    fontSize: 11,
    padding: "4px 14px",
    borderRadius: 20,
    whiteSpace: "nowrap",
  },
  screen: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.84)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    zIndex: 20,
  },
  card: {
    background: "#18181f",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: "36px 44px",
    textAlign: "center",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
  },
  cardTitle: { color: "#f1f5f9", fontSize: 18, fontWeight: 700, margin: 0 },
  cardDesc: { color: "#94a3b8", fontSize: 13, lineHeight: 1.7, margin: 0 },
  primaryBtn: {
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color: "#fff",
    border: "none",
    width: "100%",
    padding: 13,
    borderRadius: 11,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  ghostBtn: {
    background: "transparent",
    color: "#64748b",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    marginTop: 2,
  },
  spinner: {
    width: 46,
    height: 46,
    border: "3px solid rgba(99,102,241,0.2)",
    borderTop: "3px solid #6366f1",
    borderRadius: "50%",
    animation: "_sp .75s linear infinite",
  },
  loadMsg: { color: "#94a3b8", fontSize: 13, maxWidth: 280, textAlign: "center" },
  ctrlBar: {
    display: "flex",
    gap: 8,
    padding: "11px 18px",
    background: "#0a0a0d",
    borderTop: "1px solid rgba(255,255,255,0.055)",
    justifyContent: "center",
  },
  ctrlBtn: {
    background: "rgba(255,255,255,0.055)",
    color: "#9ca3af",
    border: "1px solid rgba(255,255,255,0.07)",
    padding: "8px 18px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
  ctrlOn: {
    background: "rgba(99,102,241,0.18)",
    color: "#818cf8",
    borderColor: "rgba(99,102,241,0.4)",
  },
  snapBtn: {
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color: "#fff",
    border: "none",
    padding: "8px 24px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
};

if (typeof document !== "undefined" && !document.getElementById("_arst3")) {
  const s = document.createElement("style");
  s.id = "_arst3";
  s.textContent = "@keyframes _sp{to{transform:rotate(360deg)}}";
  document.head.appendChild(s);
}
