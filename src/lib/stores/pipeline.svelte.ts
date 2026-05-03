/**
 * Shared derived state for every panel in the Droste pipeline.
 *
 * Two raw inputs come from the user — the nest (inner self-similar
 * rectangle) and the crop (sub-rectangle of the original to use as the
 * working image). From those we derive everything every panel needs:
 *
 *   workingSize  — dimensions of the working image (= the crop)
 *   geom         — DrosteGeometry in WORKING (crop-relative) coords
 *   R0           — reference radius for the Escher panel's twist correction
 *   drosteCtx    — ready-to-pass context for sampleDroste / renderMappedDroste
 *
 * Render budget per panel — pixels of canvas width:
 *
 *   STATIC_MAX_W    — the still panels (LogPanel, EscherPanel, …).
 *   ANIMATED_MAX_W  — the spiral-zoom panel; lower because we re-render
 *                     every frame.
 */

import { drosteGeometry, type DrosteGeometry } from '../math/droste';
import { buildMipmap, type DrosteCtx } from '../math/transforms';
import { imageState } from './image.svelte';
import { selectionState } from './selection.svelte';

export const STATIC_MAX_W = 560;
export const ANIMATED_MAX_W = 360;

class Pipeline {
  /** Working image dimensions: equals the user's crop (= full image when locked). */
  readonly workingSize = $derived.by((): { width: number; height: number } | null => {
    const crop = selectionState.crop;
    if (!crop) return null;
    return { width: crop.w, height: crop.h };
  });

  /**
   * Geometry of the (image, rectangle) pair, computed in WORKING coords:
   * `geom.limit` is offset from the crop's top-left, not from the original
   * image's top-left. Add selectionState.crop.{x,y} to get original coords.
   */
  readonly geom = $derived.by((): DrosteGeometry | null => {
    const nest = selectionState.nest;
    const crop = selectionState.crop;
    if (!nest || !crop) return null;
    const nestInCrop = {
      x: nest.x - crop.x,
      y: nest.y - crop.y,
      w: nest.w,
      h: nest.h
    };
    return drosteGeometry({ width: crop.w, height: crop.h }, nestInCrop);
  });

  /**
   * Limit point in ORIGINAL-image coords, for overlays drawn over the
   * source image (the picker, the source panel chip).
   */
  readonly limitInOriginal = $derived.by(() => {
    const g = this.geom;
    const crop = selectionState.crop;
    if (!g || !crop) return null;
    return { x: g.limit.x + crop.x, y: g.limit.y + crop.y };
  });

  /**
   * Reference radius R₀ for the Escher panels' upright-orientation
   * correction. Geometric mean of the inner ring (rMax/S) and the outer
   * rim (rMax) — the middle of one Droste period in log-radius. See
   * EscherPanel docstring for the full derivation.
   */
  readonly R0 = $derived.by((): number | null => {
    const g = this.geom;
    if (!g) return null;
    return g.rMax / Math.sqrt(g.S);
  });

  /**
   * Mipmap pyramid of the source image. Built once per image (the pyramid
   * is stable as long as imageState.source's identity is stable). Panels
   * that suffer from minification aliasing (the Escher panels near c)
   * sample through this; cheaper panels can keep using the bare ImageData.
   */
  readonly mipmap = $derived.by((): ImageData[] | null => {
    const src = imageState.source;
    if (!src) return null;
    return buildMipmap(src.pixels);
  });

  /**
   * Pre-built DrosteCtx for callers of sampleDroste / renderMappedDroste.
   * Carries the crop offset so sampling indexes into the original
   * ImageData while the math runs in working coords.
   */
  readonly drosteCtx = $derived.by((): DrosteCtx | null => {
    const g = this.geom;
    const crop = selectionState.crop;
    if (!g || !crop) return null;
    return {
      cx: g.limit.x,
      cy: g.limit.y,
      logS: g.logS,
      rMax: g.rMax,
      W: crop.w,
      H: crop.h,
      cropX: crop.x,
      cropY: crop.y
    };
  });
}

export const pipeline = new Pipeline();
