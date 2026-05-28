import { describe, expect, it } from 'vitest';

import { buildDrosteFrameParams, workingCrop } from '../../src/lib/ui1/droste-frame';

describe('regular Droste frame params', () => {
  it('falls back to the whole image when there is no working crop', () => {
    const image = { width: 800, height: 600 };
    const rect = { x: 200, y: 150, w: 200, h: 150 };

    expect(buildDrosteFrameParams(image, rect, null)).toMatchObject({
      W: 800,
      H: 600,
      sx: 0.25,
      sy: 0.25,
      Rx: 200,
      Ry: 150,
      cropX: 0,
      cropY: 0,
      cropW: 800,
      cropH: 600
    });
  });

  it('translates the nest into crop-local coordinates', () => {
    const image = { width: 1000, height: 800 };
    const crop = { x: 140, y: 90, w: 500, h: 375 };
    const rect = { x: 240, y: 165, w: 125, h: 93.75 };

    expect(buildDrosteFrameParams(image, rect, crop)).toMatchObject({
      W: 500,
      H: 375,
      sx: 0.25,
      sy: 0.25,
      Rx: 100,
      Ry: 75,
      cropX: 140,
      cropY: 90,
      cropW: 500,
      cropH: 375
    });
  });

  it('rejects a nest that falls outside the crop working frame', () => {
    const image = { width: 1000, height: 800 };
    const crop = { x: 140, y: 90, w: 500, h: 375 };
    const rect = { x: 80, y: 165, w: 125, h: 93.75 };

    expect(buildDrosteFrameParams(image, rect, crop)).toBeNull();
  });

  it('uses the source crop as the drawImage source rectangle', () => {
    const image = { width: 1000, height: 800 };
    const crop = { x: 100, y: 50, w: 600, h: 300 };

    expect(workingCrop(image, crop)).toEqual(crop);
  });
});
