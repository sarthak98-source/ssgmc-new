import { loadScript } from "./scriptLoader";
import { MP_CDN } from "./arConfig";

export class PoseTracker {
  constructor() {
    this.pose = null;
    this.last = null;
    this._cb = null;
  }

  async load(onProgress) {
    onProgress?.("Downloading Pose model…");
    await loadScript(MP_CDN.pose.js);
    onProgress?.("Initialising Pose…");
    this.pose = new window.Pose({ locateFile: (f) => `${MP_CDN.pose.wasm}${f}` });
    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
    this.pose.onResults((r) => {
      this.last = r;
      this._cb?.(r);
      this._cb = null;
    });
    await this.pose.initialize();
    onProgress?.("Pose ready ✓");
  }

  detect(video) {
    if (!this.pose) return Promise.resolve(null);
    return new Promise((res) => {
      this._cb = res;
      setTimeout(() => {
        if (this._cb) {
          this._cb(this.last);
          this._cb = null;
        }
      }, 150);
      this.pose.send({ image: video }).catch(() => res(this.last));
    });
  }

  destroy() {
    try {
      this.pose?.close?.();
    } catch (_) {}
    this.pose = null;
  }
}
