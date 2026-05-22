---
shaping: true
---

# V2 — Gallery (list + open)

**Demo:** Make two tententoons. Open the gallery from the toolbar, see both, click one — you're editing it.

**Closes:** R1, R3 (UI).

---

## Scope

A modal/sheet that lists every tententoon on this device and lets the user open one. Read-only — no rename, delete, or new. Placeholder thumbnails (a colored swatch or first letter of the name) so the layout is real but V5 still owns the JPEG generation.

### In

- `Gallery.svelte` modal triggered by the toolbar button.
- Lists from `tt:index` sorted by `updatedAt` desc.
- Tile click → `loadTententoon(id)` → close modal.
- Empty gallery state with a clear "Upload an image to make your first tententoon" message.

### Out

- Rename, delete, new (V3).
- Real thumbnails (V5).
- Gallery as a route — modal only for now.

---

## Files

| File | Change |
|------|--------|
| `src/components/Gallery.svelte` | NEW — modal, tile grid, open behavior |
| `src/components/GalleryTile.svelte` | NEW — single tile (placeholder thumb, name, updatedAt) |
| `src/components/ui1/UiVariant1.svelte` | EDIT — wire toolbar gallery button to open the modal; manage `galleryOpen` local state |
| `src/lib/persistence/tententoons.ts` | EDIT (V1 already exposes `list()`; double-check it returns sorted by updatedAt) |

---

## Behavior

- **Open trigger.** Gallery button in toolbar (already added in V1) flips a `galleryOpen` boolean in `UiVariant1.svelte`.
- **Modal.** Click-outside / Esc closes. While open, focus moves into the grid; pointer events on the editor are blocked.
- **Tile click.** Calls `loadTententoon(id)` (from V1) → updates `currentTententoon` + editor stores. The Gallery's reactive `$effect` on `currentTententoon.id` closes the modal once the new tententoon loads. (Don't close eagerly — if load fails, user stays in the gallery.)
- **Tile content.** Placeholder thumb (CSS gradient or initial letter on a colored square seeded by id). Name on one line (ellipsis on overflow). Updated-at as relative time ("2 min ago", "yesterday", "May 22").
- **Current tententoon.** Marked with a ring or a "Current" badge so it's clear which one is open.

---

## Sequence

1. Stub `Gallery.svelte` that renders a list of names from `list()`.
2. Add tile layout (grid, thumb placeholder).
3. Wire tile click to `loadTententoon`.
4. Wire toolbar button → modal open.
5. Polish: empty state, current badge, relative time formatting.

---

## Gotchas

- **Reading sync.** `list()` reads `localStorage` — sync, fast. No loading spinner needed.
- **Stale list.** If V1's writes update `tt:index` but the gallery is already open and showing the cached snapshot, we miss updates. Re-read on open is enough for V2 (no auto-refresh while open).
- **Modal layering.** Need to make sure it sits above the existing UI. Reuse the existing modal pattern if there's one (check `Magnifier.svelte`? Probably no modal infra; add a minimal one).
- **Keyboard nav.** Arrow keys + Enter would be nice but not required this slice. Esc to close is required.

---

## Demo script

1. From V1 state with one tententoon, upload a second image → second tententoon created.
2. Click gallery button → modal opens, both tententoons listed, current one badged.
3. Click the other tile → modal closes, editor shows the other tententoon.
4. Click gallery again → previous tententoon is now badged.
5. Reload → `tt:current` still points at the last-opened one.

---

## Tracking

- R1 ✅
- R3 ✅
