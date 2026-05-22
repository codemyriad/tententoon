/**
 * Orphan-blob garbage collector. Walks every persisted tententoon
 * state, collects the set of source hashes still referenced, then
 * deletes anything in the IDB `blobs` store that isn't on the list.
 *
 * Single pass, runs synchronously after a delete. Defensive against
 * a concurrent autosave dropping a referenced blob: the reference
 * set is read from localStorage BEFORE the IDB scan, so a blob
 * referenced by a state written after that read might still be
 * deleted. Acceptable: the next user gesture re-uploads the file's
 * blob via putBlob — content-hashed, idempotent.
 */

import { BLOBS_STORE, LS_INDEX, stateKey } from './schema';
import type { IndexEntry, TtState } from './schema';
import { dbAvailable, openTtDb, reqAsPromise, txDone } from './idb';

function referencedHashes(): Set<string> {
  const refs = new Set<string>();
  let entries: IndexEntry[] = [];
  try {
    const raw = localStorage.getItem(LS_INDEX);
    entries = raw ? (JSON.parse(raw) as IndexEntry[]) : [];
  } catch {
    return refs;
  }
  for (const e of entries) {
    try {
      const raw = localStorage.getItem(stateKey(e.id));
      if (!raw) continue;
      const state = JSON.parse(raw) as TtState;
      if (state.source?.kind === 'blob') refs.add(state.source.hash);
    } catch {}
  }
  return refs;
}

/** Drop every blob in IDB that isn't referenced by any current tententoon. */
export async function gcOrphanBlobs(): Promise<number> {
  if (!dbAvailable()) return 0;
  const refs = referencedHashes();
  const db = await openTtDb();
  let dropped = 0;
  try {
    const tx = db.transaction(BLOBS_STORE, 'readwrite');
    const store = tx.objectStore(BLOBS_STORE);
    const keys = (await reqAsPromise(store.getAllKeys())) as IDBValidKey[];
    for (const k of keys) {
      if (typeof k !== 'string') continue;
      if (refs.has(k)) continue;
      store.delete(k);
      dropped++;
    }
    await txDone(tx);
  } finally {
    db.close();
  }
  return dropped;
}
