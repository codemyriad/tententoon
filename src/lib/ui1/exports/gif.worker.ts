/**
 * GIF encoding worker. The main thread renders each frame to RGBA pixels
 * (using the same renderFrame fn the video export uses) and posts them
 * here; we quantize a 256-colour palette per frame, apply it, and feed
 * the LZW-indexed bytes to gifenc's GIFEncoder. The result loops forever
 * (gifenc defaults to repeat=0 on the first writeFrame).
 *
 * Per-frame quantize + LZW is the expensive part — running it here keeps
 * the main thread free for rendering the next frame in parallel.
 */

import { GIFEncoder, quantize, applyPalette } from 'gifenc';

type Inbound =
  | { type: 'start'; delayMs: number }
  | {
      type: 'frame';
      index: number;
      width: number;
      height: number;
      rgba: ArrayBuffer;
    }
  | { type: 'finish' };

type Outbound =
  | { type: 'frame-encoded'; index: number }
  | { type: 'done'; bytes: ArrayBuffer }
  | { type: 'error'; error: string };

let enc: ReturnType<typeof GIFEncoder> | null = null;
let delayMs = 80;

function post(msg: Outbound, transfer: Transferable[] = []): void {
  (self as unknown as Worker).postMessage(msg, transfer);
}

self.onmessage = (e: MessageEvent<Inbound>) => {
  const msg = e.data;
  try {
    if (msg.type === 'start') {
      enc = GIFEncoder();
      delayMs = msg.delayMs;
    } else if (msg.type === 'frame') {
      if (!enc) throw new Error('encoder not started');
      const rgba = new Uint8ClampedArray(msg.rgba);
      // rgb444 keeps the per-frame palette computation cheap; the spiral
      // has smoothly-shaded regions and the visible banding is mild.
      const palette = quantize(rgba, 256, { format: 'rgb444' });
      const indexed = applyPalette(rgba, palette, 'rgb444');
      enc.writeFrame(indexed, msg.width, msg.height, { palette, delay: delayMs });
      post({ type: 'frame-encoded', index: msg.index });
    } else if (msg.type === 'finish') {
      if (!enc) throw new Error('encoder not started');
      enc.finish();
      const bytes = enc.bytes();
      // Transfer the underlying buffer so the main thread can wrap it
      // in a Blob without copying. bytes.buffer can be a SharedArrayBuffer
      // in some envs — slice() always returns a plain ArrayBuffer.
      const buf = bytes.slice().buffer as ArrayBuffer;
      post({ type: 'done', bytes: buf }, [buf]);
      enc = null;
    }
  } catch (err) {
    post({ type: 'error', error: err instanceof Error ? err.message : String(err) });
  }
};
