---
shaping: true
---

# V1 — Tententoon model + autosave

**Demo:** Drag the nest, reload the page, your work is still there. Toolbar shows the tententoon's name.

**Closes:** R0, R8, R10. Partial R3 (open-by-id exists but no UI to pick one yet — gallery is V2).

---

## Scope

**(Revised after reading the codebase.)** The primary UI (`/`) is `UiVariant1`, with state in `src/lib/ui1/state.svelte.ts` (`doc.image`, `doc.rect`, `doc.crop`, `playback`, `ui`). Nothing of `doc.rect`/`doc.crop`/`playback` persists today — that's the user-visible gap. A separate IDB called `tententoon` (store `history`, 3 image slots) already exists for the RecentMenu dropdown; that stays as-is.

The legacy `/ui1` route, `imageState`/`selectionState`/`persistence.ts`, and the legacy `components/*.svelte` panels are being **deleted** this slice (user direction). No migration.

### In

- New persistence module under `src/lib/ui1/persistence/`, in its own IDB (`tt-store`, stores `blobs`, `undo` empty for V1, `thumbs` empty for V1) + localStorage (`tt:index`, `tt:current`, `tt:<id>:state`).
- `currentTententoon` store (`{id, name}`) added to `lib/ui1`.
- Autosave engine that writes the current tententoon's state on gesture-end (pointerup in CanvasStage, source swaps via setImage).
- bootRestore on app mount: read `tt:current`; if present, hydrate doc + currentTententoon.
- TopBar gets a name slot showing `currentTententoon.name` (read-only).
- DropZone/TopBar file-load flow creates a tententoon alongside the existing `addToHistory` Recent entry.
- Delete: legacy `App.svelte` `<main>` branch, `src/lib/persistence.ts`, `src/lib/stores/{image,selection,interaction,pipeline}.svelte.ts`, `src/components/{Uploader,SourcePanel,LogPanel,RotatedLogPanel,EscherPanel,EscherZoomPanel,ZoomPreview,RectanglePicker,Magnifier,Panel}.svelte`.

### Out

- Migration from old `droste:*` keys (legacy users are losing it by choice).
- Gallery list UI (V2).
- Rename, delete, new (V3).
- Undo / Redo (V4–V5).
- Real thumbnails (V5).
- Persistent undo log (V5).

---

## Files

| File | Change |
|------|--------|
| `src/lib/persistence/index.ts` | NEW — re-exports the V1 API |
| `src/lib/persistence/schema.ts` | NEW — `Tententoon`, `IndexEntry`, `State`, `SourceRef` types |
| `src/lib/persistence/idb.ts` | NEW — IDB open + stores: `blobs`, `undo` (empty in V1), `thumbs` (empty in V1) |
| `src/lib/persistence/blobs.ts` | NEW — `putBlob(blob) → hash`, `getBlob(hash)` |
| `src/lib/persistence/tententoons.ts` | NEW — `create`, `load`, `writeState`, `list`, `getCurrentId`, `setCurrentId` |
| `src/lib/persistence/migrate.ts` | NEW — one-time read of the old `droste:*` keys and IDB single-slot upload → create one tententoon |
| `src/lib/persistence.ts` | DELETE old default exports; thin re-export from `persistence/index.ts` for any leftover callers |
| `src/lib/stores/tententoon.svelte.ts` | NEW — `currentTententoon` runes store |
| `src/lib/stores/autosave.svelte.ts` | NEW — `markGestureEnd()` API + effect that writes state on gesture-end |
| `src/lib/stores/image.svelte.ts` | EDIT — `restoreLastSession` → `bootRestore`; uploads call new `putBlob` + `createTententoon`; URL sources call `createTententoon` with `{kind: 'url', url}` |
| `src/lib/stores/selection.svelte.ts` | EDIT — replace `persist()` with a write to the autosave engine; drag handlers call `markGestureEnd()` on pointerup |
| `src/App.svelte` | EDIT — boot path uses `bootRestore`; toolbar gets a name slot |
| `src/components/ui1/UiVariant1.svelte` (or wherever toolbar lives) | EDIT — render name from `currentTententoon` |

---

## Data shapes

```ts
type SourceRef =
  | { kind: 'url'; url: string }
  | { kind: 'blob'; hash: string };  // content hash of the uploaded image

type State = {
  source: SourceRef;
  nest: Rect;
  crop: Rect;
  aspectLocked: boolean;
};

type IndexEntry = {
  id: string;          // crypto.randomUUID()
  name: string;        // e.g. "droste-image.jpg · 2026-05-22 14:03"
  createdAt: number;
  updatedAt: number;
};

type CurrentTententoon = { id: string; name: string };
```

### Storage keys

- `localStorage['tt:index']` → `IndexEntry[]`
- `localStorage['tt:current']` → `string | null`
- `localStorage['tt:<id>:state']` → `State`
- IDB `tententoons` db, stores: `blobs` (key = hash), `undo` (empty in V1), `thumbs` (empty in V1)

---

## Sequence

1. **Schema + storage primitives** (`schema.ts`, `idb.ts`, `blobs.ts`).
2. **CRUD primitives** (`tententoons.ts`): `create`, `load`, `writeState`, `list`, `getCurrentId`, `setCurrentId`. No UI yet — unit test by calling from a debug script if useful.
3. **currentTententoon store** + autosave engine. Autosave subscribes to `selectionState` and `imageState.source`, but only writes when `markGestureEnd()` is called (no per-frame writes during drag).
4. **Wire selection drags** to call `markGestureEnd()` on pointerup (in `RectanglePicker.svelte` or wherever drags end). Same for source swap (immediate gesture-end).
5. **Migration** (`migrate.ts`): read `droste:last`, `droste:rect:<key>`, IDB `droste/uploads/current`. Create one tententoon. Delete the old keys.
6. **bootRestore**: replace `restoreLastSession()`. If `tt:current` set → `loadTententoon(id)`. Else run migration. Else: leave editor empty.
7. **Toolbar name slot** wired to `currentTententoon.name`.
8. **Manual QA**: load app, drag nest, reload — selection restored. Upload an image, reload — image + selection restored. Upgrade from an existing install (use a backup of localStorage from current main).

---

## Gotchas

- **Content hashing.** Use `crypto.subtle.digest('SHA-256', buf)` and hex-encode. For very large uploads this is fast enough; no need to chunk.
- **Don't re-fire autosave from apply.** `loadTententoon` writes `imageState`/`selectionState`; the autosave effect must skip during a "loading" phase. Use a `currentTententoon.loading` flag (or a generation counter).
- **URL sources don't hit IDB.** Their `SourceRef` is just `{kind: 'url', url}` — `loadTententoon` re-fetches via `loadImageFromUrl`.
- **Migration is one-shot.** Write a `tt:migrated:v1` sentinel after the first successful run so we don't keep trying to migrate old keys that no longer exist.
- **`writeState` debounce.** Even with gesture-end gating, source loads and aspect-lock toggles fire writes. localStorage writes are sync but tiny — don't bother debouncing for V1.

---

## Demo script

1. Fresh install (clear storage): app loads with empty editor (`P1.2`).
2. Upload an image → first tententoon is created, named after the file. Toolbar shows the name.
3. Drag the nest. Reload. Nest position is preserved.
4. Hard reload after a source swap. Source + selection restored.
5. Open browser devtools → Application → localStorage shows `tt:index` with one entry, `tt:current` set, `tt:<id>:state` populated.

---

## Tracking

- R0 ✅
- R8 ✅
- R10 ✅
- R3 ✅ (mechanism exists; UI to pick is V2)
- R12 partially — name is auto-set from filename, but no rename UI yet (V3).
- R15 ✅ (empty editor on no-current).
