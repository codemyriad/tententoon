/**
 * Still-frame PNG export. Renders the current geometry to an off-screen
 * canvas sized to the source image (NOT the on-screen canvas), so the
 * exported PNG is full-resolution per HANDOFF §8 acceptance.
 */

import { CpuEscherZoomRenderer } from '../../render/escher-zoom/cpu';
import { buildRenderInputs, extractPixels } from '../render';
import { drawWatermark, shareBlob } from './share';

export type Rect = { x: number; y: number; w: number; h: number };

export type PngExportOptions = {
  filename?: string;
  /** Reported as 0..1 across the pixel render; encoding/download share the tail. */
  onProgress?: (fraction: number) => void;
  signal?: { cancelled: boolean };
  /** When set, stamped bottom-right after the spiral renders. */
  watermark?: string;
  /** Default 'download'. 'share' hands the blob to navigator.share. */
  output?: 'download' | 'share';
};

export async function exportPng(
  image: ImageBitmap,
  rect: Rect,
  crop: Rect,
  opts: PngExportOptions = {}
): Promise<void> {
  const {
    filename = 'tententoon.png',
    onProgress,
    signal,
    watermark,
    output = 'download'
  } = opts;
  if (rect.w <= 0 || rect.h <= 0 || crop.w <= 0 || crop.h <= 0) {
    throw new Error('No valid rect');
  }
  // Render at the WORKING IMAGE's pixel size (the crop), not the
  // original image's — the crop is what the math actually operates on,
  // and at any other aspect the renderer would just letterbox.
  // Rounded to integer pixels for the canvas/blob.
  const outW = Math.max(1, Math.round(crop.w));
  const outH = Math.max(1, Math.round(crop.h));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const pixels = extractPixels(image);
  const inputs = buildRenderInputs(pixels, rect, crop, outW, outH);
  if (!inputs) throw new Error('No valid rect');

  // Direct-construct the CPU renderer (bypassing the tier picker) — the
  // GPU worker tier wants its own canvas via transferControlToOffscreen,
  // which is a one-time op and would conflict with the live preview.
  // Chunked render keeps the main thread responsive: a single sync render
  // on a 1280×960 image freezes the UI for ~hundreds of ms.
  const renderer = new CpuEscherZoomRenderer();
  renderer.init(canvas);
  await renderer.renderProgressive(inputs, { onProgress, signal });
  renderer.dispose();

  if (signal?.cancelled) throw new Error('cancelled');

  if (watermark) drawWatermark(canvas, watermark);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('toBlob returned null');
  onProgress?.(1);
  if (output === 'share') {
    await shareBlob(blob, filename, 'image/png');
  } else {
    downloadBlob(blob, filename);
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
  // Defer revoke so the click can fire.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
