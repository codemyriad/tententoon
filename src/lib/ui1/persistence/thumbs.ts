/**
 * Per-tententoon JPEG thumbnail Blobs in IDB. Keyed by tententoon id.
 * Written by the autosave path (idle-scheduled canvas grab), read by
 * the gallery tiles via the in-memory thumbCache.
 */

import { THUMBS_STORE } from './schema';
import { dbAvailable, openTtDb, reqAsPromise, txDone } from './idb';

export async function putThumb(id: string, blob: Blob): Promise<void> {
  if (!dbAvailable()) return;
  const db = await openTtDb();
  try {
    const tx = db.transaction(THUMBS_STORE, 'readwrite');
    tx.objectStore(THUMBS_STORE).put(blob, id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function getThumb(id: string): Promise<Blob | null> {
  if (!dbAvailable()) return null;
  const db = await openTtDb();
  try {
    const tx = db.transaction(THUMBS_STORE, 'readonly');
    const req = tx.objectStore(THUMBS_STORE).get(id);
    const blob = (await reqAsPromise(req)) as Blob | undefined;
    await txDone(tx);
    return blob ?? null;
  } finally {
    db.close();
  }
}

export async function deleteThumb(id: string): Promise<void> {
  if (!dbAvailable()) return;
  const db = await openTtDb();
  try {
    const tx = db.transaction(THUMBS_STORE, 'readwrite');
    tx.objectStore(THUMBS_STORE).delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}
