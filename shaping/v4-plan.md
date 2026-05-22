---
shaping: true
---

# V4 — Undo / Redo (in-session)

**Demo:** Drag the nest. Drag it again. Click Undo — first drag restored. Click Undo again — original position. Click Redo twice — back to the latest. New edit while pointer is mid-stack truncates the redo tail.

**Closes:** R4, R5 (within a session), R9, R13.
**Doesn't close yet:** R6 (undo survives reload — V5).

---

## Scope

In-memory undo stack per tententoon, populated by the autosave engine on gesture-end. Undo/Redo buttons in toolbar. Apply-snapshot mode that suppresses pushing to the stack while the apply is in flight.

### In

- `undoState` runes store per currentTententoon: `{ stack: State[]; pointer: number }`. `pointer = stack.length - 1` means we're at the head.
- `pushUndo(state)` — appends; if `pointer < stack.length - 1`, drop everything after `pointer` first (redo-tail truncation, R13).
- `undo()` — moves pointer back by 1, applies `stack[pointer]` via `applySnapshot`.
- `redo()` — moves pointer forward by 1, applies.
- `applySnapshot(snap)` — writes to `imageState`/`selectionState` with `isApplying = true` so the autosave engine's gesture-end callback skips `pushUndo` (but still does `writeState`).
- Toolbar buttons: Undo (disabled when `pointer === 0`), Redo (disabled when `pointer === stack.length - 1`).
- Keyboard: `Cmd/Ctrl-Z`, `Cmd/Ctrl-Shift-Z`. Bind in `App.svelte`.

### Out

- Persisting undo across reload (V5).
- Cross-tententoon history (decided out in shaping — per-tententoon only).
- Capping stack depth (V5 adds the cap when persisting; in-memory is fine unbounded for one session).
- Loading source for a re-applied snapshot if the source changed (rare edge — see Gotchas).

---

## Files

| File | Change |
|------|--------|
| `src/lib/stores/undo.svelte.ts` | NEW — `undoState`, `pushUndo`, `undo`, `redo`, `applySnapshot`, `isApplying` flag |
| `src/lib/stores/autosave.svelte.ts` | EDIT — on gesture-end, call `pushUndo(state)` UNLESS `isApplying` is set |
| `src/lib/stores/tententoon.svelte.ts` | EDIT — `loadTententoon` initializes `undoState` from the loaded `State` (single-entry stack); discards previous in-memory stack |
| `src/components/ui1/UiVariant1.svelte` | EDIT — Undo/Redo buttons in toolbar, disabled bindings |
| `src/App.svelte` | EDIT — keyboard shortcuts |

---

## Snapshot shape

Same as V1's `State`:

```ts
type State = {
  source: SourceRef | null;
  nest: Rect;
  crop: Rect;
  aspectLocked: boolean;
};
```

Cheap to clone (a few numbers + a tiny SourceRef). Each gesture pushes one. A long session might accumulate a few hundred entries — still tiny.

---

## Sequence

1. `undo.svelte.ts` with `undoState`, push/undo/redo/applySnapshot, `isApplying` flag.
2. Wire autosave engine's gesture-end → `pushUndo` (guarded by `isApplying`).
3. Wire `loadTententoon` to reset `undoState` to `{ stack: [state], pointer: 0 }`.
4. Toolbar buttons.
5. Keyboard shortcuts (Cmd/Ctrl-Z, Cmd/Ctrl-Shift-Z, ignore when target is a text input — e.g., RenameModal).
6. Manual QA covering the matrix below.

---

## Test matrix

| Action | Expected |
|--------|----------|
| Fresh tententoon, no edits, click Undo | Disabled (no-op) |
| Drag once, click Undo | Initial state restored |
| Drag twice, Undo, Undo | Two steps back |
| Undo, then drag (new edit) | Redo button now disabled — redo tail dropped |
| Undo, Redo | Round-trips exactly |
| Switch tententoon via gallery | New undo stack (single entry); old one discarded |
| Cmd-Z while focused in rename input | Default text undo behavior, not app undo |

---

## Gotchas

- **`isApplying` must reset reliably.** Use a try/finally or a microtask: set true → write stores → set false. If an effect re-fires synchronously inside the writes and reads `isApplying`, it must still see true. Test it.
- **Source swaps as undo steps.** Uploading a new image counts as a gesture. That's intentional — Undo after upload should restore the previous source (handled in V5; in V4 it's enough that the snapshot captures the SourceRef, even if reapplying it doesn't reload the bitmap if the URL hasn't actually changed). For V4, document the limitation: undoing across source swaps in-session works only if the bitmap is still in `imageState`. We'll firm this up in V5.
- **Initial snapshot.** When `loadTententoon` runs, the resulting state is the first entry in the stack — undoing from there is a no-op. This is the right behavior: undo doesn't escape into the previous tententoon (R7).
- **Avoid double-push on aspect-lock toggle.** That's a discrete event, not a drag. Treat it as a gesture-end (calls `markGestureEnd` immediately). One toggle = one undo step.

---

## Demo script

1. Open a tententoon with a source. Drag the nest left. Drag the crop. Now click Undo → crop reverts. Undo again → nest reverts. Redo → nest forward. Redo → crop forward.
2. Undo once. Drag the nest somewhere new. Redo button disappears (disabled).
3. Switch tententoon. Drag. Switch back. Undo applies to the right stack.
4. Cmd-Z / Cmd-Shift-Z work from the keyboard.

---

## Tracking

- R4 ✅
- R5 ✅
- R9 ✅
- R13 ✅
- R6 ❌ (V5 closes it)
- R7 ✅ (in-memory stack is per-tententoon by construction)
