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
   * So animating the spiral zoom is exactly the regular Escher renderer
   * with one extra term added to source lnR:
   *
   *     source lnR  = lnR + k·Φ + t·logS
   *     source Φ    = Φ − k·(lnR − lnR₀)
   *
   * Rendering goes through the tiered backend in src/lib/render/escher-zoom:
   * WebGL2 in a Worker → WebGL2 on main → CPU on main, with automatic
   * demotion if a tier fails to init or the GL context is lost. The CPU
   * tier is the original JS pixel loop, kept verbatim.
   */

  import { pipeline, ANIMATED_MAX_W } from '../lib/stores/pipeline.svelte';
  import { createEscherZoomRenderer } from '../lib/render/escher-zoom';
  import type { BackendTier } from '../lib/render/types';
  import Panel from './Panel.svelte';

  let canvas: HTMLCanvasElement | null = $state(null);
  let t = $state(0);
  let playing = $state(true);
  let cycleSeconds = $state(8);
  let activeTier: BackendTier | null = $state(null);
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

  // Animation clock — drives t. Pause halts it without losing position.
  // dt is capped at 1/30 s so coming back from a hidden tab (where rAF
  // was throttled) doesn't catapult t forward in one frame.
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

  // The active renderer. Held in a $state-like holder so the render effect
  // re-runs once it's bound. Plain `let` is enough — we read it inside the
  // render effect AFTER reading the reactive inputs, so reads here don't
  // re-fire the effect on their own.
  let renderer: ReturnType<typeof createEscherZoomRenderer> | null = $state(null);

  // Bind a renderer to the canvas once the canvas mounts. Recreate on
  // unmount/remount; the renderer's internal tier-demotion handles backend
  // failures, so no need to re-create on those.
  // Optional URL override for testing each tier on a single machine:
  //   ?renderer=webgl2-worker / webgl2-main / cpu-main
  // Useful when the page lands on cpu-main (e.g. SwiftShader) but you want
  // to verify the WebGL2 path actually compiles and runs. Skipped if absent.
  function forcedTier(): BackendTier | undefined {
    if (typeof window === 'undefined') return undefined;
    const v = new URLSearchParams(window.location.search).get('renderer');
    if (v === 'webgl2-worker' || v === 'webgl2-main' || v === 'cpu-main') return v;
    return undefined;
  }

  $effect(() => {
    if (!canvas) return;
    const r = createEscherZoomRenderer({
      onTier: (tier) => (activeTier = tier),
      forceTier: forcedTier()
    });
    renderer = r;
    void r.init(canvas);
    return () => {
      r.dispose();
      renderer = null;
      activeTier = null;
    };
  });

  // Render — feeds the active backend with the current pipeline state and
  // animation phase. Re-runs whenever any tracked input changes (t every
  // frame while playing). The renderer itself decides what to do with it
  // (GPU draw call, JS pixel loop, etc.). Init may not have completed yet;
  // worker init is async so the first few render calls may queue up
  // internally — `renderer.render` is safe to call early.
  $effect(() => {
    const pixels = pipeline.samplingPixels;
    const droste = pipeline.drosteCtx;
    const d = dims;
    const R0 = pipeline.R0;
    const r = renderer;
    if (!pixels || !droste || !d || !R0 || !r) return;
    r.render({
      pixels,
      ctx: droste,
      R0,
      W: d.W,
      H: d.H,
      scale: d.scale,
      t
    });
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
        {#if activeTier}
          <span class="chip" title="Active rendering backend">
            backend = {activeTier}
          </span>
        {/if}
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
