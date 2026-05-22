/**
 * Shared helpers for the export pipeline: watermark stamping, file-share
 * detection, and the Web Share invocation. The export modules (png.ts,
 * mp4.ts) call into here so the same watermark looks the same on stills
 * and on every video frame.
 */

/** Brand text stamped on shared outputs. */
export const WATERMARK_TEXT = 'tententoon.codemyriad.io';

/**
 * Draw the watermark in the bottom-right corner of a canvas. Font size
 * scales with the canvas width so a 1080-px frame and a 360-px frame
 * both end up with a visually-similar mark. Soft dark shadow keeps it
 * readable over any background; no opaque pill so the chrome stays out
 * of the way of the picture.
 */
export function drawWatermark(canvas: HTMLCanvasElement, text: string = WATERMARK_TEXT): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Linear in long side, clamped to a sensible range. 1080 → ~17px,
  // 540 → ~11px, 1920 → ~24px.
  const size = Math.max(11, Math.min(28, Math.round(Math.max(canvas.width, canvas.height) / 64)));
  const pad = Math.round(size * 0.9);
  ctx.save();
  ctx.font = `${size}px ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = Math.max(2, Math.round(size / 5));
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillText(text, canvas.width - pad, canvas.height - pad);
  ctx.restore();
}

/**
 * True when the Web Share API can share files of the given MIME type
 * in this browser. Desktop Chrome on Linux/Windows usually returns
 * false; iOS Safari and Android Chrome usually return true.
 *
 * We probe with an empty File of the given type because navigator
 * .canShare's file-type filter is conservative — checking just
 * `'share' in navigator` isn't enough.
 */
export function canShareFiles(mimeType: string, suggestedExt: string): boolean {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.share || !navigator.canShare) return false;
  try {
    const probe = new File([new Uint8Array(0)], `probe.${suggestedExt}`, { type: mimeType });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Quick combined check used by the share UI to decide whether to render at all. */
export function shareCapability(): {
  image: boolean;
  gif: boolean;
  video: { mp4: boolean; webm: boolean };
} {
  return {
    image: canShareFiles('image/png', 'png'),
    gif: canShareFiles('image/gif', 'gif'),
    video: {
      mp4: canShareFiles('video/mp4', 'mp4'),
      webm: canShareFiles('video/webm', 'webm')
    }
  };
}

/**
 * Wrap a Blob as a File and hand it to navigator.share. Falls back to
 * throwing 'cannot-share' if the runtime refuses the payload; the
 * caller can decide what to surface.
 */
export async function shareBlob(blob: Blob, filename: string, mimeType: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.share) {
    throw new Error('cannot-share');
  }
  const file = new File([blob], filename, { type: mimeType });
  if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
    throw new Error('cannot-share');
  }
  try {
    await navigator.share({
      files: [file],
      title: 'tententoon',
      text: `Made with ${WATERMARK_TEXT}`
    });
  } catch (e) {
    // AbortError means the user dismissed the sheet. Treat as cancel,
    // not failure, so the caller can show a neutral toast.
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('cancelled');
    }
    throw e;
  }
}
