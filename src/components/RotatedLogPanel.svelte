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

  import { pipeline } from '../lib/stores/pipeline.svelte';
  import { renderMappedDroste } from '../lib/math/transforms';
  import Panel from './Panel.svelte';

  const W = 840;
  const H = 280;
  const N_PERIODS = 3;  // number of u-direction Droste copies to fill horizontally

  let canvas: HTMLCanvasElement | null = $state(null);

  $effect(() => {
    const pixels = pipeline.samplingPixels;
    const droste = pipeline.drosteCtx;
    if (!pixels || !droste || !canvas) return;
    const cv = canvas;

    // rAF-coalesce: see EscherPanel.svelte for rationale.
    const raf = requestAnimationFrame(() => {
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    // Rotation: β = atan(logS / 2π). The diagonal lattice vector (logS, 2π)
    // rotates onto (0, L) with L = √(logS² + 4π²) — purely vertical.
    const beta = Math.atan2(droste.logS, 2 * Math.PI);
    const cosB = Math.cos(beta);
    const sinB = Math.sin(beta);
    const L = Math.hypot(droste.logS, 2 * Math.PI);

    const { cx, cy, rMax, logS } = droste;
    const uMin = Math.log(Math.max(rMax, 1)) - N_PERIODS * logS;
    const uSpan = N_PERIODS * logS;

    const out = ctx.createImageData(W, H);
    renderMappedDroste(out, pixels, droste, (px, py, s) => {
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
    return () => cancelAnimationFrame(raf);
  });
</script>

<Panel>
  {#snippet title()}log(z − c), rotated by β{/snippet}
  {#snippet chips()}
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
  {/snippet}
  <canvas bind:this={canvas} style="width: {W}px; max-width: 100%; height: auto;"></canvas>
  {#snippet hint()}
    Same log strip rotated by β = atan(logS / 2π). The diagonal lattice
    vector (logS, 2π) now stands purely vertical with length L = √(logS² + 4π²);
    the canvas is exactly L tall, so top and bottom rows coincide. This is
    a pure rotation — applying exp would give an almost-Escher (angles
    right, radial scaling off). The proper Lenstra step in the next panel
    multiplies log by 2πi/(logS + 2πi) instead, which is the same rotation
    PLUS a scaling by 2π/L.
  {/snippet}
</Panel>

<style>
  canvas { image-rendering: pixelated; }
</style>
