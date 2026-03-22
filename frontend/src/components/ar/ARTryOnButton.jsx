import React, { useState, lazy, Suspense } from "react";

const ARTryOn = lazy(() => import("./ARTryOn"));

// Categories that show the Try-On button
const AR_CATS = new Set([
  "clothing",
  "shirt",
  "tshirt",
  "dress",
  "pants",
  "trousers",
  "jacket",
  "hoodie",
  "coat",
  "top",
  "kurta",
  "glasses",
  "sunglasses",
  "eyewear",
  "hat",
  "cap",
  "earrings",
  "necklace",
  "jewelry",
  "ring",
  "watch",
]);

/**
 * ARTryOnButton
 *
 * variant="card"  → small pill in bottom-right corner of product image
 * variant="page"  → large gradient CTA button for product detail page
 *
 * The parent image container MUST have: position: relative
 */
export default function ARTryOnButton({ product, variant = "card" }) {
  const [open, setOpen] = useState(false);
  const cat = (product?.category || "").toLowerCase();

  if (!AR_CATS.has(cat)) return null;

  const isCard = variant === "card";

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="Try this on with AR"
        style={isCard ? BS.card : BS.page}
      >
        <span style={{ fontSize: isCard ? 13 : 16 }}>👁</span>
        <span>{isCard ? "Try On" : "AR Try-On"}</span>
      </button>

      {open && (
        <Suspense
          fallback={
            <div style={BS.loader}>
              <div style={BS.loaderSpinner} />
            </div>
          }
        >
          <ARTryOn product={product} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

const BS = {
  card: {
    position: "absolute",
    bottom: 10,
    right: 10,
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "rgba(10,10,14,0.82)",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 30,
    padding: "5px 13px",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
    backdropFilter: "blur(8px)",
    zIndex: 10,
    transition: "all 0.18s",
    fontFamily: "'Inter',system-ui,sans-serif",
  },
  page: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 26px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Inter',system-ui,sans-serif",
    transition: "opacity 0.18s",
  },
  loader: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  loaderSpinner: {
    width: 42,
    height: 42,
    border: "3px solid rgba(99,102,241,0.3)",
    borderTop: "3px solid #6366f1",
    borderRadius: "50%",
    animation: "_sp .75s linear infinite",
  },
};
