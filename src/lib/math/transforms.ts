/**
 * Sampling helpers for the Droste visualisation pipeline.
 *
 * Every panel renders by an INVERSE map: for each output pixel we ask
 * "what point in the source did this come from?", then bilinearly sample
 * the source there. This guarantees every output pixel is covered (a
 * forward map would leave holes wherever the forward map stretched).
 *
 * The pipeline stages, all rendered this way:
 *
 *   1. log(z − c)              — log panel
 *   2. rotate (u, v) by atan(logS / 2π) — rotated-log panel
 *   3. (z − c)^α  with α = 1 − i·logS/(2π) — Escher panel
 *
 * The rotated-log panel is illustrative: it's a PURE rotation of log
 * space, not the full multiplication by 2πi/(logS + 2πi) the Lenstra
 * construction needs. Applying exp to it won't quite match the Escher
 * panel (the rotation is right but a scale factor is missing). Showing
 * the three side by side still makes the geometry obvious.
 *
 * The source image is, of course, NOT actually Droste-invariant — it's
 * just a photo. We FAKE invariance with `sampleDroste`, which folds any
 * candidate sample point back into the outermost ring of the image by
 * scaling around c. The result is what the picture would look like if it
 * really were a Droste fractal.
 */

export type Pixels = ImageData;

/** Bilinear sample of the source at (x, y) in pixel space. Out-of-bounds → transparent black. */
export function sample(
  src: Pixels,
  x: number,
  y: number,
  out: [number, number, number, number]
): void {
  const W = src.width;
  const H = src.height;
  if (x < 0 || y < 0 || x > W - 1 || y > H - 1) {
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    return;
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(W - 1, x0 + 1);
  const y1 = Math.min(H - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const d = src.data;
  const i00 = (y0 * W + x0) * 4;
  const i10 = (y0 * W + x1) * 4;
  const i01 = (y1 * W + x0) * 4;
  const i11 = (y1 * W + x1) * 4;
  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;
  out[0] = d[i00] * w00 + d[i10] * w10 + d[i01] * w01 + d[i11] * w11;
  out[1] = d[i00 + 1] * w00 + d[i10 + 1] * w10 + d[i01 + 1] * w01 + d[i11 + 1] * w11;
  out[2] = d[i00 + 2] * w00 + d[i10 + 2] * w10 + d[i01 + 2] * w01 + d[i11 + 2] * w11;
  out[3] = d[i00 + 3] * w00 + d[i10 + 3] * w10 + d[i01 + 3] * w01 + d[i11 + 3] * w11;
}

/**
 * Render `out` by inverse mapping. For each output pixel (px, py), the
 * caller's `mapInv` writes the corresponding source coord into `s`; we
 * sample the source there. Returning false leaves the output pixel blank.
 */
export function renderMapped(
  out: ImageData,
  pixels: Pixels,
  mapInv: (px: number, py: number, src: { x: number; y: number }) => boolean
): void {
  const rgba: [number, number, number, number] = [0, 0, 0, 0];
  const src = { x: 0, y: 0 };
  const W = out.width;
  const H = out.height;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const idx = (py * W + px) * 4;
      if (mapInv(px, py, src)) {
        sample(pixels, src.x, src.y, rgba);
        out.data[idx] = rgba[0];
        out.data[idx + 1] = rgba[1];
        out.data[idx + 2] = rgba[2];
        out.data[idx + 3] = rgba[3];
      } else {
        out.data[idx] = 0;
        out.data[idx + 1] = 0;
        out.data[idx + 2] = 0;
        out.data[idx + 3] = 0;
      }
    }
  }
}

/**
 * Droste self-similarity context: we PRETEND the working image is invariant
 * under p → c + S·(p − c), scaling by S around c. The working image is the
 * user's CROP of the original — when the crop covers the whole image,
 * "working coords" and "original coords" coincide, but in general working
 * coords run [0, W)×[0, H) while the original lives at an offset.
 *
 *   cx, cy   — limit point in working (crop-relative) coords
 *   W, H     — working image dimensions (= crop size)
 *   cropX,   — where the crop sits inside the original; sample positions
 *   cropY      get translated by (+cropX, +cropY) before reading pixels
 */
export type DrosteCtx = {
  cx: number;
  cy: number;
  logS: number;
  rMax: number;
  W: number;
  H: number;
  cropX: number;
  cropY: number;
};

/**
 * Sample the (faked) Droste tiling. The candidate (sx, sy) is in working
 * coords. We scale (sx − c, sy − c) by S^n until the result lands inside
 * the working rectangle [0, W)×[0, H), then translate to original-image
 * coords for the actual bilinear read. Among valid n we pick the one with
 * the largest radius — the outermost, sharpest equivalent copy.
 */
export function sampleDroste(
  src: Pixels,
  ctx: DrosteCtx,
  sx: number,
  sy: number,
  out: [number, number, number, number]
): boolean {
  const dx = sx - ctx.cx;
  const dy = sy - ctx.cy;
  const r = Math.hypot(dx, dy);
  if (r < 1e-9) {
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    return false;
  }
  // Largest n with r·exp(n·logS) ≤ rMax. Walk inward from there until the
  // scaled point lands inside the working rectangle. The 10-step cap is
  // generous: dn > 1 only kicks in when one working dimension is much
  // shorter than the other, so the inner ring spills outside it. Falling
  // off the cap leaves the pixel transparent (the only reasonable thing).
  const n0 = Math.floor((Math.log(ctx.rMax) - Math.log(r)) / ctx.logS);
  for (let dn = 0; dn <= 10; dn++) {
    const n = n0 - dn;
    const scale = Math.exp(n * ctx.logS);
    const tx = ctx.cx + dx * scale;
    const ty = ctx.cy + dy * scale;
    if (tx >= 0 && ty >= 0 && tx <= ctx.W - 1 && ty <= ctx.H - 1) {
      sample(src, tx + ctx.cropX, ty + ctx.cropY, out);
      return true;
    }
  }
  return false;
}

/** Like `renderMapped`, but routes every source lookup through Droste folding. */
export function renderMappedDroste(
  out: ImageData,
  pixels: Pixels,
  ctx: DrosteCtx,
  mapInv: (px: number, py: number, src: { x: number; y: number }) => boolean
): void {
  const rgba: [number, number, number, number] = [0, 0, 0, 0];
  const src = { x: 0, y: 0 };
  const W = out.width;
  const H = out.height;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const idx = (py * W + px) * 4;
      if (mapInv(px, py, src) && sampleDroste(pixels, ctx, src.x, src.y, rgba)) {
        out.data[idx] = rgba[0];
        out.data[idx + 1] = rgba[1];
        out.data[idx + 2] = rgba[2];
        out.data[idx + 3] = rgba[3];
      } else {
        out.data[idx] = 0;
        out.data[idx + 1] = 0;
        out.data[idx + 2] = 0;
        out.data[idx + 3] = 0;
      }
    }
  }
}

