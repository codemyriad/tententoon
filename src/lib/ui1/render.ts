/**
 * Driver that bridges /ui1's runes (doc.rect, playback.t, …) to the
 * existing complex-map GPU spiral renderer (createEscherZoomRenderer).
 *
 * We use the existing pipeline rather than the simpler nested-drawImage
 * model from HANDOFF §4 because:
 *   (a) it's already GPU-accelerated in a worker (smooth playback),
 *   (b) it produces the canonical Lenstra spiral the rest of the project
 *       is built around — same visualisation in a different chrome.
 *
 * The HANDOFF state shape is preserved 1:1 in `doc` / `playback`; only
 * the rendering pipeline differs from the spec.
 */

import { drosteGeometry, type Rect as DrosteRect } from '../math/droste';
import type { DrosteCtx } from '../math/transforms';
import { doc, playback } from './state.svelte';

export type RenderInputs = {
  pixels: ImageData;
  ctx: DrosteCtx;
  R0: number;
  W: number;
  H: number;
  scale: number;
  t: number;
};

/**
 * Compute renderer inputs from the current /ui1 state + a canvas size,
 * or return null when the state isn't ready (no image, zero rect).
 */
export function buildRenderInputs(
  image: ImageBitmap,
  pixels: ImageData,
  rect: { x: number; y: number; w: number; h: number },
  canvasW: number,
  canvasH: number
): RenderInputs | null {
  if (rect.w <= 0 || rect.h <= 0) return null;
  // For now /ui1 ignores the crop concept — the working image IS the full
  // image. The HANDOFF doesn't surface "crop" as a separate dimension.
  const imageSize = { width: image.width, height: image.height };
  const droste = drosteGeometry(imageSize, rect satisfies DrosteRect);
  const drosteCtx: DrosteCtx = {
    cx: droste.limit.x,
    cy: droste.limit.y,
    logS: droste.logS,
    rMax: droste.rMax,
    W: image.width,
    H: image.height,
    cropX: 0,
    cropY: 0,
    sampleScale: 1
  };
  const R0 = droste.rMax / Math.sqrt(droste.S);
  const scaleW = canvasW / image.width;
  const scaleH = canvasH / image.height;
  const scale = Math.min(scaleW, scaleH);
  return {
    pixels,
    ctx: drosteCtx,
    R0,
    W: canvasW,
    H: canvasH,
    scale,
    t: effectiveT()
  };
}

/**
 * The renderer's `t` advances 0→1 over one Droste step inward.
 * HANDOFF's direction='in' matches that; 'out' is just the mirror.
 * We map [0,1) cleanly without negative-modulo nonsense.
 */
export function effectiveT(): number {
  return playback.direction === 'in' ? playback.t : 1 - playback.t;
}

/**
 * Extract pixel ImageData from a bitmap. One-shot, on image load only.
 * The result is fed to every render call (worker reuploads on key change).
 */
export function extractPixels(bitmap: ImageBitmap): ImageData {
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

/** Aspect-conformance: snap the rect to the chip's aspect, keep its centre. */
export function snapRectToAspect(rect: { x: number; y: number; w: number; h: number }, aspect: number | null) {
  if (aspect === null) return rect;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  // Take the shorter of "width-driven height" and "height-driven width";
  // keeps area roughly invariant under the snap.
  const wDriven = { w: rect.w, h: rect.w / aspect };
  const hDriven = { w: rect.h * aspect, h: rect.h };
  const useW = Math.abs(wDriven.h - rect.h) < Math.abs(hDriven.w - rect.w);
  const sized = useW ? wDriven : hDriven;
  return { x: cx - sized.w / 2, y: cy - sized.h / 2, w: sized.w, h: sized.h };
}

/** Quick state-machine helper consumers can use to gate UI. */
export function phase(): 'empty' | 'framing' | 'edit' | 'playing' {
  if (!doc.image) return 'empty';
  if (doc.rect.w <= 0 || doc.rect.h <= 0) return 'framing';
  return playback.playing ? 'playing' : 'edit';
}
