/**
 * Gallery thumbnail capture + cache.
 *
 * UiVariant1 hands its preview canvas in via setPreviewCanvas() so we
 * can grab it for thumbnails without pulling state through props.
 * `scheduleThumb(id)` queues a capture on the next idle tick — if one
 * is already in flight for the same id, the second call is a no-op
 * (the in-flight one will already pick up the latest state when it
 * runs). After the JPEG Blob lands in IDB, we update `thumbCache` so
 * any open Gallery refreshes via Svelte reactivity.
 *
 * ObjectURLs are managed in the cache: replacing a Blob revokes the
 * previous URL. The cache lives in-memory and is rebuilt from IDB
 * the first time the gallery asks for an id.
 */

import { putThumb, getThumb, deleteThumb } from './persistence';

const THUMB_W = 240;
const THUMB_H = 180;
const THUMB_QUALITY = 0.7;

let previewCanvas: HTMLCanvasElement | null = null;

/**
 * Reactive map: tententoon id → ObjectURL of its thumbnail. Gallery
 * tiles render `thumbCache[id]` when set, fall back to the gradient
 * placeholder when null/undefined.
 */
export const thumbCache = $state<Record<string, string | null>>({});

/** UiVariant1 calls this when its preview canvas is bound. */
export function setPreviewCanvas(c: HTMLCanvasElement | null): void {
  previewCanvas = c;
}

const pending = new Set<string>();

/**
 * Queue a thumbnail regenerate for `id`. Coalesces: if a capture is
 * already pending for the same id, the second call is a no-op.
 *
 * No-ops when there's nothing to capture (no preview canvas yet, or
 * the canvas is sized 0×0 — happens before the renderer has drawn
 * its first frame).
 */
export function scheduleThumb(id: string): void {
  if (!previewCanvas) return;
  if (pending.has(id)) return;
  pending.add(id);
  runIdle(async () => {
    try {
      await captureThumb(id);
    } finally {
      pending.delete(id);
    }
  });
}

async function captureThumb(id: string): Promise<void> {
  const src = previewCanvas;
  if (!src || src.width === 0 || src.height === 0) return;
  const off = document.createElement('canvas');
  off.width = THUMB_W;
  off.height = THUMB_H;
  const ctx = off.getContext('2d');
  if (!ctx) return;
  // Fit-letterbox: scale the source canvas into 240×180 preserving aspect.
  const srcAspect = src.width / src.height;
  const dstAspect = THUMB_W / THUMB_H;
  let dw = THUMB_W;
  let dh = THUMB_H;
  if (srcAspect > dstAspect) {
    dh = Math.round(THUMB_W / srcAspect);
  } else {
    dw = Math.round(THUMB_H * srcAspect);
  }
  const dx = Math.round((THUMB_W - dw) / 2);
  const dy = Math.round((THUMB_H - dh) / 2);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);
  ctx.drawImage(src, dx, dy, dw, dh);
  const blob: Blob | null = await new Promise((resolve) =>
    off.toBlob((b) => resolve(b), 'image/jpeg', THUMB_QUALITY)
  );
  if (!blob) return;
  await putThumb(id, blob);
  setCacheBlob(id, blob);
}

/** Hydrate (or refresh) the cached ObjectURL for `id` from IDB. */
export async function loadThumbInto(id: string): Promise<void> {
  if (thumbCache[id]) return;
  const blob = await getThumb(id);
  setCacheBlob(id, blob);
}

/** Drop a tententoon's thumbnail (memory + IDB). Called by deleteTententoon. */
export async function dropThumb(id: string): Promise<void> {
  const prev = thumbCache[id];
  if (prev) URL.revokeObjectURL(prev);
  delete thumbCache[id];
  await deleteThumb(id);
}

function setCacheBlob(id: string, blob: Blob | null): void {
  const prev = thumbCache[id];
  if (prev) URL.revokeObjectURL(prev);
  thumbCache[id] = blob ? URL.createObjectURL(blob) : null;
}

function runIdle(cb: () => void): void {
  // requestIdleCallback isn't on Safari; fall back to setTimeout. The
  // 200ms delay is long enough that we don't compete with the next
  // animation frame after a gesture, short enough to feel responsive.
  const w = window as Window & {
    requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
  };
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(() => cb(), { timeout: 1000 });
  } else {
    setTimeout(cb, 200);
  }
}
