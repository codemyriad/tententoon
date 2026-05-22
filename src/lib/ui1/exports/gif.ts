/**
 * Looping GIF export.
 *
 * Architecture mirrors mp4.ts: render frames off-screen on a hidden canvas
 * (using the caller's renderFrame fn), then hand each frame's RGBA pixels
 * to a worker that does the quantize + LZW encode. The result loops
 * forever (gifenc's default repeat=0 on the first writeFrame).
 *
 * Per-frame timing is discrete (fps × loopSeconds frames) — unlike the
 * MP4 path we are NOT real-time. We render as fast as the GPU + encoder
 * allow and the output is identical regardless of wall-clock speed.
 *
 * GIFs are large by nature; the caller is responsible for keeping
 * loopSeconds, maxLongSide, and fps within reasonable bounds.
 */

import { drawWatermark } from './share';

export type GifExportInputs = {
  imageWidth: number;
  imageHeight: number;
  loopSeconds: number;
  /** Frames per second to sample. GIF delay precision is 1cs (max 100fps in spec, ~50fps in practice). */
  fps?: number;
  /** Cap the long side so the GIF doesn't balloon past a few MB. */
  maxLongSide?: number;
  renderFrame: (canvas: HTMLCanvasElement, t: number) => Promise<void> | void;
  onProgress?: (p: { fraction: number; phase: 'render' | 'encode' }) => void;
  filenameBase?: string;
  signal?: { cancelled: boolean };
  watermark?: string;
  /** 'download' triggers an <a download> click; 'blob' returns the blob for share. */
  output?: 'download' | 'blob';
};

export type GifExportResult = { blob?: Blob; mime: string; ext: 'gif' };

export async function exportGif({
  imageWidth,
  imageHeight,
  loopSeconds,
  fps = 25,
  maxLongSide = 480,
  renderFrame,
  onProgress,
  filenameBase = 'tententoon',
  signal,
  watermark,
  output = 'download'
}: GifExportInputs): Promise<GifExportResult> {
  const longSide = Math.max(imageWidth, imageHeight);
  const scale = Math.min(1, maxLongSide / longSide);
  const width = Math.max(2, Math.round((imageWidth * scale) / 2) * 2);
  const height = Math.max(2, Math.round((imageHeight * scale) / 2) * 2);
  const totalFrames = Math.max(2, Math.round(loopSeconds * fps));
  const delayMs = Math.round(1000 / fps);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = 'fixed';
  canvas.style.left = '-99999px';
  canvas.style.top = '-99999px';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  // Per-frame readback canvas. The renderFrame target may not have a 2D
  // context (e.g. WebGL); we always copy to this 2D canvas to get pixels.
  // Re-used across frames.
  const readCanvas = document.createElement('canvas');
  readCanvas.width = width;
  readCanvas.height = height;
  const readCtx = readCanvas.getContext('2d');
  if (!readCtx) throw new Error('2d context unavailable');

  const worker = new Worker(new URL('./gif.worker.ts', import.meta.url), { type: 'module' });

  // Track encode-side progress so we can show the user the encoder isn't
  // wedged. Render+encode pipeline overlaps but we report the lagging side.
  let encodedFrames = 0;
  let finishResolve: ((bytes: ArrayBuffer) => void) | null = null;
  let finishReject: ((err: Error) => void) | null = null;

  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data as
      | { type: 'frame-encoded'; index: number }
      | { type: 'done'; bytes: ArrayBuffer }
      | { type: 'error'; error: string };
    if (msg.type === 'frame-encoded') {
      encodedFrames++;
      onProgress?.({ fraction: 0.5 + (encodedFrames / totalFrames) * 0.5, phase: 'encode' });
    } else if (msg.type === 'done') {
      finishResolve?.(msg.bytes);
    } else if (msg.type === 'error') {
      finishReject?.(new Error(msg.error));
    }
  };
  worker.onerror = (e) => {
    finishReject?.(new Error(e.message || 'gif worker error'));
  };

  try {
    worker.postMessage({ type: 'start', delayMs });

    for (let i = 0; i < totalFrames; i++) {
      if (signal?.cancelled) throw new Error('cancelled');
      // t ∈ [0, 1). The last frame at i = totalFrames is == frame 0, so
      // we stop one short to keep the loop seamless.
      const t = i / totalFrames;
      await renderFrame(canvas, t);
      if (watermark) drawWatermark(canvas, watermark);
      // Copy from the (possibly WebGL) target onto the 2D readback canvas
      // and pull the RGBA bytes.
      readCtx.clearRect(0, 0, width, height);
      readCtx.drawImage(canvas, 0, 0);
      const img = readCtx.getImageData(0, 0, width, height);
      // Transfer the buffer to the worker; getImageData allocates fresh
      // each call so detaching it is safe.
      const buf = img.data.buffer;
      worker.postMessage(
        { type: 'frame', index: i, width, height, rgba: buf },
        [buf]
      );
      // Render phase represents the first 50% of progress
      onProgress?.({ fraction: ((i + 1) / totalFrames) * 0.5, phase: 'render' });
    }

    if (signal?.cancelled) throw new Error('cancelled');

    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      finishResolve = resolve;
      finishReject = reject;
      worker.postMessage({ type: 'finish' });
    });

    const blob = new Blob([bytes], { type: 'image/gif' });
    const filename = `${filenameBase}.gif`;
    onProgress?.({ fraction: 1, phase: 'encode' });
    if (output === 'blob') {
      return { blob, mime: 'image/gif', ext: 'gif' };
    }
    downloadBlob(blob, filename);
    return { mime: 'image/gif', ext: 'gif' };
  } finally {
    canvas.remove();
    worker.terminate();
  }
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
