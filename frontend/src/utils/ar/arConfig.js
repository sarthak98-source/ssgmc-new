// ─── AR Config ───────────────────────────────────────────────────────────────

export const PRODUCT_AR_MODES = {
  clothing: "body",
  shirt: "body",
  tshirt: "body",
  dress: "body",
  pants: "body",
  trousers: "body",
  jacket: "body",
  hoodie: "body",
  coat: "body",
  top: "body",
  kurta: "body",
  hat: "face",
  cap: "face",
  glasses: "face",
  sunglasses: "face",
  eyewear: "face",
  earrings: "face",
  necklace: "face",
  jewelry: "face",
  watch: "body",
  ring: "face",
};

export const MP_CDN = {
  pose: {
    js: "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js",
    wasm: "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/",
  },
  face: {
    js: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js",
    wasm: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/",
  },
};

export const PL = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

export const FL = {
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_INNER: 362,
  NOSE_TIP: 4,
  NOSE_BRIDGE: 6,
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  LEFT_EAR: 234,
  RIGHT_EAR: 454,
  FOREHEAD: 10,
  CHIN: 175,
  LEFT_CHEEK: 116,
  RIGHT_CHEEK: 345,
};

export const BODY_CFG = {
  shirt: { top: [11, 12], bot: [23, 24], wScale: 1.42, hScale: 1.0, offY: -0.03 },
  tshirt: { top: [11, 12], bot: [23, 24], wScale: 1.38, hScale: 1.0, offY: -0.03 },
  dress: { top: [11, 12], bot: [27, 28], wScale: 1.5, hScale: 1.0, offY: -0.02 },
  pants: { top: [23, 24], bot: [27, 28], wScale: 1.3, hScale: 1.0, offY: 0.0 },
  trousers: { top: [23, 24], bot: [27, 28], wScale: 1.3, hScale: 1.0, offY: 0.0 },
  jacket: { top: [11, 12], bot: [23, 24], wScale: 1.62, hScale: 1.05, offY: -0.04 },
  hoodie: { top: [11, 12], bot: [23, 24], wScale: 1.58, hScale: 1.05, offY: -0.03 },
  coat: { top: [11, 12], bot: [27, 28], wScale: 1.58, hScale: 1.0, offY: -0.03 },
  top: { top: [11, 12], bot: [23, 24], wScale: 1.38, hScale: 1.0, offY: -0.02 },
  kurta: { top: [11, 12], bot: [27, 28], wScale: 1.45, hScale: 1.0, offY: -0.02 },
  clothing: { top: [11, 12], bot: [23, 24], wScale: 1.42, hScale: 1.0, offY: -0.03 },
  watch: { wrist: 15, elbow: 13, wScale: 0.09, aspect: 1.0 },
};

export const FACE_CFG = {
  glasses: { L: 33, R: 263, wScale: 1.3, offY: 0.0, aspect: 0.38 },
  sunglasses: { L: 33, R: 263, wScale: 1.36, offY: 0.0, aspect: 0.42 },
  eyewear: { L: 33, R: 263, wScale: 1.3, offY: 0.0, aspect: 0.38 },
  hat: { L: 234, R: 454, wScale: 1.62, offY: -0.48, aspect: 0.78, fromTop: true },
  cap: { L: 234, R: 454, wScale: 1.52, offY: -0.4, aspect: 0.66, fromTop: true },
  earrings: { L: 234, R: 454, wScale: 0.14, offY: 0.05, aspect: 2.6, both: true },
  necklace: { L: 234, R: 454, wScale: 0.96, offY: 0.3, aspect: 0.4 },
  jewelry: { L: 234, R: 454, wScale: 0.9, offY: 0.22, aspect: 0.4 },
  ring: { L: 116, R: 345, wScale: 0.12, offY: 0.0, aspect: 1.0 },
};
