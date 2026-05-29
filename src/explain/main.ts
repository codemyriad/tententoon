/**
 * Live panels for explain.html, rendered by the app's own GPU pipeline
 * renderer (PipelinePanelGLRenderer) — no duplicated map math.
 *
 *   #exp-escher  — the tententoon spiral, in "Now bend it".  Its twist follows
 *                  the angle slider, so you see how β shapes the final spiral.
 *   #exp-rotlog  — the rotated-log lattice (leans by the same angle).
 *   #exp-log     — log(z − c). DRAGGABLE.  +  #exp-orig — "the original".
 *
 * Two global controls feed every panel from one swappable test image:
 *   • source mode — picture / grid / polar / overlay (see patterns.ts).
 *   • twist angle — overrides β = atan(logS / 2π); only at β does the spiral
 *                   close on itself.
 *
 * The experiment: dragging #exp-log pans log space. Horizontal pan = a shift in
 * u = log|z − c| (a ZOOM); vertical pan = a shift in v = arg(z − c) (a
 * ROTATION). The same pan drives #exp-orig (the picture with the twist off), so
 * a slide in the log visibly becomes a rotate-and-zoom of the original.
 */

import { fitCropToNest, type Rect } from '../lib/math/droste';
import { buildPanelGeometry, panelPxPerUnit, panelURef } from '../lib/ui1/pipeline-panels';
import { PipelinePanelGLRenderer } from '../lib/render/pipeline-gl';
import { makeSource, type SourceMode } from './patterns';

// ─── Swappable test image ───────────────────────────────────────────────────
// To use a different picture: drop it in /public and point SOURCE at it. NEST
// is the nest rectangle in *image pixels* — load it in the editor, draw the
// rectangle, read x / y / w / h off the readout. Leave NEST = null to drop a
// ~half-size nest in the centre of whatever image you give (S ≈ 2).
const SOURCE = '/Droste_1260359-nevit.jpg';
const NEST: Rect | null = { x: 343.2, y: 334.7, w: 583.5, h: 454.9 };
// ─────────────────────────────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;
const MAX_PX = 720;

const byId = <T extends Element>(id: string) => document.getElementById(id) as T | null;

function centeredNest(w: number, h: number): Rect {
  const s = 0.5;
  return { x: (w * (1 - s)) / 2, y: (h * (1 - s)) / 2, w: w * s, h: h * s };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img.decode().then(() => img);
}

type Role = 'tententoon' | 'log' | 'orig' | 'rotlog';
type Panel = { role: Role; canvas: HTMLCanvasElement; renderer: PipelinePanelGLRenderer };

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
    document.querySelectorAll<HTMLElement>('.live-panels, .exp-controls').forEach((el) => {
      el.style.display = 'none';
    });
  }

  let photo: HTMLImageElement;
  try {
    photo = await loadImage(SOURCE);
  } catch {
    showFallback('Could not load the test image.');
    return;
  }

  const W = photo.naturalWidth;
  const H = photo.naturalHeight;
  const nest = NEST ?? centeredNest(W, H);
  const crop = fitCropToNest({ width: W, height: H }, nest, null);
  const geom = buildPanelGeometry(nest, crop);
  if (!geom) {
    showFallback('That nest is degenerate — pick a smaller rectangle.');
    return;
  }
  const { ctx, R0, S } = geom;
  const uRef = panelURef(ctx.rMax);
  const lnR0 = Math.log(Math.max(R0, 1e-9));
  const cImgX = crop.x + ctx.cx;
  const cImgY = crop.y + ctx.cy;
  const beta = Math.atan2(ctx.logS, TWO_PI); // canonical twist angle

  // Image-aspect cells so the "original" panel shows the picture undistorted.
  root.style.setProperty('--cell-ar', `${W} / ${H}`);

  // ── State ──────────────────────────────────────────────────────────────
  const state = { source: 'picture' as SourceMode, angle: beta, panU: 0, panV: 0 };
  let pixels = makeSource(state.source, photo, W, H, cImgX, cImgY, S);

  const roles: Role[] = ['tententoon', 'log', 'orig', 'rotlog'];
  const idByRole: Record<Role, string> = {
    tententoon: 'exp-escher',
    log: 'exp-log',
    orig: 'exp-orig',
    rotlog: 'exp-rotlog'
  };
  const panels: Panel[] = [];
  try {
    for (const role of roles) {
      const canvas = byId<HTMLCanvasElement>(idByRole[role]);
      if (!canvas) continue;
      const renderer = new PipelinePanelGLRenderer();
      renderer.init(canvas);
      panels.push({ role, canvas, renderer });
    }
  } catch {
    for (const p of panels) p.renderer.dispose();
    showFallback();
    return;
  }

  function renderPanel(p: Panel): void {
    const dpr = window.devicePixelRatio || 1;
    const r = p.canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    let cw = Math.round(r.width * dpr);
    let ch = Math.round(r.height * dpr);
    const long = Math.max(cw, ch);
    if (long > MAX_PX) {
      const s = MAX_PX / long;
      cw = Math.max(1, Math.round(cw * s));
      ch = Math.max(1, Math.round(ch * s));
    }
    const a = state.angle;
    switch (p.role) {
      case 'tententoon':
        p.renderer.render({
          pixels, ctx, mode: 'escher', W: cw, H: ch,
          scale: cw / ctx.W, lnR0, kTwist: Math.tan(a)
        });
        break;
      case 'orig': // the picture itself (twist off), rotated/zoomed by the pan
        p.renderer.render({
          pixels, ctx, mode: 'escher', W: cw, H: ch,
          scale: cw / ctx.W, lnR0, kTwist: 0, panU: state.panU, panV: state.panV
        });
        break;
      case 'log':
        p.renderer.render({
          pixels, ctx, mode: 'log', W: cw, H: ch,
          pxPerUnit: panelPxPerUnit('log', ctx.logS, ch), uRef, panU: state.panU, panV: state.panV
        });
        break;
      case 'rotlog':
        p.renderer.render({
          pixels, ctx, mode: 'rotlog', W: cw, H: ch,
          pxPerUnit: panelPxPerUnit('rotlog', ctx.logS, ch), uRef, rot: a
        });
        break;
    }
  }

  function updateReadout(): void {
    if (!readout) return;
    if (state.panU === 0 && state.panV === 0) {
      readout.textContent = 'drag the log panel — ↔ zoom, ↕ rotate the original';
      return;
    }
    const zoom = Math.exp(state.panU);
    let deg = ((state.panV * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;
    readout.textContent = `the original is now zoomed ×${zoom.toFixed(2)} and rotated ${deg.toFixed(0)}°`;
  }

  let raf = 0;
  let dirtyAll = false;
  const dirty = new Set<Role>();
  function scheduleRender(only?: Role[]): void {
    if (only) only.forEach((r) => dirty.add(r));
    else dirtyAll = true;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const all = dirtyAll;
      dirtyAll = false;
      const set = new Set(dirty);
      dirty.clear();
      for (const p of panels) if (all || set.has(p.role)) renderPanel(p);
      updateReadout();
    });
  }

  // ── Source mode ──────────────────────────────────────────────────────────
  function setSource(mode: SourceMode): void {
    state.source = mode;
    pixels = makeSource(mode, photo, W, H, cImgX, cImgY, S);
    document.querySelectorAll<HTMLElement>('[data-source]').forEach((b) => {
      b.classList.toggle('on', b.dataset.source === mode);
    });
    scheduleRender(); // new texture → re-render every panel
  }
  document.querySelectorAll<HTMLElement>('[data-source]').forEach((b) => {
    b.addEventListener('click', () => setSource((b.dataset.source as SourceMode) ?? 'picture'));
  });

  // ── Twist angle ────────────────────────────────────────────────────────
  const angleInput = byId<HTMLInputElement>('exp-angle');
  const angleVal = byId<HTMLElement>('exp-angle-val');
  const betaDeg = (beta * 180) / Math.PI;
  function setAngleDeg(deg: number): void {
    state.angle = (deg * Math.PI) / 180;
    if (angleVal) {
      const closed = Math.abs(deg - betaDeg) < 0.4;
      angleVal.textContent = `${deg.toFixed(1)}°${closed ? ' — closed ✓' : ''}`;
      angleVal.classList.toggle('closed', closed);
    }
    scheduleRender(['tententoon', 'rotlog']);
  }
  if (angleInput) {
    angleInput.min = '0';
    angleInput.max = Math.max(24, Math.ceil(betaDeg * 3)).toString();
    angleInput.step = '0.1';
    angleInput.value = betaDeg.toFixed(1);
    angleInput.addEventListener('input', () => setAngleDeg(parseFloat(angleInput.value)));
    setAngleDeg(betaDeg);
  }
  const betaNote = byId<HTMLElement>('exp-angle-note');
  if (betaNote) betaNote.textContent = `closes seamlessly at β ≈ ${betaDeg.toFixed(1)}°`;

  // ── Drag-to-pan on the log panel ─────────────────────────────────────────
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
        /* not capturable (synthetic event) */
      }
      e.preventDefault();
    });
    logCanvas.addEventListener('pointermove', (e) => {
      if (!active) return;
      const h = logCanvas.getBoundingClientRect().height || 1;
      const perUnit = h / TWO_PI; // one cell height = 2π = one full turn
      state.panU += (e.clientX - lastX) / perUnit;
      state.panV += (e.clientY - lastY) / perUnit;
      lastX = e.clientX;
      lastY = e.clientY;
      scheduleRender(['log', 'orig']);
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
    state.panU = 0;
    state.panV = 0;
    scheduleRender(['log', 'orig']);
  });

  new ResizeObserver(() => scheduleRender()).observe(root);
  scheduleRender();
}

void main();
