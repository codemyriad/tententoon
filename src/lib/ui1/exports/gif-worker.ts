/**
 * GIF encoder worker. Receives a list of pre-rendered RGBA frame buffers
 * + dims + delay, runs gifenc's quantize+applyPalette+writeFrame loop,
 * posts the final bytes back as a transferable.
 */

import { GIFEncoder, quantize, applyPalette } from 'gifenc';

type Inbound = {
  type: 'encode';
  frames: Uint8Array[];
  width: number;
  height: number;
  /** Per-frame delay in ms. */
  delay: number;
};

type Outbound =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; bytes: Uint8Array }
  | { type: 'error'; error: string };

function post(msg: Outbound, transfer: Transferable[] = []): void {
  (self as unknown as Worker).postMessage(msg, transfer);
}

self.addEventListener('message', (e: MessageEvent<Inbound>) => {
  const msg = e.data;
  if (msg.type !== 'encode') return;
  try {
    const enc = GIFEncoder();
    const total = msg.frames.length;
    for (let i = 0; i < total; i++) {
      const rgba = msg.frames[i];
      const palette = quantize(rgba, 256);
      const index = applyPalette(rgba, palette);
      enc.writeFrame(index, msg.width, msg.height, { palette, delay: msg.delay });
      if ((i & 3) === 0) post({ type: 'progress', done: i + 1, total });
    }
    enc.finish();
    const out = enc.bytesView();
    // Copy into a fresh ArrayBuffer so it's safely transferable.
    const copy = new Uint8Array(out.byteLength);
    copy.set(out);
    post({ type: 'done', bytes: copy }, [copy.buffer]);
  } catch (err) {
    post({ type: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});
