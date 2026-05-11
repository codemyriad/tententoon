/**
 * MP4 / WebM export via MediaRecorder + canvas.captureStream.
 *
 * Records the LIVE on-screen canvas while the playback rune drives it
 * through one full loop. Caller is responsible for driving `playback.t`
 * from 0 → 1 at the right wall-clock rate (or letting the existing rAF
 * tick handle it). We just orchestrate start/stop and download.
 *
 * MIME negotiation:
 *   1. video/mp4;codecs=avc1   (Safari, recent Chrome)
 *   2. video/webm;codecs=vp9   (Firefox, all Chrome)
 *   3. video/webm              (fallback)
 */

const CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9',
  'video/webm'
];

export type RecordHandle = {
  stop: () => Promise<void>;
  ext: 'mp4' | 'webm';
};

export function pickMimeType(): { type: string; ext: 'mp4' | 'webm' } | null {
  for (const t of CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
      return { type: t, ext: t.startsWith('video/mp4') ? 'mp4' : 'webm' };
    }
  }
  return null;
}

export function startRecording(canvas: HTMLCanvasElement, filenameBase = 'tententoon'): RecordHandle {
  const mime = pickMimeType();
  if (!mime) throw new Error('No supported video MIME type for MediaRecorder.');
  const stream = canvas.captureStream(60);
  const rec = new MediaRecorder(stream, { mimeType: mime.type, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  rec.start();

  return {
    ext: mime.ext,
    stop(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        rec.onstop = () => {
          try {
            const blob = new Blob(chunks, { type: rec.mimeType });
            downloadBlob(blob, `${filenameBase}.${mime.ext}`);
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        rec.onerror = (e) => reject((e as ErrorEvent).error ?? e);
        rec.stop();
      });
    }
  };
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
