<script lang="ts">
  /**
   * Panel 3 — Escher: (z − c)^α.
   *
   * The Lenstra construction. Compose the previous two ideas as a single
   * complex map: take log, multiply by c̃ = 2πi/(logS + 2πi), exponentiate.
   * The composition is z = c + (w − c)^c̃ — a forward map source → Escher.
   *
   * For RENDERING we need the inverse: each output pixel z asks for its
   * source w. With α = 1/c̃ = 1 − i·k where k = logS / (2π),
   *
   *     w = c + (z − c)^α
   *
   * In log-polar coords this is just a 2×2 real-linear map:
   *
   *     α · (lnR + iΦ) = (lnR + k·Φ) + i·(Φ − k·lnR)
   *
   * The geometric punchline: going CCW around c by 2π in z shifts the
   * source log by exactly the diagonal lattice vector (logS, 2π) — one
   * clean Droste step. So one full lap in the Escher panel is one zoom
   * level deeper into the source.
   */

  import { imageState } from '../lib/stores/image.svelte';
  import { selectionState } from '../lib/stores/selection.svelte';
  import { drosteGeometry } from '../lib/math/droste';
  import { renderMappedDroste, maxCornerRadius } from '../lib/math/transforms';

  const MAX_W = 560;

  let canvas: HTMLCanvasElement | null = $state(null);

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

  $effect(() => {
    const src = imageState.source;
    const g = geom;
    const d = dims;
    if (!src || !g || !d || !canvas) return;

    canvas.width = d.W;
    canvas.height = d.H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const k = g.logS / (2 * Math.PI);
    const cx = g.limit.x;
    const cy = g.limit.y;
    const rMax = maxCornerRadius(src.width, src.height, cx, cy);
    const droste = { cx, cy, logS: g.logS, rMax };

    const out = ctx.createImageData(d.W, d.H);
    renderMappedDroste(out, src.pixels, droste, (px, py, s) => {
      // Output pixel → image-space coord z = (x, y).
      const x = px / d.scale;
      const y = py / d.scale;
      const dx = x - cx;
      const dy = y - cy;
      const R2 = dx * dx + dy * dy;
      if (R2 < 1e-12) return false;

      // log(z − c) = lnR + iΦ.
      const lnR = 0.5 * Math.log(R2);
      const Phi = Math.atan2(dy, dx);
      // α · log = (lnR + k·Φ) + i·(Φ − k·lnR).
      const newLnR = lnR + k * Phi;
      const newPhi = Phi - k * lnR;
      // exp back to source coords.
      const r = Math.exp(newLnR);
      s.x = cx + r * Math.cos(newPhi);
      s.y = cy + r * Math.sin(newPhi);
      return true;
    });
    ctx.putImageData(out, 0, 0);

    // Mark the limit point c if it's on screen.
    const lx = cx * d.scale;
    const ly = cy * d.scale;
    if (lx >= 0 && lx <= d.W && ly >= 0 && ly <= d.H) {
      ctx.strokeStyle = 'rgba(255, 184, 92, 0.9)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.moveTo(lx - 9, ly);
      ctx.lineTo(lx + 9, ly);
      ctx.moveTo(lx, ly - 9);
      ctx.lineTo(lx, ly + 9);
      ctx.stroke();
    }
  });
</script>

<section class="panel">
  <header>
    <h2>Escher: (z − c)<sup>α</sup></h2>
    {#if geom}
      {@const k = geom.logS / (2 * Math.PI)}
      <div class="chips mono">
        <span class="chip" title="Escher exponent">α = 1 − {k.toFixed(3)}i</span>
        <span class="chip" title="|α| = √(1 + k²)">|α| = {Math.sqrt(1 + k * k).toFixed(3)}</span>
      </div>
    {/if}
  </header>
  <canvas bind:this={canvas}></canvas>
  <p class="muted hint">
    Output pixel z samples the Droste-folded source at c + (z − c)<sup>α</sup>
    with α = 1 − i·logS/(2π). Following a CCW circle around c once shifts
    the source log by exactly (logS, 2π) — one full Droste step — so the
    picture winds into itself: each lap is one zoom level deeper.
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
