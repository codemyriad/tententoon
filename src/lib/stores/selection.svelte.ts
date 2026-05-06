/**
 * The user's selection: a NEST (the inner self-similar rectangle) and a
 * CROP of the original image. The math always treats the crop as the
 * working image; when `aspectLocked` is true, the crop is the whole image
 * and the nest is forced to the image's aspect — exactly the original
 * single-rectangle behaviour. Unlock to choose a different nest aspect
 * and a sub-rectangle of the original to use as the working image.
 *
 *   nest          — inner self-similar rectangle (in original-image coords)
 *   crop          — sub-rectangle of the original used as working image
 *   aspectLocked  — when true, crop = whole image and nest aspect = image aspect
 *
 * Invariants:
 *   - aspectLocked ⇒ crop covers the whole image
 *   - nest ⊂ crop
 *   - nest aspect = crop aspect (so the nested image is a clean uniform scale)
 *   - nest, crop both inside the original image
 */

import type { Rect } from '../math/droste';
import { clampRect } from '../math/droste';
import { imageState } from './image.svelte';
import { identityOf, writeSelection, type StoredSelection } from '../persistence';

export type SelectionState = {
  nest: Rect | null;
  crop: Rect | null;
  aspectLocked: boolean;
};

export const selectionState = $state<SelectionState>({
  nest: null,
  crop: null,
  aspectLocked: false
});

/**
 * Initialise from a fresh image. The preset may be:
 *   - a full StoredSelection — applied verbatim (saved sessions, presets
 *     with custom crop / aspectLocked)
 *   - a Rect — legacy nest-only persistence; we derive crop + lock state
 *   - undefined — start from a centred default nest
 *
 * Compute everything into locals, then write the store last. NEVER read
 * back from `selectionState` after writing in the same call: the caller
 * is a $effect, and a read-after-write makes that effect track the just-
 * written state. Since helpers return fresh object references, tracking
 * them would re-fire the effect → unbounded loop → page freeze.
 */
export function initSelection(
  image: { width: number; height: number },
  preset?: StoredSelection | Rect
) {
  let nest: Rect;
  let crop: Rect;
  let aspectLocked: boolean;

  if (preset && 'nest' in preset && 'crop' in preset) {
    nest = preset.nest;
    crop = preset.crop;
    aspectLocked = preset.aspectLocked;
  } else {
    const nestPreset = preset ?? defaultNest(image);
    const localNest = clampNestFree(image, nestPreset);
    crop = fitCropToNest(image, localNest, null);
    nest = ensureNestInside(localNest, crop);
    aspectLocked = false;
  }

  selectionState.aspectLocked = aspectLocked;
  selectionState.crop = crop;
  selectionState.nest = nest;
}

/**
 * Set the nest. Locked mode forces image aspect (via clampRect). Unlocked
 * mode allows free aspect; the crop is resized so its aspect tracks the
 * new nest aspect, while keeping its centre stable.
 */
export function setNest(image: { width: number; height: number }, nest: Rect) {
  if (selectionState.aspectLocked) {
    selectionState.nest = clampRect(image, nest);
    selectionState.crop = wholeImage(image);
  } else {
    selectionState.nest = clampNestFree(image, nest);
    selectionState.crop = fitCropToNest(image, selectionState.nest, selectionState.crop);
    selectionState.nest = ensureNestInside(selectionState.nest, selectionState.crop);
  }
  persist();
}

/**
 * Set the crop. Aspect should already match the nest. Crop is clamped to
 * image bounds; the nest is shifted in if it would otherwise spill out.
 */
export function setCrop(image: { width: number; height: number }, crop: Rect) {
  if (selectionState.aspectLocked || !selectionState.nest) return;
  selectionState.crop = clampCrop(image, crop);
  selectionState.nest = ensureNestInside(selectionState.nest, selectionState.crop);
  persist();
}

/**
 * Toggle the aspect lock. Locking → crop snaps to whole image and nest
 * aspect is forced to image aspect. Unlocking → initialise the crop to
 * the largest centred rectangle with the nest's current aspect.
 */
export function setAspectLocked(
  image: { width: number; height: number },
  locked: boolean
) {
  if (selectionState.aspectLocked === locked) return;
  selectionState.aspectLocked = locked;
  if (!selectionState.nest) return;
  if (locked) {
    selectionState.nest = clampRect(image, selectionState.nest);
    selectionState.crop = wholeImage(image);
  } else {
    selectionState.crop = fitCropToNest(image, selectionState.nest, null);
    selectionState.nest = ensureNestInside(selectionState.nest, selectionState.crop);
  }
  persist();
}

// ---- internal helpers ----

function wholeImage(image: { width: number; height: number }): Rect {
  return { x: 0, y: 0, w: image.width, h: image.height };
}

function defaultNest(image: { width: number; height: number }): Rect {
  const w = image.width / 3;
  const h = w * (image.height / image.width);
  return { x: (image.width - w) / 2, y: (image.height - h) / 2, w, h };
}

/** Clamp a free-aspect nest to image bounds with a minimum side. */
function clampNestFree(image: { width: number; height: number }, nest: Rect): Rect {
  const minSide = 16;
  const w = Math.max(minSide, Math.min(image.width, nest.w));
  const h = Math.max(minSide, Math.min(image.height, nest.h));
  const x = Math.max(0, Math.min(image.width - w, nest.x));
  const y = Math.max(0, Math.min(image.height - h, nest.y));
  return { x, y, w, h };
}

/** Clamp a crop to image bounds. */
function clampCrop(image: { width: number; height: number }, crop: Rect): Rect {
  const w = Math.max(1, Math.min(image.width, crop.w));
  const h = Math.max(1, Math.min(image.height, crop.h));
  const x = Math.max(0, Math.min(image.width - w, crop.x));
  const y = Math.max(0, Math.min(image.height - h, crop.y));
  return { x, y, w, h };
}

/**
 * Build a crop with the nest's aspect: largest rectangle that fits inside
 * the image, no smaller than the nest itself. Centred on `prev` (when
 * resizing because aspect changed) or on the nest (initial unlock).
 */
function fitCropToNest(
  image: { width: number; height: number },
  nest: Rect,
  prev: Rect | null
): Rect {
  const aspect = nest.w / nest.h;
  let cw: number;
  let ch: number;
  if (image.width / image.height > aspect) {
    ch = image.height;
    cw = ch * aspect;
  } else {
    cw = image.width;
    ch = cw / aspect;
  }
  if (cw < nest.w || ch < nest.h) {
    const scale = Math.max(nest.w / cw, nest.h / ch);
    cw *= scale;
    ch *= scale;
  }
  const anchor = prev
    ? { x: prev.x + prev.w / 2, y: prev.y + prev.h / 2 }
    : { x: nest.x + nest.w / 2, y: nest.y + nest.h / 2 };
  return clampCrop(image, { x: anchor.x - cw / 2, y: anchor.y - ch / 2, w: cw, h: ch });
}

/** Shift the nest minimally so it lies entirely inside the given crop. */
function ensureNestInside(nest: Rect, crop: Rect): Rect {
  const x = Math.max(crop.x, Math.min(crop.x + crop.w - nest.w, nest.x));
  const y = Math.max(crop.y, Math.min(crop.y + crop.h - nest.h, nest.y));
  return { ...nest, x, y };
}

function persist() {
  const src = imageState.source;
  if (!src) return;
  if (!selectionState.nest || !selectionState.crop) return;
  writeSelection(identityOf(src.url), {
    nest: selectionState.nest,
    crop: selectionState.crop,
    aspectLocked: selectionState.aspectLocked
  });
}
