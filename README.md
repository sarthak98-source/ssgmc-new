# VivMart — Live Virtual Shopping Platform

India's first live virtual e-commerce platform with real-time AR try-on, live seller sessions, and role-based access.

---

## 🏗️ Architecture

```
vivmart/
├── frontend/   React + Vite + Tailwind CSS
├── backend/    Node.js + Express + MySQL + Socket.io
└── server/     Standalone Socket.io server (optional)
```

---

## 👥 Three User Roles

| Role   | Access | Features |
|--------|--------|----------|
| **Buyer** | `/buyer/*` | Browse, AR try-on, join live sessions, chat, order |
| **Seller** | `/seller/*` | Manage products, go live, receive orders, chat |
| **Admin** | `/admin/*` | Full platform management, users, orders, sellers |

---

## ✨ Key Features

### 🔴 Live Shopping (Agora + Socket.io)
- Seller goes live on camera with `SellerLive.jsx`
- Buyers join from `BuyerLiveSession.jsx`
- Real-time chat via Socket.io
- Seller can showcase products & trigger AR for all viewers
- Powered by **Agora RTC** for WebRTC video

### 🥽 AR Try-On (MediaPipe + Three.js)
| Mode | Products | Tech |
|------|----------|------|
| Body Try-On | Clothing, shoes | MediaPipe Pose → Canvas |
| Face Try-On | Glasses, jewelry, hats | MediaPipe FaceMesh → Canvas |
| Room Placement | Furniture, decor | Three.js + WebXR |
| 3D Viewer | Electronics | Three.js orbit camera |

### 🔐 Role-Based JWT Auth
- Register as Buyer or Seller
- Admin created via seed data only
- JWT tokens with role claim
- Protected routes per role

---

## 🚀 Quick Start

### 1. Database
```bash
mysql -u root -p < backend/schema.sql
```
Default accounts (password: `demo1234`):
- `admin@vivmart.com` → Admin
- `seller@vivmart.com` → Seller
- `buyer@vivmart.com` → Buyer

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MySQL credentials
npm run dev
```
API runs at **http://localhost:5000**

### 3. Socket.io Server (optional standalone)
```bash
cd server
npm install
npm run dev
```
Socket runs at **http://localhost:5001**

> Note: Socket.io is also embedded in `backend/server.js` — you only need the standalone server for microservices setup.

### 4. Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
App runs at **http://localhost:5173**

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register buyer or seller |
| POST | `/api/auth/login` | Public | Login + get JWT |
| GET | `/api/auth/profile` | Any | Get own profile |
| PUT | `/api/auth/profile` | Any | Update own profile |

### Products
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | Public | List all (`?category=&search=&arMode=`) |
| GET | `/api/products/:id` | Public | Single product |
| GET | `/api/products/:id/model` | Public | AR model info |
| POST | `/api/products` | Seller/Admin | Create product |
| PUT | `/api/products/:id` | Seller/Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Remove product |

### Orders
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | Buyer | Place order |
| GET | `/api/orders` | Any | My orders (scoped by role) |
| GET | `/api/orders/:id` | Any | Order detail |
| PUT | `/api/orders/:id/status` | Seller/Admin | Update status |

### Users (Admin)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Admin | All users |
| PUT | `/api/users/:id/status` | Admin | Suspend/activate |
| GET | `/api/users/stats/admin` | Admin | Platform stats |

### Live Sessions
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/live/sessions` | Public | Active sessions |
| POST | `/api/live/start` | Seller | Start session |
| POST | `/api/live/end/:id` | Seller | End session |

---

## 🎯 Socket.io Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `start_session` | `{sessionId, sellerId, title, products}` | Seller starts live |
| `join_session` | `{sessionId, userId, userName, role}` | User joins room |
| `send_message` | `{sessionId, text, userName, role}` | Send chat message |
| `showcase_product` | `{sessionId, product}` | Seller shows product |
| `trigger_ar` | `{sessionId, productId, arMode}` | Seller pushes AR to viewers |
| `end_session` | `{sessionId}` | Seller ends stream |
| `leave_session` | `{sessionId, userName}` | User leaves |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `session_started` | `{sessionId, sellerName, title}` | Session is live |
| `new_message` | `{id, userName, role, text, time}` | New chat message |
| `message_history` | `Message[]` | Recent messages on join |
| `product_showcased` | `Product` | Seller showcases product |
| `ar_triggered` | `{productId, arMode}` | AR triggered for viewers |
| `viewer_count` | `number` | Updated viewer count |
| `session_ended` | `{sessionId}` | Stream ended |

---

## 📦 Tech Stack

### Frontend
- React 18 + Vite 5
- Tailwind CSS 3
- React Router v6
- Three.js (3D & room AR)
- MediaPipe (body & face AR, via CDN)
- Agora RTC SDK (live video)
- Socket.io client (real-time chat)

### Backend
- Node.js + Express
- MySQL 8 with mysql2
- bcryptjs (password hashing)
- jsonwebtoken (JWT)
- Socket.io (real-time)
- express-validator

---

## 🔑 Agora Setup (for live video)

1. Create account at [agora.io](https://console.agora.io)
2. Create a new project
3. Copy your **App ID**
4. Add to `backend/.env`: `AGORA_APP_ID=your_id`
5. Add to `frontend/.env`: `VITE_AGORA_APP_ID=your_id`
6. For production, implement token generation in `backend/routes/live.js`

---

## 🛡️ Demo Login (no backend needed)

The frontend includes a **demo mode** — click Quick Demo Login on the login page to instantly enter as Buyer, Seller, or Admin. All pages work with mock data.

---

## 📄 License
MIT © VivMart 2025
