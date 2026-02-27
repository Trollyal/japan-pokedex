// lib/storage.js — IndexedDB helpers for state + photo blobs

const DB_NAME = 'japan-guide';
const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrapRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getIDBState() {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readonly');
    return await wrapRequest(tx.objectStore('state').get('appState'));
  } catch { return null; }
}

export async function putIDBState(state) {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readwrite');
    await wrapRequest(tx.objectStore('state').put(state, 'appState'));
  } catch { /* silent */ }
}

export async function putBlob(key, blob) {
  const db = await openDB();
  const tx = db.transaction('photos', 'readwrite');
  await wrapRequest(tx.objectStore('photos').put(blob, key));
}

export async function getBlob(key) {
  const db = await openDB();
  const tx = db.transaction('photos', 'readonly');
  return await wrapRequest(tx.objectStore('photos').get(key));
}

export async function deleteBlob(key) {
  const db = await openDB();
  const tx = db.transaction('photos', 'readwrite');
  await wrapRequest(tx.objectStore('photos').delete(key));
}

export async function getAllBlobKeys() {
  const db = await openDB();
  const tx = db.transaction('photos', 'readonly');
  return await wrapRequest(tx.objectStore('photos').getAllKeys());
}
