/**
 * ClothingPhysics.js
 * Verlet cloth sim pinned to MediaPipe Pose landmarks.
 * Garment realistically drapes and moves with the user's body.
 */
export class ClothingPhysics {
  constructor({ cols = 12, rows = 16 } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.pts = [];
    this.links = [];
    this.gravity = 0.48;
    this.damping = 0.982;
    this.stiff = 0.86;
    this._windT = 0;
    this._wind = 0;
    this._ready = false;
    this._pins = null;
  }

  // Zip-compatible API (non-breaking additions)
  isInitialized() {
    return Boolean(this._ready)
  }

  getNodes() {
    return this.pts
  }

  getCols() {
    return this.cols
  }

  getRows() {
    return this.rows
  }

  /**
   * Pin the full top row along a shoulder line (pixel coords).
   * Useful if you want to drive the cloth manually instead of `update(...)`.
   */
  pinShoulderRow(leftShoulder, rightShoulder) {
    if (!this._ready || !this._pins?.top?.length || !leftShoulder || !rightShoulder) return
    for (let c = 0; c < this.cols; c++) {
      const t = c / (this.cols - 1)
      const p = this.pts[this._pins.top[c]]
      if (!p) continue
      p.x = leftShoulder.x + (rightShoulder.x - leftShoulder.x) * t
      p.y = leftShoulder.y + (rightShoulder.y - leftShoulder.y) * t
      p.ox = p.x
      p.oy = p.y
      p.pinned = true
    }
  }

  /**
   * Soft-pull sleeve region toward elbow/wrist (pixel coords).
   * Call after pinShoulderRow() and before step().
   */
  pinSleeveAnchor(side, elbow, wrist) {
    if (!this._ready || !elbow) return
    const isLeft = side === 'left'

    const cStart = isLeft ? 0 : Math.floor(this.cols * 0.75)
    const cEnd = isLeft ? Math.floor(this.cols * 0.25) : this.cols - 1
    const rStart = Math.floor(this.rows * 0.3)
    const rEnd = this.rows - 1

    for (let r = rStart; r <= rEnd; r++) {
      const t = (r - rStart) / Math.max(1, rEnd - rStart)
      const target = wrist
        ? { x: elbow.x + t * (wrist.x - elbow.x), y: elbow.y + t * (wrist.y - elbow.y) }
        : elbow

      for (let c = cStart; c <= cEnd; c++) {
        const n = this.pts[r * this.cols + c]
        if (!n || n.pinned) continue
        n.x += (target.x - n.x) * 0.18
        n.y += (target.y - n.y) * 0.18
      }
    }
  }

  /** Run only the physics integration/relaxation step. */
  step(iterations = 8) {
    if (!this._ready) return
    this._integrate()
    for (let i = 0; i < iterations; i++) this._relax()
  }

  update(lm, W, H) {
    if (!lm || lm.length < 25) return;
    const ls = lm[11];
    const rs = lm[12];
    const le = lm[13];
    const re = lm[14];
    const lw = lm[15];
    const rw = lm[16];
    const lh = lm[23] || (ls ? { x: ls.x, y: ls.y + 0.42 } : null);
    const rh = lm[24] || (rs ? { x: rs.x, y: rs.y + 0.42 } : null);
    if (!ls || !rs || !lh || !rh) return;

    if (!this._ready) {
      this._init(ls, rs, lh, rh, W, H);
      this._ready = true;
    }

    // Drive anchor pins to current landmarks (shoulders + sleeves)
    this._pinAnchors(ls, rs, lh, rh, le, re, lw, rw, W, H);

    // Gentle periodic wind
    this._windT += 0.022;
    this._wind = Math.sin(this._windT) * 0.28 + Math.sin(this._windT * 2.3) * 0.1;

    this._integrate();
    for (let i = 0; i < 8; i++) this._relax();
  }

  getState() {
    return { pts: this.pts, cols: this.cols, rows: this.rows };
  }

  reset() {
    this.pts = [];
    this.links = [];
    this._ready = false;
    this._pins = null;
  }

  // ── private ─────────────────────────────────────────────────────────────────

  _init(ls, rs, lh, rh, W, H) {
    const lpx = ls.x * W;
    const rpx = rs.x * W;
    const x0 = Math.min(lpx, rpx);
    const x1 = Math.max(lpx, rpx);
    const y0 = Math.min(ls.y, rs.y) * H;
    const y1 = ((lh.y + rh.y) / 2) * H;
    const cw = (x1 - x0) / (this.cols - 1);
    const ch = (y1 - y0) / (this.rows - 1);
    this._cw = cw;
    this._ch = ch;

    // Cache indices for dynamic pins (top row + sleeve controls)
    const sleeveRow1 = Math.max(1, Math.round((this.rows - 1) * 0.18));
    const sleeveRow2 = Math.max(sleeveRow1 + 1, Math.round((this.rows - 1) * 0.34));
    this._pins = {
      top: Array.from({ length: this.cols }, (_, c) => c),
      left: {
        r1: sleeveRow1 * this.cols + 0,
        r2: sleeveRow2 * this.cols + 0,
      },
      right: {
        r1: sleeveRow1 * this.cols + (this.cols - 1),
        r2: sleeveRow2 * this.cols + (this.cols - 1),
      },
      sideRows: { sleeveRow1, sleeveRow2 },
    };

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const px = x0 + c * cw,
          py = y0 + r * ch;
        this.pts.push({ x: px, y: py, ox: px, oy: py, pinned: r === 0 });
      }
    }

    // Structural + shear constraints
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        if (c < this.cols - 1) this.links.push({ a: i, b: i + 1, rest: cw });
        if (r < this.rows - 1) this.links.push({ a: i, b: i + this.cols, rest: ch });
        if (c < this.cols - 1 && r < this.rows - 1) {
          const d = Math.hypot(cw, ch);
          this.links.push({ a: i, b: i + this.cols + 1, rest: d });
          this.links.push({ a: i + 1, b: i + this.cols, rest: d });
        }
        // Bend springs (skip 1)
        if (c < this.cols - 2) this.links.push({ a: i, b: i + 2, rest: cw * 2, stiff: 0.3 });
        if (r < this.rows - 2)
          this.links.push({ a: i, b: i + this.cols * 2, rest: ch * 2, stiff: 0.3 });
      }
    }
  }

  _pinAnchors(ls, rs, lh, rh, le, re, lw, rw, W, H) {
    if (!this._pins) return;

    const px = (p) => ({ x: p.x * W, y: p.y * H });
    const pLS = px(ls);
    const pRS = px(rs);

    // Pin top row along the shoulder line (preserves tilt)
    for (let c = 0; c < this.cols; c++) {
      const t = c / (this.cols - 1);
      const p = this.pts[this._pins.top[c]];
      p.x = pRS.x + (pLS.x - pRS.x) * t;
      p.y = pRS.y + (pLS.y - pRS.y) * t;
      p.ox = p.x;
      p.oy = p.y;
      p.pinned = true;
    }

    // Side defaults (when arms not reliably detected)
    const pLH = px(lh);
    const pRH = px(rh);
    const leftSideDefault = (rowIndex) => {
      const t = rowIndex / (this.rows - 1);
      return { x: pRS.x + (pRH.x - pRS.x) * t, y: pRS.y + (pRH.y - pRS.y) * t };
    };
    const rightSideDefault = (rowIndex) => {
      const t = rowIndex / (this.rows - 1);
      return { x: pLS.x + (pLH.x - pLS.x) * t, y: pLS.y + (pLH.y - pLS.y) * t };
    };

    const ok = (p) => p && (p.visibility == null || p.visibility > 0.55);

    // Sleeve targets: drive a couple of points on each side using elbow/wrist.
    // This makes the sleeve area follow arm raises instead of staying rigid.
    const leftTargets = [];
    if (ok(re) && ok(rw)) {
      const pRE = px(re);
      const pRW = px(rw);
      leftTargets.push({
        row: this._pins.sideRows.sleeveRow1,
        pt: { x: pRS.x + (pRE.x - pRS.x) * 0.65, y: pRS.y + (pRE.y - pRS.y) * 0.65 },
      });
      leftTargets.push({
        row: this._pins.sideRows.sleeveRow2,
        pt: { x: pRE.x + (pRW.x - pRE.x) * 0.35, y: pRE.y + (pRW.y - pRE.y) * 0.35 },
      });
    } else if (ok(re)) {
      const pRE = px(re);
      leftTargets.push({
        row: this._pins.sideRows.sleeveRow1,
        pt: { x: pRS.x + (pRE.x - pRS.x) * 0.7, y: pRS.y + (pRE.y - pRS.y) * 0.7 },
      });
      leftTargets.push({ row: this._pins.sideRows.sleeveRow2, pt: pRE });
    }

    const rightTargets = [];
    if (ok(le) && ok(lw)) {
      const pLE = px(le);
      const pLW = px(lw);
      rightTargets.push({
        row: this._pins.sideRows.sleeveRow1,
        pt: { x: pLS.x + (pLE.x - pLS.x) * 0.65, y: pLS.y + (pLE.y - pLS.y) * 0.65 },
      });
      rightTargets.push({
        row: this._pins.sideRows.sleeveRow2,
        pt: { x: pLE.x + (pLW.x - pLE.x) * 0.35, y: pLE.y + (pLW.y - pLE.y) * 0.35 },
      });
    } else if (ok(le)) {
      const pLE = px(le);
      rightTargets.push({
        row: this._pins.sideRows.sleeveRow1,
        pt: { x: pLS.x + (pLE.x - pLS.x) * 0.7, y: pLS.y + (pLE.y - pLS.y) * 0.7 },
      });
      rightTargets.push({ row: this._pins.sideRows.sleeveRow2, pt: pLE });
    }

    // Apply left side sleeve pins (col 0)
    const leftPinIdxs = [this._pins.left.r1, this._pins.left.r2];
    const leftRows = [this._pins.sideRows.sleeveRow1, this._pins.sideRows.sleeveRow2];
    for (let i = 0; i < leftPinIdxs.length; i++) {
      const idx = leftPinIdxs[i];
      const rowIndex = leftRows[i];
      const t = leftTargets[i]?.pt || leftTargets[leftTargets.length - 1]?.pt || leftSideDefault(rowIndex);
      const p = this.pts[idx];
      p.x = t.x;
      p.y = t.y;
      p.ox = p.x;
      p.oy = p.y;
      p.pinned = true;
    }

    // Apply right side sleeve pins (col cols-1)
    const rightPinIdxs = [this._pins.right.r1, this._pins.right.r2];
    const rightRows = [this._pins.sideRows.sleeveRow1, this._pins.sideRows.sleeveRow2];
    for (let i = 0; i < rightPinIdxs.length; i++) {
      const idx = rightPinIdxs[i];
      const rowIndex = rightRows[i];
      const t = rightTargets[i]?.pt || rightTargets[rightTargets.length - 1]?.pt || rightSideDefault(rowIndex);
      const p = this.pts[idx];
      p.x = t.x;
      p.y = t.y;
      p.ox = p.x;
      p.oy = p.y;
      p.pinned = true;
    }
  }

  _integrate() {
    for (const p of this.pts) {
      if (p.pinned) continue;
      const vx = (p.x - p.ox) * this.damping + this._wind;
      const vy = (p.y - p.oy) * this.damping + this.gravity;
      p.ox = p.x;
      p.oy = p.y;
      p.x += vx;
      p.y += vy;
    }
  }

  _relax() {
    for (const lk of this.links) {
      const a = this.pts[lk.a],
        b = this.pts[lk.b];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const diff = ((dist - lk.rest) / dist) * (lk.stiff || this.stiff) * 0.5;
      if (!a.pinned) {
        a.x += dx * diff;
        a.y += dy * diff;
      }
      if (!b.pinned) {
        b.x -= dx * diff;
        b.y -= dy * diff;
      }
    }
  }
}
