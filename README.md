# 🧠 PWA Habit Tracker

> A production-ready Progressive Web App for building better daily habits — works offline, syncs in the background, and keeps you engaged with push notifications.

![Lighthouse PWA Score](https://img.shields.io/badge/Lighthouse%20PWA-100%2F100-brightgreen?logo=lighthouse)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📖 Overview

This Habit Tracker is a **Progressive Web App (PWA)** that demonstrates advanced browser APIs including Service Workers, Background Sync, Push Notifications, IndexedDB, and the Web App Manifest. It achieves a perfect **Lighthouse PWA score of 100/100**.

### Key Highlights

- **Offline-First** — The full app shell loads from cache even with no network connection
- **Background Sync** — Habit updates made offline are automatically replayed when connectivity returns
- **Push Notifications** — VAPID-based Web Push keeps users engaged with habit reminders
- **Installable** — Meets all PWA installability criteria (manifest, icons, HTTPS, service worker)
- **Developer Debug Panel** — Live service worker state and cache version displayed in the UI

---

## 🎮 How to Try This Project

> **No complicated setup.** The entire app — frontend + backend — runs from a single port.

### ⚡ Fastest Way (Docker — 3 Steps)

**Step 1** — Make sure Docker Desktop is running, then:

```bash
cd "path/to/this/project"
```

**Step 2** — Create your `.env` file (VAPID keys are already filled in `.env.example` with placeholders — you need real ones):

```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

Generate real VAPID keys:
```bash
npx web-push generate-vapid-keys
```
Paste the output into your `.env` file replacing the placeholder values.

**Step 3** — Start the app:

```bash
docker-compose up --build
```

✅ Open your browser → **http://localhost:3001**

---

### 🔧 Without Docker (Node.js Only)

**Step 1** — Install dependencies:

```bash
cd backend
npm install
```

**Step 2** — Create `.env` in the project root (same as above).

**Step 3** — Start:

```bash
npm start
```

✅ Open your browser → **http://localhost:3001**

---

### 🕹️ Things to Try in the Browser

Once the app is open at **http://localhost:3001**, here's what you can do:

#### ➕ Add a Habit
1. Type a habit name (e.g. "Drink 8 glasses of water") in the right panel
2. Pick a color swatch
3. Click **✨ Add Habit** — it appears in the list instantly

#### ✅ Mark a Habit Done
- Click **⬜ Mark Done** on any habit — it turns green and shows ✅ Done Today
- The calendar heatmap updates to show today's completions
- Your streak counter 🔥 increases

#### 📴 Test Offline Mode
1. Open **Chrome DevTools** (F12) → **Network** tab → change dropdown to **"Offline"**
2. **Reload the page** — the app still loads completely from cache!
3. Add a habit while offline — the sync badge shows 🟡 **"Sync Pending"**
4. Switch back to **"No throttling"**
5. Within ~10 seconds, the sync fires automatically → badge shows 🟢 **"Synced"**

#### 🔔 Enable Push Notifications
1. Click **"🔔 Enable Notifications"** in the right panel
2. Allow the browser permission prompt
3. Then trigger a test push from your terminal:

```bash
# Windows PowerShell
Invoke-WebRequest -Uri "http://localhost:3001/api/trigger-push" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"title":"Habit Reminder","body":"Time to check your habits!"}'
```

```bash
# Mac/Linux
curl -X POST http://localhost:3001/api/trigger-push \
  -H "Content-Type: application/json" \
  -d '{"title":"Habit Reminder","body":"Time to check your habits!"}'
```

A system notification pops up! 🎉

#### 📱 Install as an App (PWA)
- In Chrome/Edge: click the **⊕ install icon** in the address bar
- On Android: browser menu → **"Add to Home screen"**

#### 🛠 Developer Debug Panel (bottom-right of the UI)
| Field | What it shows |
|---|---|
| SW State | `installing` → `activated` (watch it change live!) |
| Cache Version | `habit-tracker-v1` |
| Background Sync | `supported ✓` |
| Push Support | `supported ✓` |
| IndexedDB | `supported ✓` |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
│                                                     │
│  ┌──────────────┐    ┌───────────────────────────┐  │
│  │  PWA Frontend│◄──►│   Service Worker (sw.js)  │  │
│  │  (HTML/CSS/JS│    │                           │  │
│  │  + IndexedDB)│    │  • Cache-First (assets)   │  │
│  └──────┬───────┘    │  • Network-First (API)    │  │
│         │            │  • Background Sync         │  │
│         │            │  • Push Notifications      │  │
└─────────┼────────────┴───────────────────────────┘--┘
          │  HTTP (same origin)
          ▼
┌─────────────────────────────┐
│   Express.js Backend        │
│   (Node.js · Port 3001)     │
│                             │
│  GET  /api/habits           │
│  POST /api/habits           │
│  PUT  /api/habits/:id/complete│
│  DEL  /api/habits/:id       │
│  POST /api/subscribe        │──► FCM / Web Push Service
│  POST /api/trigger-push     │
│  GET  /api/vapid-public-key │
│  GET  /health               │
└─────────────────────────────┘
```

The **backend and frontend are served from the same Express server** on port 3001. This eliminates CORS issues, simplifies Docker configuration, and ensures service workers can intercept all requests including API calls.

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18 or higher |
| Docker Desktop | Latest |
| Chrome / Edge | Latest (for full PWA support) |

---

### Option A — Docker (Recommended)

One command starts everything:

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd <repo-folder>

# 2. Copy the environment file
cp .env.example .env

# 3. Fill in your VAPID keys (see section below for how to generate them)
#    Edit .env with real VAPID keys

# 4. Build and start
docker-compose up --build

# 5. Open the app
# http://localhost:3001
```

To run in detached mode:
```bash
docker-compose up --build -d
```

To stop:
```bash
docker-compose down
```

---

### Option B — Local Development (No Docker)

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Copy and configure environment variables
cp ../.env.example ../.env
# Edit ../.env with your VAPID keys

# 3. Start the backend (also serves the frontend)
npm start
```

Open → **http://localhost:3001**

> The Express server automatically serves the `../frontend` directory as static files in development mode. No separate frontend server is needed.

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and populate it:

```bash
cp .env.example .env
```

| Variable | Description | Required |
|---|---|---|
| `PORT` | Port the server listens on (default: `3001`) | Yes |
| `VAPID_PUBLIC_KEY` | Base64url-encoded VAPID public key | Yes |
| `VAPID_PRIVATE_KEY` | Base64url-encoded VAPID private key (keep secret!) | Yes |
| `VAPID_EMAIL` | Contact email for the push service (e.g., `mailto:you@example.com`) | Yes |

### Generating VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Copy the output into your `.env` file. **Never commit real keys to Git.**

---

## 📁 Project Structure

```
.
├── Dockerfile                 # Root Dockerfile — builds backend + frontend together
├── docker-compose.yml         # Starts the push-server container
├── .env.example               # Template for environment variables
├── lighthouse-report.json     # Lighthouse PWA audit — score: 100/100
├── README.md                  # This file
│
├── backend/
│   ├── server.js              # Express app — API + static file serving
│   ├── package.json
│   └── Dockerfile             # (kept for reference; root Dockerfile is used by compose)
│
└── frontend/
    ├── index.html             # Main HTML with all required data-testid attributes
    ├── manifest.json          # PWA Web App Manifest
    ├── sw.js                  # Service Worker — caching, sync, push
    ├── icons/
    │   ├── icon-192x192.png
    │   └── icon-512x512.png
    ├── css/
    │   └── styles.css         # Dark mode glassmorphism design
    └── js/
        ├── app.js             # Main app logic, SW registration, UI rendering
        ├── api.js             # API client with offline queuing
        ├── db.js              # IndexedDB helpers for the sync queue
        └── notifications.js   # Push notification subscription management
```

---

## ✅ Requirements Checklist

| # | Requirement | Implementation |
|---|---|---|
| 1 | `docker-compose up` starts the backend | Root `Dockerfile` copies both frontend and backend; `docker-compose.yml` uses root context |
| 2 | `.env.example` with all required variables | `PORT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` documented |
| 3 | Valid `manifest.json` with all required properties | `name`, `short_name`, `icons` (192+512), `start_url`, `display`, `theme_color`, `background_color` |
| 4 | Lighthouse PWA score of 100 | `lighthouse-report.json` — `categories.pwa.score = 1` |
| 5 | App shell served offline | Service worker caches all shell assets on install; `data-testid="app-container"` present |
| 6 | Background Sync for offline writes | IndexedDB queue + `sync.register('sync-new-habits')`; `data-testid="sync-status"` shows "Sync Pending" / "Synced" |
| 7 | Push notification subscription | `data-testid="enable-notifications"` button → `POST /api/subscribe` |
| 8 | Backend can send push notifications | `POST /api/trigger-push` sends via `web-push` library |
| 9 | Cache cleanup on SW activate | `activate` event uses `caches.keys()` + `caches.delete()` to remove old versions |
| 10 | Debug panel with SW state + cache version | `data-testid="sw-state"` and `data-testid="cache-version"` updated live via `postMessage` |

---

## 🗄️ Caching Strategy Justification

### Static Assets — Cache-First

**Strategy:** Cache-First with network fallback and background update

```
Request → Cache hit? → Return cached → DONE
                    ↓ Cache miss
              Fetch from network → Store in cache → Return response
```

**Why:** Static assets (HTML, CSS, JS, icons) rarely change between visits. Serving from cache achieves near-instant load times and full offline support. Cache invalidation is handled by the **versioned cache name** (`habit-tracker-v1`) — when a new service worker activates, the `activate` event deletes all caches not matching the current version.

**Trade-off:** Users may see a slightly stale UI until the service worker updates and they reload. This is acceptable for a habit tracker where content structure changes rarely.

---

### API Data — Network-First

**Strategy:** Network-First with cache fallback

```
Request → Try network → Success? → Store in API cache → Return response
                     ↓ Network failure
                     Return last cached API response (503 fallback if none)
```

**Why:** Habit data (`GET /api/habits`) changes frequently — users add habits, mark completions, etc. Network-first ensures users always see the most up-to-date data when online. The cache acts as a safety net when the server is unreachable.

**Trade-off:** Slightly slower than cache-first on a slow connection, but the data freshness is worth it for this use case.

---

### Offline Write Operations — Background Sync

**Strategy:** Queue in IndexedDB + Background Sync API

```
Write action offline → Store in IndexedDB → Register 'sync-new-habits' event
                                                         ↓
                                              Network returns → Browser fires sync
                                                         ↓
                                              Service worker replays queued requests
                                                         ↓
                                              Notify main thread via postMessage
```

**Why:** The Background Sync API guarantees delivery of write operations even if the user closes the browser before connectivity returns. This is far more reliable than in-page retry logic. If the server returns a non-2xx status, the item stays in the queue and is retried on the next sync cycle.

---

## 🧪 Testing the Key Features

### 1. Offline Mode & App Shell

1. Open **http://localhost:3001** in Chrome
2. Wait for "SW State: activated" in the debug panel
3. Open DevTools → Network → set throttle to **"Offline"**
4. Reload the page — the app should load completely from cache

### 2. Background Sync

1. With DevTools Network set to **Offline**
2. Add a new habit — you'll see the sync-status badge shows **"Sync Pending"**
3. Set DevTools Network back to **"No throttling"**
4. Within 30 seconds, the sync event fires and status changes to **"Synced"**

> You can also check DevTools → Application → Background Sync to see registered sync events.

### 3. Push Notifications

1. Click **"🔔 Enable Notifications"** and grant permission
2. From a terminal, trigger a test push:

```bash
curl -X POST http://localhost:3001/api/trigger-push \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Notification", "body": "Time to build your habits!"}'
```

### 4. Lighthouse Audit

1. Open **http://localhost:3001** in Chrome (must be HTTPS or localhost)
2. Open DevTools → Lighthouse tab
3. Select only "Progressive Web App"
4. Click **"Analyze page load"**

---

## 🛠️ API Reference

### Habits

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/habits` | Get all habits |
| `POST` | `/api/habits` | Create a new habit `{ name, color }` |
| `PUT` | `/api/habits/:id/complete` | Mark a habit done for today `{ date? }` |
| `DELETE` | `/api/habits/:id` | Delete a habit |

### Push Notifications

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/vapid-public-key` | Get VAPID public key for frontend |
| `POST` | `/api/subscribe` | Save a push subscription `{ endpoint, keys }` |
| `POST` | `/api/trigger-push` | Send a push to all (or specific) subscribers |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check (used by Docker) |

---

## 📱 PWA Installation

On Chrome/Edge desktop:
- Look for the **install icon (⊕)** in the address bar
- Click it to install the app to your desktop

On Android:
- Tap the browser menu → **"Add to Home screen"**

---

## 🔒 Security Notes

- **VAPID keys** must never be committed to Git — use `.env` and ensure it's in `.gitignore`
- The `.env.example` file contains only placeholder values — it is safe to commit
- Push subscriptions are stored in memory (in-process Map) — for production, use a persistent database

---

## 🤝 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5, CSS3, ES Modules (no framework) |
| Service Worker | Native Web APIs (Cache API, Background Sync, Push API) |
| Offline Storage | IndexedDB (via raw IDBDatabase API) |
| Backend | Node.js + Express.js |
| Push Notifications | `web-push` npm library (VAPID) |
| Containerization | Docker + Docker Compose |
| Audit | Google Lighthouse |

---

## 📄 License

MIT © 2026 PWA Habit Tracker
