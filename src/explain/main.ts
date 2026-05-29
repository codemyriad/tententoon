/**
 * Explorable for the "four pictures" section of explain.html.
 *
 * Loads a (swappable) test image, builds the Droste→Escher geometry, and
 * renders the pipeline's four frames live: source · log(z−c) · rotated log ·
 * tententoon. It reuses the app's GPU renderer (PipelinePanelGLRenderer) and
 * geometry helpers — no duplicated math.
 *
 * Drag the log panel: a horizontal drag pans u = log|z−c| (a ZOOM); a vertical
 * drag pans v = arg(z−c) (a ROTATION). The same pan feeds the tententoon, so
 * you watch the spiral zoom and rotate under your finger.
 */

import { fitCropToNest, type Rect } from '../lib/math/droste';
import { buildPanelGeometry, panelPxPerUnit, panelURef } from '../lib/ui1/pipeline-panels';
import { PipelinePanelGLRenderer, type PanelMode } from '../lib/render/pipeline-gl';

// ─── Swappable test image ───────────────────────────────────────────────────
// To use a different picture: drop it in /public and point SOURCE at it. NEST
// is the nest rectangle in *image pixels* — load the image in the editor, draw
// the rectangle, and read x / y / w / h off the readout. Leave NEST = null to
// drop a ~half-size nest in the centre of whatever image you give (S ≈ 2).
const SOURCE = '/Droste_1260359-nevit.jpg';
const NEST: Rect | null = { x: 343.2, y: 334.7, w: 583.5, h: 454.9 };
// ─────────────────────────────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;
const MAX_PX = 720; // cap a canvas's long side (keeps the GPU framebuffer small)

const byId = <T extends Element>(id: string) => document.getElementById(id) as T | null;

function centeredNest(w: number, h: number): Rect {
  const nw = w * 0.5;
  const nh = h * 0.5;
  return { x: (w - nw) / 2, y: (h - nh) / 2, w: nw, h: nh };
}

async function loadPixels(src: string): Promise<ImageData> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

type Panel = { canvas: HTMLCanvasElement; renderer: PipelinePanelGLRenderer; mode: PanelMode };

async function main(): Promise<void> {
  const fig = byId<HTMLElement>('explorable');
  if (!fig) return;
  const fallback = byId<HTMLElement>('exp-fallback');
  const readout = byId<HTMLElement>('exp-readout');

  function showFallback(msg?: string): void {
    if (fallback) {
      fallback.hidden = false;
      if (msg) fallback.textContent = msg;
    }
    const grid = fig!.querySelector('.exp-grid') as HTMLElement | null;
    const controls = fig!.querySelector('.exp-controls') as HTMLElement | null;
    if (grid) grid.style.display = 'none';
    if (controls) controls.style.display = 'none';
  }

  let pixels: ImageData;
  try {
    pixels = await loadPixels(SOURCE);
  } catch {
    showFallback('Could not load the test image.');
    return;
  }

  const image = { width: pixels.width, height: pixels.height };
  const nest = NEST ?? centeredNest(image.width, image.height);
  const crop = fitCropToNest(image, nest, null);
  const geom = buildPanelGeometry(nest, crop);
  if (!geom) {
    showFallback('That nest is degenerate — pick a smaller rectangle.');
    return;
  }
  const { ctx, R0 } = geom;
  const uRef = panelURef(ctx.rMax);
  const lnR0 = Math.log(Math.max(R0, 1e-9));

  // Source thumbnail + nest overlay. Every cell takes the image's aspect ratio
  // (--cell-ar), so the source fills its cell with no letterbox and the nest
  // box can be positioned in plain percentages.
  fig.style.setProperty('--cell-ar', `${image.width} / ${image.height}`);
  const srcImg = byId<HTMLImageElement>('exp-src');
  if (srcImg) srcImg.src = SOURCE;
  const nestBox = byId<HTMLElement>('exp-nest');
  if (nestBox) {
    nestBox.style.left = `${(nest.x / image.width) * 100}%`;
    nestBox.style.top = `${(nest.y / image.height) * 100}%`;
    nestBox.style.width = `${(nest.w / image.width) * 100}%`;
    nestBox.style.height = `${(nest.h / image.height) * 100}%`;
  }

  // GL panels — one WebGL2 context per canvas. Bail to the prose fallback if
  // WebGL2 is unavailable (init throws).
  const defs: Array<{ id: string; mode: PanelMode }> = [
    { id: 'exp-log', mode: 'log' },
    { id: 'exp-rotlog', mode: 'rotlog' },
    { id: 'exp-escher', mode: 'escher' }
  ];
  const panels: Panel[] = [];
  try {
    for (const d of defs) {
      const canvas = byId<HTMLCanvasElement>(d.id);
      if (!canvas) continue;
      const renderer = new PipelinePanelGLRenderer();
      renderer.init(canvas);
      panels.push({ canvas, renderer, mode: d.mode });
    }
  } catch {
    for (const p of panels) p.renderer.dispose();
    showFallback();
    return;
  }

  const pan = { u: 0, v: 0 };

  function renderPanel(p: Panel): void {
    const dpr = window.devicePixelRatio || 1;
    const r = p.canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    let W = Math.round(r.width * dpr);
    let H = Math.round(r.height * dpr);
    const long = Math.max(W, H);
    if (long > MAX_PX) {
      const s = MAX_PX / long;
      W = Math.max(1, Math.round(W * s));
      H = Math.max(1, Math.round(H * s));
    }
    if (p.mode === 'escher') {
      p.renderer.render({
        pixels, ctx, mode: 'escher', W, H,
        scale: W / ctx.W, lnR0, panU: pan.u, panV: pan.v
      });
    } else {
      p.renderer.render({
        pixels, ctx, mode: p.mode, W, H,
        pxPerUnit: panelPxPerUnit(p.mode, ctx.logS, H), uRef, panU: pan.u, panV: pan.v
      });
    }
  }

  function updateReadout(): void {
    if (!readout) return;
    if (pan.u === 0 && pan.v === 0) {
      readout.textContent = 'drag the log panel — ↔ zoom, ↕ rotate';
      return;
    }
    const zoom = Math.exp(pan.u);
    let deg = ((pan.v * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;
    readout.textContent = `u-pan → zoom ×${zoom.toFixed(2)}    ·    v-pan → rotation ${deg.toFixed(0)}°`;
  }

  let raf = 0;
  function scheduleRender(): void {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      for (const p of panels) renderPanel(p);
      updateReadout();
    });
  }

  // Drag-to-pan: Δx → u (zoom), Δy → v (rotation). One cell-height of vertical
  // drag = 2π = exactly one full turn, so the gesture maps 1:1 to the angle.
  function attachPan(canvas: HTMLCanvasElement): void {
    let active = false;
    let lastX = 0;
    let lastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      active = true;
      lastX = e.clientX;
      lastY = e.clientY;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* pointer not capturable (e.g. synthetic event) */
      }
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!active) return;
      const h = canvas.getBoundingClientRect().height || 1;
      const perUnit = h / TWO_PI; // css px per log-space unit
      pan.u += (e.clientX - lastX) / perUnit;
      pan.v += (e.clientY - lastY) / perUnit;
      lastX = e.clientX;
      lastY = e.clientY;
      scheduleRender();
    });
    const end = (e: PointerEvent) => {
      active = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }
  const logCanvas = byId<HTMLCanvasElement>('exp-log');
  const rotCanvas = byId<HTMLCanvasElement>('exp-rotlog');
  if (logCanvas) attachPan(logCanvas);
  if (rotCanvas) attachPan(rotCanvas);

  byId<HTMLButtonElement>('exp-reset')?.addEventListener('click', () => {
    pan.u = 0;
    pan.v = 0;
    scheduleRender();
  });

  const ro = new ResizeObserver(() => scheduleRender());
  ro.observe(fig);

  scheduleRender();
}

void main();
