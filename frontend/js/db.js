/**
 * db.js — IndexedDB helpers for offline sync queue
 */

const DB_NAME = 'habit-tracker-sync-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-syncs';

let dbInstance = null;

/**
 * Open (or reuse) the IndexedDB connection.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('tag', 'tag', { unique: false });
      }
    };

    request.onsuccess = event => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = event => {
      console.error('[DB] Failed to open IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Queue a failed write request for later sync.
 * @param {{ url: string, method: string, body: object, tag: string }} item
 * @returns {Promise<number>} The ID of the queued item
 */
export async function queueRequest(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add({
      ...item,
      timestamp: Date.now(),
      tag: item.tag || 'sync-new-habits',
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = e => reject(e.target.error);
  });
}

/**
 * Get all pending sync requests.
 * @returns {Promise<Array>}
 */
export async function getAllPending() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = e => reject(e.target.error);
  });
}

/**
 * Get count of pending sync items.
 * @returns {Promise<number>}
 */
export async function getPendingCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = e => reject(e.target.error);
  });
}

/**
 * Delete a synced request by ID.
 * @param {number} id
 */
export async function deleteItem(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = e => reject(e.target.error);
  });
}

/**
 * Clear all pending sync requests.
 */
export async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = e => reject(e.target.error);
  });
}
