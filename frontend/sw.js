// ============================================================
// PWA Habit Tracker - Service Worker (sw.js)
// ============================================================

const CACHE_VERSION = 'habit-tracker-v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Files to cache during install (the App Shell)
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/db.js',
  '/js/api.js',
  '/js/notifications.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ─── Install Event: Cache App Shell ──────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker, caching app shell...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => {
        console.log('[SW] App shell cached successfully.');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(err => console.error('[SW] Cache install failed:', err))
  );
});

// ─── Activate Event: Clean Up Old Caches ─────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker, cleaning old caches...');
  const allowedCaches = [STATIC_CACHE, API_CACHE];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!allowedCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Old caches cleaned. Claiming clients...');
      return self.clients.claim(); // Take control immediately
    })
  );
});

// ─── Fetch Event: Caching Strategies ─────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and chrome-extension requests
  if (event.request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // API requests → Network-First with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }

  // Static assets → Cache-First with network fallback
  event.respondWith(cacheFirstStrategy(event.request));
});

/**
 * Cache-First: Try cache, fall back to network and update cache.
 */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // If offline and no cache, return the offline page
    const cachedIndex = await caches.match('/index.html');
    if (cachedIndex) return cachedIndex;
    return new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
  }
}

/**
 * Network-First: Try network, fall back to cache.
 */
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline - no cached data available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Background Sync Event ────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  console.log('[SW] Background sync event fired:', event.tag);
  if (event.tag === 'sync-new-habits') {
    event.waitUntil(replaySyncQueue());
  }
});

async function replaySyncQueue() {
  const db = await openDB();
  const pendingRequests = await getAllPending(db);
  console.log(`[SW] Replaying ${pendingRequests.length} queued request(s)...`);

  for (const item of pendingRequests) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (response.ok) {
        await deleteItem(db, item.id);
        console.log(`[SW] Synced request ID ${item.id} successfully.`);
      } else {
        console.warn(`[SW] Server returned ${response.status} for request ID ${item.id}. Will retry.`);
      }
    } catch (err) {
      console.error(`[SW] Failed to replay request ID ${item.id}:`, err);
      // Will retry on next sync event
    }
  }

  // Notify all open clients that sync is complete
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE', cacheVersion: CACHE_VERSION }));
}

// ─── Push Notification Event ──────────────────────────────────────────────────
self.addEventListener('push', event => {
  console.log('[SW] Push notification received.');

  let data = {
    title: 'Test Notification',
    body: 'You have a new message from Habit Tracker!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    tag: 'habit-notification',
    renotify: true,
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    data: { url: self.registration.scope },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ─── Notification Click Event ─────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existingClient = clients.find(c => c.url === targetUrl);
      if (existingClient) return existingClient.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Message Event: Communicate with Main Thread ──────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'GET_CACHE_VERSION') {
    event.source.postMessage({ type: 'CACHE_VERSION', version: CACHE_VERSION });
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── IndexedDB Helpers (in SW context) ───────────────────────────────────────
const DB_NAME = 'habit-tracker-sync-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-syncs';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = e => reject(e.target.error);
  });
}

function deleteItem(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = e => reject(e.target.error);
  });
}
