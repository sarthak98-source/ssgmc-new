import { loadScript } from "./scriptLoader";
import { MP_CDN } from "./arConfig";

export class FaceTracker {
  constructor() {
    this.fm = null;
    this.last = null;
    this._cb = null;
  }

  async load(onProgress) {
    onProgress?.("Downloading FaceMesh model…");
    await loadScript(MP_CDN.face.js);
    onProgress?.("Initialising FaceMesh…");
    this.fm = new window.FaceMesh({ locateFile: (f) => `${MP_CDN.face.wasm}${f}` });
    this.fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
    this.fm.onResults((r) => {
      this.last = r;
      this._cb?.(r);
      this._cb = null;
    });
    await this.fm.initialize();
    onProgress?.("FaceMesh ready ✓");
  }

  detect(video) {
    if (!this.fm) return Promise.resolve(null);
    return new Promise((res) => {
      this._cb = res;
      setTimeout(() => {
        if (this._cb) {
          this._cb(this.last);
          this._cb = null;
        }
      }, 150);
      this.fm.send({ image: video }).catch(() => res(this.last));
    });
  }

  destroy() {
    try {
      this.fm?.close?.();
    } catch (_) {}
    this.fm = null;
  }
}
