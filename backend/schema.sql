-- ================================================================
-- VivMart — Complete MySQL Database Schema
-- Run:  mysql -u root -p < schema.sql
-- ================================================================

CREATE DATABASE IF NOT EXISTS `vivmart ssgmc db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `vivmart ssgmc db`;

-- ── Users (buyer | seller | admin) ───────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  role         ENUM('buyer','seller','admin') NOT NULL DEFAULT 'buyer',
  phone        VARCHAR(20),
  avatar_url   MEDIUMTEXT   ,
  status       ENUM('active','pending','suspended') NOT NULL DEFAULT 'active',
  last_login   DATETIME,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email  (email),
  INDEX idx_role   (role),
  INDEX idx_status (status)
);

-- ── Products ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             INT           AUTO_INCREMENT PRIMARY KEY,
  seller_id      INT           NOT NULL,
  name           VARCHAR(200)  NOT NULL,
  category       VARCHAR(50)   NOT NULL,
  ar_mode        ENUM('body','face','room','3d','shoes') DEFAULT '3d',
  ar_overlay     VARCHAR(500)  NULL,
  color          VARCHAR(40)   NULL,
  price          DECIMAL(12,2) NOT NULL,
  original_price DECIMAL(12,2),
  description    TEXT,
  image_url      MEDIUMTEXT  ,
  model_url      MEDIUMTEXT  ,
  badge          VARCHAR(50),
  rating         DECIMAL(3,1)  DEFAULT 0.0,
  review_count   INT           DEFAULT 0,
  colors         JSON,
  sizes          JSON,
  featured       TINYINT(1)    DEFAULT 0,
  stock          INT           DEFAULT 100,
  active         TINYINT(1)    DEFAULT 1,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category  (category),
  INDEX idx_seller    (seller_id),
  INDEX idx_ar_mode   (ar_mode),
  INDEX idx_featured  (featured),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Orders ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id             INT           AUTO_INCREMENT PRIMARY KEY,
  buyer_id       INT           NOT NULL,
  items          JSON          NOT NULL,
  address        JSON          NOT NULL,
  payment_method VARCHAR(50)   DEFAULT 'upi',
  subtotal       DECIMAL(12,2) DEFAULT 0,
  shipping       DECIMAL(10,2) DEFAULT 0,
  tax            DECIMAL(10,2) DEFAULT 0,
  total          DECIMAL(12,2) NOT NULL,
  status         ENUM('pending','confirmed','shipped','delivered','cancelled') DEFAULT 'pending',
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_buyer  (buyer_id),
  INDEX idx_status (status),
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Order Items (normalized order line items) ────────────────────
-- Keeps compatibility with existing JSON `orders.items` while also
-- storing proper order->product relations.
CREATE TABLE IF NOT EXISTS order_items (
  id         INT           AUTO_INCREMENT PRIMARY KEY,
  order_id   INT           NOT NULL,
  product_id INT           NOT NULL,
  quantity   INT           NOT NULL DEFAULT 1,
  price      DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order   (order_id),
  INDEX idx_product (product_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- ── Live Sessions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_sessions (
  id          INT          AUTO_INCREMENT PRIMARY KEY,
  seller_id   INT          NOT NULL,
  title       VARCHAR(200) NOT NULL,
  channel     VARCHAR(100) NOT NULL UNIQUE,
  product_ids JSON,
  status      ENUM('active','ended','scheduled') DEFAULT 'active',
  viewers     INT          DEFAULT 0,
  started_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at    DATETIME,
  INDEX idx_seller (seller_id),
  INDEX idx_status (status),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Live Chat Messages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  session_id INT          NOT NULL,
  user_id    INT,
  user_name  VARCHAR(100) NOT NULL,
  role       ENUM('buyer','seller','system') DEFAULT 'buyer',
  message    TEXT         NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session (session_id),
  FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE
);

-- ── Reviews ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  product_id INT          NOT NULL,
  user_id    INT          NOT NULL,
  rating     TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_review (product_id, user_id),
  INDEX idx_product (product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);

-- ── Wishlist ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist (
  id         INT       AUTO_INCREMENT PRIMARY KEY,
  user_id    INT       NOT NULL,
  product_id INT       NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_wish (user_id, product_id),
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ── Notifications ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  message    TEXT,
  data       JSON,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_user_read (user_id, is_read),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ================================================================
-- Seed Data
-- ================================================================

-- Default admin + demo accounts (password: demo1234 for all)
-- bcrypt hash of 'demo1234' with 12 rounds:
INSERT INTO users (name, email, password, role, status) VALUES
('Admin User',   'admin@vivmart.com',  '$2a$12$LiGRNfMaFHX1I5z.JyRK.OKC4lHzl1UdG3F2M0Hs6VpXQ0VWGKN22', 'admin',  'active'),
('Demo Seller',  'seller@vivmart.com', '$2a$12$LiGRNfMaFHX1I5z.JyRK.OKC4lHzl1UdG3F2M0Hs6VpXQ0VWGKN22', 'seller', 'active'),
('Demo Buyer',   'buyer@vivmart.com',  '$2a$12$LiGRNfMaFHX1I5z.JyRK.OKC4lHzl1UdG3F2M0Hs6VpXQ0VWGKN22', 'buyer',  'active')
ON DUPLICATE KEY UPDATE
  name     = VALUES(name),
  password = VALUES(password),
  role     = VALUES(role),
  status   = VALUES(status);

-- No demo products seeded — sellers add their own products via the dashboard

-- ── Video Call Requests (buyer → seller 1-to-1) ───────────────────
CREATE TABLE IF NOT EXISTS video_call_requests (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  buyer_id     INT          NOT NULL,
  seller_id    INT          NOT NULL,
  product_id   INT,
  buyer_name   VARCHAR(100) NOT NULL,
  product_name VARCHAR(200),
  message      TEXT,
  status       ENUM('pending','accepted','rejected','ended') DEFAULT 'pending',
  room_id      VARCHAR(100),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_seller (seller_id),
  INDEX idx_buyer  (buyer_id),
  INDEX idx_status (status),
  FOREIGN KEY (buyer_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);