import type { Rect } from '../math/droste';

export type DrosteFrameParams = {
  W: number;
  H: number;
  sx: number;
  sy: number;
  Rx: number;
  Ry: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
};

export function workingCrop(
  image: { width: number; height: number },
  crop: Rect | null
): Rect {
  return crop ?? { x: 0, y: 0, w: image.width, h: image.height };
}

/**
 * Parameters for the regular nested-image Droste renderer.
 *
 * All geometry is crop-local: the crop is the working image, and the
 * selected nest is translated into that coordinate space. The returned
 * crop fields preserve the original-image source rectangle for the
 * eventual drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) call.
 */
export function buildDrosteFrameParams(
  image: { width: number; height: number },
  rect: Rect,
  crop: Rect | null
): DrosteFrameParams | null {
  if (rect.w <= 0 || rect.h <= 0) return null;
  const c = workingCrop(image, crop);
  const W = c.w;
  const H = c.h;
  const Rx = rect.x - c.x;
  const Ry = rect.y - c.y;
  if (W <= 0 || H <= 0 || Rx < 0 || Ry < 0 || Rx + rect.w > W || Ry + rect.h > H) {
    return null;
  }
  const sx = rect.w / W;
  const sy = rect.h / H;
  if (!(sx > 0 && sx < 1 && sy > 0 && sy < 1)) return null;
  return {
    W,
    H,
    sx,
    sy,
    Rx,
    Ry,
    cropX: c.x,
    cropY: c.y,
    cropW: c.w,
    cropH: c.h
  };
}
