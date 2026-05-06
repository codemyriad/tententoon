/**
 * Worker entry for the WebGL2 EscherZoom backend.
 *
 * Hosts an OffscreenCanvas (transferred from the main thread) and a
 * WebGL2EscherZoomRenderer. Receives:
 *
 *   { type: 'init', canvas }            once at start
 *   { type: 'setPixels', ... }          each time the source image changes
 *   { type: 'render', ... }             every frame
 *
 * Posts back:
 *
 *   { type: 'ready' }                   after init succeeds
 *   { type: 'error', error }            on any throw — main thread demotes
 *   { type: 'context-lost' }            from the GL context-loss handler
 */

import { WebGL2EscherZoomRenderer } from './webgl2';
import type { DrosteCtx } from '../../math/transforms';

type WorkerInbound =
  | { type: 'init'; canvas: OffscreenCanvas }
  | {
      type: 'setPixels';
      width: number;
      height: number;
      data: Uint8ClampedArray;
    }
  | {
      type: 'render';
      ctx: DrosteCtx;
      R0: number;
      W: number;
      H: number;
      scale: number;
      t: number;
    };

let renderer: WebGL2EscherZoomRenderer | null = null;
let pixels: ImageData | null = null;

function post(msg: { type: 'ready' } | { type: 'error'; error: string } | { type: 'context-lost' }) {
  (self as unknown as Worker).postMessage(msg);
}

self.addEventListener('message', (e: MessageEvent<WorkerInbound>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'init': {
        renderer = new WebGL2EscherZoomRenderer({
          onContextLost: () => post({ type: 'context-lost' })
        });
        renderer.init(msg.canvas);
        post({ type: 'ready' });
        return;
      }
      case 'setPixels': {
        // structured-clone yields a Uint8ClampedArray over a fresh ArrayBuffer;
        // TypeScript's generic ImageDataArray type can't infer that, so the
        // cast tells it what the runtime guarantees.
        pixels = new ImageData(
          msg.data as Uint8ClampedArray<ArrayBuffer>,
          msg.width,
          msg.height
        );
        return;
      }
      case 'render': {
        if (!renderer || !pixels) return;
        renderer.render({
          pixels,
          ctx: msg.ctx,
          R0: msg.R0,
          W: msg.W,
          H: msg.H,
          scale: msg.scale,
          t: msg.t
        });
        return;
      }
    }
  } catch (err) {
    post({ type: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});
