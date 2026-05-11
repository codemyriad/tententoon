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
   *
   * Reference radius R₀ — the orientation knob.
   * The map twists: source angle = Φ − k·lnR, so the source orientation
   * drifts with lnR. At R = 1 px the source is upright; everywhere else
   * it's rotated by k·lnR. Lenstra's formula leaves a free overall
   * rotation, which we use to make the picture upright at SOME chosen
   * reference radius R₀:
   *
   *     source angle = Φ − k·(lnR − lnR₀)
   *
   * Default: R₀ = rMax / √S, the GEOMETRIC MEAN of the outer rim
   * (rMax) and the inner Droste ring (rMax/S) — i.e. the middle of one
   * Droste period in log-radius. This is well-defined for any rectangle
   * placement and lands the upright reading right in the middle of the
   * picture's annulus. (Tempting but wrong: distance from c to the rect
   * centre — that's identically 0 for any centred rect, since c is
   * always exactly at the rect's centre when the rect is centred.)
   */

  import { pipeline, STATIC_MAX_W } from '../lib/stores/pipeline.svelte';
  import { sampleDroste, ssOffsetsForFootprint } from '../lib/math/transforms';
  import Panel from './Panel.svelte';

  let canvas: HTMLCanvasElement | null = $state(null);

  // Canvas dims follow the WORKING image (= crop), not the original.
  const dims = $derived.by(() => {
    const ws = pipeline.workingSize;
    if (!ws) return null;
    const scale = Math.min(1, STATIC_MAX_W / ws.width);
    return {
      W: Math.round(ws.width * scale),
      H: Math.round(ws.height * scale),
      scale
    };
  });

  $effect(() => {
    const pixels = pipeline.samplingPixels;
    const droste = pipeline.drosteCtx;
    const d = dims;
    const R0 = pipeline.R0;
    if (!pixels || !droste || !d || !R0 || !canvas) return;

    canvas.width = d.W;
    canvas.height = d.H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { cx, cy, logS, rMax } = droste;
    const { scale } = d;
    const k = logS / (2 * Math.PI);
    const lnR0 = Math.log(Math.max(R0, 1e-9));
    const alphaMag = Math.sqrt(1 + k * k);
    const lnRmax = Math.log(rMax);

    /**
     * Forward Lenstra map with the R₀ orientation correction. Returns the
     * source coord plus a footprint estimate (source-pixels per output-
     * canvas-pixel). The footprint formula is |dw/dz|·S^n / canvasScale,
     * where |dw/dz| = |α|·exp(k·Φ) for w(z) = c+(z−c)^α and n is the
     * Droste fold count needed to bring the source back into the working
     * rectangle. Returns null exactly at z = c.
     */
    function forward(x: number, y: number): { sx: number; sy: number; footprint: number } | null {
      const dx = x - cx;
      const dy = y - cy;
      const R2 = dx * dx + dy * dy;
      if (R2 < 1e-12) return null;
      const lnR = 0.5 * Math.log(R2);
      const Phi = Math.atan2(dy, dx);
      const newLnR = lnR + k * Phi;
      const newPhi = Phi - k * (lnR - lnR0);
      const r = Math.exp(newLnR);
      const sx = cx + r * Math.cos(newPhi);
      const sy = cy + r * Math.sin(newPhi);
      const n = Math.max(0, Math.floor((lnRmax - newLnR) / logS));
      const footprint = (alphaMag * Math.exp(k * Phi + n * logS)) / scale;
      return { sx, sy, footprint };
    }

    const out = ctx.createImageData(d.W, d.H);
    const data = out.data;
    const rgba: [number, number, number, number] = [0, 0, 0, 0];
    for (let py = 0; py < d.H; py++) {
      for (let px = 0; px < d.W; px++) {
        const idx = (py * d.W + px) << 2;
        const fwd = forward(px / d.scale, py / d.scale);
        if (!fwd) {
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
          continue;
        }
        const offsets = ssOffsetsForFootprint(fwd.footprint);
        if (!offsets) {
          if (sampleDroste(pixels, droste, fwd.sx, fwd.sy, rgba)) {
            data[idx] = rgba[0]; data[idx + 1] = rgba[1];
            data[idx + 2] = rgba[2]; data[idx + 3] = rgba[3];
          } else {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
          }
          continue;
        }
        // Adaptive supersampling: re-run the forward map at sub-pixel
        // offsets within this output pixel and average. Sub-samples that
        // fall onto the limit point or fail to fold back into the working
        // rectangle simply don't contribute.
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        for (let s = 0; s < offsets.length; s++) {
          const f = forward((px + offsets[s][0]) / d.scale, (py + offsets[s][1]) / d.scale);
          if (f && sampleDroste(pixels, droste, f.sx, f.sy, rgba)) {
            r += rgba[0]; g += rgba[1]; b += rgba[2]; a += rgba[3];
            count++;
          }
        }
        if (count > 0) {
          data[idx] = r / count; data[idx + 1] = g / count;
          data[idx + 2] = b / count; data[idx + 3] = a / count;
        } else {
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
  });
</script>

<Panel>
  {#snippet title()}Tententoon{/snippet}
  {#snippet chips()}
    {#if pipeline.geom && pipeline.R0}
      {@const k = pipeline.geom.logS / (2 * Math.PI)}
      <div class="chips mono">
        <span class="chip" title="Escher exponent">α = 1 − {k.toFixed(3)}i</span>
        <span class="chip" title="|α| = √(1 + k²)">|α| = {Math.sqrt(1 + k * k).toFixed(3)}</span>
        <span class="chip" title="Reference radius (rMax/√S) — source reads upright at this radius">
          R₀ = {pipeline.R0.toFixed(0)} px
        </span>
      </div>
    {/if}
  {/snippet}
  <canvas bind:this={canvas}></canvas>
  {#snippet hint()}
    Output pixel z samples the Droste-folded source at c + (z − c)<sup>α</sup>
    with α = 1 − i·logS/(2π). Going CCW around c once shifts the source
    log by exactly (logS, 2π) — one full Droste step — so the picture
    winds into itself: each lap is one zoom level deeper. The map twists
    the source angle by k·lnR; we cancel that twist at R₀ = rMax/√S
    (the middle of one Droste period in log-radius), so the photo reads
    upright there and progressively more wound inward / outward as you
    leave R₀.
  {/snippet}
</Panel>
