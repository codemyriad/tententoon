/**
 * Still-frame PNG export. Renders the current geometry to an off-screen
 * canvas sized to the source image (NOT the on-screen canvas), so the
 * exported PNG is full-resolution per HANDOFF §8 acceptance.
 */

import { CpuEscherZoomRenderer } from '../../render/escher-zoom/cpu';
import { WebGL2EscherZoomRenderer } from '../../render/escher-zoom/webgl2';
import type { EscherZoomInput } from '../../render/escher-zoom/input';
import { buildRenderInputs, extractPixels } from '../render';
import { drawWatermark } from './share';

export type Rect = { x: number; y: number; w: number; h: number };

export type PngExportOptions = {
  filename?: string;
  /** Reported as 0..1 across the pixel render; encoding/download share the tail. */
  onProgress?: (fraction: number) => void;
  signal?: { cancelled: boolean };
  /** When set, stamped bottom-right after the spiral renders. */
  watermark?: string;
  /**
   * 'download' triggers an <a download> click.
   * 'blob' returns the rendered blob without saving — caller is
   * responsible for sharing/saving it (used by the share flow so the
   * blob can be handed to navigator.share inside a fresh user gesture).
   */
  output?: 'download' | 'blob';
  /**
   * Optional alternative single-frame renderer. When provided, the
   * spiral CPU pipeline is bypassed entirely — exportPng allocates a
   * canvas, calls renderFrame on it, watermarks, and saves. Used by
   * the Droste view so its on-screen animation is what gets saved
   * instead of the tententoon spiral. The caller is responsible for
   * applying playback.direction; t is passed through raw.
   */
  renderFrame?: (canvas: HTMLCanvasElement, t: number) => Promise<void> | void;
  /** Output canvas size when using renderFrame. Defaults to image size. */
  outputSize?: { w: number; h: number };
  /** t to render at when using renderFrame. Defaults to 0. */
  t?: number;
};

export async function exportPng(
  image: ImageBitmap,
  rect: Rect,
  crop: Rect,
  opts: PngExportOptions = {}
): Promise<Blob | void> {
  const {
    filename = 'tententoon.png',
    onProgress,
    signal,
    watermark,
    output = 'download',
    renderFrame,
    outputSize,
    t = 0
  } = opts;

  // External-renderer path (Droste view). Single render call, then
  // watermark + save — no chunking required, since the Droste renderer
  // is a handful of ctx.drawImage calls.
  if (renderFrame) {
    const w = Math.max(1, Math.round(outputSize?.w ?? image.width));
    const h = Math.max(1, Math.round(outputSize?.h ?? image.height));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    onProgress?.(0);
    await renderFrame(canvas, t);
    if (signal?.cancelled) throw new Error('cancelled');
    onProgress?.(1);
    if (watermark) drawWatermark(canvas, watermark);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('toBlob returned null');
    if (output === 'blob') return blob;
    downloadBlob(blob, filename);
    return;
  }

  if (rect.w <= 0 || rect.h <= 0 || crop.w <= 0 || crop.h <= 0) {
    throw new Error('No valid rect');
  }
  // Render at the WORKING IMAGE's pixel size (the crop), not the
  // original image's — the crop is what the math actually operates on,
  // and at any other aspect the renderer would just letterbox.
  // Rounded to integer pixels for the canvas/blob.
  const outW = Math.max(1, Math.round(crop.w));
  const outH = Math.max(1, Math.round(crop.h));
  const pixels = extractPixels(image);
  const inputs = buildRenderInputs(pixels, rect, crop, outW, outH);
  if (!inputs) throw new Error('No valid rect');

  // Try the GPU first — it draws a single fullscreen quad and finishes in
  // a few ms even on multi-megapixel canvases. The live preview uses the
  // same renderer, which is why playback is smooth; the CPU progressive
  // path here was only the legacy default. Falls back to chunked CPU
  // render on any GPU failure (no WebGL2, context creation refused, etc.).
  let canvas = tryRenderGpu(inputs, outW, outH);
  if (canvas) {
    onProgress?.(1);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const renderer = new CpuEscherZoomRenderer();
    renderer.init(canvas);
    await renderer.renderProgressive(inputs, { onProgress, signal });
    renderer.dispose();
    if (signal?.cancelled) throw new Error('cancelled');
  }

  if (watermark) drawWatermark(canvas, watermark);

  const blob = await new Promise<Blob | null>((resolve) => canvas!.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('toBlob returned null');
  onProgress?.(1);
  if (output === 'blob') return blob;
  downloadBlob(blob, filename);
}

/**
 * Render one frame on a fresh WebGL2 context, then composite the result
 * onto a 2D canvas so the caller can watermark and toBlob normally.
 * Returns null if WebGL2 isn't available or fails — caller should fall
 * back to the CPU renderer. The intermediate WebGL2 canvas is discarded;
 * only the 2D copy is returned.
 */
function tryRenderGpu(input: EscherZoomInput, outW: number, outH: number): HTMLCanvasElement | null {
  let glCanvas: HTMLCanvasElement | null = null;
  let renderer: WebGL2EscherZoomRenderer | null = null;
  try {
    glCanvas = document.createElement('canvas');
    glCanvas.width = outW;
    glCanvas.height = outH;
    renderer = new WebGL2EscherZoomRenderer({ preserveDrawingBuffer: true });
    renderer.init(glCanvas);
    renderer.render(input);
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(glCanvas, 0, 0);
    return out;
  } catch {
    return null;
  } finally {
    renderer?.dispose();
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
