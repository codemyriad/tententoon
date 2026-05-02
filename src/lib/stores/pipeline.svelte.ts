/**
 * Shared derived state for every panel in the Droste pipeline.
 *
 * Each panel wants the same two things: the Droste geometry for the
 * current (image, rectangle) pair, and the reference radius R₀ used to
 * cancel the Lenstra twist. Computing them in every panel meant five
 * copies of the same eight-line block; this collects them in one place.
 *
 * Render budget per panel — pixels of canvas width:
 *
 *   STATIC_MAX_W    — the still panels (LogPanel, EscherPanel, …).
 *   ANIMATED_MAX_W  — the spiral-zoom panel; lower because we re-render
 *                     every frame.
 */

import { drosteGeometry, type DrosteGeometry } from '../math/droste';
import { imageState } from './image.svelte';
import { selectionState } from './selection.svelte';

export const STATIC_MAX_W = 560;
export const ANIMATED_MAX_W = 360;

class Pipeline {
  /** Geometry of the current (image, rectangle); null until both are set. */
  readonly geom = $derived.by((): DrosteGeometry | null => {
    const src = imageState.source;
    const r = selectionState.rect;
    if (!src || !r) return null;
    return drosteGeometry({ width: src.width, height: src.height }, r);
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
}

export const pipeline = new Pipeline();
