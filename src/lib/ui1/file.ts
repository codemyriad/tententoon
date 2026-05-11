/**
 * File → ImageBitmap helpers for the /ui1 DropZone.
 *
 * Accepts JPG/PNG/WebP (per HANDOFF §8 acceptance criteria). Size cap of
 * 20 MB is enforced here so big drops fail fast with a clear message
 * instead of attempting to decode and silently OOMing.
 */

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPTED = /^image\/(jpeg|png|webp)$/;

export type LoadResult =
  | { ok: true; image: ImageBitmap; name: string }
  | { ok: false; reason: string };

export async function loadFile(file: File): Promise<LoadResult> {
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: `Too large (${formatMB(file.size)}). Max 20 MB.` };
  }
  if (!ACCEPTED.test(file.type)) {
    return { ok: false, reason: `Unsupported type: ${file.type || 'unknown'}.` };
  }
  try {
    const image = await createImageBitmap(file);
    return { ok: true, image, name: file.name };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Decode failed.' };
  }
}

export async function loadUrl(url: string): Promise<LoadResult> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, reason: `${res.status} ${res.statusText}` };
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return { ok: false, reason: `Not an image (${ct}).` };
    const blob = await res.blob();
    const image = await createImageBitmap(blob);
    const name = url.split('/').pop() ?? 'sample';
    return { ok: true, image, name };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Load failed.' };
  }
}

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
