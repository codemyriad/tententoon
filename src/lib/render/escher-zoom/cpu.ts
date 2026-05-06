/**
 * CPU implementation of the Escher spiral-zoom panel.
 *
 * Same algorithm as the original EscherZoomPanel JS loop: precompute the
 * frame-invariant per-pixel work into typed arrays, render frames by one
 * mul + Droste-folded sample per pixel, with adaptive supersampling for
 * pixels whose source footprint is larger than a canvas pixel.
 *
 * Lives behind the Renderer interface so the panel can swap us out for the
 * WebGL2 backend without changing call sites.
 */

import { sampleDroste, SS_OFFSETS_4, SS_OFFSETS_16 } from '../../math/transforms';
import type { EscherZoomInput, EscherZoomRenderer } from './input';

type Cache = {
  W: number;
  H: number;
  scale: number;
  k: number;
  lnR0: number;
  baseR: Float32Array;
  cosPhi: Float32Array;
  sinPhi: Float32Array;
  valid: Uint8Array;
  ssTier: Uint8Array;
  imageData: ImageData;
};

export class CpuEscherZoomRenderer implements EscherZoomRenderer {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private ctx2d: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private cache: Cache | null = null;
  /** Cache key — invalidate when geometry, R₀, or canvas dims change. */
  private cacheKey = '';

  init(canvas: HTMLCanvasElement | OffscreenCanvas): void {
    this.canvas = canvas;
    // Type-cast: 2D context type unifies fine for our usage.
    this.ctx2d = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!this.ctx2d) throw new Error('canvas 2d context unavailable');
  }

  render(input: EscherZoomInput): void {
    if (!this.canvas || !this.ctx2d) return;
    const { pixels, ctx: droste, R0, W, H, scale, t } = input;

    if (this.canvas.width !== W) this.canvas.width = W;
    if (this.canvas.height !== H) this.canvas.height = H;

    const key = `${W}x${H}@${scale}|${droste.cx},${droste.cy}|${droste.logS}|${droste.rMax}|${R0}|${droste.cropX},${droste.cropY}|${droste.sampleScale}`;
    if (this.cacheKey !== key || !this.cache) {
      this.cache = this.buildCache(input);
      this.cacheKey = key;
    }
    const c = this.cache;
    const expTShift = Math.exp(t * droste.logS);
    const { cx, cy } = droste;
    const data = c.imageData.data;
    const rgba: [number, number, number, number] = [0, 0, 0, 0];

    const sampleAt = (px: number, py: number, ox: number, oy: number): boolean => {
      const x = (px + ox) / scale;
      const y = (py + oy) / scale;
      const dx = x - cx;
      const dy = y - cy;
      const R2 = dx * dx + dy * dy;
      if (R2 < 1e-12) return false;
      const lnR = 0.5 * Math.log(R2);
      const Phi = Math.atan2(dy, dx);
      const newPhi = Phi - c.k * (lnR - c.lnR0);
      const r = Math.exp(lnR + c.k * Phi) * expTShift;
      const sx = cx + r * Math.cos(newPhi);
      const sy = cy + r * Math.sin(newPhi);
      return sampleDroste(pixels, droste, sx, sy, rgba);
    };

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const i = py * W + px;
        const idx = i << 2;
        if (!c.valid[i]) {
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
          continue;
        }
        const tier = c.ssTier[i];
        if (tier === 0) {
          const r = c.baseR[i] * expTShift;
          const sx = cx + r * c.cosPhi[i];
          const sy = cy + r * c.sinPhi[i];
          if (sampleDroste(pixels, droste, sx, sy, rgba)) {
            data[idx] = rgba[0]; data[idx + 1] = rgba[1];
            data[idx + 2] = rgba[2]; data[idx + 3] = rgba[3];
          } else {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
          }
        } else {
          const offsets = tier === 1 ? SS_OFFSETS_4 : SS_OFFSETS_16;
          let r = 0, g = 0, b = 0, a = 0, count = 0;
          for (let s = 0; s < offsets.length; s++) {
            if (sampleAt(px, py, offsets[s][0], offsets[s][1])) {
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
    }
    this.ctx2d.putImageData(c.imageData, 0, 0);
  }

  dispose(): void {
    this.canvas = null;
    this.ctx2d = null;
    this.cache = null;
  }

  private buildCache(input: EscherZoomInput): Cache {
    const { ctx: droste, R0, W, H, scale } = input;
    const N = W * H;
    const k = droste.logS / (2 * Math.PI);
    const lnR0 = Math.log(Math.max(R0, 1e-9));
    const lnRmax = Math.log(droste.rMax);
    const alphaMag = Math.sqrt(1 + k * k);
    const { cx, cy } = droste;

    const baseR = new Float32Array(N);
    const cosPhi = new Float32Array(N);
    const sinPhi = new Float32Array(N);
    const valid = new Uint8Array(N);
    const ssTier = new Uint8Array(N);

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const i = py * W + px;
        const dx = px / scale - cx;
        const dy = py / scale - cy;
        const R2 = dx * dx + dy * dy;
        if (R2 < 1e-12) continue;
        const lnR = 0.5 * Math.log(R2);
        const Phi = Math.atan2(dy, dx);
        const baseLnR = lnR + k * Phi;
        const newPhi = Phi - k * (lnR - lnR0);
        baseR[i] = Math.exp(baseLnR);
        cosPhi[i] = Math.cos(newPhi);
        sinPhi[i] = Math.sin(newPhi);
        valid[i] = 1;
        const n = Math.max(0, Math.floor((lnRmax - baseLnR) / droste.logS));
        const fp = (alphaMag * Math.exp(k * Phi + n * droste.logS)) / scale;
        const fp2 = fp * fp;
        ssTier[i] = fp2 > 4 ? 2 : fp2 > 1 ? 1 : 0;
      }
    }
    return {
      W, H, scale, k, lnR0,
      baseR, cosPhi, sinPhi, valid, ssTier,
      imageData: new ImageData(W, H)
    };
  }
}
