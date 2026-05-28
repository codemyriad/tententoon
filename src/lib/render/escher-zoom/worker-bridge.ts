/**
 * Main-thread proxy for the WebGL2 worker. Implements the same Renderer
 * interface so the panel can swap us out for the in-thread WebGL2 backend
 * or the CPU backend without changing call sites.
 *
 * Pixels are sent to the worker only when they change — keyed by a hash of
 * (width, height, sampleScale). Per-frame messages carry only the small
 * uniform set, so postMessage cost stays in the tens-of-microseconds range.
 *
 * On worker error or GL context loss, calls `onFailure`. The factory uses
 * this to demote to the CPU backend mid-session.
 */

import type { EscherZoomInput, EscherZoomRenderer } from './input';

export type WorkerBridgeOptions = {
  /** Called when the worker reports an error or the GL context is lost. */
  onFailure: (reason: string) => void;
};

type WorkerOutbound =
  | { type: 'ready' }
  | { type: 'error'; error: string }
  | { type: 'context-lost' };

export class WorkerEscherZoomRenderer implements EscherZoomRenderer {
  private worker: Worker | null = null;
  private mainCanvas: HTMLCanvasElement | null = null;
  private ready = false;
  private failed = false;
  private pixels: ImageData | null = null;
  private pixelsSampleScale = Number.NaN;

  constructor(private opts: WorkerBridgeOptions) {}

  init(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<void> {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('worker bridge expects an HTMLCanvasElement');
    }
    this.mainCanvas = canvas;
    const off = canvas.transferControlToOffscreen();
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    return new Promise<void>((resolve, reject) => {
      const onMessage = (e: MessageEvent<WorkerOutbound>) => {
        const msg = e.data;
        if (msg.type === 'ready') {
          this.ready = true;
          resolve();
        } else if (msg.type === 'error') {
          this.failed = true;
          this.opts.onFailure(msg.error);
          if (!this.ready) reject(new Error(msg.error));
        } else if (msg.type === 'context-lost') {
          this.failed = true;
          this.opts.onFailure('webgl context lost');
        }
      };
      this.worker!.addEventListener('message', onMessage);
      this.worker!.addEventListener('error', (ev) => {
        const reason = ev.message || 'worker error';
        this.failed = true;
        this.opts.onFailure(reason);
        if (!this.ready) reject(new Error(reason));
      });
      this.worker!.postMessage({ type: 'init', canvas: off }, [off]);
    });
  }

  render(input: EscherZoomInput): void {
    if (!this.worker || !this.ready || this.failed) return;
    const { pixels } = input;
    if (pixels !== this.pixels || input.ctx.sampleScale !== this.pixelsSampleScale) {
      // Structured clone of the pixel data — one-time cost per image load
      // (~10–25 ms for a 5 MB buffer per the research). We can't transfer
      // the underlying buffer because other CPU panels still read from it.
      this.worker.postMessage({
        type: 'setPixels',
        width: pixels.width,
        height: pixels.height,
        data: pixels.data
      });
      this.pixels = pixels;
      this.pixelsSampleScale = input.ctx.sampleScale;
    }
    this.worker.postMessage({
      type: 'render',
      ctx: input.ctx,
      R0: input.R0,
      W: input.W,
      H: input.H,
      scale: input.scale,
      t: input.t
    });
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    this.mainCanvas = null;
    this.pixels = null;
    this.pixelsSampleScale = Number.NaN;
  }
}
