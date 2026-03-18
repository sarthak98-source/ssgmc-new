-- Fix image_url column to support base64 images
USE vivmart;
ALTER TABLE products MODIFY COLUMN image_url MEDIUMTEXT;
ALTER TABLE products MODIFY COLUMN model_url MEDIUMTEXT;
SELECT 'image_url column updated to MEDIUMTEXT' AS result;