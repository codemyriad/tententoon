/**
 * Recent-tententoons history. Up to 3 user-loaded images persist in
 * IndexedDB across sessions so the user can flip back to the last few
 * pictures without re-finding the file.
 *
 * Stores: id, name, original blob (for re-decode), dimensions, a tiny
 * JPEG thumbnail data URL for the dropdown, and savedAt for ordering.
 * Dedupe is by name: re-loading the same filename refreshes the entry's
 * timestamp instead of stacking duplicates.
 *
 * Reactive: components read `historyState.entries` (a $state array)
 * which is kept in sync with the DB by add/load/clear calls.
 */

const DB_NAME = 'tententoon';
const DB_VERSION = 1;
const STORE = 'history';
const MAX_ENTRIES = 3;
const THUMB_LONG_SIDE = 160;
const THUMB_QUALITY = 0.8;

export type HistoryEntry = {
  id: string;
  name: string;
  blob: Blob;
  width: number;
  height: number;
  thumbDataUrl: string;
  savedAt: number;
};

export const historyState = $state<{ entries: HistoryEntry[] }>({ entries: [] });

function dbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function makeThumbnail(image: ImageBitmap): Promise<string> {
  const longSide = Math.max(image.width, image.height);
  const scale = Math.min(1, THUMB_LONG_SIDE / longSide);
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(image, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', THUMB_QUALITY);
}

async function readAll(db: IDBDatabase): Promise<HistoryEntry[]> {
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const all = await reqAsPromise(store.getAll() as IDBRequest<HistoryEntry[]>);
  await txDone(tx);
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

/** Populate `historyState.entries` from IndexedDB. Call once on app mount. */
export async function loadHistory(): Promise<void> {
  if (!dbAvailable()) return;
  try {
    const db = await openDb();
    historyState.entries = await readAll(db);
    db.close();
  } catch {
    historyState.entries = [];
  }
}

/**
 * Persist a freshly-loaded image to history. Deduplicates by name; evicts
 * the oldest entry once the list grows past MAX_ENTRIES. Failures are
 * swallowed — history is a nice-to-have, not load-bearing.
 */
export async function addToHistory(blob: Blob, image: ImageBitmap, name: string): Promise<void> {
  if (!dbAvailable()) return;
  try {
    const thumbDataUrl = await makeThumbnail(image);
    const db = await openDb();
    const existing = await readAll(db);
    // Drop any prior entry with the same display name so reloading the
    // same picture surfaces it as "most recent" rather than stacking.
    const idsToDelete = existing.filter((e) => e.name === name).map((e) => e.id);
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      name,
      blob,
      width: image.width,
      height: image.height,
      thumbDataUrl,
      savedAt: Date.now()
    };
    const remaining = existing
      .filter((e) => !idsToDelete.includes(e.id))
      .sort((a, b) => b.savedAt - a.savedAt);
    // After insertion, keep only the newest (MAX_ENTRIES - 1) of the
    // old entries so the total never exceeds MAX_ENTRIES.
    const toKeep = remaining.slice(0, MAX_ENTRIES - 1);
    const toEvict = remaining.slice(MAX_ENTRIES - 1);

    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const id of idsToDelete) store.delete(id);
    for (const e of toEvict) store.delete(e.id);
    store.put(entry);
    await txDone(tx);

    historyState.entries = [entry, ...toKeep];
    db.close();
  } catch {
    // best-effort; ignore quota / opaque-origin errors
  }
}

/** Re-decode a stored entry's blob into an ImageBitmap. */
export async function loadFromHistory(
  id: string
): Promise<{ image: ImageBitmap; name: string } | null> {
  if (!dbAvailable()) return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const entry = await reqAsPromise(
      store.get(id) as IDBRequest<HistoryEntry | undefined>
    );
    await txDone(tx);
    db.close();
    if (!entry) return null;
    const image = await createImageBitmap(entry.blob);
    return { image, name: entry.name };
  } catch {
    return null;
  }
}

/** Remove one entry by id (used by the "remove" affordance in the menu). */
export async function removeFromHistory(id: string): Promise<void> {
  if (!dbAvailable()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
    db.close();
    historyState.entries = historyState.entries.filter((e) => e.id !== id);
  } catch {
    // ignore
  }
}
