/**
 * UI variant 1 — shared $state runes. Mirrors HANDOFF.md §3 (ui / doc /
 * playback). Scoped to /ui1; the main view's stores are untouched.
 *
 * State machine implied by the runes:
 *   Empty   doc.image == null
 *   Framing doc.image set, doc.rect zero
 *   Edit    doc.rect non-zero, playback.playing == false
 *   Playing playback.playing == true
 *   (Exporting is owned by export-* modules; the rune state is whatever it
 *    was when the export started.)
 */

import { fitCropToNest, ensureNestInside, type Rect as DrosteRect } from '../math/droste';

export type Tool = 'select' | 'rect' | 'pan';
export type AspectKind = 'match-image' | 'free' | '1:1' | '16:9';
export type Direction = 'in' | 'out';
export type Theme = 'light-neutral' | 'light-warm' | 'dark-warm';

export type Rect = { x: number; y: number; w: number; h: number };

export const ui = $state<{
  tool: Tool;
  zoom: 'fit' | number;
  exportMenuOpen: boolean;
  theme: Theme;
  /** Hint shown briefly after an export completes. */
  exportToast: string | null;
}>({
  tool: 'rect',
  zoom: 'fit',
  exportMenuOpen: false,
  theme: 'light-neutral',
  exportToast: null
});

export const doc = $state<{
  image: ImageBitmap | null;
  imageName: string;
  rect: Rect;
  /**
   * Working-image crop: the rectangle the renderer treats as its
   * input frame. Stored as state (rather than purely derived from
   * `rect`) so that translating the nest leaves the crop stable —
   * the user gets a steady reference frame instead of a working
   * window that follows the cursor. Refits on resize, on a fresh
   * marquee draw, or on image change; nulled when no rect is set.
   */
  crop: Rect | null;
  aspect: AspectKind;
}>({
  image: null,
  imageName: '',
  rect: { x: 0, y: 0, w: 0, h: 0 },
  crop: null,
  aspect: 'match-image'
});

export const playback = $state<{
  playing: boolean;
  t: number;
  speed: 0.5 | 1 | 2 | 4;
  direction: Direction;
  loopLength: number;
  exporting: boolean;
}>({
  // Autoplay by default: the moment a rect is drawn we want the spiral
  // to be the thing the user sees, not a still frame waiting for input.
  playing: true,
  t: 0,
  speed: 1,
  direction: 'in',
  loopLength: 10,
  exporting: false
});

/** Replace the working image and clear the rect + crop. */
export function setImage(image: ImageBitmap | null, name = ''): void {
  doc.image?.close?.();
  doc.image = image;
  doc.imageName = name;
  doc.rect = { x: 0, y: 0, w: 0, h: 0 };
  doc.crop = null;
  playback.playing = false;
  playback.t = 0;
}

// --- Rect/crop commit helpers ------------------------------------------
//
// Three commit shapes, mirroring the legacy selection.svelte.ts:setNest
// semantics. Drag handlers in CanvasStage call the matching helper
// instead of writing doc.rect directly, so the crop bookkeeping happens
// in one place.

function imageSize(): { width: number; height: number } | null {
  if (!doc.image) return null;
  return { width: doc.image.width, height: doc.image.height };
}

/**
 * Initial commit for a fresh marquee draw or any time we want the crop
 * to recentre on the nest. Crop fits around the nest, anchored on it.
 */
export function commitNewRect(rect: Rect): void {
  doc.rect = rect;
  const sz = imageSize();
  if (!sz || rect.w <= 0 || rect.h <= 0) { doc.crop = null; return; }
  doc.crop = fitCropToNest(sz, rect as DrosteRect, null);
}

/**
 * Body translate. Crop stays put; the nest is shifted minimally to
 * stay inside it. Falls back to commitNewRect when there's no crop
 * yet (first interaction after image load).
 */
export function commitTranslate(rect: Rect): void {
  if (!doc.crop) { commitNewRect(rect); return; }
  doc.rect = ensureNestInside(rect as DrosteRect, doc.crop);
}

/**
 * Handle/marquee resize. Crop refits with the previous crop's centre
 * as anchor, so the working frame stays stable across pure-translate
 * gestures but resizes when the aspect changes or the nest outgrows
 * the current crop.
 */
export function commitResize(rect: Rect): void {
  doc.rect = rect;
  const sz = imageSize();
  if (!sz || rect.w <= 0 || rect.h <= 0) { doc.crop = null; return; }
  doc.crop = fitCropToNest(sz, rect as DrosteRect, doc.crop);
  doc.rect = ensureNestInside(doc.rect as DrosteRect, doc.crop);
}

/**
 * Crop translate: the user dragging the working frame around the (now
 * stationary) nest. Clamps the proposed crop position to two
 * constraints — the crop must (a) stay inside the image and (b)
 * still fully contain the nest. The nest is NOT moved; only the
 * crop's x/y change. Width/height come from doc.crop and are
 * preserved (translate, not resize).
 */
export function commitCropTranslate(next: Rect): void {
  if (!doc.image || !doc.crop) return;
  const img = imageSize()!;
  const nest = doc.rect;
  const minX = Math.max(0, nest.x + nest.w - next.w);
  const maxX = Math.min(img.width - next.w, nest.x);
  const minY = Math.max(0, nest.y + nest.h - next.h);
  const maxY = Math.min(img.height - next.h, nest.y);
  // No valid position (shouldn't happen — fitCropToNest always returns
  // a crop ⊇ nest that's also ⊆ image, so the intersection is non-empty
  // when called from CanvasStage). Bail safely if it ever does.
  if (minX > maxX || minY > maxY) return;
  doc.crop = {
    x: Math.max(minX, Math.min(maxX, next.x)),
    y: Math.max(minY, Math.min(maxY, next.y)),
    w: next.w,
    h: next.h
  };
}

/** Image's aspect ratio (W/H) or 0 when no image. */
export function imageAspect(): number {
  return doc.image ? doc.image.width / doc.image.height : 0;
}

/** Aspect ratio implied by the current `doc.aspect` chip. */
export function chipAspect(): number | null {
  switch (doc.aspect) {
    case 'match-image':
      return imageAspect() || null;
    case '1:1':
      return 1;
    case '16:9':
      return 16 / 9;
    case 'free':
    default:
      return null;
  }
}
