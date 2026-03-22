-- ──────────────────────────────────────────────────────────────────
-- AR Try-On  –  Database migration
-- Run this once against your existing MySQL database.
-- ──────────────────────────────────────────────────────────────────

-- 1. Add AR columns to your products table
-- Note: `ar_mode` is already part of the base schema as an ENUM.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS ar_overlay VARCHAR(500)    NULL COMMENT 'Path/URL to transparent PNG overlay image',
  ADD COLUMN IF NOT EXISTS color      VARCHAR(40)     NULL COMMENT 'Hex color for placeholder fallback';

-- 2. Seed AR mode based on category (adjust category values to match yours)
UPDATE products SET ar_mode = 'body'
WHERE LOWER(category) IN ('clothing','shirt','tshirt','dress','pants','trousers','jacket','hoodie','coat','top','kurta','watch');

UPDATE products SET ar_mode = 'face'
WHERE LOWER(category) IN ('glasses','sunglasses','eyewear','hat','cap','earrings','necklace','jewelry','ring');

-- 3. (Optional) index for fast AR-mode queries
-- If your base schema already created idx_ar_mode, you can skip this.
CREATE INDEX IF NOT EXISTS idx_products_ar_mode ON products(ar_mode);
