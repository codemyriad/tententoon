/**
 * Video export via MediaRecorder driven off a HIDDEN canvas.
 *
 * Old design recorded the live on-screen canvas via captureStream, which
 * meant any user interaction (timeline scrub, hover effects, tool clicks)
 * leaked into the recording. New design: keep a hidden HTMLCanvasElement
 * that the export drives frame-by-frame via the caller's renderFrame fn,
 * and captureStream THAT. The live preview stays untouched throughout.
 *
 * The encoder still samples at its own pace (this is MediaRecorder's API
 * surface), so a stuttering main thread will repeat frames rather than
 * drop them — output stays correct, just visibly less smooth at the
 * stutter points. Frame-perfect encoding is a follow-up (WebCodecs).
 *
 * MIME negotiation:
 *   1. video/mp4;codecs=avc1   (Safari, recent Chrome)
 *   2. video/webm;codecs=vp9   (Firefox, all Chrome)
 *   3. video/webm              (fallback)
 */

import { drawWatermark, shareBlob } from './share';

const CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9',
  'video/webm'
];

export type VideoExtension = 'mp4' | 'webm';

export type VideoExportInputs = {
  imageWidth: number;
  imageHeight: number;
  loopSeconds: number;
  /** Cap the long side at 1080 px so giant source images don't produce huge files. */
  maxLongSide?: number;
  /** Caller draws frame i (in image coords) onto the off-screen canvas. */
  renderFrame: (canvas: HTMLCanvasElement, t: number) => Promise<void> | void;
  onProgress?: (p: { fraction: number; done: boolean }) => void;
  filenameBase?: string;
  /** External cancellation. Throws if true on the next tick. */
  signal?: { cancelled: boolean };
  /** When set, stamped bottom-right of every frame after renderFrame draws. */
  watermark?: string;
  /** Default 'download'. 'share' hands the blob to navigator.share. */
  output?: 'download' | 'share';
};

export function pickMimeType(): { type: string; ext: VideoExtension } | null {
  for (const t of CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
      return { type: t, ext: t.startsWith('video/mp4') ? 'mp4' : 'webm' };
    }
  }
  return null;
}

export async function exportVideo({
  imageWidth,
  imageHeight,
  loopSeconds,
  maxLongSide = 1080,
  renderFrame,
  onProgress,
  filenameBase = 'tententoon',
  signal,
  watermark,
  output = 'download'
}: VideoExportInputs): Promise<{ ext: VideoExtension }> {
  const mime = pickMimeType();
  if (!mime) throw new Error('No supported video MIME type for MediaRecorder.');

  // Down-scale to keep file sizes sane. Preserve aspect.
  const longSide = Math.max(imageWidth, imageHeight);
  const scale = Math.min(1, maxLongSide / longSide);
  const width = Math.max(2, Math.round(imageWidth * scale / 2) * 2);   // even px helps codecs
  const height = Math.max(2, Math.round(imageHeight * scale / 2) * 2);

  // Hidden HTMLCanvasElement — must be in the DOM for captureStream to fire
  // events, but display:none keeps it off-screen. Removed at the end.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = 'fixed';
  canvas.style.left = '-99999px';
  canvas.style.top = '-99999px';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  try {
    const stream = canvas.captureStream(60);
    const rec = new MediaRecorder(stream, { mimeType: mime.type, videoBitsPerSecond: 6_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<Blob>((resolve, reject) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType }));
      rec.onerror = (e) => reject((e as ErrorEvent).error ?? new Error('MediaRecorder error'));
    });

    rec.start();

    // Drive frames in real time so the encoder samples them. We deliberately
    // use wall-clock elapsed time (not frame counts) so the playback rate of
    // the recording matches loopSeconds regardless of how fast we can render.
    const startWall = performance.now();
    const durationMs = loopSeconds * 1000;
    await new Promise<void>((resolve, reject) => {
      let raf = 0;
      const tick = async (now: number) => {
        if (signal?.cancelled) {
          cancelAnimationFrame(raf);
          reject(new Error('cancelled'));
          return;
        }
        const elapsed = now - startWall;
        const fraction = Math.min(1, elapsed / durationMs);
        const t = fraction % 1; // wraps at the end; we stop right after
        try {
          await renderFrame(canvas, t);
          if (watermark) drawWatermark(canvas, watermark);
        } catch (err) {
          cancelAnimationFrame(raf);
          reject(err);
          return;
        }
        onProgress?.({ fraction, done: false });
        if (elapsed >= durationMs) {
          resolve();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    rec.stop();
    const blob = await stopped;
    const filename = `${filenameBase}.${mime.ext}`;
    if (output === 'share') {
      await shareBlob(blob, filename, mime.type.split(';')[0]);
    } else {
      downloadBlob(blob, filename);
    }
    onProgress?.({ fraction: 1, done: true });
    return { ext: mime.ext };
  } finally {
    canvas.remove();
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
