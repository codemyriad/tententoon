/**
 * Read-only bridge to the older Recent-menu image store. Some saved
 * tententoons may still have their localStorage state/index while their
 * newer `tt-store.blobs` entry is absent. When possible, recover the
 * source Blob from the old `tententoon/history` records without deleting
 * or rewriting that legacy store.
 */

import type { SourceRef } from './schema';
import { hashBlob, putBlob } from './blobs';
import { dbAvailable, reqAsPromise, txDone } from './idb';

const LEGACY_DB = 'tententoon';
const LEGACY_STORE = 'history';

type LegacyHistoryEntry = {
  id?: string;
  name?: string;
  blob?: Blob;
  width?: number;
  height?: number;
  thumbDataUrl?: string;
  savedAt?: number;
};

export type RecoveredSourceBlob = {
  blob: Blob;
  source: SourceRef;
};

function openLegacyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LEGACY_DB);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      // If the DB did not exist, leave it empty; recovery will no-op.
    };
  });
}

function hasBlob(entry: LegacyHistoryEntry): entry is LegacyHistoryEntry & { blob: Blob } {
  return typeof Blob !== 'undefined' && entry.blob instanceof Blob;
}

async function readLegacyHistory(): Promise<Array<LegacyHistoryEntry & { blob: Blob }>> {
  if (!dbAvailable()) return [];
  let db: IDBDatabase | null = null;
  try {
    db = await openLegacyDb();
    if (!db.objectStoreNames.contains(LEGACY_STORE)) return [];
    const tx = db.transaction(LEGACY_STORE, 'readonly');
    const store = tx.objectStore(LEGACY_STORE);
    const rows = (await reqAsPromise(
      store.getAll() as IDBRequest<LegacyHistoryEntry[]>
    )) ?? [];
    await txDone(tx);
    return rows.filter(hasBlob);
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

function candidateNames(names: string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    out.add(name);
    const generatedSuffix = name.lastIndexOf(' · ');
    if (generatedSuffix > 0) out.add(name.slice(0, generatedSuffix).trim());
  }
  return out;
}

async function recoverByHash(
  entries: Array<LegacyHistoryEntry & { blob: Blob }>,
  source: SourceRef
): Promise<RecoveredSourceBlob | null> {
  if (source.kind !== 'blob') return null;
  for (const entry of entries) {
    try {
      if ((await hashBlob(entry.blob)) !== source.hash) continue;
      await putBlob(entry.blob);
      return { blob: entry.blob, source };
    } catch {}
  }
  return null;
}

async function recoverByName(
  entries: Array<LegacyHistoryEntry & { blob: Blob }>,
  names: string[]
): Promise<RecoveredSourceBlob | null> {
  const candidates = candidateNames(names);
  if (candidates.size === 0) return null;
  const matches = entries.filter((entry) => {
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    return name !== '' && candidates.has(name);
  });
  if (matches.length !== 1) return null;
  const blob = matches[0].blob;
  const hash = await putBlob(blob);
  return { blob, source: { kind: 'blob', hash } };
}

/**
 * Try to repopulate a missing source Blob from the older recent-image
 * database. Hash recovery is exact; filename recovery only runs when
 * there is a single unambiguous match.
 */
export async function recoverSourceBlob(
  source: SourceRef | null,
  names: string[]
): Promise<RecoveredSourceBlob | null> {
  const entries = await readLegacyHistory();
  if (entries.length === 0) return null;
  if (source) {
    const byHash = await recoverByHash(entries, source);
    if (byHash) return byHash;
    return null;
  }
  return recoverByName(entries, names);
}
