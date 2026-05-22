---
shaping: true
---

# V3 — Delete + rename + new

**Demo:** Rename a tententoon. Delete one (with confirm). Click "New" — start fresh from an empty editor.

**Closes:** R2, R12 (rename UI).

---

## Scope

Make the gallery a real CRUD list. Rename via inline modal (click on name in toolbar OR rename action on tile). Delete with a confirmation. "New" creates an empty tententoon and routes to the empty-editor state (no source yet — user uploads).

### In

- Rename modal (P3): single text input + Save / Cancel.
- Delete confirmation (P4): "Delete '<name>'? This can't be undone." Yes / Cancel.
- New tententoon action in gallery: creates an unbound tententoon (no source), sets it current, navigates to P1.2 empty state (the editor's empty state from V1) inside the editor with the upload control prominent.
- Toolbar name becomes click-to-rename.

### Out

- Orphan blob garbage collection (V5 — V3 deletes the tententoon's localStorage entries and IDB undo log, but unused blobs in `S4` stay until V5's `gcOrphanBlobs`).
- Bulk operations.
- Undo for delete itself — out of scope; delete is final.

---

## Files

| File | Change |
|------|--------|
| `src/components/RenameModal.svelte` | NEW — input + Save / Cancel |
| `src/components/DeleteConfirm.svelte` | NEW — destructive confirm dialog |
| `src/components/Gallery.svelte` | EDIT — tile hover actions: rename, delete; "New" button |
| `src/components/GalleryTile.svelte` | EDIT — hover overlay with action buttons |
| `src/components/ui1/UiVariant1.svelte` | EDIT — name display is a button that opens RenameModal |
| `src/lib/persistence/tententoons.ts` | EDIT — `rename(id, name)`, `remove(id)` (drops state + undo log; leaves blobs to V5) |

---

## Behavior

### Create (new tententoon)

1. User clicks "New" in gallery.
2. `createTententoon({ source: null, name: 'Untitled · <timestamp>' })` — but V1's `create` requires a source. Refactor V1's `create` to allow `source: null` and persist a partial state.
3. Set as current. Close gallery. Editor renders empty state (P1.2). User uploads → existing autosave path fills in the source.

Refactor note: `State.source` becomes `SourceRef | null`. `loadTententoon` for a null-source tententoon just clears `imageState.source`.

### Rename

- Trigger A: click toolbar name → opens RenameModal with current name pre-filled.
- Trigger B: hover a gallery tile, click the rename icon → same modal.
- Save → `rename(id, newName)` → updates `IndexEntry.name` and the in-memory `currentTententoon.name` if it's the current one.
- Cancel / Esc → no change.

### Delete

- Trigger: hover gallery tile, click delete icon → DeleteConfirm appears.
- Confirm → `remove(id)`:
  - Drop `localStorage['tt:<id>:state']`.
  - Drop IDB `undo` entries for this id (cursor + delete by id index).
  - Drop IDB `thumbs[id]` (placeholder ok — V5 may not be live yet).
  - Remove from `tt:index`.
  - If `id === currentTententoonId`: set `tt:current` to null, clear editor stores, render empty state.
- Cancel → no-op.

---

## Sequence

1. Refactor `State.source` to allow null; `createTententoon` accepts no source.
2. Wire "New" button.
3. Build `RenameModal`, wire both triggers.
4. Build `DeleteConfirm`, wire `remove()`.
5. Polish hover overlays on tiles.

---

## Gotchas

- **Names must be unique?** No — let the user have duplicates. Disambiguate by id internally; show created-at on hover if needed.
- **Empty-name save.** Disable Save when input is empty/whitespace.
- **Delete current tententoon.** After delete, we must not leave a dangling `currentTententoon`. Either auto-load the most-recently-updated remaining tententoon, or go to empty state. Pick: empty state (matches V1's R15 behavior — user re-chooses explicitly).
- **Stale references.** If the gallery is open while a rename happens, the visible name updates because the gallery reads from `tt:index` via a reactive `$derived` (make sure it is, not a one-shot read at mount).

---

## Demo script

1. Click toolbar name → RenameModal opens with current name. Type new name. Save. Toolbar updates.
2. Open gallery. Hover a tile → rename + delete icons appear. Click rename. Save. List updates.
3. Click delete on a non-current tile. Confirm. Tile disappears.
4. Click delete on the current tile. Confirm. Modal closes; editor shows empty state.
5. Click "New" in gallery. Editor shows empty state with upload prominent. Upload an image → autosave fills in the source for this new tententoon.

---

## Tracking

- R2 ✅
- R12 ✅ (rename UI live)
- Partial R11 — delete removes state but leaves orphan blobs in S4 until V5's GC
