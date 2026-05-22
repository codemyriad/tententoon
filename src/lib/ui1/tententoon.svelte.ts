/**
 * Currently-open tententoon. A thin store ({id, name}) plus a small
 * autosave engine that snapshots `doc` + `playback` into the
 * persistence layer on gesture-end.
 *
 * Gesture-end is signalled explicitly via `markGestureEnd()` — called
 * from CanvasStage's onPointerUp and from setImage flows. We don't
 * watch `doc.rect` reactively because we'd write on every pointermove;
 * the existing commit helpers already debounce gestures to pointerup.
 *
 * Loading a tententoon (load()) sets a `hydrating` flag so any writes
 * that race in from the loading code are suppressed.
 */

import { doc, playback, ui, setImage } from './state.svelte';
import * as persistence from './persistence';
import type { SourceRef, TtState, IndexEntry } from './persistence';

export const currentTententoon = $state<{
  id: string | null;
  name: string;
  hydrating: boolean;
}>({
  id: null,
  name: '',
  hydrating: false
});

function snapshotState(source: SourceRef | null): TtState {
  return {
    source,
    rect: { x: doc.rect.x, y: doc.rect.y, w: doc.rect.w, h: doc.rect.h },
    crop: doc.crop ? { x: doc.crop.x, y: doc.crop.y, w: doc.crop.w, h: doc.crop.h } : null,
    imageName: doc.imageName,
    playback: {
      speed: playback.speed,
      direction: playback.direction,
      loopLength: playback.loopLength,
      playing: playback.playing
    },
    view: ui.view
  };
}

let knownSource: SourceRef | null = null;

/** Replace the in-memory record of which source the current tententoon points at. */
export function setKnownSource(s: SourceRef | null): void {
  knownSource = s;
}

/**
 * Take a snapshot of the current editor state and write it to the
 * persistence layer under the current tententoon's id. If no current
 * tententoon exists, create one first.
 */
export function markGestureEnd(): void {
  if (currentTententoon.hydrating) return;
  const state = snapshotState(knownSource);
  if (currentTententoon.id) {
    persistence.writeState(currentTententoon.id, state);
  } else {
    // No current id: don't autocreate from a stray pointerup. Source
    // loads call markCreate() explicitly with a SourceRef.
  }
}

/**
 * Create a tententoon for a freshly-loaded source. The caller (TopBar /
 * DropZone) has already called setImage(); we then snapshot the current
 * doc + the new source and persist.
 */
export function markCreate(source: SourceRef): IndexEntry {
  knownSource = source;
  const state = snapshotState(source);
  const entry = persistence.create(state);
  currentTententoon.id = entry.id;
  currentTententoon.name = entry.name;
  return entry;
}

/**
 * "Fill" the current tententoon's source if it's a fresh `null`-source
 * entry; otherwise create a new tententoon. Used by DropZone after a
 * user clicked "New" in the gallery — the empty entry exists, the next
 * upload should land in it, not stack a second one.
 */
export function markSourceLoaded(source: SourceRef): IndexEntry {
  if (currentTententoon.id && knownSource === null) {
    knownSource = source;
    const state = snapshotState(source);
    persistence.writeState(currentTententoon.id, state);
    return {
      id: currentTententoon.id,
      name: currentTententoon.name,
      createdAt: 0,
      updatedAt: Date.now()
    };
  }
  return markCreate(source);
}

/**
 * Create an empty tententoon (no source). Used by the gallery's "New"
 * button. Sets it as current so the editor renders the empty state and
 * the next upload fills the entry in place.
 */
export function createEmpty(): IndexEntry {
  knownSource = null;
  setImage(null, '');
  const state = snapshotState(null);
  const entry = persistence.create(state, 'Untitled · ' + nowStamp());
  currentTententoon.id = entry.id;
  currentTententoon.name = entry.name;
  return entry;
}

function nowStamp(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0') +
    ' ' +
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  );
}

/** Rename the current or any tententoon. Updates the live store if it's current. */
export function renameTententoon(id: string, name: string): void {
  persistence.rename(id, name);
  if (currentTententoon.id === id) currentTententoon.name = name;
}

/**
 * Delete a tententoon. If it was the current one, the editor returns
 * to its empty state — image cleared, currentTententoon zeroed,
 * `tt:current` cleared by persistence.remove().
 */
export function deleteTententoon(id: string): void {
  const wasCurrent = currentTententoon.id === id;
  persistence.remove(id);
  if (wasCurrent) {
    currentTententoon.hydrating = true;
    try {
      setImage(null, '');
      knownSource = null;
      currentTententoon.id = null;
      currentTententoon.name = '';
    } finally {
      currentTententoon.hydrating = false;
    }
  }
}

/**
 * Load a tententoon by id. Resolves the source (URL or IDB blob), calls
 * setImage to update the editor, then writes rect/crop/playback from the
 * snapshot. The hydrating flag suppresses autosave writes during this.
 *
 * Returns false on missing/corrupt entries so the caller can fall
 * through to the empty state.
 */
export async function load(id: string): Promise<boolean> {
  const loaded = persistence.load(id);
  if (!loaded) return false;
  const { entry, state } = loaded;
  currentTententoon.hydrating = true;
  try {
    let image: ImageBitmap | null = null;
    if (state.source?.kind === 'url') {
      try {
        const res = await fetch(state.source.url);
        if (res.ok) {
          const blob = await res.blob();
          image = await createImageBitmap(blob);
        }
      } catch {}
    } else if (state.source?.kind === 'blob') {
      const blob = await persistence.getBlob(state.source.hash);
      if (blob) image = await createImageBitmap(blob);
    }
    // setImage clears rect/crop/playback, so apply the snapshot AFTER.
    setImage(image, state.imageName);
    doc.rect = { ...state.rect };
    doc.crop = state.crop ? { ...state.crop } : null;
    playback.speed = state.playback.speed;
    playback.direction = state.playback.direction;
    playback.loopLength = state.playback.loopLength;
    // Resume the user's saved play state. Falls back to autoplay-if-rect
    // for older snapshots that predate persisting `playing`.
    playback.playing =
      typeof state.playback.playing === 'boolean'
        ? state.playback.playing
        : state.rect.w > 0 && state.rect.h > 0;
    playback.t = 0;
    ui.view = state.view ?? 'split';
    knownSource = state.source;
    currentTententoon.id = entry.id;
    currentTententoon.name = entry.name;
    persistence.setCurrentId(entry.id);
    return true;
  } finally {
    currentTententoon.hydrating = false;
  }
}

/**
 * Boot: if `tt:current` resolves to a usable entry, hydrate it.
 * Otherwise leave the editor empty (DropZone shows).
 */
export async function bootRestore(): Promise<boolean> {
  const id = persistence.getCurrentId();
  if (!id) return false;
  const ok = await load(id);
  if (!ok) persistence.setCurrentId(null);
  return ok;
}
