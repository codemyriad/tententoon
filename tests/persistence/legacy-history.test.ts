import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getBlob, hashBlob } from '../../src/lib/ui1/persistence/blobs';
import { recoverSourceBlob } from '../../src/lib/ui1/persistence/legacy-history';

const LEGACY_DB = 'tententoon';
const CURRENT_DB = 'tt-store';
const LEGACY_STORE = 'history';

type LegacyEntry = {
  id: string;
  name: string;
  blob: Blob;
  width: number;
  height: number;
  thumbDataUrl: string;
  savedAt: number;
};

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onblocked = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function seedLegacyHistory(entries: Array<Partial<LegacyEntry> & { name: string; blob: Blob }>) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(LEGACY_DB, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(LEGACY_STORE, { keyPath: 'id' });
    };
  });

  try {
    const tx = db.transaction(LEGACY_STORE, 'readwrite');
    const store = tx.objectStore(LEGACY_STORE);
    entries.forEach((entry, i) => {
      store.put({
        id: entry.id ?? `legacy-${i}`,
        name: entry.name,
        blob: entry.blob,
        width: entry.width ?? 1,
        height: entry.height ?? 1,
        thumbDataUrl: entry.thumbDataUrl ?? '',
        savedAt: entry.savedAt ?? i
      });
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}

async function blobText(blob: Blob | null): Promise<string | null> {
  return blob ? await blob.text() : null;
}

beforeEach(async () => {
  await deleteDb(LEGACY_DB);
  await deleteDb(CURRENT_DB);
});

afterEach(async () => {
  await deleteDb(LEGACY_DB);
  await deleteDb(CURRENT_DB);
});

describe('legacy recent-image recovery', () => {
  it('hydrates a source-less saved tententoon from one matching legacy history name', async () => {
    const oldBlob = new Blob(['old picture bytes'], { type: 'image/png' });
    await seedLegacyHistory([{ name: 'portrait.png', blob: oldBlob }]);

    const recovered = await recoverSourceBlob(null, ['portrait.png · 2026-05-28 15:12']);

    expect(recovered?.source).toMatchObject({ kind: 'blob' });
    if (!recovered || recovered.source.kind !== 'blob') throw new Error('expected blob source');
    expect(await blobText(recovered.blob)).toBe('old picture bytes');
    expect(await blobText(await getBlob(recovered.source.hash))).toBe('old picture bytes');
  });

  it('hydrates a missing blob-backed source only by exact content hash', async () => {
    const oldBlob = new Blob(['exact picture bytes'], { type: 'image/png' });
    const hash = await hashBlob(oldBlob);
    await seedLegacyHistory([{ name: 'renamed-in-history.png', blob: oldBlob }]);

    const recovered = await recoverSourceBlob({ kind: 'blob', hash }, ['unrelated-name.png']);

    expect(recovered?.source).toEqual({ kind: 'blob', hash });
    expect(await blobText(await getBlob(hash))).toBe('exact picture bytes');
  });

  it('does not recover a hash-backed source from a same-name but different blob', async () => {
    const wrongBlob = new Blob(['wrong picture bytes'], { type: 'image/png' });
    await seedLegacyHistory([{ name: 'portrait.png', blob: wrongBlob }]);

    const recovered = await recoverSourceBlob({ kind: 'blob', hash: '0'.repeat(64) }, ['portrait.png']);

    expect(recovered).toBeNull();
    expect(await getBlob('0'.repeat(64))).toBeNull();
  });

  it('does not recover source-less state from ambiguous legacy names', async () => {
    await seedLegacyHistory([
      { name: 'portrait.png', blob: new Blob(['first'], { type: 'image/png' }) },
      { name: 'portrait.png', blob: new Blob(['second'], { type: 'image/png' }) }
    ]);

    const recovered = await recoverSourceBlob(null, ['portrait.png']);

    expect(recovered).toBeNull();
  });
});
