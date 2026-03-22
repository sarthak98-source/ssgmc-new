/**
 * CanvasRenderer.js
 * Draws all AR overlays: clothing (with physics warp), glasses, hat,
 * earrings, necklace, watch – all bone-driven with proper rotation.
 */
import { FL, BODY_CFG, FACE_CFG } from "./arConfig";

export class CanvasRenderer {
  constructor(product) {
    this.product = product;
    this.category = (product?.category || "clothing").toLowerCase();
    this.img = null;
    this.showSkel = false;
    this._loadImg(product);
  }

  _normalizePoseLm(lm, mirror = true) {
    if (!lm || lm.length < 29) return lm;
    const out = lm.slice();
    const mx = (i) => (mirror ? 1 - (out[i]?.x ?? 0) : (out[i]?.x ?? 0));
    const has = (a, b) => Boolean(out[a] && out[b]);
    const pickSwap = (...pairs) => {
      for (const [a, b] of pairs) {
        if (has(a, b)) return mx(a) > mx(b);
      }
      return false;
    };

    const shouldSwap = pickSwap([11, 12], [23, 24], [15, 16], [27, 28], [25, 26]);
    if (!shouldSwap) return lm;
    const swap = (a, b) => {
      const t = out[a];
      out[a] = out[b];
      out[b] = t;
    };
    swap(11, 12);
    swap(13, 14);
    swap(15, 16);
    swap(23, 24);
    swap(25, 26);
    swap(27, 28);
    return out;
  }

  // ── public entry point ────────────────────────────────────────────────────
  render(ctx, results, W, H) {
    if (!results) return;
    if (results.type === "pose") this._body(ctx, results, W, H);
    else this._face(ctx, results, W, H);
  }

  setShowSkeleton(v) {
    this.showSkel = v;
  }

  // ── body / clothing ───────────────────────────────────────────────────────
  _body(ctx, results, W, H) {
    const lmRaw = results.poseLandmarks;
    const lm = this._normalizePoseLm(lmRaw, results?.__mirror !== false);
    if (!lm) return;
    if (this.showSkel) this._skel(ctx, lm, W, H);

    const cat = this.category;

    if (cat === "watch") {
      const cfg = BODY_CFG.watch;
      this._watch(ctx, lm, cfg, W, H);
      return;
    }

    const cfg = BODY_CFG[cat] || BODY_CFG.clothing;
    const phy = results.physics;

    if (phy?.pts?.length) {
      this._clothMesh(ctx, phy, W, H);
    } else {
      this._clothSimple(ctx, lm, cfg, W, H);
    }
  }

  // ── cloth mesh (physics warp) ─────────────────────────────────────────────
  _clothMesh(ctx, { pts, cols, rows }, W, H) {
    if (!this.img?.complete || !this.img.naturalWidth) {
      this._wireframe(ctx, pts, cols, rows);
      return;
    }
    const iw = this.img.naturalWidth,
      ih = this.img.naturalHeight;
    const sw = iw / (cols - 1),
      sh = ih / (rows - 1);
    ctx.save();
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const i = r * cols + c;
        const p00 = pts[i],
          p10 = pts[i + 1];
        const p01 = pts[i + cols],
          p11 = pts[i + cols + 1];
        const u0 = c * sw,
          u1 = (c + 1) * sw,
          v0 = r * sh,
          v1 = (r + 1) * sh;
        this._tri(ctx, this.img, p00.x, p00.y, u0, v0, p10.x, p10.y, u1, v0, p01.x, p01.y, u0, v1);
        this._tri(ctx, this.img, p10.x, p10.y, u1, v0, p11.x, p11.y, u1, v1, p01.x, p01.y, u0, v1);
      }
    }
    ctx.restore();
  }

  _wireframe(ctx, pts, cols, rows) {
    ctx.save();
    ctx.strokeStyle = "rgba(99,102,241,0.45)";
    ctx.lineWidth = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = pts[r * cols + c];
        if (c < cols - 1) {
          const p2 = pts[r * cols + c + 1];
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        if (r < rows - 1) {
          const p2 = pts[(r + 1) * cols + c];
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ── cloth simple (no physics yet) ─────────────────────────────────────────
  _clothSimple(ctx, lm, cfg, W, H) {
    const [tL, tR] = cfg.top.map((i) => lm[i]);
    const [bL, bR] = cfg.bot.map((i) => lm[i] || { x: tL.x, y: tL.y + 0.42 });
    if (!tL || !tR) return;

    const sw = Math.abs(tL.x - tR.x) * W * cfg.wScale;
    const cx = ((tL.x + tR.x) / 2) * W;
    const ty = Math.min(tL.y, tR.y) * H + cfg.offY * H;
    const by = ((bL.y + bR.y) / 2) * H;
    const sh = (by - ty) * cfg.hScale;
    const angle = Math.atan2((tR.y - tL.y) * H, (tR.x - tL.x) * W);

    ctx.save();
    ctx.translate(cx, ty + sh / 2);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.92;

    if (this.img?.complete && this.img.naturalWidth) {
      ctx.drawImage(this.img, -sw / 2, -sh / 2, sw, sh);
    } else {
      this._garmentPlaceholder(ctx, sw, sh, cfg);
    }
    ctx.restore();
  }

  _garmentPlaceholder(ctx, w, h) {
    const c = this.product?.color || "#6366f1";
    ctx.fillStyle = c + "cc";
    const nw = w * 0.24;
    ctx.beginPath();
    ctx.moveTo(-nw / 2, -h / 2);
    ctx.lineTo(nw / 2, -h / 2);
    ctx.lineTo(w / 2 + w * 0.12, -h / 2 + h * 0.13);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2 - w * 0.12, -h / 2 + h * 0.13);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ── watch (wrist-anchored) ────────────────────────────────────────────────
  _watch(ctx, lm, cfg, W, H) {
    const wrist = lm[cfg.wrist],
      elbow = lm[cfg.elbow];
    if (!wrist) return;
    const wx = wrist.x * W,
      wy = wrist.y * H;
    const headW = Math.abs((lm[11]?.x || 0) - (lm[12]?.x || 0)) * W || W * 0.3;
    const size = headW * cfg.wScale * 2.2;
    const angle = elbow ? Math.atan2(wy - elbow.y * H, wx - elbow.x * W) : 0;

    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.95;
    if (this.img?.complete && this.img.naturalWidth) {
      ctx.drawImage(this.img, -size / 2, -size / 2, size, size);
    } else {
      this._watchPlaceholder(ctx, size);
    }
    ctx.restore();
  }

  _watchPlaceholder(ctx, sz) {
    const r = sz / 2;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-r * 0.6, -r * 1.45, r * 1.2, r * 0.62);
    ctx.fillRect(-r * 0.6, r * 0.83, r * 1.2, r * 0.62);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "#334155";
    ctx.fill();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
    ctx.fillStyle = "#f8fafc";
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r * 0.52);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.36, 0);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── face items ────────────────────────────────────────────────────────────
  _face(ctx, results, W, H) {
    const lm = results.multiFaceLandmarks?.[0];
    if (!lm) return;
    if (this.showSkel) this._facemesh(ctx, lm, W, H);

    const cat = this.category;
    const cfg = FACE_CFG[cat] || FACE_CFG.glasses;

    if (cfg.both) {
      // earrings – render at both ears
      this._renderFaceItem(ctx, lm, { ...cfg, singleLeft: true }, W, H);
      this._renderFaceItem(ctx, lm, { ...cfg, singleRight: true }, W, H);
    } else {
      this._renderFaceItem(ctx, lm, cfg, W, H);
    }
  }

  _renderFaceItem(ctx, lm, cfg, W, H) {
    const Lpt = lm[cfg.L],
      Rpt = lm[cfg.R];
    if (!Lpt || !Rpt) return;

    let cx, cy, iw, ih, angle;

    if (cfg.singleLeft) {
      cx = Lpt.x * W;
      cy = Lpt.y * H;
      const headW =
        Math.abs((lm[FL.LEFT_EAR]?.x || 0) - (lm[FL.RIGHT_EAR]?.x || 0)) * W || W * 0.3;
      iw = headW * cfg.wScale;
      ih = iw * cfg.aspect;
      angle = 0;
    } else if (cfg.singleRight) {
      cx = Rpt.x * W;
      cy = Rpt.y * H;
      const headW =
        Math.abs((lm[FL.LEFT_EAR]?.x || 0) - (lm[FL.RIGHT_EAR]?.x || 0)) * W || W * 0.3;
      iw = headW * cfg.wScale;
      ih = iw * cfg.aspect;
      angle = 0;
    } else {
      const lx = Lpt.x * W,
        ly = Lpt.y * H;
      const rx = Rpt.x * W,
        ry = Rpt.y * H;
      const span = Math.hypot(rx - lx, ry - ly);
      cx = (lx + rx) / 2;
      cy = (ly + ry) / 2;
      iw = span * cfg.wScale;
      ih = iw * cfg.aspect;
      angle = Math.atan2(ry - ly, rx - lx);
    }

    // Vertical offset in head-space
    const headH = Math.abs((lm[FL.FOREHEAD]?.y || 0) - (lm[FL.CHIN]?.y || 0)) * H || H * 0.35;
    cy += cfg.offY * headH;

    ctx.save();
    ctx.translate(cx, cy + (cfg.fromTop ? ih / 2 : 0));
    ctx.rotate(angle);
    ctx.globalAlpha = 0.95;

    if (this.img?.complete && this.img.naturalWidth) {
      if (cfg.fromTop) ctx.drawImage(this.img, -iw / 2, -ih, iw, ih);
      else ctx.drawImage(this.img, -iw / 2, -ih / 2, iw, ih);
    } else {
      this._facePlaceholder(ctx, cfg, iw, ih);
    }
    ctx.restore();
  }

  _facePlaceholder(ctx, cfg, w, h) {
    const cat = this.category;
    if (cat === "glasses" || cat === "sunglasses" || cat === "eyewear") this._glassesPlaceholder(ctx, w, h);
    else if (cat === "hat" || cat === "cap") this._hatPlaceholder(ctx, w, h);
    else if (cat === "earrings") this._earringPlaceholder(ctx, w, h);
    else if (cat === "necklace" || cat === "jewelry") this._necklacePlaceholder(ctx, w, h);
    else if (cat === "ring") this._ringPlaceholder(ctx, w, h);
  }

  _glassesPlaceholder(ctx, w, h) {
    const lw = w * 0.38,
      bw = w * 0.09;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.fillStyle = this.category === "sunglasses" ? "rgba(0,0,0,0.55)" : "rgba(100,180,255,0.20)";
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(side * (lw / 2 + bw / 2), 0, lw / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(-bw / 2, 0);
    ctx.lineTo(bw / 2, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-lw - bw / 2, 0);
    ctx.lineTo(-lw - bw / 2 - w * 0.18, 0);
    ctx.moveTo(lw + bw / 2, 0);
    ctx.lineTo(lw + bw / 2 + w * 0.18, 0);
    ctx.stroke();
  }

  _hatPlaceholder(ctx, w, h) {
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(-w * 0.33, 0);
    ctx.lineTo(-w * 0.27, -h * 0.88);
    ctx.lineTo(w * 0.27, -h * 0.88);
    ctx.lineTo(w * 0.33, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  _earringPlaceholder(ctx, w, h) {
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(0, w * 0.28, w * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d97706";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.55, w * 0.18, h * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _necklacePlaceholder(ctx, w, h) {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -h * 0.3, w * 0.46, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = "#d97706";
    ctx.beginPath();
    ctx.arc(0, h * 0.1, h * 0.33, 0, Math.PI * 2);
    ctx.fill();
  }

  _ringPlaceholder(ctx, w, h) {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(245,158,11,0.25)";
    ctx.beginPath();
    ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── triangle texture warp (affine) ────────────────────────────────────────
  _tri(ctx, img, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2) {
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
    ctx.globalAlpha = 0.93;
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  // ── debug overlays ────────────────────────────────────────────────────────
  _skel(ctx, lm, W, H) {
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
    ctx.strokeStyle = "rgba(99,102,241,0.7)";
    ctx.lineWidth = 2;
    for (const [a, b] of CONN) {
      if (!lm[a] || !lm[b]) continue;
      ctx.beginPath();
      ctx.moveTo(lm[a].x * W, lm[a].y * H);
      ctx.lineTo(lm[b].x * W, lm[b].y * H);
      ctx.stroke();
    }
    for (const p of lm) {
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#818cf8";
      ctx.fill();
    }
    ctx.restore();
  }

  _facemesh(ctx, lm, W, H) {
    ctx.save();
    ctx.fillStyle = "rgba(99,102,241,0.5)";
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── image loader ──────────────────────────────────────────────────────────
  _loadImg(product) {
    const src = product?.overlayImage || product?.ar_overlay || product?.imageUrl || product?.image_url;
    if (!src) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      this.img = img;
    };
  }
}
