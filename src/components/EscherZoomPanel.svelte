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
   *
   * The only thing that changes per frame is t. So we precompute the
   * frame-invariant per-pixel work once (whenever the image, rectangle,
   * or canvas size changes) into typed arrays, and the inner frame loop
   * is just one multiplication and a Droste-folded sample per pixel.
   */

  import { imageState } from '../lib/stores/image.svelte';
  import { pipeline, ANIMATED_MAX_W } from '../lib/stores/pipeline.svelte';
  import { sampleDroste } from '../lib/math/transforms';
  import Panel from './Panel.svelte';

  let canvas: HTMLCanvasElement | null = $state(null);
  let t = $state(0);
  let playing = $state(true);
  let cycleSeconds = $state(8);
  // Captured at scrub start so we can restore the prior playback state
  // when the user releases the slider.
  let wasPlayingBeforeScrub = false;

  // Canvas dims follow the WORKING image (= crop), not the original.
  const dims = $derived.by(() => {
    const ws = pipeline.workingSize;
    if (!ws) return null;
    const scale = Math.min(1, ANIMATED_MAX_W / ws.width);
    return {
      W: Math.round(ws.width * scale),
      H: Math.round(ws.height * scale),
      scale
    };
  });

  /**
   * Per-pixel cache. Frame-invariant work goes here:
   *
   *   baseR[i]   = exp(lnR + k·Φ)        — source radius at t = 0
   *   cosPhi[i]  = cos(Φ − k·(lnR − lnR₀))
   *   sinPhi[i]  = sin(...)
   *   valid[i]   = 0 at the limit point itself, 1 elsewhere
   *
   * Per frame we just compute r = baseR[i] · S^t and sample. No log,
   * atan2, cos, sin, or exp in the hot loop — Droste folding only.
   *
   * Rebuilds when geometry, R₀, or canvas dims change.
   */
  const cache = $derived.by(() => {
    const src = imageState.source;
    const droste = pipeline.drosteCtx;
    const d = dims;
    const R0 = pipeline.R0;
    if (!src || !droste || !d || !R0) return null;

    const { W, H, scale } = d;
    const N = W * H;
    const k = droste.logS / (2 * Math.PI);
    const lnR0 = Math.log(Math.max(R0, 1e-9));
    const { cx, cy } = droste;

    const baseR = new Float32Array(N);
    const cosPhi = new Float32Array(N);
    const sinPhi = new Float32Array(N);
    const valid = new Uint8Array(N);

    // (px, py) are CANVAS pixels; (px/scale, py/scale) are WORKING-image
    // pixels (crop-relative). Sampling later goes through droste, which
    // adds the crop offset before reading the original ImageData.
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const i = py * W + px;
        const dx = px / scale - cx;
        const dy = py / scale - cy;
        const R2 = dx * dx + dy * dy;
        if (R2 < 1e-12) continue; // valid stays 0 → output black
        const lnR = 0.5 * Math.log(R2);
        const Phi = Math.atan2(dy, dx);
        const newPhi = Phi - k * (lnR - lnR0);
        baseR[i] = Math.exp(lnR + k * Phi);
        cosPhi[i] = Math.cos(newPhi);
        sinPhi[i] = Math.sin(newPhi);
        valid[i] = 1;
      }
    }

    return {
      W, H,
      baseR, cosPhi, sinPhi, valid,
      imageData: new ImageData(W, H),
      droste
    };
  });

  // Animation clock — drives t. Pause halts it without losing position.
  // dt is capped at 1/30 s so coming back from a hidden tab (where rAF
  // was throttled) doesn't catapult t forward in one frame; the
  // animation just smoothly picks up where it left off.
  const MAX_FRAME_DT = 1 / 30;
  $effect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, MAX_FRAME_DT);
      last = now;
      t = (t + dt / cycleSeconds) % 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  // Render — reads `t` and `cache` and writes pixels. Re-runs every frame
  // while playing because changing `t` invalidates this effect.
  $effect(() => {
    const c = cache;
    const src = imageState.source;
    if (!c || !src || !canvas) return;

    if (canvas.width !== c.W) canvas.width = c.W;
    if (canvas.height !== c.H) canvas.height = c.H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const expTShift = Math.exp(t * c.droste.logS); // = S^t
    const { cx, cy } = c.droste;
    const data = c.imageData.data;
    const rgba: [number, number, number, number] = [0, 0, 0, 0];
    const N = c.W * c.H;

    for (let i = 0; i < N; i++) {
      const idx = i << 2;
      if (!c.valid[i]) {
        data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
        continue;
      }
      const r = c.baseR[i] * expTShift;
      const sx = cx + r * c.cosPhi[i];
      const sy = cy + r * c.sinPhi[i];
      if (sampleDroste(src.pixels, c.droste, sx, sy, rgba)) {
        data[idx] = rgba[0];
        data[idx + 1] = rgba[1];
        data[idx + 2] = rgba[2];
        data[idx + 3] = rgba[3];
      } else {
        data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
      }
    }
    ctx.putImageData(c.imageData, 0, 0);
  });

  function togglePlay() { playing = !playing; }
  function reset() { t = 0; }
</script>

<Panel>
  {#snippet title()}Escher zoom — (z − c)<sup>α</sup>, animated{/snippet}
  {#snippet chips()}
    {#if pipeline.geom}
      {@const k = pipeline.geom.logS / (2 * Math.PI)}
      {@const denom = 1 + k * k}
      {@const lambdaMag = Math.exp(pipeline.geom.logS / denom)}
      {@const lambdaArgDeg = (k * pipeline.geom.logS / denom) * 180 / Math.PI}
      <div class="chips mono">
        <span class="chip" title="|λ| = exp(logS / (1 + k²))">
          |λ| = {lambdaMag.toFixed(2)}
        </span>
        <span class="chip" title="arg(λ) = k·logS / (1 + k²)">
          arg(λ) = {lambdaArgDeg.toFixed(1)}°
        </span>
      </div>
    {/if}
  {/snippet}
  {#snippet controls()}
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
          onpointerdown={() => { wasPlayingBeforeScrub = playing; playing = false; }}
          onpointerup={() => { playing = wasPlayingBeforeScrub; }}
          onpointercancel={() => { playing = wasPlayingBeforeScrub; }}
        />
        <span>t = {t.toFixed(3)}</span>
      </label>
    </div>
  {/snippet}
  <!-- tabindex makes the canvas focusable so Space toggles play when it has focus. -->
  <canvas
    bind:this={canvas}
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    }}
  ></canvas>
  {#snippet hint()}
    Each frame applies the Escher map with source lnR shifted by t·logS.
    By the self-similarity g(c + λ(z − c)) = g(z) with λ = exp(c̃·logS),
    one cycle of t spirals the picture inward by exactly one Droste level
    — scaled by |λ| and rotated by arg(λ) — and t = 1 lands back where
    t = 0 began, so the loop is seamless.
  {/snippet}
</Panel>

<style>
  /* Panel-specific tweaks: slider widths. Other control styling is in Panel. */
  .controls input[type='range'] { width: 110px; }
  .controls .scrub input { width: 180px; }
</style>
