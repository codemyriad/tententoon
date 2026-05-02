<script lang="ts">
  /**
   * Panel 2 — log(z − c) rotated.
   *
   * The diagonal of the (logS, 2π) lattice from the previous panel is the
   * vector (logS, 2π); rotating (u, v) by
   *
   *     β = atan(logS / 2π)
   *
   * sends that diagonal onto the +v' axis, with length L = √(logS² + 4π²).
   * After rotation the image tiles vertically with period L, so a canvas
   * that is exactly L tall has matching top and bottom rows — one Droste
   * step is one upward tile.
   *
   * This is a PURE rotation. The proper Lenstra step is multiplication of
   * log by c̃ = 2πi/(logS + 2πi), which is the same rotation but ALSO a
   * scaling by |c̃| = 2π/L. So applying exp here doesn't quite produce the
   * Escher panel — the angles are right, the radial scaling isn't. The
   * rotated view exists to make the geometry obvious side-by-side.
   *
   * Inverse map: (u', v') is the pixel; un-rotate by −β to get (u, v) in
   * the original log frame, then sample as in panel 1.
   */

  import { imageState } from '../lib/stores/image.svelte';
  import { pipeline } from '../lib/stores/pipeline.svelte';
  import { renderMappedDroste } from '../lib/math/transforms';

  const W = 840;
  const H = 280;
  const N_PERIODS = 3;  // number of u-direction Droste copies to fill horizontally

  let canvas: HTMLCanvasElement | null = $state(null);

  $effect(() => {
    const src = imageState.source;
    const g = pipeline.geom;
    if (!src || !g || !canvas) return;

    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Rotation: β = atan(logS / 2π). The diagonal lattice vector (logS, 2π)
    // rotates onto (0, L) with L = √(logS² + 4π²) — purely vertical.
    const beta = Math.atan2(g.logS, 2 * Math.PI);
    const cosB = Math.cos(beta);
    const sinB = Math.sin(beta);
    const L = Math.hypot(g.logS, 2 * Math.PI);

    const cx = g.limit.x;
    const cy = g.limit.y;
    const uMin = Math.log(Math.max(g.rMax, 1)) - N_PERIODS * g.logS;
    const uSpan = N_PERIODS * g.logS;
    const droste = { cx, cy, logS: g.logS, rMax: g.rMax };

    const out = ctx.createImageData(W, H);
    renderMappedDroste(out, src.pixels, droste, (px, py, s) => {
      // (u', v') in the rotated frame. Canvas is exactly L tall → one period.
      const uPrime = uMin + (px / (W - 1)) * uSpan;
      const vPrime = -L / 2 + (py / (H - 1)) * L;
      // Inverse rotation by −β: (u, v) = R(−β) · (u', v').
      const u = uPrime * cosB + vPrime * sinB;
      const v = -uPrime * sinB + vPrime * cosB;
      const r = Math.exp(u);
      s.x = cx + r * Math.cos(v);
      s.y = cy + r * Math.sin(v);
      return true;
    });
    ctx.putImageData(out, 0, 0);

    // Reference midline at v' = 0: where the un-rotated angle horizon sits.
    ctx.strokeStyle = 'rgba(255, 184, 92, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2 + 0.5);
    ctx.lineTo(W, H / 2 + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  });
</script>

<section class="panel">
  <header>
    <h2>log(z − c), rotated by β</h2>
    {#if pipeline.geom}
      {@const beta = Math.atan2(pipeline.geom.logS, 2 * Math.PI)}
      {@const L = Math.hypot(pipeline.geom.logS, 2 * Math.PI)}
      <div class="chips mono">
        <span class="chip" title="Rotation angle">
          β = {(beta * 180 / Math.PI).toFixed(2)}°
        </span>
        <span class="chip" title="tan β = logS / 2π">
          tan β = logS / 2π = {(pipeline.geom.logS / (2 * Math.PI)).toFixed(3)}
        </span>
        <span class="chip" title="Vertical period after rotation">
          period = L = {L.toFixed(3)}
        </span>
      </div>
    {/if}
  </header>
  <canvas bind:this={canvas} style="width: {W}px; max-width: 100%; height: auto;"></canvas>
  <p class="muted hint">
    Same log strip rotated by β = atan(logS / 2π). The diagonal lattice
    vector (logS, 2π) now stands purely vertical with length L = √(logS² + 4π²);
    the canvas is exactly L tall, so top and bottom rows coincide. This is
    a pure rotation — applying exp would give an almost-Escher (angles
    right, radial scaling off). The proper Lenstra step in the next panel
    multiplies log by 2πi/(logS + 2πi) instead, which is the same rotation
    PLUS a scaling by 2π/L.
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
