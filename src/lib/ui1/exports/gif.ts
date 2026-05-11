/**
 * GIF export. Renders frames into an off-screen canvas at GIF resolution
 * (cap 720p), pulls RGBA from each, ships them to the worker for
 * encoding, downloads the result.
 *
 * Caller passes a function that renders frame i (0..frames-1) into a
 * canvas at (width, height). That keeps the math/renderer choice out of
 * this module — the GIF code doesn't care what's on the canvas.
 */

const MAX_LONG_SIDE = 720; // px
const FPS = 18;

export type GifProgress =
  | { kind: 'render'; done: number; total: number }
  | { kind: 'encode'; done: number; total: number }
  | { kind: 'done' }
  | { kind: 'error'; error: string };

export type GifInputs = {
  imageWidth: number;
  imageHeight: number;
  loopSeconds: number;
  renderFrame: (canvas: HTMLCanvasElement, frame: number, total: number) => Promise<void> | void;
  onProgress?: (p: GifProgress) => void;
  filename?: string;
};

export async function exportGif({
  imageWidth,
  imageHeight,
  loopSeconds,
  renderFrame,
  onProgress,
  filename = 'tententoon.gif'
}: GifInputs): Promise<void> {
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(imageWidth, imageHeight));
  const width = Math.max(1, Math.round(imageWidth * scale));
  const height = Math.max(1, Math.round(imageHeight * scale));

  const total = Math.max(2, Math.round(loopSeconds * FPS));
  const delay = Math.round(1000 / FPS);
  const frames: Uint8Array[] = [];

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');

  // Render each frame, copy out the RGBA bytes.
  for (let i = 0; i < total; i++) {
    await renderFrame(offscreen, i, total);
    const data = ctx.getImageData(0, 0, width, height).data;
    // Copy into a transferable.
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    frames.push(copy);
    onProgress?.({ kind: 'render', done: i + 1, total });
  }

  // Encode in a worker so the UI stays responsive.
  const worker = new Worker(new URL('./gif-worker.ts', import.meta.url), { type: 'module' });
  await new Promise<void>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as
        | { type: 'progress'; done: number; total: number }
        | { type: 'done'; bytes: Uint8Array }
        | { type: 'error'; error: string };
      if (msg.type === 'progress') {
        onProgress?.({ kind: 'encode', done: msg.done, total: msg.total });
      } else if (msg.type === 'done') {
        // The transferred buffer is a fresh ArrayBuffer (the worker copies
        // before posting). Cast to a typed Uint8Array<ArrayBuffer> so the
        // Blob constructor's strict BlobPart accepts it.
        const view = new Uint8Array(msg.bytes.buffer as ArrayBuffer, msg.bytes.byteOffset, msg.bytes.byteLength);
        downloadBlob(new Blob([view], { type: 'image/gif' }), filename);
        onProgress?.({ kind: 'done' });
        worker.terminate();
        resolve();
      } else if (msg.type === 'error') {
        onProgress?.({ kind: 'error', error: msg.error });
        worker.terminate();
        reject(new Error(msg.error));
      }
    };
    worker.onerror = (ev) => {
      worker.terminate();
      reject(new Error(ev.message || 'gif worker crashed'));
    };
    worker.postMessage(
      { type: 'encode', frames, width, height, delay },
      frames.map((f) => f.buffer)
    );
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
