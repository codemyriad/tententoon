/**
 * Per-tententoon undo log in IDB. One row per snapshot, keyed by
 * `[id, seq]`. The `byId` index makes "all rows for a tententoon"
 * a cursor scan in sequence order. V5 makes ⌘Z survive reload.
 *
 * Seq is monotonically increasing within a tententoon. Reaches a
 * fresh integer on each appendUndo. truncateRedoTail removes rows
 * with seq ≥ fromSeq when a new edit lands after an undo (R13).
 * trimUndo enforces the depth cap by dropping rows with seq <
 * minSeq from the head as the stack grows past the limit.
 */

import { UNDO_STORE } from './schema';
import type { TtState } from './schema';
import { dbAvailable, openTtDb, reqAsPromise, txDone } from './idb';

type UndoRow = { id: string; seq: number; state: TtState };

export async function appendUndo(id: string, seq: number, state: TtState): Promise<void> {
  if (!dbAvailable()) return;
  const db = await openTtDb();
  try {
    const tx = db.transaction(UNDO_STORE, 'readwrite');
    tx.objectStore(UNDO_STORE).put({ id, seq, state });
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** Read every undo row for `id`, ordered by seq ascending. */
export async function readUndo(id: string): Promise<{ seq: number; state: TtState }[]> {
  if (!dbAvailable()) return [];
  const db = await openTtDb();
  try {
    const tx = db.transaction(UNDO_STORE, 'readonly');
    const idx = tx.objectStore(UNDO_STORE).index('byId');
    const rows = (await reqAsPromise(idx.getAll(id) as IDBRequest<UndoRow[]>)) ?? [];
    await txDone(tx);
    rows.sort((a, b) => a.seq - b.seq);
    return rows.map((r) => ({ seq: r.seq, state: r.state }));
  } finally {
    db.close();
  }
}

/** Delete all rows for `id` with seq ≥ fromSeq. Used when a new edit overwrites a redo tail. */
export async function truncateRedoTail(id: string, fromSeq: number): Promise<void> {
  if (!dbAvailable()) return;
  const db = await openTtDb();
  try {
    const tx = db.transaction(UNDO_STORE, 'readwrite');
    const idx = tx.objectStore(UNDO_STORE).index('byId');
    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        const row = cursor.value as UndoRow;
        if (row.seq >= fromSeq) cursor.delete();
        cursor.continue();
      };
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** Delete rows with seq < minSeq. Used to enforce the depth cap. */
export async function trimUndo(id: string, minSeq: number): Promise<void> {
  if (!dbAvailable()) return;
  const db = await openTtDb();
  try {
    const tx = db.transaction(UNDO_STORE, 'readwrite');
    const idx = tx.objectStore(UNDO_STORE).index('byId');
    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        const row = cursor.value as UndoRow;
        if (row.seq < minSeq) cursor.delete();
        cursor.continue();
      };
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** Drop all undo entries for a tententoon. Used by delete + reset flows. */
export async function dropUndo(id: string): Promise<void> {
  if (!dbAvailable()) return;
  const db = await openTtDb();
  try {
    const tx = db.transaction(UNDO_STORE, 'readwrite');
    const idx = tx.objectStore(UNDO_STORE).index('byId');
    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        cursor.delete();
        cursor.continue();
      };
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}
