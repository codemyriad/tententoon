<script lang="ts">
  import { imageState } from '../lib/stores/image.svelte';
  import { selectionState } from '../lib/stores/selection.svelte';
  import { drosteGeometry } from '../lib/math/droste';
  import { renderMappedDroste, maxCornerRadius } from '../lib/math/transforms';

  // log(z − c) carries TWO independent lattice vectors:
  //   (logS, 0)  — Droste self-similarity (scale by S = horizontal shift in u)
  //   (0, 2π)    — angle wraps every full revolution (vertical shift in v)
  // We render N_U × N_V tiles of that rectangular lattice so the periodicity
  // is immediate. One tile is logS wide × 2π tall in (u, v) space; rendered
  // at PX_PER_LOG pixels per log-unit in BOTH axes so the tile aspect on
  // screen matches the math (logS : 2π).
  const N_U = 3;
  const N_V = 2;
  const PX_PER_LOG = 70;
  const MAX_W = 720;

  let canvas: HTMLCanvasElement | null = $state(null);

  const geom = $derived.by(() => {
    const src = imageState.source;
    const r = selectionState.rect;
    if (!src || !r) return null;
    return drosteGeometry({ width: src.width, height: src.height }, r);
  });

  const dims = $derived.by(() => {
    const g = geom;
    if (!g) return null;
    const uSpan = N_U * g.logS;
    const vSpan = N_V * 2 * Math.PI;
    const rawW = uSpan * PX_PER_LOG;
    const rawH = vSpan * PX_PER_LOG;
    const scale = Math.min(1, MAX_W / rawW);
    return {
      W: Math.max(1, Math.round(rawW * scale)),
      H: Math.max(1, Math.round(rawH * scale)),
      uSpan,
      vSpan
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

    const cx = g.limit.x;
    const cy = g.limit.y;
    const rMax = maxCornerRadius(src.width, src.height, cx, cy);
    const uMax = Math.log(Math.max(rMax, 1));
    const uMin = uMax - d.uSpan;
    const vTop = d.vSpan / 2;
    const droste = { cx, cy, logS: g.logS, rMax };

    const out = ctx.createImageData(d.W, d.H);
    renderMappedDroste(out, src.pixels, droste, (px, py, s) => {
      // px → u (log-radius): increases left to right, uMin..uMax
      // py → v (angle):      decreases top to bottom, +vTop..−vTop
      const u = uMin + (px / (d.W - 1)) * d.uSpan;
      const v = vTop - (py / (d.H - 1)) * d.vSpan;
      const r = Math.exp(u);
      s.x = cx + r * Math.cos(v);
      s.y = cy + r * Math.sin(v);
      return true;
    });
    ctx.putImageData(out, 0, 0);

    // Lattice grid: vertical lines at every logS in u, horizontal lines at
    // every 2π in v. Inside each rectangle is one fundamental Droste tile.
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
    {#if geom && dims}
      <div class="chips mono">
        <span class="chip" title="Horizontal Droste period">
          period<sub>u</sub> = logS = {geom.logS.toFixed(3)}
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
    Horizontal: u = log|z − c|, with period logS — every shift by logS
    reproduces the same picture (Droste self-similarity). Vertical:
    v = arg(z − c), period 2π — going around c once is the identity. Together
    they form a rectangular (logS, 2π) lattice; each dashed cell is one
    fundamental tile. Multiplying log by 2πi/(logS + 2πi) tilts the diagonal
    of this lattice onto the vertical axis — that's the next panel.
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
  h2 {
    margin: 0;
  }
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
