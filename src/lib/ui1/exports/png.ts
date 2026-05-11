/**
 * Still-frame PNG export. Renders the current geometry to an off-screen
 * canvas sized to the source image (NOT the on-screen canvas), so the
 * exported PNG is full-resolution per HANDOFF §8 acceptance.
 */

import { createEscherZoomRenderer } from '../../render/escher-zoom';
import { buildRenderInputs, extractPixels } from '../render';

export async function exportPng(image: ImageBitmap, rect: { x: number; y: number; w: number; h: number }, filename = 'tententoon.png'): Promise<void> {
  // Render to a canvas matching the source image's pixel size.
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const pixels = extractPixels(image);
  const inputs = buildRenderInputs(image, pixels, rect, image.width, image.height);
  if (!inputs) throw new Error('No valid rect');

  // Force the CPU tier for one-shot offscreen renders. The GPU worker
  // tier wants its own canvas via transferControlToOffscreen, which is
  // a one-time operation and would conflict with the live preview.
  const renderer = createEscherZoomRenderer({ forceTier: 'cpu-main' });
  await renderer.init(canvas);
  renderer.render(inputs);
  renderer.dispose();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('toBlob returned null');
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
