<script lang="ts">
  import { imageState } from '../lib/stores/image.svelte';
  import { selectionState } from '../lib/stores/selection.svelte';
  import { pipeline } from '../lib/stores/pipeline.svelte';

  /**
   * Continuous Droste zoom.
   *
   * At time t, we draw the WORKING image (the user's crop) at multiple
   * nested levels k = 0, 1, 2, … Each level k is drawn at scale
   * σ_fit · S^t / S^k, with the limit point c pinned to the same canvas
   * anchor. Level 0 is the outermost (fit-to-canvas at t = 0); each
   * subsequent level lands exactly in the inner rectangle of the previous
   * one, so we synthesise an infinitely nested Droste image even when the
   * source only has one physical level of self-similarity.
   *
   * As t grows from 0 to 1, every level is multiplied by S — level k at
   * t = 1 matches level (k-1) at t = 0 — so the loop closes seamlessly.
   *
   * When the crop covers the whole image (locked-aspect mode) this reduces
   * to drawing src.bitmap directly. Otherwise we use the 9-arg drawImage
   * form to render only the crop's sub-rectangle.
   */

  let canvas: HTMLCanvasElement | null = $state(null);
  let t = $state(0);
  let playing = $state(true);
  let cycleSeconds = $state(8);
  // ResizeObserver bumps this when the canvas gets resized (e.g. after the
  // crop's aspect changes the CSS aspect-ratio). The render effect reads
  // it so it runs once more with the up-to-date canvas dimensions.
  let resizeTick = $state(0);

  // Use the shared pipeline geom — `geom.limit` is in CROP coords, which is
  // exactly what we need below since every drawImage call places the
  // working-image's top-left at our level anchor.
  const geom = $derived(pipeline.geom);

  $effect(() => {
    if (!canvas) return;
    const resize = () => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        resizeTick++;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  });

  $effect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      t = (t + dt / cycleSeconds) % 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  $effect(() => {
    const src = imageState.source;
    const g = geom;
    const crop = selectionState.crop;
    if (!canvas || !src || !g || !crop) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    void t;
    void resizeTick; // re-render after the canvas's intrinsic size changes

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a1016';
    ctx.fillRect(0, 0, W, H);

    // Fit the WORKING image (the crop) to the canvas (letterbox).
    const workAspect = crop.w / crop.h;
    const canvasAspect = W / H;
    let fitW: number, fitH: number;
    if (canvasAspect > workAspect) {
      fitH = H;
      fitW = H * workAspect;
    } else {
      fitW = W;
      fitH = W / workAspect;
    }
    const offX = (W - fitW) / 2;
    const offY = (H - fitH) / 2;
    const sigmaFit = fitW / crop.w; // canvas-px per working-px when fit-to-canvas

    // Anchor: where c appears on canvas at t = 0 (in fitted working coords).
    const anchorX = offX + g.limit.x * sigmaFit;
    const anchorY = offY + g.limit.y * sigmaFit;

    ctx.save();
    ctx.beginPath();
    ctx.rect(offX, offY, fitW, fitH);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const zoom = Math.pow(g.S, t);

    // Each level draws the crop's sub-rectangle of the source bitmap, scaled
    // around the limit point so that level k+1 lands inside level k's nest.
    for (let level = 0; level < 32; level++) {
      const scale = (sigmaFit * zoom) / Math.pow(g.S, level);
      const w = crop.w * scale;
      if (w < 1.5) break; // sub-pixel, invisible
      const h = crop.h * scale;
      const dx = anchorX - g.limit.x * scale;
      const dy = anchorY - g.limit.y * scale;
      try {
        // 9-arg drawImage: copy [crop.x, crop.y, crop.w, crop.h] of the
        // bitmap into [dx, dy, w, h] of the canvas.
        ctx.drawImage(src.bitmap, crop.x, crop.y, crop.w, crop.h, dx, dy, w, h);
      } catch {
        // non-fatal
      }
    }

    ctx.restore();
  });

  function togglePlay() { playing = !playing; }
  function reset() { t = 0; }
</script>

<section class="zoom-preview">
  <header>
    <h2>Continuous zoom</h2>
    <div class="controls mono">
      <button onclick={togglePlay} aria-pressed={playing}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <button onclick={reset}>Reset</button>
      <label class="speed">
        Cycle
        <input type="range" min="1" max="20" step="0.5" bind:value={cycleSeconds} />
        <span>{cycleSeconds.toFixed(1)} s</span>
      </label>
      <label class="scrub">
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          bind:value={t}
          onpointerdown={() => (playing = false)}
        />
        <span>t = {t.toFixed(3)}</span>
      </label>
    </div>
  </header>

  {#if imageState.source}
    <canvas
      bind:this={canvas}
      class="view"
      style="aspect-ratio: {selectionState.crop?.w ?? imageState.source.width} / {selectionState.crop?.h ?? imageState.source.height};"
    ></canvas>
    <p class="muted hint">
      Source drawn at scale σ · S<sup>t</sup> / S<sup>k</sup> for every level k, all
      anchored at the limit point c. Level k + 1 always lands in level k's inner rectangle;
      t = 1 is identical to t = 0 so the loop is seamless.
    </p>
  {:else}
    <p class="muted">Place a rectangle above to start.</p>
  {/if}
</section>

<style>
  .zoom-preview {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 960px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
    flex-wrap: wrap;
  }
  .speed,
  .scrub {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted);
  }
  .scrub input { width: 180px; }
  .speed input { width: 110px; }
  .view {
    display: block;
    width: 100%;
    border: 1px solid var(--border);
  }
  .hint { font-size: 0.85rem; }
</style>
