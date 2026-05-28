import { describe, it, expect } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import jpeg from 'jpeg-js';
import { fitCropToNest, type Rect } from '../../src/lib/math/droste';
import type { Pixels } from '../../src/lib/math/transforms';
import {
  buildPanelGeometry,
  renderLogPanel,
  renderRotatedLogPanel,
  renderEscherStill,
  panelURef,
  panelPxPerUnit,
  type PanelImage
} from '../../src/lib/ui1/pipeline-panels';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

/** Decode the committed example image into an ImageData-shaped buffer. */
function loadExample(): Pixels {
  const buf = readFileSync(resolve(repoRoot, 'public/Droste_1260359-nevit.jpg'));
  const raw = jpeg.decode(buf, { useTArray: true });
  return { width: raw.width, height: raw.height, data: raw.data } as unknown as Pixels;
}

/**
 * The known-good free-aspect selection the legacy view shipped as its
 * default for this 1280×960 image (S ≈ 2.11). The crop is derived from the
 * nest exactly as the editor does it (fitCropToNest), so this exercises the
 * full crop pipeline rather than a degenerate whole-image case.
 */
const NEST: Rect = { x: 343.2, y: 334.7, w: 583.5, h: 454.9 };

/** Fraction of fully-opaque pixels in a panel. */
function opaqueFraction(img: PanelImage): number {
  let n = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 250) n++;
  return n / (img.width * img.height);
}

/** Luminance spread — proves the panel has real image structure, not a flat fill. */
function luminanceSpread(img: PanelImage): number {
  let min = 255;
  let max = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 250) continue;
    const l = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    if (l < min) min = l;
    if (l > max) max = l;
  }
  return max - min;
}

/** Write a panel to a JPEG under local-research-dont-commit for eyeballing. */
function dump(name: string, img: PanelImage): void {
  const dir = resolve(repoRoot, 'local-research-dont-commit/pipeline-panels');
  mkdirSync(dir, { recursive: true });
  const enc = jpeg.encode({ data: img.data, width: img.width, height: img.height }, 90);
  writeFileSync(resolve(dir, name), enc.data);
}

describe('pipeline-panels', () => {
  const pixels = loadExample();
  const image = { width: pixels.width, height: pixels.height };
  const crop = fitCropToNest(image, NEST, null);
  const geom = buildPanelGeometry(NEST, crop);

  it('derives sane crop-local geometry (S ≈ 2.11)', () => {
    expect(geom).not.toBeNull();
    expect(geom!.S).toBeGreaterThan(2.0);
    expect(geom!.S).toBeLessThan(2.2);
    expect(geom!.ctx.logS).toBeCloseTo(Math.log(geom!.S), 10);
    expect(geom!.R0).toBeGreaterThan(0);
    // Limit point sits inside the crop.
    expect(geom!.ctx.cx).toBeGreaterThan(0);
    expect(geom!.ctx.cx).toBeLessThan(crop.w);
    expect(geom!.ctx.cy).toBeGreaterThan(0);
    expect(geom!.ctx.cy).toBeLessThan(crop.h);
  });

  it('returns null geometry for a degenerate selection', () => {
    expect(buildPanelGeometry({ x: 0, y: 0, w: 0, h: 0 }, crop)).toBeNull();
  });

  const uRef = panelURef(geom!.ctx.rMax);

  it('renders the log panel filling the whole cell (no black margins)', () => {
    const W = 320;
    const H = 320;
    const ppu = panelPxPerUnit('log', geom!.ctx.logS, H);
    const img = renderLogPanel(pixels, geom!.ctx, ppu, uRef, W, H);
    expect(img.width).toBe(W);
    expect(img.height).toBe(H);
    // Fills the entire cell — every pixel folds to a valid ring.
    expect(opaqueFraction(img)).toBeGreaterThan(0.999);
    expect(luminanceSpread(img)).toBeGreaterThan(40);
    dump('1-log.jpg', img);
  });

  it('log panel is horizontally periodic with period logS·pxPerUnit', () => {
    const W = 360;
    const H = 360;
    const ppu = panelPxPerUnit('log', geom!.ctx.logS, H);
    const img = renderLogPanel(pixels, geom!.ctx, ppu, uRef, W, H);
    const periodPx = Math.round(geom!.ctx.logS * ppu); // one logS shift in px
    let diff = 0;
    let count = 0;
    for (let y = 0; y < H; y += 7) {
      for (let x = 0; x + periodPx < W; x += 11) {
        const a = (y * W + x) * 4;
        const b = (y * W + x + periodPx) * 4;
        diff += Math.abs(img.data[a] - img.data[b]);
        count++;
      }
    }
    const meanDiff = diff / count;
    // A one-period horizontal shift is the Droste identity → near-identical
    // (not pixel-exact: adjacent columns fold to different-resolution rings).
    expect(meanDiff).toBeLessThan(40);
  });

  it('renders the rotated-log panel filling the whole cell', () => {
    const W = 320;
    const H = 320;
    const ppu = panelPxPerUnit('rotlog', geom!.ctx.logS, H);
    const img = renderRotatedLogPanel(pixels, geom!.ctx, ppu, uRef, W, H);
    expect(opaqueFraction(img)).toBeGreaterThan(0.999);
    expect(luminanceSpread(img)).toBeGreaterThan(40);
    dump('2-rotated-log.jpg', img);
  });

  it('renders the tententoon still matching the live map (t=0)', () => {
    const W = 360;
    const H = Math.round(W * (crop.h / crop.w));
    const scale = W / crop.w;
    const img = renderEscherStill(pixels, geom!.ctx, geom!.R0, scale, W, H);
    expect(img.width).toBe(W);
    expect(img.height).toBe(H);
    // The spiral fills most of the disk; a transparent margin near corners
    // and the limit point is expected, so demand a healthy majority opaque.
    expect(opaqueFraction(img)).toBeGreaterThan(0.6);
    expect(luminanceSpread(img)).toBeGreaterThan(40);
    dump('3-tententoon.jpg', img);
  });

  it('produces tiny but valid output for sub-2px panels (no crash)', () => {
    const ppu = panelPxPerUnit('log', geom!.ctx.logS, 1);
    const img = renderLogPanel(pixels, geom!.ctx, ppu, uRef, 1, 1);
    expect(img.width).toBeGreaterThanOrEqual(1);
    expect(img.data.length).toBe(img.width * img.height * 4);
  });
});
