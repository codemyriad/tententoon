<script lang="ts">
  /**
   * Panel 1 — log(z − c).
   *
   * Move into log-polar coords around the limit point c. Two simple
   * symmetries of the (faked) Droste image become two perpendicular
   * shifts:
   *
   *     scale by S around c     →   shift u by logS  (horizontal)
   *     full revolution around c →   shift v by 2π   (vertical)
   *
   * So in (u, v) space the picture lives on a rectangular (logS, 2π)
   * lattice. We render N_U × N_V tiles of that lattice, drawn at the same
   * pixels-per-unit on both axes so each tile's on-screen aspect (logS : 2π)
   * matches the math. Dashed lines outline each fundamental tile.
   *
   * Inverse map for sampling: (u, v) → c + e^u · (cos v, sin v).
   */

  import { imageState } from '../lib/stores/image.svelte';
  import { pipeline } from '../lib/stores/pipeline.svelte';
  import { renderMappedDroste } from '../lib/math/transforms';

  const N_U = 3;          // horizontal Droste-scale tiles
  const N_V = 2;          // vertical angle-wrap tiles
  const PX_PER_LOG = 70;  // pixels per unit in (u, v)
  const MAX_W = 720;      // cap on canvas width

  let canvas: HTMLCanvasElement | null = $state(null);

  // Canvas dimensions follow logS so tile aspect on screen equals logS : 2π.
  const dims = $derived.by(() => {
    const g = pipeline.geom;
    if (!g) return null;
    const uSpan = N_U * g.logS;
    const vSpan = N_V * 2 * Math.PI;
    const rawW = uSpan * PX_PER_LOG;
    const rawH = vSpan * PX_PER_LOG;
    const fit = Math.min(1, MAX_W / rawW);
    return {
      W: Math.max(1, Math.round(rawW * fit)),
      H: Math.max(1, Math.round(rawH * fit)),
      uSpan,
      vSpan
    };
  });

  $effect(() => {
    const src = imageState.source;
    const g = pipeline.geom;
    const d = dims;
    if (!src || !g || !d || !canvas) return;

    canvas.width = d.W;
    canvas.height = d.H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // u sweeps [uMin, uMax]; uMax is the outermost radius of the source.
    // v sweeps [-vSpan/2, +vSpan/2]; sin/cos handle the angle wrap.
    const cx = g.limit.x;
    const cy = g.limit.y;
    const uMax = Math.log(Math.max(g.rMax, 1));
    const uMin = uMax - d.uSpan;
    const vTop = d.vSpan / 2;
    const droste = { cx, cy, logS: g.logS, rMax: g.rMax };

    const out = ctx.createImageData(d.W, d.H);
    renderMappedDroste(out, src.pixels, droste, (px, py, s) => {
      const u = uMin + (px / (d.W - 1)) * d.uSpan;
      const v = vTop - (py / (d.H - 1)) * d.vSpan;
      const r = Math.exp(u);
      s.x = cx + r * Math.cos(v);
      s.y = cy + r * Math.sin(v);
      return true;
    });
    ctx.putImageData(out, 0, 0);

    // Lattice grid: cell boundaries every logS in u, every 2π in v.
    ctx.strokeStyle = 'rgba(255, 184, 92, 0.6)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    for (let n = 1; n < N_U; n++) {
      const x = (n / N_U) * (d.W - 1);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, d.H);
      ctx.stroke();
    }
    for (let m = 1; m < N_V; m++) {
      const y = (m / N_V) * (d.H - 1);
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(d.W, y + 0.5);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  });
</script>

<section class="panel">
  <header>
    <h2>log(z − c)</h2>
    {#if pipeline.geom}
      <div class="chips mono">
        <span class="chip" title="Horizontal Droste period">
          period<sub>u</sub> = logS = {pipeline.geom.logS.toFixed(3)}
        </span>
        <span class="chip" title="Vertical angle period">
          period<sub>v</sub> = 2π
        </span>
        <span class="chip" title="Tiles shown">
          {N_U} × {N_V} tiles
        </span>
      </div>
    {/if}
  </header>
  <canvas bind:this={canvas} style="max-width: 100%; height: auto;"></canvas>
  <p class="muted hint">
    Horizontal: u = log|z − c|, period logS — every shift by logS reproduces
    the same picture (Droste self-similarity). Vertical: v = arg(z − c),
    period 2π — going around c once is the identity. The two together form
    a rectangular (logS, 2π) lattice; each dashed cell is one fundamental
    tile. The next panel multiplies log by 2πi/(logS + 2πi), which tilts
    this lattice's diagonal onto the vertical axis.
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
    image-rendering: pixelated;
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
