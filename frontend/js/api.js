/**
 * api.js — API communication layer with offline-first support
 *
 * For write operations (POST/PUT/DELETE), if the browser is offline,
 * the request is queued in IndexedDB and a Background Sync event is registered.
 */

import { queueRequest, getPendingCount } from './db.js';

// Backend API base URL — adjust if hosting the backend elsewhere
export const API_BASE = 'http://localhost:3001';

// UI element for sync status feedback
let syncStatusEl = null;

export function initAPI() {
  syncStatusEl = document.querySelector('[data-testid="sync-status"]');

  // Listen for sync complete messages from the service worker
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        setSyncStatus('Synced');
      }
    });
  }

  // Update sync status on startup
  refreshSyncStatus();
}

export async function refreshSyncStatus() {
  try {
    const count = await getPendingCount();
    setSyncStatus(count > 0 ? 'Sync Pending' : 'Synced');
  } catch {
    setSyncStatus('Synced');
  }
}

function setSyncStatus(status) {
  if (syncStatusEl) {
    syncStatusEl.textContent = status;
    syncStatusEl.className = `sync-status ${status === 'Sync Pending' ? 'pending' : 'synced'}`;
  }
}

/**
 * Perform a GET request (always tries network first, falls back to SW cache).
 */
export async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
  return response.json();
}

/**
 * Perform a write request (POST/PUT/DELETE) with offline queuing.
 * If offline → queues in IndexedDB + registers background sync.
 * If online → sends normally.
 */
export async function apiWrite(path, method = 'POST', body = null) {
  if (!navigator.onLine) {
    return queueOfflineRequest(path, method, body);
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `${method} ${path} failed: ${response.status}`);
    }

    setSyncStatus('Synced');
    return response.json();
  } catch (err) {
    // If a network error occurs while nominally online, queue it
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return queueOfflineRequest(path, method, body);
    }
    throw err;
  }
}

async function queueOfflineRequest(path, method, body) {
  const url = `${API_BASE}${path}`;
  await queueRequest({ url, method, body, tag: 'sync-new-habits' });
  setSyncStatus('Sync Pending');

  // Register background sync if supported
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-new-habits');
      console.log('[API] Background sync registered: sync-new-habits');
    } catch (err) {
      console.warn('[API] Background sync registration failed:', err);
    }
  }

  // Return an optimistic response so UI can update immediately
  return body ? { ...body, id: `offline-${Date.now()}`, offline: true } : { offline: true };
}

// ─── Habits API ───────────────────────────────────────────────────────────────

export async function getHabits() {
  return apiGet('/api/habits');
}

export async function addHabit(name, color) {
  return apiWrite('/api/habits', 'POST', { name, color });
}

export async function completeHabit(id, date) {
  return apiWrite(`/api/habits/${id}/complete`, 'PUT', { date });
}

export async function deleteHabit(id) {
  return apiWrite(`/api/habits/${id}`, 'DELETE');
}

// ─── Push API ─────────────────────────────────────────────────────────────────

export async function sendSubscriptionToServer(subscription) {
  const response = await fetch(`${API_BASE}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) throw new Error('Failed to save subscription on server');
  return response.json();
}

export async function getVapidPublicKey() {
  const data = await apiGet('/api/vapid-public-key');
  return data.publicKey;
}
