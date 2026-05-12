/**
 * Still-frame PNG export. Renders the current geometry to an off-screen
 * canvas sized to the source image (NOT the on-screen canvas), so the
 * exported PNG is full-resolution per HANDOFF §8 acceptance.
 */

import { CpuEscherZoomRenderer } from '../../render/escher-zoom/cpu';
import { buildRenderInputs, extractPixels } from '../render';

export type PngExportOptions = {
  filename?: string;
  /** Reported as 0..1 across the pixel render; encoding/download share the tail. */
  onProgress?: (fraction: number) => void;
  signal?: { cancelled: boolean };
};

export async function exportPng(
  image: ImageBitmap,
  rect: { x: number; y: number; w: number; h: number },
  opts: PngExportOptions = {}
): Promise<void> {
  const { filename = 'tententoon.png', onProgress, signal } = opts;
  // Render to a canvas matching the source image's pixel size.
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const pixels = extractPixels(image);
  const inputs = buildRenderInputs(image, pixels, rect, image.width, image.height);
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

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('toBlob returned null');
  onProgress?.(1);
  downloadBlob(blob, filename);
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
