/**
 * Live panels for explain.html, rendered by the app's own GPU pipeline
 * renderer (PipelinePanelGLRenderer) — no duplicated math.
 *
 * Three places on the page, fed by one swappable test image:
 *   #exp-escher  — the tententoon spiral (canonical twist), in "Now bend it".
 *   #exp-rotlog  — the rotated-log lattice, the "lean it over" illustration.
 *   #exp-log     — log(z − c). DRAGGABLE.  +  #exp-orig — "the original".
 *
 * The experiment: dragging #exp-log pans log space. A horizontal pan is a
 * shift in u = log|z − c| (a ZOOM); a vertical pan is a shift in v = arg(z − c)
 * (a ROTATION). The same pan feeds #exp-orig — the picture with the spiral
 * twist turned off (kTwist = 0) — so you watch a slide in the log become a
 * rotate-and-zoom of the original, first-hand.
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

type PanelDef = { id: string; mode: PanelMode; pan: boolean; kTwist?: number };
type Panel = PanelDef & { canvas: HTMLCanvasElement; renderer: PipelinePanelGLRenderer };

async function main(): Promise<void> {
  const root = byId<HTMLElement>('exp-root');
  if (!root) return;
  const fallback = byId<HTMLElement>('exp-fallback');
  const readout = byId<HTMLElement>('exp-readout');

  function showFallback(msg?: string): void {
    if (fallback) {
      fallback.hidden = false;
      if (msg) fallback.textContent = msg;
    }
    // Hide every live panel + its controls; the prose still explains it all.
    document.querySelectorAll<HTMLElement>('.live-panels, .exp-controls').forEach((el) => {
      el.style.display = 'none';
    });
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

  // Image-aspect cells so the "original" panel shows the picture undistorted.
  root.style.setProperty('--cell-ar', `${image.width} / ${image.height}`);

  const defs: PanelDef[] = [
    { id: 'exp-escher', mode: 'escher', pan: false }, // the spiral ("Now bend it")
    { id: 'exp-rotlog', mode: 'rotlog', pan: false }, // the tilt illustration
    { id: 'exp-log', mode: 'log', pan: true }, //        draggable log lattice
    { id: 'exp-orig', mode: 'escher', pan: true, kTwist: 0 } // "the original", no twist
  ];
  const panels: Panel[] = [];
  try {
    for (const d of defs) {
      const canvas = byId<HTMLCanvasElement>(d.id);
      if (!canvas) continue;
      const renderer = new PipelinePanelGLRenderer();
      renderer.init(canvas);
      panels.push({ ...d, canvas, renderer });
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
    const panU = p.pan ? pan.u : 0;
    const panV = p.pan ? pan.v : 0;
    if (p.mode === 'escher') {
      p.renderer.render({
        pixels, ctx, mode: 'escher', W, H,
        scale: W / ctx.W, lnR0, panU, panV,
        ...(p.kTwist !== undefined ? { kTwist: p.kTwist } : {})
      });
    } else {
      p.renderer.render({
        pixels, ctx, mode: p.mode, W, H,
        pxPerUnit: panelPxPerUnit(p.mode, ctx.logS, H), uRef, panU, panV
      });
    }
  }

  function updateReadout(): void {
    if (!readout) return;
    if (pan.u === 0 && pan.v === 0) {
      readout.textContent = 'drag the log panel — ↔ zoom, ↕ rotate the original';
      return;
    }
    const zoom = Math.exp(pan.u);
    let deg = ((pan.v * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;
    readout.textContent = `the original is now zoomed ×${zoom.toFixed(2)} and rotated ${deg.toFixed(0)}°`;
  }

  let raf = 0;
  let panOnly = false;
  function scheduleRender(onlyPanned = false): void {
    panOnly = panOnly || onlyPanned;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const only = panOnly;
      panOnly = false;
      for (const p of panels) if (!only || p.pan) renderPanel(p);
      updateReadout();
    });
  }

  // Drag-to-pan on the log panel: Δx → u (zoom), Δy → v (rotation). One cell
  // height of vertical drag = 2π = exactly one full turn.
  const logCanvas = byId<HTMLCanvasElement>('exp-log');
  if (logCanvas) {
    let active = false;
    let lastX = 0;
    let lastY = 0;
    logCanvas.addEventListener('pointerdown', (e) => {
      active = true;
      lastX = e.clientX;
      lastY = e.clientY;
      try {
        logCanvas.setPointerCapture(e.pointerId);
      } catch {
        /* pointer not capturable (e.g. synthetic event) */
      }
      e.preventDefault();
    });
    logCanvas.addEventListener('pointermove', (e) => {
      if (!active) return;
      const h = logCanvas.getBoundingClientRect().height || 1;
      const perUnit = h / TWO_PI; // css px per log-space unit
      pan.u += (e.clientX - lastX) / perUnit;
      pan.v += (e.clientY - lastY) / perUnit;
      lastX = e.clientX;
      lastY = e.clientY;
      scheduleRender(true);
    });
    const end = (e: PointerEvent) => {
      active = false;
      try {
        logCanvas.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };
    logCanvas.addEventListener('pointerup', end);
    logCanvas.addEventListener('pointercancel', end);
  }

  byId<HTMLButtonElement>('exp-reset')?.addEventListener('click', () => {
    pan.u = 0;
    pan.v = 0;
    scheduleRender(true);
  });

  new ResizeObserver(() => scheduleRender(false)).observe(root);
  scheduleRender(false);
}

void main();
