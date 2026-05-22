---
shaping: true
---

# V5 — Persistent undo + thumbnails + GC

**Demo:** Drag a few times. Reload. Undo still works back through every drag. Gallery shows real thumbnails of each tententoon's current frame. Delete a tententoon — its blobs are freed too.

**Closes:** R6, R11, R14.

---

## Scope

The closing slice. Three independent pieces that all touch storage:

1. **Persistent undo log.** Append each `pushUndo` to IDB `undo`. On `loadTententoon`, hydrate the in-memory stack from IDB.
2. **Real thumbnails.** Grab the EscherPanel canvas on every autosave, JPEG-encode it, store in IDB `thumbs`. Gallery tiles render from there.
3. **Orphan-blob GC.** On every delete, reference-count blobs across all remaining `State`s; drop unreferenced ones.

### In

- IDB `undo` store schema: keyed `(id, seq)`, value `State`. Index on `id` for cursor reads.
- `pushUndo` writes to IDB; `truncateRedoTail(id, fromSeq)` deletes by cursor.
- `readUndo(id)` loads the full sequence into `undoState`.
- Undo depth cap: keep the most recent N = 100 entries per tententoon. Drop the head when exceeded.
- Thumbnail capture: after autosave's `writeState`, run a `requestIdleCallback`-deferred `regenerateThumbnail(id)`.
- `gcOrphanBlobs()` on every delete (+ a "Compact storage" debug button somewhere if useful).

### Out

- Quota-exceeded UX (a stretch goal — show a toast). For V5, just log and let the next write retry on its own.
- Compression beyond JPEG for thumbnails. 240×180 @ quality 0.7 is fine.
- Cross-device sync — explicitly out of scope for this whole shaping.

---

## Files

| File | Change |
|------|--------|
| `src/lib/persistence/idb.ts` | EDIT — open the `undo` and `thumbs` stores from V1 with full indexes; bump db version if needed |
| `src/lib/persistence/undo.ts` | NEW — `appendUndo(id, seq, state)`, `readUndo(id)`, `truncateRedoTail(id, fromSeq)`, `dropUndo(id)` |
| `src/lib/persistence/thumbs.ts` | NEW — `putThumb(id, blob)`, `getThumb(id)`, `deleteThumb(id)` |
| `src/lib/persistence/gc.ts` | NEW — `gcOrphanBlobs()` walks all `State`s in `tt:index`, collects referenced hashes, deletes unreferenced from `S4 blobs` |
| `src/lib/persistence/tententoons.ts` | EDIT — `remove(id)` calls `dropUndo`, `deleteThumb`, `gcOrphanBlobs` |
| `src/lib/stores/undo.svelte.ts` | EDIT — `pushUndo` also writes to IDB; `loadTententoon` reads stack from IDB; enforce depth cap |
| `src/lib/stores/autosave.svelte.ts` | EDIT — after `writeState`, schedule `regenerateThumbnail(id)` on idle |
| `src/components/GalleryTile.svelte` | EDIT — render thumb as `<img src={ObjectURL(blob)}>`; revoke on unmount |

---

## Undo persistence model

- IDB `undo` keyPath: `[id, seq]`. Index `byId` on `id`.
- `seq` starts at 0 and increments per push within a tententoon.
- `undoState` in memory: `{ stack: State[]; pointer: number; baseSeq: number }`.
  - `baseSeq` = the IDB seq of `stack[0]`.
  - `stack[i]` corresponds to IDB seq `baseSeq + i`.
- `pushUndo(state)`:
  1. If `pointer < stack.length - 1`, truncate redo tail in memory AND call `truncateRedoTail(id, baseSeq + pointer + 1)`.
  2. Push to in-memory `stack`. Set `pointer = stack.length - 1`.
  3. `appendUndo(id, baseSeq + pointer, state)`.
  4. If `stack.length > 100`: `stack.shift()`, increment `baseSeq`, fire-and-forget `deleteByCursor(id, < new baseSeq)`.
- `loadTententoon(id)`:
  1. `readUndo(id)` → cursor over the byId index, sorted by seq.
  2. Build `stack`, `pointer = stack.length - 1`, `baseSeq = firstSeq`.
  3. If no undo entries (legacy or freshly created): seed with the loaded `State` as a single entry.

---

## Thumbnail capture

- Source canvas: the `EscherPanel` output (or whichever is the canonical "this is your tententoon" view).
- Down-sample: render to a 240×180 offscreen canvas (preserve aspect — letterbox if needed), then `canvas.toBlob('image/jpeg', 0.7)`.
- Write Blob to IDB `thumbs[id]`.
- Gallery: `getThumb(id)` returns `Blob | null`; component creates `URL.createObjectURL`, revokes on unmount or when the blob changes.

**Trigger discipline:**

- Run from a `requestIdleCallback` queued after autosave's `writeState`.
- Coalesce: if a regeneration is already pending for `id`, no-op the second request.
- This means the thumb is at-most one update behind the state — fine.

---

## Garbage collection

- Run on `remove(id)` after deletion.
- Algorithm:
  1. Read every `IndexEntry` in `tt:index`.
  2. For each, read `tt:<entryId>:state`, collect `state.source.hash` if `kind === 'blob'`.
  3. Walk IDB `blobs` keys; delete any key not in the collected set.
- Single pass, no transactions across stores needed. Fine to run sync after delete.

---

## Sequence

1. Bump IDB version; create indexes on `undo`.
2. `undo.ts`, `thumbs.ts`, `gc.ts` primitives + smoke tests via debug script.
3. Wire `pushUndo` / `loadTententoon` to IDB.
4. Enforce 100-entry cap.
5. Thumbnail capture from EscherPanel canvas → tile rendering in gallery.
6. GC on delete.
7. Manual QA across the matrix.

---

## Test matrix

| Action | Expected |
|--------|----------|
| Drag 5 times, reload, click Undo 5 times | All five steps restored, then Undo disabled |
| Drag 5 times, Undo 2, drag 1, reload | Stack ends at the new drag; redo disabled |
| Drag 200 times | Stack capped at 100; oldest entries gone from IDB |
| Create tententoon → autosave → wait a frame → open gallery | Thumb shows current preview |
| Delete tententoon with unique upload | Blob hash gone from IDB |
| Delete one of two tententoons sharing the same uploaded image | Blob NOT deleted (still referenced) |

---

## Gotchas

- **Canvas readback timing.** The EscherPanel renders async (it's GPU). Capture after the next animation frame following the state change, not synchronously.
- **JPEG quality vs gallery look.** 0.7 is the right starting point; the thumb is small enough that artifacts are imperceptible. If gallery feels grainy, bump to 0.8.
- **Idle callback shim.** Safari iOS doesn't have `requestIdleCallback`. Fall back to `setTimeout(..., 100)`.
- **GC + concurrent writes.** If GC runs while autosave fires, an in-flight `putBlob` might be deleted. Defensive: take the "referenced hashes" snapshot first, then delete; if an autosave happens in between, the worst case is a blob gets deleted and re-uploaded on next session — acceptable.
- **Undo size budget.** 100 snapshots × maybe 200 bytes each = ~20KB per tententoon. Trivial. Don't bother compressing.
- **Schema migration from V1.** V1 created the `undo` store empty. V5 needs a real schema (indexes). Bump db version → onupgradeneeded creates the index. No data loss because there's nothing in there yet.

---

## Demo script

1. Edit a tententoon (5 drags). Reload. Undo 5 times — every step restored.
2. Open gallery — every tile has a real thumbnail showing the saved preview.
3. Edit, watch the thumbnail update next time the gallery opens.
4. Upload the same image into two tententoons. Delete one. Open IDB devtools → blob still present. Delete the other. Blob gone.

---

## Tracking

- R6 ✅ (undo survives reload)
- R11 ✅ (depth cap + orphan GC)
- R14 ✅ (thumbs refresh on every save)
