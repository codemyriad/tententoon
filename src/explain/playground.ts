/**
 * Function playground for the explainer page (index.html) — a self-contained
 * complex-function explorer that runs before the tententoon pipeline.
 *
 * The reader drags a point on the left (the input plane) and watches where it
 * lands on the right (the output plane), with a grid, concentric rings, or the
 * active contest photo riding along so the whole warp is visible.
 *
 * Clicking a function smoothly animates the interpolation slider from z (t=0)
 * to f(z) (t=1) so you see the plane move into place rather than jump.
 */

import { HERO_EXAMPLE } from './examples';

type C = { re: number; im: number };

type FnKey = 'id' | 'double' | 'rot' | 'square' | 'exp' | 'log';
type Fn = {
  key: FnKey;
  label: string;
  note: string;
  map: (z: C) => C;
  fixedOut?: number;
};

// Input half-extent: the plane shown is [−D, D]² with D = π so the vertical
// span is 2π — exp(z) wraps a 2π-tall strip all the way around the origin.
const D = Math.PI;

const FNS: Fn[] = [
  {
    key: 'id',
    label: 'f(z) = z',
    note: 'Identity — every point stays right where it started.',
    map: (z) => ({ re: z.re, im: z.im }),
    fixedOut: D
  },
  {
    key: 'double',
    label: 'f(z) = 2z',
    note: 'Pure scale — multiplying by 2 doubles every distance from the center.',
    map: (z) => ({ re: 2 * z.re, im: 2 * z.im }),
    fixedOut: D
  },
  {
    key: 'rot',
    label: 'f(z) = iz',
    note: 'Pure rotation — multiplying by i turns the entire plane 90° counterclockwise.',
    map: (z) => ({ re: -z.im, im: z.re }),
    fixedOut: D
  },
  {
    key: 'square',
    label: 'f(z) = z²',
    note: 'Curved warp — the grid bends globally, yet the tiny orange square stays square.',
    map: (z) => ({ re: z.re * z.re - z.im * z.im, im: 2 * z.re * z.im })
  },
  {
    key: 'exp',
    label: 'f(z) = exp(z)',
    note: 'Roll up — vertical lines become concentric circles; horizontal lines become spokes.',
    map: (z) => {
      const e = Math.exp(z.re);
      return { re: e * Math.cos(z.im), im: e * Math.sin(z.im) };
    }
  },
  {
    key: 'log',
    label: 'f(z) = log(z)',
    note: 'Unroll — cuts concentric circles open and lays them flat as vertical lines.',
    map: (z) => ({ re: 0.5 * Math.log(z.re * z.re + z.im * z.im), im: Math.atan2(z.im, z.re) })
  }
];

const DEFAULT_PHOTO = HERO_EXAMPLE.src;
const GRID_STEP = Math.PI / 8;
const NEIGH = 0.17;
const LINE_SAMPLES = 100;
const MESH = 22;

const ACCENT = '#d94f2c';
const RED = '#d1495b';
const BLUE = '#2e86ab';

const byId = <T extends Element>(id: string) => document.getElementById(id) as T | null;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

let externalPhotoSetter: ((img: HTMLImageElement) => void) | null = null;

export function setPlaygroundPhoto(img: HTMLImageElement): void {
  externalPhotoSetter?.(img);
}

export function initPlayground(): void {
  const root = byId<HTMLElement>('pg-root');
  if (!root) return;
  const inEl = byId<HTMLCanvasElement>('pg-in');
  const outEl = byId<HTMLCanvasElement>('pg-out');
  const ictx0 = inEl?.getContext('2d') ?? null;
  const octx0 = outEl?.getContext('2d') ?? null;
  if (!inEl || !outEl || !ictx0 || !octx0) return;
  const inCanvas = inEl;
  const outCanvas = outEl;
  const ictx = ictx0;
  const octx = octx0;

  const state = {
    fn: FNS[0],
    t: 1,
    z: { re: 1.1, im: 0.6 } as C,
    grid: true,
    rings: false,
    image: false
  };

  let photoSq: { canvas: HTMLCanvasElement; size: number } | null = null;

  function applyPhotoElement(img: HTMLImageElement): void {
    const size = Math.min(img.naturalWidth, img.naturalHeight);
    if (size <= 0) return;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const cx = c.getContext('2d');
    if (cx) {
      cx.drawImage(
        img,
        (img.naturalWidth - size) / 2,
        (img.naturalHeight - size) / 2,
        size,
        size,
        0,
        0,
        size,
        size
      );
      photoSq = { canvas: c, size };
    }
    if (state.image) draw();
  }

  externalPhotoSetter = applyPhotoElement;

  const defaultImg = new Image();
  defaultImg.decoding = 'async';
  defaultImg.src = DEFAULT_PHOTO;
  defaultImg
    .decode()
    .then(() => {
      if (!photoSq) applyPhotoElement(defaultImg);
    })
    .catch(() => {
      /* fallback handled when main.ts pushes its loaded image */
    });

  function ft(z: C): C {
    const f = state.fn.map(z);
    const t = state.t;
    return { re: lerp(z.re, f.re, t), im: lerp(z.im, f.im, t) };
  }

  let outE = D;
  function computeOutExtent(): void {
    if (state.fn.fixedOut !== undefined) {
      outE = state.fn.fixedOut;
      return;
    }
    let m = D * 0.5;
    const N = 24;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const re = lerp(-D, D, i / N);
        const im = lerp(-D, D, j / N);
        const r2 = re * re + im * im;
        if (state.fn.key === 'log' && r2 < 0.04) continue;
        const w = state.fn.map({ re, im });
        m = Math.max(m, Math.abs(w.re), Math.abs(w.im));
      }
    }
    outE = clamp(m * 1.08, 1.6, 8);
  }
  computeOutExtent();

  let cw = 0;
  let ch = 0;
  function resize(): void {
    const rect = inCanvas.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.max(1, Math.round(rect.width * dpr));
    cw = px;
    ch = px;
    for (const cv of [inCanvas, outCanvas]) {
      cv.width = px;
      cv.height = px;
    }
  }

  const toIn = (z: C) => ({ x: cw / 2 + (z.re / D) * (cw / 2), y: ch / 2 - (z.im / D) * (ch / 2) });
  const toOut = (z: C) => ({ x: cw / 2 + (z.re / outE) * (cw / 2), y: ch / 2 - (z.im / outE) * (ch / 2) });
  const fromIn = (x: number, y: number): C => ({
    re: ((x - cw / 2) / (cw / 2)) * D,
    im: -((y - ch / 2) / (ch / 2)) * D
  });

  function clearPlane(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e0c09';
    ctx.fillRect(0, 0, cw, ch);
  }

  function strokeMappedPath(
    ctx: CanvasRenderingContext2D,
    pts: C[],
    map: (z: C) => { x: number; y: number },
    apply: boolean
  ): void {
    const jump = cw * 0.5;
    let started = false;
    let px = 0;
    let py = 0;
    ctx.beginPath();
    for (const z of pts) {
      const w = apply ? ft(z) : z;
      const p = map(w);
      if (started && (Math.abs(p.x - px) > jump || Math.abs(p.y - py) > jump)) {
        started = false;
      }
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
      px = p.x;
      py = p.y;
    }
    ctx.stroke();
  }

  function lineSamples(a: C, b: C): C[] {
    const out: C[] = [];
    for (let i = 0; i <= LINE_SAMPLES; i++) {
      const u = i / LINE_SAMPLES;
      out.push({ re: lerp(a.re, b.re, u), im: lerp(a.im, b.im, u) });
    }
    return out;
  }

  function ringSamples(r: number): C[] {
    const out: C[] = [];
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI;
      out.push({ re: r * Math.cos(a), im: r * Math.sin(a) });
    }
    return out;
  }

  function drawGrid(ctx: CanvasRenderingContext2D, map: (z: C) => { x: number; y: number }, apply: boolean): void {
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = 'rgba(220,228,232,0.22)';
    for (let g = -D; g <= D + 1e-6; g += GRID_STEP) {
      if (Math.abs(g) < 1e-6) continue;
      strokeMappedPath(ctx, lineSamples({ re: g, im: -D }, { re: g, im: D }), map, apply);
      strokeMappedPath(ctx, lineSamples({ re: -D, im: g }, { re: D, im: g }), map, apply);
    }
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = RED;
    strokeMappedPath(ctx, lineSamples({ re: -D, im: 0 }, { re: D, im: 0 }), map, apply);
    ctx.strokeStyle = BLUE;
    strokeMappedPath(ctx, lineSamples({ re: 0, im: -D }, { re: 0, im: D }), map, apply);
  }

  function drawRings(ctx: CanvasRenderingContext2D, map: (z: C) => { x: number; y: number }, apply: boolean): void {
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = 'rgba(220,228,232,0.20)';
    for (let s = 0; s < 12; s++) {
      const a = (s * Math.PI) / 6;
      const dir = { re: Math.cos(a), im: Math.sin(a) };
      if (s === 0) continue;
      strokeMappedPath(ctx, lineSamples({ re: 0, im: 0 }, { re: dir.re * D, im: dir.im * D }), map, apply);
    }
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = RED;
    strokeMappedPath(ctx, lineSamples({ re: 0.02, im: 0 }, { re: D, im: 0 }), map, apply);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(120,190,230,0.55)';
    for (let r = GRID_STEP; r <= D + 1e-6; r += GRID_STEP) {
      strokeMappedPath(ctx, ringSamples(r), map, apply);
    }
  }

  function texTri(
    ctx: CanvasRenderingContext2D,
    src: { canvas: HTMLCanvasElement; size: number },
    s: { x: number; y: number }[],
    d: { x: number; y: number }[]
  ): void {
    const [s0, s1, s2] = s;
    const [d0, d1, d2] = d;
    const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
    if (Math.abs(den) < 1e-6) return;
    const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
    const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
    const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
    const d_ = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
    const e = d0.x - a * s0.x - c * s0.y;
    const f = d0.y - b * s0.x - d_ * s0.y;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(a, b, c, d_, e, f);
    ctx.drawImage(src.canvas, 0, 0);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawPhoto(ctx: CanvasRenderingContext2D, map: (z: C) => { x: number; y: number }, apply: boolean): void {
    if (!photoSq) return;
    const sz = photoSq.size;
    const toSrc = (re: number, im: number) => ({
      x: ((re + D) / (2 * D)) * sz,
      y: ((D - im) / (2 * D)) * sz
    });
    for (let i = 0; i < MESH; i++) {
      for (let j = 0; j < MESH; j++) {
        const re0 = lerp(-D, D, i / MESH);
        const re1 = lerp(-D, D, (i + 1) / MESH);
        const im0 = lerp(-D, D, j / MESH);
        const im1 = lerp(-D, D, (j + 1) / MESH);
        const corners: C[] = [
          { re: re0, im: im0 },
          { re: re1, im: im0 },
          { re: re1, im: im1 },
          { re: re0, im: im1 }
        ];
        const sc = corners.map((p) => toSrc(p.re, p.im));
        const dc = corners.map((p) => map(apply ? ft(p) : p));
        texTri(ctx, photoSq, [sc[0], sc[1], sc[2]], [dc[0], dc[1], dc[2]]);
        texTri(ctx, photoSq, [sc[0], sc[2], sc[3]], [dc[0], dc[2], dc[3]]);
      }
    }
  }

  function dot(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, color: string, r: number): void {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
  }

  function neighbourSquare(z: C): C[] {
    return [
      { re: z.re - NEIGH, im: z.im - NEIGH },
      { re: z.re + NEIGH, im: z.im - NEIGH },
      { re: z.re + NEIGH, im: z.im + NEIGH },
      { re: z.re - NEIGH, im: z.im + NEIGH }
    ];
  }

  function drawSquare(ctx: CanvasRenderingContext2D, corners: C[], map: (z: C) => { x: number; y: number }, apply: boolean): void {
    const pts: C[] = [];
    for (let e = 0; e < 4; e++) {
      const a = corners[e];
      const b = corners[(e + 1) % 4];
      for (let i = 0; i < 18; i++) pts.push({ re: lerp(a.re, b.re, i / 18), im: lerp(a.im, b.im, i / 18) });
    }
    pts.push(corners[0]);
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ACCENT;
    ctx.fillStyle = 'rgba(217,79,44,0.18)';
    ctx.beginPath();
    let started = false;
    const jump = cw * 0.5;
    let px = 0;
    let py = 0;
    for (const z of pts) {
      const w = apply ? ft(z) : z;
      const p = map(w);
      if (started && (Math.abs(p.x - px) > jump || Math.abs(p.y - py) > jump)) started = false;
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
      px = p.x;
      py = p.y;
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawAxesFrame(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(cw / 2, 0);
    ctx.lineTo(cw / 2, ch);
    ctx.moveTo(0, ch / 2);
    ctx.lineTo(cw, ch / 2);
    ctx.stroke();
  }

  function drawSide(ctx: CanvasRenderingContext2D, map: (z: C) => { x: number; y: number }, apply: boolean): void {
    clearPlane(ctx);
    if (state.image) drawPhoto(ctx, map, apply);
    drawAxesFrame(ctx);
    if (state.grid) drawGrid(ctx, map, apply);
    if (state.rings) drawRings(ctx, map, apply);
    drawSquare(ctx, neighbourSquare(state.z), map, apply);
    dot(ctx, map(apply ? ft(state.z) : state.z), ACCENT, 6.5);
  }

  function draw(): void {
    if (cw === 0) {
      resize();
      if (cw === 0) return;
    }
    drawSide(ictx, toIn, false);
    drawSide(octx, toOut, true);
    updateReadout();
  }

  const zOut = byId<HTMLElement>('pg-z');
  const fzOut = byId<HTMLElement>('pg-fz');
  const noteEl = byId<HTMLElement>('pg-note');
  const tSlider = byId<HTMLInputElement>('pg-t');

  const fmt = (z: C) => {
    const r = z.re.toFixed(2);
    const i = Math.abs(z.im).toFixed(2);
    return `${r} ${z.im < 0 ? '−' : '+'} ${i}i`;
  };
  function updateReadout(): void {
    if (zOut) zOut.textContent = fmt(state.z);
    if (fzOut) fzOut.textContent = fmt(ft(state.z));
    if (noteEl) noteEl.textContent = state.fn.note;
  }

  // Smooth morph animation when selecting a function button.
  let animRaf = 0;
  let animStart = 0;
  function stopAnim(): void {
    if (animRaf) {
      cancelAnimationFrame(animRaf);
      animRaf = 0;
    }
  }
  function animateT(): void {
    stopAnim();
    if (state.fn.key === 'id') {
      state.t = 1;
      if (tSlider) tSlider.value = '100';
      draw();
      return;
    }
    state.t = 0;
    if (tSlider) tSlider.value = '0';
    animStart = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - animStart) / 520);
      state.t = easeInOutCubic(u);
      if (tSlider) tSlider.value = String(Math.round(state.t * 100));
      draw();
      if (u < 1) {
        animRaf = requestAnimationFrame(step);
      } else {
        animRaf = 0;
      }
    };
    animRaf = requestAnimationFrame(step);
  }

  function selectFn(key: FnKey, animate = true): void {
    const f = FNS.find((x) => x.key === key);
    if (!f) return;
    state.fn = f;
    computeOutExtent();
    document.querySelectorAll<HTMLElement>('.pg-fn').forEach((b) => b.classList.toggle('on', b.dataset.fn === key));
    if (key === 'log' && !state.rings) {
      setLayer('rings', true);
    }
    if (animate) animateT();
    else draw();
  }
  document.querySelectorAll<HTMLElement>('.pg-fn').forEach((b) => {
    b.addEventListener('click', () => selectFn((b.dataset.fn as FnKey) ?? 'id', true));
  });

  function setLayer(name: 'grid' | 'rings' | 'image', on: boolean): void {
    state[name] = on;
    document.querySelectorAll<HTMLElement>(`[data-layer="${name}"]`).forEach((b) => b.classList.toggle('on', on));
    draw();
  }
  document.querySelectorAll<HTMLElement>('[data-layer]').forEach((b) => {
    b.addEventListener('click', () => {
      const name = b.dataset.layer as 'grid' | 'rings' | 'image';
      if (name === 'image' && !photoSq) return;
      setLayer(name, !state[name]);
    });
  });

  if (tSlider) {
    tSlider.min = '0';
    tSlider.max = '100';
    tSlider.step = '1';
    tSlider.value = '100';
    tSlider.addEventListener('input', () => {
      stopAnim();
      state.t = parseFloat(tSlider.value) / 100;
      draw();
    });
  }

  byId<HTMLButtonElement>('pg-reset')?.addEventListener('click', () => {
    stopAnim();
    state.z = { re: 1.1, im: 0.6 };
    state.t = 1;
    if (tSlider) tSlider.value = '100';
    draw();
  });

  let dragging = false;
  function pointerToZ(e: PointerEvent): C {
    const rect = inCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (e.clientX - rect.left) * dpr;
    const y = (e.clientY - rect.top) * dpr;
    const z = fromIn(x, y);
    return { re: clamp(z.re, -D, D), im: clamp(z.im, -D, D) };
  }
  inCanvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    state.z = pointerToZ(e);
    try {
      inCanvas.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    e.preventDefault();
    draw();
  });
  inCanvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    state.z = pointerToZ(e);
    draw();
  });
  const end = (e: PointerEvent) => {
    dragging = false;
    try {
      inCanvas.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };
  inCanvas.addEventListener('pointerup', end);
  inCanvas.addEventListener('pointercancel', end);

  document.querySelectorAll<HTMLElement>('.pg-fn').forEach((b) => b.classList.toggle('on', b.dataset.fn === state.fn.key));
  new ResizeObserver(() => {
    resize();
    draw();
  }).observe(root);
  requestAnimationFrame(() => {
    setLayer('grid', state.grid);
    resize();
    draw();
  });
}
