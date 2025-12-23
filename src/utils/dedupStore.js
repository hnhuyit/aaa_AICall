// src/utils/dedupStore.js

// In-memory dedup store (per process)
// Key: message mid
// Value: expireAt (ms)

const store = new Map();

// default TTL: 5 minutes
const DEFAULT_TTL_MS = 5 * 60 * 1000;

// garbage collection every 60s
const GC_INTERVAL_MS = 60 * 1000;

let gcStarted = false;
function startGC() {
  if (gcStarted) return;
  gcStarted = true;

  setInterval(() => {
    const now = Date.now();
    for (const [key, expireAt] of store.entries()) {
      if (expireAt <= now) store.delete(key);
    }
  }, GC_INTERVAL_MS).unref?.(); // unref để không giữ process sống
}

/**
 * Check if a message id has been processed (and not expired)
 * @param {string} key - message mid
 * @returns {Promise<boolean>}
 */
export async function isDuplicated(key) {
  if (!key) return false;
  startGC();

  const expireAt = store.get(key);
  if (!expireAt) return false;

  // expired -> clean and treat as not duplicated
  if (expireAt <= Date.now()) {
    store.delete(key);
    return false;
  }

  return true;
}

/**
 * Mark a message id as processed with TTL
 * @param {string} key - message mid
 * @param {number} ttlMs - optional TTL in ms
 * @returns {Promise<void>}
 */
export async function markProcessed(key, ttlMs = DEFAULT_TTL_MS) {
  if (!key) return;
  startGC();

  const expireAt = Date.now() + Math.max(5_000, Number(ttlMs) || DEFAULT_TTL_MS);
  store.set(key, expireAt);
}

/**
 * Optional helpers for debugging/ops
 */
export function dedupSize() {
  return store.size;
}

export function dedupClear() {
  store.clear();
}
