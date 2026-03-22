/**
 * AREngine.js
 * Ties together tracker + physics + renderer into one RAF loop.
 */
import { PoseTracker } from "./PoseTracker";
import { FaceTracker } from "./FaceTracker";
import { ClothingPhysics } from "./ClothingPhysics";
import { CanvasRenderer } from "./CanvasRenderer";
import { PRODUCT_AR_MODES } from "./arConfig";

export class AREngine {
  constructor({ video, canvas, product, onFps, onStatus }) {
    this.video = video;
    this.canvas = canvas;
    this.product = product;
    this.onFps = onFps;
    this.onStatus = onStatus;
    this.mode = PRODUCT_AR_MODES[(product?.category || "").toLowerCase()] || "body";
    this.mirror = true;
    this._raf = null;
    this._running = false;
    this._fN = 0;
    this._fT = performance.now();
  }

  async init() {
    this.onStatus?.("Starting camera…");
    this._syncSize();
    window.addEventListener("resize", () => this._syncSize());

    this.renderer = new CanvasRenderer(this.product);

    if (this.mode === "body") {
      this.tracker = new PoseTracker();
      if (this.mode === "body") {
        const cat = (this.product?.category || "").toLowerCase();
        if (cat !== "watch") {
          this.physics = new ClothingPhysics();
        }
      }
    } else {
      this.tracker = new FaceTracker();
    }

    await this.tracker.load((msg) => this.onStatus?.(msg));
    this.onStatus?.("AR ready!");
  }

  start() {
    this._running = true;
    this._loop();
  }

  destroy() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    try {
      this.tracker?.destroy();
    } catch (_) {}
    window.removeEventListener("resize", () => this._syncSize());
  }

  setMirror(v) {
    this.mirror = v;
  }
  setShowSkeleton(v) {
    this.renderer?.setShowSkeleton(v);
  }

  // ── loop ────────────────────────────────────────────────────────────────────
  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(async () => {
      await this._frame();
      this._fps();
      this._loop();
    });
  }

  async _frame() {
    const vid = this.video;
    if (!vid || vid.readyState < 2) return;
    const { width: W, height: H } = this.canvas;
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // Draw mirrored video
    ctx.save();
    if (this.mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(vid, 0, 0, W, H);
    ctx.restore();

    // Detect
    const raw = await this.tracker.detect(vid);
    if (!raw) return;

    // Pass mirror state downstream (renderer/physics need consistent L/R).
    raw.__mirror = this.mirror;

    // Normalize L/R landmark indices so "left" means left-most on the displayed canvas.
    // (MediaPipe LEFT_* is anatomical-left; in mirrored selfie view it can appear swapped.)
    const normalizePoseLR = (poseLandmarks) => {
      if (!poseLandmarks || poseLandmarks.length < 29) return poseLandmarks;
      const lm = poseLandmarks.slice();
      const mx = (i) => (this.mirror ? 1 - (lm[i]?.x ?? 0) : (lm[i]?.x ?? 0));
      const has = (a, b) => Boolean(lm[a] && lm[b]);
      const pickSwap = (...pairs) => {
        for (const [a, b] of pairs) {
          if (has(a, b)) return mx(a) > mx(b);
        }
        return false;
      };
      const shouldSwap = pickSwap([11, 12], [23, 24], [15, 16], [27, 28], [25, 26]);
      if (!shouldSwap) return poseLandmarks;
      const swap = (a, b) => {
        const t = lm[a];
        lm[a] = lm[b];
        lm[b] = t;
      };
      swap(11, 12);
      swap(13, 14);
      swap(15, 16);
      swap(23, 24);
      swap(25, 26);
      swap(27, 28);
      return lm;
    };

    if (raw.poseLandmarks) {
      raw.poseLandmarks = normalizePoseLR(raw.poseLandmarks);
    }

    // Physics for body
    if (this.physics) {
      const lm = raw.poseLandmarks;
      if (lm) this.physics.update(lm, W, H);
      raw.physics = this.physics.getState();
    }

    // Render overlay
    ctx.save();
    if (this.mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    this.renderer.render(ctx, raw, W, H);
    ctx.restore();
  }

  _syncSize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
    }
  }

  _fps() {
    this._fN++;
    const now = performance.now();
    if (now - this._fT >= 1000) {
      this.onFps?.(Math.round((this._fN * 1000) / (now - this._fT)));
      this._fN = 0;
      this._fT = now;
    }
  }
}
