/**
 * Live, interactive panels for explain.html — every one rendered by the app's
 * own GPU pipeline (PipelinePanelGLRenderer), so there is no duplicated map
 * math. The page is a guided explorable; this file is its engine.
 *
 *   #exp-escher  — the hero tententoon spiral. Its twist follows the
 *                  Droste⟷Escher slider; at the closing angle β it seals into a
 *                  seamless spiral and the panel lights up "closed ✓".
 *   #exp-unroll  — the unroll. Morphs the spiral (morph = 1) into the flat
 *                  rotated-log strip (morph = 0), so "take the logarithm" is
 *                  something you watch happen rather than a formula to trust.
 *   #exp-log     — log(z − c), DRAGGABLE.  +  #exp-orig — "the original".
 *                  A sideways slide in the log zooms the picture; an up/down
 *                  slide rotates it. The readout keeps the score.
 *
 * Two test geometries feed the panels so the bend can be both honest AND
 * dramatic:
 *   • the PHOTO at its own gentle nesting (S ≈ 2.1, β ≈ 6.8°) — the "picture"
 *     and "overlay" sources, faithful but subtle;
 *   • a BOLD synthetic geometry (S = 20, β ≈ 25.5°, all but Escher's own 26°)
 *     for the scale-invariant "polar" and "grid" patterns, which stay seamless
 *     at any scale, so we can crank the twist right up.
 * Switching source switches geometry; the slider's β and the "closed" mark
 * follow along.
 */

import { fitCropToNest, type Rect } from '../lib/math/droste';
import {
  buildPanelGeometry,
  panelPxPerUnit,
  panelURef,
  type PanelGeometry
} from '../lib/ui1/pipeline-panels';
import { PipelinePanelGLRenderer } from '../lib/render/pipeline-gl';
import type { DrosteCtx } from '../lib/math/transforms';
import { makeSource, type SourceMode } from './patterns';

// ─── Test image + its nest ──────────────────────────────────────────────────
// NEST is in *image pixels*: load the photo in the editor, draw the rectangle,
// read x / y / w / h off the readout. null → a centred ~half-size nest (S ≈ 2).
const SOURCE = '/Droste_1260359-nevit.jpg';
const PHOTO_NEST: Rect | null = { x: 343.2, y: 334.7, w: 583.5, h: 454.9 };
// Bold synthetic scale: β = atan(ln 20 / 2π) ≈ 25.5°, a hair under Escher's 26°.
const BOLD_S = 20;
// ─────────────────────────────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;
const MAX_PX = 720;
const TWIST_MAX_DEG = 40; // slider headroom past the boldest closing angle
const RAD = Math.PI / 180;

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

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * A synthetic Droste geometry with the limit point at the centre of a
 * texW×texH working rect and an arbitrary shrink S — lets the scale-invariant
 * patterns spiral as hard as we like while still closing on themselves.
 */
function boldGeometry(texW: number, texH: number, S: number): PanelGeometry {
  const cx = texW / 2;
  const cy = texH / 2;
  const logS = Math.log(S);
  const rMax = Math.hypot(Math.max(cx, texW - cx), Math.max(cy, texH - cy));
  const ctx: DrosteCtx = {
    cx, cy, logS, rMax, W: texW, H: texH, cropX: 0, cropY: 0, sampleScale: 1
  };
  return { ctx, R0: rMax / Math.sqrt(S), S };
}

type Role = 'hero' | 'unroll' | 'log' | 'orig';
type Panel = { role: Role; canvas: HTMLCanvasElement; renderer: PipelinePanelGLRenderer };
type GeomInfo = {
  geom: PanelGeometry;
  uRef: number;
  lnR0: number;
  beta: number;
  betaDeg: number;
};

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
    document.querySelectorAll<HTMLElement>('.live-panels, .exp-controls, .ctl-row').forEach((el) => {
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

  const Wimg = photo.naturalWidth;
  const Himg = photo.naturalHeight;

  // ── Photo geometry (faithful, gentle) ──────────────────────────────────────
  const nest = PHOTO_NEST ?? centeredNest(Wimg, Himg);
  const crop = fitCropToNest({ width: Wimg, height: Himg }, nest, null);
  const gPhoto = buildPanelGeometry(nest, crop);
  if (!gPhoto) {
    showFallback('That nest is degenerate. Pick a smaller rectangle.');
    return;
  }
  const cImgX = crop.x + gPhoto.ctx.cx;
  const cImgY = crop.y + gPhoto.ctx.cy;
  const photoS = gPhoto.S; // capture once: the guard above narrows gPhoto here

  // ── Bold geometry (dramatic, seamless) — match the crop aspect so the cells
  //    keep their size when you switch source. ──────────────────────────────
  const texH = Math.min(960, Math.round(crop.h));
  const texW = Math.round(texH * (crop.w / crop.h));
  const gBold = boldGeometry(texW, texH, BOLD_S);

  // Image-aspect cells so the "original" reads undistorted; bold shares it.
  root.style.setProperty('--cell-ar', `${crop.w} / ${crop.h}`);

  function infoFor(geom: PanelGeometry): GeomInfo {
    const beta = Math.atan2(geom.ctx.logS, TWO_PI);
    return {
      geom,
      uRef: panelURef(geom.ctx.rMax),
      lnR0: Math.log(Math.max(geom.R0, 1e-9)),
      beta,
      betaDeg: (beta * 180) / Math.PI
    };
  }
  const photoInfo = infoFor(gPhoto);
  const boldInfo = infoFor(gBold);
  const isBold = (m: SourceMode) => m === 'grid' || m === 'polar';
  const infoForSource = (m: SourceMode): GeomInfo => (isBold(m) ? boldInfo : photoInfo);

  // Source textures are expensive to draw — build each once, on first use.
  const texCache = new Map<SourceMode, ImageData>();
  function pixelsFor(m: SourceMode): ImageData {
    const hit = texCache.get(m);
    if (hit) return hit;
    const img = isBold(m)
      ? makeSource(m, photo, texW, texH, texW / 2, texH / 2, BOLD_S)
      : makeSource(m, photo, Wimg, Himg, cImgX, cImgY, photoS);
    texCache.set(m, img);
    return img;
  }

  const reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    source: 'polar' as SourceMode,
    angle: boldInfo.beta, // twist of the hero/unroll spiral; starts closed
    panU: 0, // drag-the-log pan (drives #exp-log + #exp-orig only)
    panV: 0,
    morph: 1, // unroll: 1 = rolled-up spiral … 0 = flat strip
    playing: false // unroll auto-morph running
  };

  // ── Panels ───────────────────────────────────────────────────────────────
  const idByRole: Record<Role, string> = {
    hero: 'exp-escher',
    unroll: 'exp-unroll',
    log: 'exp-log',
    orig: 'exp-orig'
  };
  const panels: Panel[] = [];
  try {
    for (const role of Object.keys(idByRole) as Role[]) {
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

  function canvasPx(canvas: HTMLCanvasElement): { cw: number; ch: number } | null {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    let cw = Math.round(r.width * dpr);
    let ch = Math.round(r.height * dpr);
    const long = Math.max(cw, ch);
    if (long > MAX_PX) {
      const s = MAX_PX / long;
      cw = Math.max(1, Math.round(cw * s));
      ch = Math.max(1, Math.round(ch * s));
    }
    return { cw, ch };
  }

  function renderPanel(p: Panel): void {
    const dim = canvasPx(p.canvas);
    if (!dim) return;
    const { cw, ch } = dim;
    const info = infoForSource(state.source);
    const ctx = info.geom.ctx;
    const pixels = pixelsFor(state.source);
    const a = state.angle;
    const k = Math.tan(a);
    switch (p.role) {
      case 'hero':
        p.renderer.render({
          pixels, ctx, mode: 'escher', W: cw, H: ch,
          scale: cw / ctx.W, lnR0: info.lnR0, kTwist: k
        });
        break;
      case 'unroll':
        p.renderer.render({
          pixels, ctx, mode: 'unroll', W: cw, H: ch,
          pxPerUnit: panelPxPerUnit('rotlog', ctx.logS, ch),
          uRef: info.uRef, lnR0: info.lnR0, rot: a, kTwist: k, morph: state.morph
        });
        break;
      case 'log':
        p.renderer.render({
          pixels, ctx, mode: 'log', W: cw, H: ch,
          pxPerUnit: panelPxPerUnit('log', ctx.logS, ch),
          uRef: info.uRef, panU: state.panU, panV: state.panV
        });
        break;
      case 'orig':
        p.renderer.render({
          pixels, ctx, mode: 'escher', W: cw, H: ch,
          scale: cw / ctx.W, lnR0: info.lnR0, kTwist: 0, panU: state.panU, panV: state.panV
        });
        break;
    }
  }

  // ── Render scheduler (handles discrete updates + running animations) ───────
  let raf = 0;
  let dirtyAll = false;
  const dirty = new Set<Role>();
  let last = performance.now();

  // twist snap-to-β tween
  let snapping = false;
  let snapFrom = 0;
  let snapTo = 0;
  let snapT = 0;
  // unroll ping-pong
  let morphPhase = 0;

  function schedule(only?: Role[]): void {
    if (only) only.forEach((r) => dirty.add(r));
    else dirtyAll = true;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick(now: number): void {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let more = false;

    if (snapping) {
      snapT += dt / 0.45;
      const e = snapT >= 1 ? 1 : easeOutCubic(snapT);
      state.angle = snapFrom + (snapTo - snapFrom) * e;
      syncTwistUI();
      dirty.add('hero');
      dirty.add('unroll');
      if (snapT >= 1) snapping = false;
      else more = true;
    }

    if (state.playing) {
      morphPhase += dt / 2.4; // ~2.4s each way
      const tri = 1 - Math.abs(1 - (morphPhase % 2)); // 0 → 1 → 0 triangle
      state.morph = tri;
      syncUnrollUI();
      dirty.add('unroll');
      more = true;
    }

    const all = dirtyAll;
    dirtyAll = false;
    const set = new Set(dirty);
    dirty.clear();
    for (const p of panels) if (all || set.has(p.role)) renderPanel(p);
    updateReadout();

    if (more) raf = requestAnimationFrame(tick);
  }

  function updateReadout(): void {
    if (!readout) return;
    if (state.panU === 0 && state.panV === 0) {
      readout.textContent = 'drag the log: ↔ zooms the picture, ↕ spins it';
      return;
    }
    const zoom = Math.exp(state.panU);
    let deg = ((state.panV * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;
    readout.textContent = `the picture is now zoomed ×${zoom.toFixed(2)} and turned ${deg.toFixed(0)}°`;
  }

  // ── Twist (Droste ⟷ Escher) ────────────────────────────────────────────────
  const twist = byId<HTMLInputElement>('exp-twist');
  const twistVal = byId<HTMLElement>('exp-twist-val');
  const twistNote = byId<HTMLElement>('exp-twist-note');
  const heroCell = panels.find((p) => p.role === 'hero')?.canvas.closest('.panel-cell') ?? null;

  function syncTwistUI(): void {
    const deg = state.angle / RAD;
    const betaDeg = infoForSource(state.source).betaDeg;
    const closed = Math.abs(deg - betaDeg) < 0.4;
    if (twist && document.activeElement !== twist) twist.value = deg.toFixed(1);
    if (twistVal) {
      twistVal.textContent = `${deg.toFixed(1)}°`;
      twistVal.classList.toggle('closed', closed);
    }
    heroCell?.classList.toggle('is-closed', closed);
    if (twistNote) {
      twistNote.innerHTML = closed
        ? 'closed ✓ — every line meets itself'
        : `closes at <em>β</em> ≈ ${betaDeg.toFixed(1)}°`;
    }
  }

  function setTwistDeg(deg: number): void {
    state.angle = deg * RAD;
    snapping = false;
    syncTwistUI();
    schedule(['hero', 'unroll']);
  }

  if (twist) {
    twist.min = '0';
    twist.max = String(TWIST_MAX_DEG);
    twist.step = '0.1';
    twist.value = boldInfo.betaDeg.toFixed(1);
    twist.addEventListener('input', () => setTwistDeg(parseFloat(twist.value)));
  }

  byId<HTMLButtonElement>('exp-twist-snap')?.addEventListener('click', () => {
    snapFrom = state.angle;
    snapTo = infoForSource(state.source).beta;
    snapT = 0;
    snapping = true;
    schedule(['hero', 'unroll']);
  });

  // ── Unroll ─────────────────────────────────────────────────────────────────
  const unrollRange = byId<HTMLInputElement>('exp-unroll-range');
  const unrollVal = byId<HTMLElement>('exp-unroll-val');
  const unrollPlay = byId<HTMLButtonElement>('exp-unroll-play');

  function syncUnrollUI(): void {
    if (unrollRange && document.activeElement !== unrollRange) {
      unrollRange.value = String(Math.round(state.morph * 100));
    }
    if (unrollVal) {
      unrollVal.textContent =
        state.morph > 0.97 ? 'rolled up' : state.morph < 0.03 ? 'unrolled flat' : 'unrolling…';
    }
    if (unrollPlay) unrollPlay.textContent = state.playing ? '❚❚ pause' : '▶ play';
  }

  if (unrollRange) {
    unrollRange.min = '0';
    unrollRange.max = '100';
    unrollRange.step = '1';
    unrollRange.value = '100';
    unrollRange.addEventListener('input', () => {
      state.playing = false;
      state.morph = parseFloat(unrollRange.value) / 100;
      syncUnrollUI();
      schedule(['unroll']);
    });
  }
  unrollPlay?.addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.playing) {
      morphPhase = state.morph; // continue from where the slider left it
      last = performance.now();
    }
    syncUnrollUI();
    schedule(['unroll']);
  });

  // ── Source mode ────────────────────────────────────────────────────────────
  function setSource(mode: SourceMode): void {
    state.source = mode;
    state.angle = infoForSource(mode).beta; // reset to the closing angle of the new geometry
    snapping = false;
    document.querySelectorAll<HTMLElement>('[data-source]').forEach((b) => {
      b.classList.toggle('on', b.dataset.source === mode);
    });
    syncTwistUI();
    schedule(); // new texture + geometry → re-render every panel
  }
  document.querySelectorAll<HTMLElement>('[data-source]').forEach((b) => {
    b.addEventListener('click', () => setSource((b.dataset.source as SourceMode) ?? 'polar'));
  });

  // ── Drag-to-pan on the log panel ───────────────────────────────────────────
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
      schedule(['log', 'orig']);
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
    schedule(['log', 'orig']);
  });

  // Pause the unroll animation while it's scrolled out of view (saves battery).
  const unrollCanvas = byId<HTMLCanvasElement>('exp-unroll');
  if (unrollCanvas && 'IntersectionObserver' in window) {
    let wasPlaying = false;
    new IntersectionObserver(
      (entries) => {
        const vis = entries[0]?.isIntersecting ?? true;
        if (!vis && state.playing) {
          wasPlaying = true;
          state.playing = false;
          syncUnrollUI();
        } else if (vis && wasPlaying) {
          wasPlaying = false;
          state.playing = true;
          morphPhase = state.morph;
          last = performance.now();
          syncUnrollUI();
          schedule(['unroll']);
        }
      },
      { threshold: 0.15 }
    ).observe(unrollCanvas);
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  document.querySelectorAll<HTMLElement>('[data-source]').forEach((b) => {
    b.classList.toggle('on', b.dataset.source === state.source);
  });
  syncTwistUI();
  syncUnrollUI();
  if (!reduceMotion && unrollPlay) {
    // Greet the reader with the unroll already in motion.
    state.playing = true;
    morphPhase = state.morph;
    syncUnrollUI();
  }
  new ResizeObserver(() => schedule()).observe(root);
  schedule();
}

void main();
