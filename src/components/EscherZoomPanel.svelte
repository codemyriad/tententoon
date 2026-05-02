<script lang="ts">
  /**
   * Panel 4 — infinite spiral zoom of the Escher image.
   *
   * The Escher image g(z) = source(c + (z − c)^α) inherits a COMPLEX
   * self-similarity from the Droste invariance of the source:
   *
   *     g(c + λ·(z − c)) = g(z),   λ = exp(c̃·logS)
   *
   * with |λ| = exp(logS/(1+k²)) and arg(λ) = k·logS/(1+k²). One step of
   * λ scales-and-spins the picture by exactly one Droste level. So
   * showing g at preimage λ^t·(z − c) for t ∈ [0, 1) is infinite spiral
   * zoom — and t = 1 lands back on the same image, so the loop closes
   * without a seam.
   *
   * Computational shortcut. Pulling the λ^t through the Lenstra map
   * collapses to a real shift in source log-radius:
   *
   *     (λ^t)^α = exp(t·c̃·logS·α) = exp(t·logS) = S^t      (since c̃·α = 1)
   *
   * So animating the spiral zoom is exactly the regular Escher
   * renderer with one extra term added to source lnR:
   *
   *     source lnR  = lnR + k·Φ + t·logS
   *     source Φ    = Φ − k·(lnR − lnR₀)
   */

  import { imageState } from '../lib/stores/image.svelte';
  import { selectionState } from '../lib/stores/selection.svelte';
  import { drosteGeometry } from '../lib/math/droste';
  import { renderMappedDroste, maxCornerRadius } from '../lib/math/transforms';

  // Smaller than the static panel: we re-render every frame.
  const MAX_W = 360;

  let canvas: HTMLCanvasElement | null = $state(null);
  let t = $state(0);
  let playing = $state(true);
  let cycleSeconds = $state(8);

  const geom = $derived.by(() => {
    const src = imageState.source;
    const r = selectionState.rect;
    if (!src || !r) return null;
    return drosteGeometry({ width: src.width, height: src.height }, r);
  });

  const dims = $derived.by(() => {
    const src = imageState.source;
    if (!src) return null;
    const scale = Math.min(1, MAX_W / src.width);
    return {
      W: Math.round(src.width * scale),
      H: Math.round(src.height * scale),
      scale
    };
  });

  // Same R₀ default as the static panel: middle of one Droste period in
  // log-radius, so the un-twisted reading sits in the middle of the picture.
  const refR = $derived.by(() => {
    const src = imageState.source;
    const g = geom;
    if (!src || !g) return null;
    const rMax = maxCornerRadius(src.width, src.height, g.limit.x, g.limit.y);
    return rMax / Math.sqrt(g.S);
  });

  // Animation loop — drives t from 0 → 1 and wraps. Pause halts it without
  // losing position.
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

  // Render. Re-runs whenever t (or any input) changes — i.e. every frame
  // while playing.
  $effect(() => {
    const src = imageState.source;
    const g = geom;
    const d = dims;
    const R0 = refR;
    if (!src || !g || !d || !R0 || !canvas) return;

    canvas.width = d.W;
    canvas.height = d.H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const k = g.logS / (2 * Math.PI);
    const lnR0 = Math.log(Math.max(R0, 1e-9));
    const cx = g.limit.x;
    const cy = g.limit.y;
    const rMax = maxCornerRadius(src.width, src.height, cx, cy);
    const droste = { cx, cy, logS: g.logS, rMax };

    // The whole animation lives in this single number: how much further
    // along the source log-radius axis we are this frame. Drives the
    // visual descent into c.
    const tShift = t * g.logS;

    const out = ctx.createImageData(d.W, d.H);
    renderMappedDroste(out, src.pixels, droste, (px, py, s) => {
      const x = px / d.scale;
      const y = py / d.scale;
      const dx = x - cx;
      const dy = y - cy;
      const R2 = dx * dx + dy * dy;
      if (R2 < 1e-12) return false;
      const lnR = 0.5 * Math.log(R2);
      const Phi = Math.atan2(dy, dx);
      const newLnR = lnR + k * Phi + tShift;
      const newPhi = Phi - k * (lnR - lnR0);
      const r = Math.exp(newLnR);
      s.x = cx + r * Math.cos(newPhi);
      s.y = cy + r * Math.sin(newPhi);
      return true;
    });
    ctx.putImageData(out, 0, 0);
  });

  function togglePlay() { playing = !playing; }
  function reset() { t = 0; }
</script>

<section class="panel">
  <header>
    <h2>Escher zoom — (z − c)<sup>α</sup>, animated</h2>
    {#if geom}
      {@const k = geom.logS / (2 * Math.PI)}
      {@const denom = 1 + k * k}
      {@const lambdaMag = Math.exp(geom.logS / denom)}
      {@const lambdaArgDeg = (k * geom.logS / denom) * 180 / Math.PI}
      <div class="chips mono">
        <span class="chip" title="|λ| = exp(logS / (1 + k²))">
          |λ| = {lambdaMag.toFixed(2)}
        </span>
        <span class="chip" title="arg(λ) = k·logS / (1 + k²)">
          arg(λ) = {lambdaArgDeg.toFixed(1)}°
        </span>
      </div>
    {/if}
  </header>
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
  <canvas bind:this={canvas}></canvas>
  <p class="muted hint">
    Each frame applies the Escher map with source lnR shifted by t·logS.
    By the self-similarity g(c + λ(z − c)) = g(z) with λ = exp(c̃·logS),
    one cycle of t spirals the picture inward by exactly one Droste level
    — scaled by |λ| and rotated by arg(λ) — and t = 1 lands back where
    t = 0 began, so the loop is seamless.
  </p>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 1240px;
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  h2 { margin: 0; }
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
  canvas {
    display: block;
    border: 1px solid var(--border);
    background: var(--bg);
    image-rendering: auto;
  }
  .chips {
    display: flex;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .chip {
    padding: 0.2em 0.55em;
    border: 1px solid var(--border);
    color: var(--fg);
  }
  .hint {
    font-size: 0.85rem;
    max-width: 720px;
  }
</style>
