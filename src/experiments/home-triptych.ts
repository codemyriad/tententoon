/**
 * Live engine for the home-page rewrite proposals in `experiments/`.
 *
 * Uses the single generated workshop photograph (`HERO_EXAMPLE` in
 * `src/explain/examples.ts`), whose circular brass bezel unrolls naturally
 * under `log(z − c)` into vertical golden pillars in panel 1, leans at angle β
 * in panel 2, and winds into a seamless golden nautilus spiral in panel 3.
 */

import { fitCropToNest, type Rect } from '../lib/math/droste';
import {
  buildPanelGeometry,
  panelPxPerUnit,
  panelURef,
  renderEscherStill,
  renderLogPanel,
  renderRotatedLogPanel,
  type PanelGeometry,
  type PanelImage
} from '../lib/ui1/pipeline-panels';
import { PipelinePanelGLRenderer } from '../lib/render/pipeline-gl';
import { makeSource, type SourceMode } from '../explain/patterns';
import { HERO_EXAMPLE } from '../explain/examples';
import { initPlayground, setPlaygroundPhoto } from '../explain/playground';

const TWO_PI = 2 * Math.PI;
const MAX_PX = 720;
const BEND_MAX_DEG = 32;
const RAD = Math.PI / 180;

const byId = <T extends Element>(id: string) => document.getElementById(id) as T | null;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img.decode().then(() => img);
}

type Role = 'orig' | 'log' | 'bend' | 'exp';
type IntroRole = 'droste' | 'spiral';

type GLOrCpuTarget<R extends string> = {
  role: R;
  canvas: HTMLCanvasElement;
  cell: HTMLElement | null;
  gl: PipelinePanelGLRenderer | null;
  ctx2d: CanvasRenderingContext2D | null;
};

function createTarget<R extends string>(role: R, canvas: HTMLCanvasElement): GLOrCpuTarget<R> {
  const cell = canvas.closest<HTMLElement>('.panel-cell');
  try {
    const gl = new PipelinePanelGLRenderer();
    gl.init(canvas);
    return { role, canvas, cell, gl, ctx2d: null };
  } catch {
    const ctx2d = canvas.getContext('2d');
    return { role, canvas, cell, gl: null, ctx2d };
  }
}

function blitCpuImage(
  ctx2d: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  img: PanelImage
): void {
  if (canvas.width !== img.width) canvas.width = img.width;
  if (canvas.height !== img.height) canvas.height = img.height;
  const copy = new Uint8ClampedArray(img.data.length);
  copy.set(img.data);
  ctx2d.putImageData(new ImageData(copy, img.width, img.height), 0, 0);
}

async function main(): Promise<void> {
  const root = byId<HTMLElement>('exp-root');
  const fallback = byId<HTMLElement>('exp-fallback');
  const readout = byId<HTMLElement>('exp-readout');
  if (!root) return;

  const spec = HERO_EXAMPLE;
  let photo: HTMLImageElement;
  try {
    photo = await loadImage(spec.src);
  } catch {
    if (fallback) fallback.hidden = false;
    return;
  }

  const W = photo.naturalWidth;
  const H = photo.naturalHeight;
  const rawNest: Rect = {
    x: spec.nest.x * W,
    y: spec.nest.y * H,
    w: spec.nest.w * W,
    h: spec.nest.h * H
  };
  const crop = fitCropToNest({ width: W, height: H }, rawNest, null);
  const localNest: Rect = {
    x: rawNest.x - crop.x,
    y: rawNest.y - crop.y,
    w: rawNest.w,
    h: rawNest.h
  };
  const shapeMorph = spec.shape === 'ellipse' ? 0 : 1;
  const builtGeom = buildPanelGeometry(rawNest, crop, shapeMorph);
  if (!builtGeom) {
    if (fallback) fallback.hidden = false;
    return;
  }
  const geom: PanelGeometry = builtGeom;
  const uRef = panelURef(geom.ctx.rMax);
  const lnR0 = Math.log(Math.max(geom.R0, 1e-9));
  const beta = Math.atan2(geom.ctx.logS, TWO_PI);
  const betaDeg = (beta * 180) / Math.PI;
  const cImgX = crop.x + geom.ctx.cx;
  const cImgY = crop.y + geom.ctx.cy;
  const rPortal = 0.5 * Math.hypot(localNest.w, localNest.h);
  const roundZoom = spec.roundZoom;

  const texCache = new Map<SourceMode, ImageData>();
  function pixelsFor(m: SourceMode): ImageData {
    const hit = texCache.get(m);
    if (hit) return hit;
    const img = makeSource(m, photo, W, H, cImgX, cImgY, geom.S, rPortal);
    texCache.set(m, img);
    return img;
  }

  setPlaygroundPhoto(photo);
  root.style.setProperty('--cell-ar', `${crop.w} / ${crop.h}`);

  // ── Shared state ───────────────────────────────────────────────────────────
  const state = {
    source: 'picture' as SourceMode,
    angle: beta,
    panU: 0,
    panV: 0,
    roll: 1,
    introPhase: 0,
    introTwist: 1,
    introPlaying: false,
    pipePlaying: false
  };

  // ── Opening triptych / twin targets ────────────────────────────────────────
  const introOrigCanvas = byId<HTMLCanvasElement>('intro-orig');
  const introOrigCtx = introOrigCanvas?.getContext('2d') ?? null;
  const introTargets: GLOrCpuTarget<IntroRole>[] = [];
  const introDrosteEl = byId<HTMLCanvasElement>('intro-droste');
  const introSpiralEl = byId<HTMLCanvasElement>('intro-spiral');
  if (introDrosteEl) introTargets.push(createTarget('droste', introDrosteEl));
  if (introSpiralEl) introTargets.push(createTarget('spiral', introSpiralEl));

  // ── 4-panel pipeline targets ───────────────────────────────────────────────
  const idByRole: Record<Role, string> = {
    orig: 'exp-orig',
    log: 'exp-log',
    bend: 'exp-bend',
    exp: 'exp-exp'
  };
  const panels: GLOrCpuTarget<Role>[] = [];
  for (const role of Object.keys(idByRole) as Role[]) {
    const canvas = byId<HTMLCanvasElement>(idByRole[role]);
    if (!canvas) continue;
    panels.push(createTarget(role, canvas));
  }

  function canvasPx(canvas: HTMLCanvasElement, cap = MAX_PX): { cw: number; ch: number } | null {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    let cw = Math.round(r.width * dpr);
    let ch = Math.round(r.height * dpr);
    const long = Math.max(cw, ch);
    if (long > cap) {
      const s = cap / long;
      cw = Math.max(1, Math.round(cw * s));
      ch = Math.max(1, Math.round(ch * s));
    }
    return { cw, ch };
  }

  function renderIntroOrig(): void {
    if (!introOrigCanvas || !introOrigCtx) return;
    const dim = canvasPx(introOrigCanvas, 640);
    if (!dim) return;
    const { cw, ch } = dim;
    if (introOrigCanvas.width !== cw) introOrigCanvas.width = cw;
    if (introOrigCanvas.height !== ch) introOrigCanvas.height = ch;

    introOrigCtx.save();
    introOrigCtx.drawImage(photo, crop.x, crop.y, crop.w, crop.h, 0, 0, cw, ch);

    const sx = cw / crop.w;
    const sy = ch / crop.h;
    const nx = localNest.x * sx;
    const ny = localNest.y * sy;
    const nw = localNest.w * sx;
    const nh = localNest.h * sy;

    introOrigCtx.lineWidth = Math.max(2, Math.round(cw * 0.0065));
    introOrigCtx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    introOrigCtx.setLineDash([7, 5]);
    introOrigCtx.beginPath();
    introOrigCtx.ellipse(nx + nw / 2, ny + nh / 2, nw / 2, nh / 2, 0, 0, TWO_PI);
    introOrigCtx.stroke();

    introOrigCtx.lineDashOffset = 6;
    introOrigCtx.strokeStyle = '#d94f2c';
    introOrigCtx.stroke();
    introOrigCtx.restore();
  }

  function renderIntroTarget(t: GLOrCpuTarget<IntroRole>): void {
    const dim = canvasPx(t.canvas, t.gl ? 640 : 280);
    if (!dim) return;
    const { cw, ch } = dim;
    const ctx = geom.ctx;
    const pixels = pixelsFor('picture');
    const panU = -state.introPhase * ctx.logS;
    const kTwist = t.role === 'spiral' ? (ctx.logS / TWO_PI) * state.introTwist : 0;
    const scale = (cw / ctx.W) * roundZoom;

    if (t.gl) {
      t.gl.render({
        pixels,
        ctx,
        mode: 'escher',
        W: cw,
        H: ch,
        scale,
        lnR0,
        kTwist,
        panU,
        panV: 0
      });
    } else if (t.ctx2d) {
      const img = renderEscherStill(pixels, ctx, geom.R0, scale, cw, ch, {
        kTwist,
        panU,
        panV: 0
      });
      blitCpuImage(t.ctx2d, t.canvas, img);
    }
  }

  function renderPanel(p: GLOrCpuTarget<Role>): void {
    const dim = canvasPx(p.canvas, p.gl ? MAX_PX : 260);
    if (!dim) return;
    const { cw, ch } = dim;
    const ctx = geom.ctx;
    const pixels = pixelsFor(state.source);
    const a = state.angle;
    const scale = (cw / ctx.W) * roundZoom;

    if (p.gl) {
      switch (p.role) {
        case 'orig':
          p.gl.render({
            pixels,
            ctx,
            mode: 'escher',
            W: cw,
            H: ch,
            scale,
            lnR0,
            kTwist: 0,
            panU: state.panU,
            panV: state.panV
          });
          break;
        case 'log':
          p.gl.render({
            pixels,
            ctx,
            mode: 'log',
            W: cw,
            H: ch,
            pxPerUnit: panelPxPerUnit('log', ctx.logS, ch),
            uRef,
            panU: state.panU,
            panV: state.panV
          });
          break;
        case 'bend':
          p.gl.render({
            pixels,
            ctx,
            mode: 'rotlog',
            W: cw,
            H: ch,
            pxPerUnit: panelPxPerUnit('rotlog', ctx.logS, ch),
            uRef,
            rot: a,
            panU: state.panU,
            panV: state.panV
          });
          break;
        case 'exp':
          p.gl.render({
            pixels,
            ctx,
            mode: 'unroll',
            W: cw,
            H: ch,
            pxPerUnit: panelPxPerUnit('rotlog', ctx.logS, ch),
            uRef,
            lnR0: Math.log(Math.max(geom.R0 / roundZoom, 1e-9)),
            rot: a,
            kTwist: Math.tan(a),
            morph: state.roll,
            panU: state.panU,
            panV: state.panV
          });
          break;
      }
      return;
    }

    if (!p.ctx2d) return;
    switch (p.role) {
      case 'orig':
        blitCpuImage(
          p.ctx2d,
          p.canvas,
          renderEscherStill(pixels, ctx, geom.R0, scale, cw, ch, {
            kTwist: 0,
            panU: state.panU,
            panV: state.panV
          })
        );
        break;
      case 'log':
        blitCpuImage(
          p.ctx2d,
          p.canvas,
          renderLogPanel(pixels, ctx, panelPxPerUnit('log', ctx.logS, ch), uRef, cw, ch, {
            panU: state.panU,
            panV: state.panV
          })
        );
        break;
      case 'bend':
        blitCpuImage(
          p.ctx2d,
          p.canvas,
          renderRotatedLogPanel(pixels, ctx, panelPxPerUnit('rotlog', ctx.logS, ch), uRef, cw, ch, {
            rot: a,
            panU: state.panU,
            panV: state.panV
          })
        );
        break;
      case 'exp':
        blitCpuImage(
          p.ctx2d,
          p.canvas,
          renderEscherStill(pixels, ctx, geom.R0, scale, cw, ch, {
            kTwist: Math.tan(a),
            panU: state.panU,
            panV: state.panV
          })
        );
        break;
    }
  }

  // ── Render scheduler ───────────────────────────────────────────────────────
  let raf = 0;
  let dirtyAll = false;
  let dirtyIntro = false;
  const dirty = new Set<Role>();
  let last = performance.now();

  let snapping = false;
  let snapFrom = 0;
  let snapTo = 0;
  let snapT = 0;

  const introZoomInput = byId<HTMLInputElement>('intro-zoom');
  const introZoomVal = byId<HTMLElement>('intro-zoom-val');
  const introTwistInput = byId<HTMLInputElement>('intro-twist');
  const introTwistVal = byId<HTMLElement>('intro-twist-val');
  const introPlayBtn = byId<HTMLButtonElement>('intro-play');
  const pipePlayBtn = byId<HTMLButtonElement>('exp-play');

  function syncIntroUI(): void {
    const pct = Math.round(state.introPhase * 100);
    if (introZoomInput && document.activeElement !== introZoomInput) {
      introZoomInput.value = String(pct);
    }
    if (introZoomVal) {
      const mult = Math.pow(geom.S, state.introPhase);
      introZoomVal.textContent = `${mult.toFixed(1)}×`;
    }
    if (introTwistInput && document.activeElement !== introTwistInput) {
      introTwistInput.value = String(Math.round(state.introTwist * 100));
    }
    if (introTwistVal) {
      const deg = state.introTwist * betaDeg;
      introTwistVal.textContent =
        state.introTwist > 0.98
          ? `${deg.toFixed(1)}° (closed ✓)`
          : state.introTwist < 0.02
          ? `0.0° (Droste)`
          : `${deg.toFixed(1)}°`;
    }
    if (introPlayBtn) {
      introPlayBtn.textContent = state.introPlaying ? '⏸ Pause zoom' : '▶ Play zoom';
      introPlayBtn.classList.toggle('on', state.introPlaying);
    }
  }

  function syncPipePlayUI(): void {
    if (pipePlayBtn) {
      pipePlayBtn.textContent = state.pipePlaying ? '⏸ Pause' : '▶ Play zoom';
      pipePlayBtn.classList.toggle('on', state.pipePlaying);
    }
  }

  function schedule(only?: Role[], intro = false): void {
    if (intro) dirtyIntro = true;
    if (only) only.forEach((r) => dirty.add(r));
    else if (!intro) {
      dirtyAll = true;
      dirtyIntro = true;
    }
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
      syncBendUI();
      dirty.add('bend');
      dirty.add('exp');
      if (snapT >= 1) snapping = false;
      else more = true;
    }

    if (state.introPlaying) {
      state.introPhase = (state.introPhase + dt * 0.22) % 1;
      syncIntroUI();
      dirtyIntro = true;
      more = true;
    }

    if (state.pipePlaying) {
      const logS = geom.ctx.logS;
      state.panU -= dt * 0.22 * logS;
      if (state.panU < -logS) state.panU += logS;
      dirty.add('orig');
      dirty.add('log');
      dirty.add('bend');
      dirty.add('exp');
      more = true;
    }

    const all = dirtyAll;
    const intro = dirtyIntro;
    dirtyAll = false;
    dirtyIntro = false;
    const set = new Set(dirty);
    dirty.clear();

    if (all || intro) {
      if (all) renderIntroOrig();
      for (const t of introTargets) renderIntroTarget(t);
    }
    for (const p of panels) if (all || set.has(p.role)) renderPanel(p);
    updateReadout();

    if (more) raf = requestAnimationFrame(tick);
  }

  function updateReadout(): void {
    if (!readout) return;
    if (Math.abs(state.panU) < 1e-3 && Math.abs(state.panV) < 1e-3) {
      readout.textContent = 'Drag panel 1 (flat strip): ↔ zooms the round views, ↕ rotates them';
      return;
    }
    const zoom = Math.exp(-state.panU);
    let deg = ((state.panV * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;
    readout.textContent = `strip offset ${state.panU >= 0 ? '+' : ''}${state.panU.toFixed(2)} → zoom ×${zoom.toFixed(2)}, turn ${deg.toFixed(0)}°`;
  }

  // ── Opening triptych controls ──────────────────────────────────────────────
  if (introZoomInput) {
    introZoomInput.addEventListener('input', () => {
      state.introPlaying = false;
      state.introPhase = parseFloat(introZoomInput.value) / 100;
      syncIntroUI();
      schedule([], true);
    });
  }
  if (introTwistInput) {
    introTwistInput.addEventListener('input', () => {
      state.introTwist = parseFloat(introTwistInput.value) / 100;
      syncIntroUI();
      schedule([], true);
    });
  }
  introPlayBtn?.addEventListener('click', () => {
    state.introPlaying = !state.introPlaying;
    last = performance.now();
    syncIntroUI();
    schedule([], true);
  });

  // ── Bend controls ──────────────────────────────────────────────────────────
  const bend = byId<HTMLInputElement>('exp-bend-range');
  const bendVal = byId<HTMLElement>('exp-bend-val');
  const bendNote = byId<HTMLElement>('exp-bend-note');
  const bendCells = panels.filter((p) => p.role === 'bend' || p.role === 'exp').map((p) => p.cell);
  const mS = byId<HTMLElement>('m-s');
  const mLogS = byId<HTMLElement>('m-logs');
  const mK = byId<HTMLElement>('m-k');

  function syncBendUI(): void {
    const deg = state.angle / RAD;
    const closed = Math.abs(deg - betaDeg) < 0.4;
    if (bend && document.activeElement !== bend) bend.value = deg.toFixed(1);
    if (bendVal) {
      bendVal.textContent = `${deg.toFixed(1)}°`;
      bendVal.classList.toggle('closed', closed);
    }
    bendCells.forEach((c) => c?.classList.toggle('is-closed', closed));
    if (bendNote) {
      bendNote.innerHTML = closed
        ? `closed ✓ — ornate wreath locks at <em>β</em> ≈ ${betaDeg.toFixed(1)}°`
        : `seam open · snap to <em>β</em> ≈ ${betaDeg.toFixed(1)}°`;
      bendNote.classList.toggle('closed-now', closed);
    }
    if (mS) mS.textContent = `${geom.S.toFixed(2)}×`;
    if (mLogS) mLogS.textContent = geom.ctx.logS.toFixed(2);
    if (mK) mK.textContent = Math.tan(state.angle).toFixed(2);
  }

  function setBendDeg(deg: number): void {
    state.angle = deg * RAD;
    snapping = false;
    syncBendUI();
    schedule(['bend', 'exp']);
  }

  if (bend) {
    bend.min = '0';
    bend.max = String(BEND_MAX_DEG);
    bend.step = '0.1';
    bend.value = betaDeg.toFixed(1);
    bend.addEventListener('input', () => setBendDeg(parseFloat(bend.value)));
  }
  byId<HTMLButtonElement>('exp-bend-snap')?.addEventListener('click', () => {
    snapFrom = state.angle;
    snapTo = beta;
    snapT = 0;
    snapping = true;
    last = performance.now();
    schedule(['bend', 'exp']);
  });

  // ── Roll control (flat ↔ spiral) ───────────────────────────────────────────
  const roll = byId<HTMLInputElement>('exp-roll');
  function syncRollUI(): void {
    if (roll && document.activeElement !== roll) roll.value = String(Math.round(state.roll * 100));
  }
  if (roll) {
    roll.min = '0';
    roll.max = '100';
    roll.step = '1';
    roll.value = '100';
    roll.addEventListener('input', () => {
      state.roll = parseFloat(roll.value) / 100;
      syncRollUI();
      schedule(['exp']);
    });
  }

  // ── Source mode switcher (picture / overlay / polar / grid) ────────────────
  function setSource(mode: SourceMode): void {
    state.source = mode;
    document.querySelectorAll<HTMLElement>('[data-source]').forEach((b) => {
      b.classList.toggle('on', b.dataset.source === mode);
    });
    syncBendUI();
    schedule(['orig', 'log', 'bend', 'exp']);
  }
  document.querySelectorAll<HTMLElement>('[data-source]').forEach((b) => {
    b.addEventListener('click', () => setSource((b.dataset.source as SourceMode) ?? 'picture'));
  });

  // ── Drag the flat strip → pan every panel ──────────────────────────────────
  const logCanvas = byId<HTMLCanvasElement>('exp-log');
  if (logCanvas) {
    let active = false;
    let lastX = 0;
    let lastY = 0;
    logCanvas.addEventListener('pointerdown', (e) => {
      active = true;
      state.pipePlaying = false;
      syncPipePlayUI();
      lastX = e.clientX;
      lastY = e.clientY;
      try {
        logCanvas.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable */
      }
      e.preventDefault();
    });
    logCanvas.addEventListener('pointermove', (e) => {
      if (!active) return;
      const h = logCanvas.getBoundingClientRect().height || 1;
      const perUnit = h / TWO_PI;
      state.panU -= (e.clientX - lastX) / perUnit;
      state.panV -= (e.clientY - lastY) / perUnit;
      lastX = e.clientX;
      lastY = e.clientY;
      schedule(['orig', 'log', 'bend', 'exp']);
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

  pipePlayBtn?.addEventListener('click', () => {
    state.pipePlaying = !state.pipePlaying;
    last = performance.now();
    syncPipePlayUI();
    schedule(['orig', 'log', 'bend', 'exp']);
  });

  byId<HTMLButtonElement>('exp-reset')?.addEventListener('click', () => {
    state.pipePlaying = false;
    state.panU = 0;
    state.panV = 0;
    state.angle = beta;
    state.roll = 1;
    syncPipePlayUI();
    syncBendUI();
    syncRollUI();
    schedule(['orig', 'log', 'bend', 'exp']);
  });

  // ── Boot ───────────────────────────────────────────────────────────────────
  document.querySelectorAll<HTMLElement>('[data-source]').forEach((b) => {
    b.classList.toggle('on', b.dataset.source === state.source);
  });
  syncBendUI();
  syncRollUI();
  syncIntroUI();
  syncPipePlayUI();
  new ResizeObserver(() => schedule()).observe(root);
  schedule();
}

void main();
initPlayground();
