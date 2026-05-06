/**
 * Backend abstraction for the math panels.
 *
 * Each panel renders the same `RenderInput` (math state from `pipeline`) into
 * a canvas. The implementation can be:
 *
 *   webgl2-worker   GPU rendering on a Web Worker via OffscreenCanvas.
 *                   Best path. Frees the main thread for input + DOM.
 *   webgl2-main     GPU rendering on the main thread. Used when
 *                   OffscreenCanvas is missing (Safari pre-17 macOS).
 *   cpu-main        JavaScript pixel loop. The original code path. Used when
 *                   WebGL2 is unavailable or backed by software rasteriser
 *                   (llvmpipe / SwiftShader — slower than the JS loop here,
 *                   so we explicitly refuse it; see capabilities.ts).
 *
 * The same `Renderer<I>` interface is implemented at all three tiers; the
 * panel doesn't know which one it got. Picked once at mount via
 * `pickTier(detectCapabilities())`.
 */

import type { DrosteCtx } from '../math/transforms';

export type BackendTier = 'webgl2-worker' | 'webgl2-main' | 'cpu-main';

export type Capabilities = {
  webgl2: boolean;
  hasOffscreen: boolean;
  /** Raw `UNMASKED_RENDERER_WEBGL` string — used to refuse software paths. */
  rendererName: string;
};

/** Common shape every panel feeds into its backend. Panel-specific extras
 *  (e.g. animation phase) extend this. */
export type RenderInputBase = {
  pixels: ImageData;
  ctx: DrosteCtx;
  R0: number;
  /** Canvas pixel dims and the canvas-px-per-working-px factor. */
  W: number;
  H: number;
  scale: number;
};

export interface Renderer<I> {
  /** Bind to a canvas. Called once per panel mount. May be async (worker
   *  initialisation, shader compile). */
  init(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<void> | void;
  /** Render one frame from the given input. Cheap to call. */
  render(input: I): void;
  /** Release GL resources, terminate workers, drop event listeners. */
  dispose(): void;
}
