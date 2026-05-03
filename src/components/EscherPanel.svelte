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

  import { imageState } from '../lib/stores/image.svelte';
  import { pipeline, STATIC_MAX_W } from '../lib/stores/pipeline.svelte';
  import { sampleDrosteMipped } from '../lib/math/transforms';
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
    const droste = pipeline.drosteCtx;
    const mips = pipeline.mipmap;
    const d = dims;
    const R0 = pipeline.R0;
    if (!droste || !mips || !d || !R0 || !canvas) return;

    canvas.width = d.W;
    canvas.height = d.H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const k = droste.logS / (2 * Math.PI);
    const lnR0 = Math.log(Math.max(R0, 1e-9));
    const { cx, cy } = droste;
    // Same anti-aliasing setup as the spiral-zoom panel, but with t = 0:
    // mipmap level = log₂(|α|/canvasScale) + n·log₂S, where n is the
    // per-pixel Droste fold added inside sampleDrosteMipped.
    const log2S = droste.logS / Math.LN2;
    const baseLevel = 0.5 * Math.log2(1 + k * k) - Math.log2(d.scale);

    const out = ctx.createImageData(d.W, d.H);
    const data = out.data;
    const rgba: [number, number, number, number] = [0, 0, 0, 0];
    for (let py = 0; py < d.H; py++) {
      for (let px = 0; px < d.W; px++) {
        const idx = (py * d.W + px) << 2;
        // Output pixel → working-image coord z (crop-relative).
        const x = px / d.scale;
        const y = py / d.scale;
        const dx = x - cx;
        const dy = y - cy;
        const R2 = dx * dx + dy * dy;
        if (R2 < 1e-12) {
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
          continue;
        }
        // α · log(z − c) = (lnR + k·Φ) + i·(Φ − k·lnR).
        // Plus the upright-at-R₀ rotation k·lnR₀ in the angle.
        const lnR = 0.5 * Math.log(R2);
        const Phi = Math.atan2(dy, dx);
        const newLnR = lnR + k * Phi;
        const newPhi = Phi - k * (lnR - lnR0);
        const r = Math.exp(newLnR);
        const sx = cx + r * Math.cos(newPhi);
        const sy = cy + r * Math.sin(newPhi);
        if (sampleDrosteMipped(mips, droste, sx, sy, baseLevel, log2S, rgba)) {
          data[idx] = rgba[0];
          data[idx + 1] = rgba[1];
          data[idx + 2] = rgba[2];
          data[idx + 3] = rgba[3];
        } else {
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
        }
      }
    }
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

<Panel>
  {#snippet title()}Escher: (z − c)<sup>α</sup>{/snippet}
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
