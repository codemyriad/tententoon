/**
 * In-memory per-tententoon undo/redo stack. V4 keeps it session-only;
 * V5 persists snapshots to IDB so undo survives reload.
 *
 * Model: every successful gesture (drag end, view toggle, play/pause
 * toggle, direction toggle) pushes a snapshot. Undo moves a pointer
 * back; redo moves it forward. A new push after an undo truncates the
 * redo tail (standard editor behaviour — R13).
 *
 * `applySnapshot` writes a snapshot back into the live editor stores
 * (doc, playback, ui). It sets `isApplying = true` while it works so
 * the autosave engine in tententoon.svelte.ts can suppress its own
 * pushUndo() — applying a historical state must not record itself as
 * a fresh history step.
 */

import { doc } from './state.svelte';
import type { TtState } from './persistence';

export const undoState = $state<{
  stack: TtState[];
  pointer: number;
}>({
  stack: [],
  pointer: -1
});

/**
 * Suppresses pushUndo while a snapshot is being applied. Read by
 * tententoon.svelte's autosave path — must not be reset until the
 * caller's writes have completed.
 */
export let isApplying = $state({ value: false });

export function canUndo(): boolean {
  return undoState.pointer > 0;
}
export function canRedo(): boolean {
  return undoState.pointer >= 0 && undoState.pointer < undoState.stack.length - 1;
}

/** Reset the stack to a single-entry baseline. Called on tententoon switch. */
export function resetUndo(baseline: TtState): void {
  undoState.stack = [cloneState(baseline)];
  undoState.pointer = 0;
}

/** Clear the stack entirely. Used when the editor returns to its empty state. */
export function clearUndo(): void {
  undoState.stack = [];
  undoState.pointer = -1;
}

/**
 * Append a new state to the stack — but only if its rect/crop differ
 * from the current head. Undo is scoped to rectangle edits: changing
 * view, play state, direction, or loop length still autosaves to
 * disk via the caller's writeState but does not create an undo step.
 *
 * If the pointer was anywhere but the head (user had undone some
 * steps), the redo tail is dropped before the append — once a new
 * edit lands, the alternate future is gone (R13).
 */
export function pushUndo(next: TtState): void {
  if (isApplying.value) return;
  const head = undoState.stack[undoState.stack.length - 1];
  if (head && rectsEqual(head, next)) return;
  // Drop the redo tail if we're not at the head.
  if (undoState.pointer < undoState.stack.length - 1) {
    undoState.stack = undoState.stack.slice(0, undoState.pointer + 1);
  }
  undoState.stack = [...undoState.stack, cloneState(next)];
  undoState.pointer = undoState.stack.length - 1;
}

/** Move pointer back one step and apply the snapshot. No-op if can't. */
export function undo(): void {
  if (!canUndo()) return;
  undoState.pointer -= 1;
  applySnapshot(undoState.stack[undoState.pointer]);
}

/** Move pointer forward one step and apply the snapshot. No-op if can't. */
export function redo(): void {
  if (!canRedo()) return;
  undoState.pointer += 1;
  applySnapshot(undoState.stack[undoState.pointer]);
}

/**
 * Write a snapshot back into the live editor stores. Restores only
 * the *document* fields (rect, crop) — view mode, play state,
 * direction, and loopLength are session/UI concerns, not part of
 * the rectangle-edit history the user expects ⌘Z to walk. They
 * still autosave to disk, just outside the undo timeline.
 *
 * Wraps the writes in `isApplying = true` so the autosave engine
 * skips its pushUndo() for the resulting state changes. The flag is
 * cleared in a microtask so any synchronous reactive effects fired
 * by the writes still see it as true.
 */
export function applySnapshot(snap: TtState): void {
  isApplying.value = true;
  try {
    doc.rect = { ...snap.rect };
    doc.crop = snap.crop ? { ...snap.crop } : null;
  } finally {
    queueMicrotask(() => {
      isApplying.value = false;
    });
  }
}

function cloneState(s: TtState): TtState {
  return {
    source: s.source ? { ...s.source } : null,
    rect: { ...s.rect },
    crop: s.crop ? { ...s.crop } : null,
    imageName: s.imageName,
    playback: { ...s.playback },
    view: s.view
  } as TtState;
}

/** Rect + crop equality — the only fields the undo timeline tracks. */
function rectsEqual(a: TtState, b: TtState): boolean {
  return (
    a.rect.x === b.rect.x &&
    a.rect.y === b.rect.y &&
    a.rect.w === b.rect.w &&
    a.rect.h === b.rect.h &&
    cropEq(a.crop, b.crop)
  );
}

function cropEq(a: TtState['crop'], b: TtState['crop']): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
