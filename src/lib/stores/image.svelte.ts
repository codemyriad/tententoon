import type { Rect } from '../math/droste';
import {
  loadUploadBlob,
  readLast,
  readSelection,
  saveUploadBlob,
  writeLast,
  type StoredSelection
} from '../persistence';

export type SourceImage = {
  bitmap: ImageBitmap;
  /** Raw RGBA pixel buffer so math panels can sample the image in JS. */
  pixels: ImageData;
  width: number;
  height: number;
  url: string;
  /**
   * Initial selection for this image. Accepts the new full-state shape
   * (nest + crop + aspectLocked) or the legacy nest-only Rect; selection.svelte.ts
   * normalises both in initSelection.
   */
  presetSelection?: StoredSelection | Rect;
};

function extractPixels(bitmap: ImageBitmap): ImageData {
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

/**
 * Optional high-resolution version of `source`, produced by an
 * AI upscaler (see `upscaleSource` below). When set, the math panels
 * sample from `pixels` and apply `scale` so the geometry math stays
 * in original-image coords. Cleared whenever a new source loads.
 */
export type SourceHQ = { pixels: ImageData; scale: number };

export const imageState = $state<{
  source: SourceImage | null;
  sourceHQ: SourceHQ | null;
  loading: boolean;
  upscaling: boolean;
  upscaleError: string | null;
  error: string | null;
}>({
  source: null,
  sourceHQ: null,
  loading: false,
  upscaling: false,
  upscaleError: null,
  error: null
});

function revokePrevious() {
  const prev = imageState.source;
  if (!prev) return;
  if (prev.url.startsWith('blob:')) URL.revokeObjectURL(prev.url);
  // Release the decoded bitmap's underlying memory. Without this, switching
  // images repeatedly leaks the previous bitmap (tens of MB each) until GC
  // — which it isn't urged to do, since ImageBitmap isn't a JS-heap object.
  prev.bitmap.close?.();
}

export async function loadImageFromUrl(
  url: string,
  presetSelection?: StoredSelection | Rect
) {
  imageState.loading = true;
  imageState.error = null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const pixels = extractPixels(bitmap);
    revokePrevious();
    imageState.source = {
      bitmap,
      pixels,
      width: bitmap.width,
      height: bitmap.height,
      url,
      presetSelection
    };
    imageState.sourceHQ = null;
    imageState.upscaleError = null;
    writeLast({ kind: 'url', url });
  } catch (e) {
    imageState.error = e instanceof Error ? e.message : String(e);
  } finally {
    imageState.loading = false;
  }
}

export async function loadImageFromFile(file: File) {
  imageState.loading = true;
  imageState.error = null;
  try {
    const bitmap = await createImageBitmap(file);
    const pixels = extractPixels(bitmap);
    const url = URL.createObjectURL(file);
    revokePrevious();
    imageState.source = { bitmap, pixels, width: bitmap.width, height: bitmap.height, url };
    imageState.sourceHQ = null;
    imageState.upscaleError = null;
    try {
      await saveUploadBlob(file);
      writeLast({ kind: 'upload' });
    } catch {
      // IndexedDB unavailable (private mode, etc.) — run without persistence.
    }
  } catch (e) {
    imageState.error = e instanceof Error ? e.message : String(e);
  } finally {
    imageState.loading = false;
  }
}

/**
 * Send the current source to the dev-server upscale proxy (which calls
 * fal.ai), decode the result, and stash it as `sourceHQ`. The Escher
 * panels then sample from this 4× pixel buffer instead of the raw
 * source — same geometry math, more source pixels under each output
 * pixel near the limit point.
 *
 * One-shot, idempotent for a given source: you can re-run it but it'll
 * just overwrite. Cancellable: call again to retry on failure.
 */
export async function upscaleSource(model = 'fal-ai/aura-sr'): Promise<void> {
  const src = imageState.source;
  if (!src) return;
  imageState.upscaling = true;
  imageState.upscaleError = null;
  try {
    // Encode the current bitmap as a PNG data URI. PNG (lossless)
    // preserves the input fidelity to the upscaler — JPEG would let
    // compression artifacts get amplified along with real detail.
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const cctx = c.getContext('2d');
    if (!cctx) throw new Error('canvas 2d context unavailable');
    cctx.drawImage(src.bitmap, 0, 0);
    const dataUrl = c.toDataURL('image/png');

    const res = await fetch('/api/upscale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_data_url: dataUrl, model })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`upscale proxy ${res.status}: ${txt.slice(0, 200)}`);
    }
    const result = await res.json();
    // fal models return either { image: { url } } or { image_url } —
    // tolerate both shapes so we don't tie ourselves to one model.
    const url: string | undefined = result?.image?.url ?? result?.image_url ?? result?.images?.[0]?.url;
    if (!url) throw new Error(`no image url in response: ${JSON.stringify(result).slice(0, 200)}`);

    const upBlob = await (await fetch(url)).blob();
    const upBitmap = await createImageBitmap(upBlob);
    const upPixels = extractPixels(upBitmap);
    const scale = upBitmap.width / src.width;
    // Guard: aborted or stale (user already loaded another image while
    // we were upscaling). Drop silently — the new source has its own HQ.
    if (imageState.source !== src) return;
    imageState.sourceHQ = { pixels: upPixels, scale };
  } catch (e) {
    imageState.upscaleError = e instanceof Error ? e.message : String(e);
  } finally {
    imageState.upscaling = false;
  }
}

export function clearSourceHQ(): void {
  imageState.sourceHQ = null;
  imageState.upscaleError = null;
}

/** Try to restore the last session (upload blob or URL) from storage. */
export async function restoreLastSession(): Promise<boolean> {
  const last = readLast();
  if (!last) return false;
  const saved = readSelection(last) ?? undefined;
  if (last.kind === 'upload') {
    try {
      const blob = await loadUploadBlob();
      if (!blob) return false;
      const bitmap = await createImageBitmap(blob);
      const pixels = extractPixels(bitmap);
      const url = URL.createObjectURL(blob);
      revokePrevious();
      imageState.source = {
        bitmap,
        pixels,
        width: bitmap.width,
        height: bitmap.height,
        url,
        presetSelection: saved
      };
      imageState.sourceHQ = null;
      imageState.upscaleError = null;
      return true;
    } catch {
      return false;
    }
  }
  try {
    await loadImageFromUrl(last.url, saved);
    return imageState.source?.url === last.url;
  } catch {
    return false;
  }
}
