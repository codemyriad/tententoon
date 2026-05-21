<script lang="ts">
  /**
   * Regular Droste preview for /ui1.
   *
   * The "classic" Droste effect: the source image painted with a scaled
   * copy of itself inside the user-drawn rectangle, with another inside
   * that one, etc. — and a smooth, seamless camera zoom toward the
   * per-axis fixed point of that self-similar map.
   *
   * Separate from PreviewStage (the log-polar spiral). When the user is
   * on this view, the export pipeline picks up THIS stage's renderFrame
   * binding instead of the spiral's, so PNG / MP4 / share all reflect
   * what's on screen.
   *
   * Why 2D canvas instead of WebGL:
   *
   *  - Each frame is a handful of ctx.drawImage calls (one per visible
   *    nesting level — typically 10–20). The browser's 2D pipeline is
   *    well under a millisecond for this on any device the spiral
   *    renderer is also expected to work on.
   *  - No shader to compile, no texture upload to cache, no WebGL
   *    context-loss bookkeeping. Adding the GPU path here would buy us
   *    nothing visible and bloat the bundle.
   *
   * Math (per axis; we keep x/y independent to handle non-square rects):
   *
   *   sx = R.w / W                          # scale ratio of the rect
   *   fixed point cx = R.x / (1 - sx)       # solves x = R.x + sx * x
   *   at time t, effective t' is t (zoom-in) or 1 - t (zoom-out)
   *   camera scale     s = sx^t'
   *   camera centre    Cx = (1 - s)/(1 - sx) * R.x + s * (W/2)
   *                       (interpolates from image-centre at t'=0 to
   *                        rect-centre at t'=1 along the orbit of the
   *                        Droste similarity, so the loop is seamless)
   *   camera viewport  W * s wide, H * s' tall (s' = sy^t')
   *
   * Level n's image-shaped quad in image coords:
   *
   *   x_n = R.x * (1 - sx^n) / (1 - sx)
   *   w_n = W * sx^n
   *
   * We paint levels 0..N from outermost to innermost (later levels
   * naturally overpaint the previous ones inside R). N is picked per
   * frame so that the deepest painted level is still ≥ ~0.5 target px
   * — anything smaller would alias.
   */

  import { doc, playback } from '../../lib/ui1/state.svelte';

  type Props = {
    bindRenderFrame?: (fn: (off: HTMLCanvasElement, t: number) => Promise<void>) => void;
  };
  let { bindRenderFrame }: Props = $props();

  let viewport: HTMLDivElement | null = $state(null);
  let canvas: HTMLCanvasElement | null = $state(null);
  let viewW = $state(0);
  let viewH = $state(0);

  const hasRect = $derived(doc.rect.w > 0 && doc.rect.h > 0);

  // sx, sy guard: a degenerate rect (full image or larger) gives sx≥1
  // and the fixed-point formula blows up. We refuse to render in that
  // case — the user sees the "draw a rectangle" hint until they pick a
  // proper one.
  const params = $derived.by(() => {
    if (!doc.image || !hasRect) return null;
    const W = doc.image.width;
    const H = doc.image.height;
    const sx = doc.rect.w / W;
    const sy = doc.rect.h / H;
    if (!(sx > 0 && sx < 1 && sy > 0 && sy < 1)) return null;
    return { W, H, sx, sy, Rx: doc.rect.x, Ry: doc.rect.y };
  });

  const fit = $derived.by(() => {
    if (!doc.image || viewW <= 0 || viewH <= 0) return null;
    const iw = doc.image.width;
    const ih = doc.image.height;
    const ia = iw / ih;
    const va = viewW / viewH;
    let w: number, h: number;
    if (va > ia) { h = viewH; w = h * ia; } else { w = viewW; h = w / ia; }
    return {
      w,
      h,
      offX: (viewW - w) / 2,
      offY: (viewH - h) / 2
    };
  });

  $effect(() => {
    if (!viewport) return;
    const update = () => {
      const r = viewport!.getBoundingClientRect();
      viewW = r.width;
      viewH = r.height;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(viewport);
    return () => ro.disconnect();
  });

  // Live preview render. Sized to the letterboxed fit at devicePixelRatio
  // so the canvas's intrinsic pixels match what's on screen.
  $effect(() => {
    if (!canvas || !params || !fit || !doc.image) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(fit.w * dpr));
    const h = Math.max(1, Math.round(fit.h * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    void playback.t;
    drawFrame(canvas, playback.t);
  });

  /**
   * Paint one frame of the Droste zoom onto `target` at progress t ∈ [0,1).
   * Honours playback.direction. Used both by the live preview ($effect
   * above) and by the export pipeline (exposed via bindRenderFrame).
   */
  function drawFrame(target: HTMLCanvasElement, t: number): void {
    if (!params || !doc.image) return;
    const { W, H, sx, sy, Rx, Ry } = params;
    const effT = playback.direction === 'in' ? t : 1 - t;
    const scaleX = Math.pow(sx, effT);
    const scaleY = Math.pow(sy, effT);
    const camCx = ((1 - scaleX) / (1 - sx)) * Rx + scaleX * (W / 2);
    const camCy = ((1 - scaleY) / (1 - sy)) * Ry + scaleY * (H / 2);
    const camW = W * scaleX;
    const camH = H * scaleY;
    const camX = camCx - camW / 2;
    const camY = camCy - camH / 2;

    const tw = target.width;
    const th = target.height;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Edge fill: when the rect isn't aspect-matched to the image the
    // camera viewport at t close to 1 may extend past the painted
    // levels along the off-axis. A flat dark fill reads cleaner than
    // whatever stale pixels happen to be in the buffer.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, tw, th);

    // image-coords → target-coords affine transform.
    const ax = tw / camW;
    const ay = th / camH;
    ctx.setTransform(ax, 0, 0, ay, -camX * ax, -camY * ay);

    // Stop painting when the next level would be sub-pixel on the
    // target canvas. Level n's painted width on target is
    //   W * sx^n * ax = tw * sx^(n - effT)
    // We want that ≥ ~0.5 px:
    //   n ≤ effT + log(0.5/tw)/log(sx)
    // With sx<1 the log is negative, so dividing flips the inequality.
    const minWidthPx = 0.5;
    const nMaxFromSx = Math.floor(effT + Math.log(minWidthPx / tw) / Math.log(sx));
    const nMaxFromSy = Math.floor(effT + Math.log(minWidthPx / th) / Math.log(sy));
    // Pick the looser of the two (we want to keep painting until BOTH
    // dimensions are sub-pixel), then cap at a sane absolute limit.
    const nMax = Math.min(Math.max(nMaxFromSx, nMaxFromSy) + 1, 60);

    // Power-table to avoid Math.pow per iteration.
    let pxw = 1; // sx^n
    let pyw = 1; // sy^n
    // Accumulated geometric sums for the position formulas:
    //   x_n = Rx * (1 - sx^n) / (1 - sx) = Rx * sum_{k=0..n-1} sx^k
    let xn = 0;
    let yn = 0;
    for (let n = 0; n <= nMax; n++) {
      const rw = W * pxw;
      const rh = H * pyw;
      // Skip levels that fall entirely outside the camera viewport.
      // (Common when the rect is well off-centre and very deep levels
      // sit far from the camera centre.)
      if (xn + rw >= camX && xn <= camX + camW && yn + rh >= camY && yn <= camY + camH) {
        ctx.drawImage(doc.image, xn, yn, rw, rh);
      }
      xn += Rx * pxw;
      yn += Ry * pyw;
      pxw *= sx;
      pyw *= sy;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  async function renderFrameToOffscreen(off: HTMLCanvasElement, t: number): Promise<void> {
    drawFrame(off, t);
  }

  $effect(() => {
    bindRenderFrame?.(renderFrameToOffscreen);
  });
</script>

<section class="droste">
  <div class="viewport" bind:this={viewport}>
    {#if doc.image && params}
      <canvas
        bind:this={canvas}
        style:left="{fit?.offX ?? 0}px"
        style:top="{fit?.offY ?? 0}px"
        style:width="{fit?.w ?? 0}px"
        style:height="{fit?.h ?? 0}px"
      ></canvas>
    {:else if !doc.image}
      <div class="hint mono">Load an image first.</div>
    {:else}
      <div class="hint mono">Draw a rectangle to see the Droste effect.</div>
    {/if}
  </div>
</section>

<style>
  .droste {
    flex: 1;
    min-width: 0;
    background: var(--canvas-bg);
    position: relative;
    overflow: hidden;
    display: flex;
    border-left: 1px solid var(--border);
  }
  .viewport {
    position: absolute;
    inset: 8px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    background: #000;
  }
  canvas {
    position: absolute;
    display: block;
  }
  .hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    pointer-events: none;
    text-align: center;
    padding: 0 16px;
  }
</style>
