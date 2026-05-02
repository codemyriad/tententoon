/**
 * Droste geometry: the data we extract from the user's "self-similar
 * rectangle" choice on the source image.
 *
 * The user picks a rectangle (x, y, w, h) inside a (W, H) image. We treat
 * the image as if it were Droste-self-similar: the inner rectangle holds a
 * shrunk copy of the whole image, which holds an even smaller copy in its
 * inner rectangle, and so on forever. The shrink map is
 *
 *     f(p) = (x, y) + p / S,   S = W / w   (image-aspect-locked, so H/h = S too)
 *
 * It has a unique fixed point — the limit point c of the Droste — found by
 * solving f(c) = c:
 *
 *     c = (x, y) · S / (S − 1)
 *
 * In log polar coords around c, scaling by S is a horizontal shift by
 * logS, and a full revolution is a vertical shift by 2π. That rectangular
 * (logS, 2π) lattice is the central object the visualisation pipeline
 * reveals.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export type DrosteGeometry = {
  /** Linear shrink factor S = W/w. */
  S: number;
  /** ln S — horizontal lattice period in log space. */
  logS: number;
  /** Limit point: the fixed point of the shrink map (in source pixel coords). */
  limit: Point;
  /** Largest |corner − c|; the outer radius of the source disk. */
  rMax: number;
};

export function drosteGeometry(
  image: { width: number; height: number },
  rect: Rect
): DrosteGeometry {
  const S = image.width / rect.w;
  const logS = Math.log(S);
  const k = S / (S - 1);
  const limit: Point = { x: rect.x * k, y: rect.y * k };
  const rMax = maxCornerDistance(image.width, image.height, limit);
  return { S, logS, limit, rMax };
}

function maxCornerDistance(W: number, H: number, c: Point): number {
  let m = 0;
  for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    const r = Math.hypot(x - c.x, y - c.y);
    if (r > m) m = r;
  }
  return m;
}

/** Clamp a rectangle (aspect-locked to image aspect) so it stays inside the image. */
export function clampRect(
  image: { width: number; height: number },
  rect: Rect,
  minSFactor = 1.05,
  maxS = 30
): Rect {
  const aspect = image.width / image.height;
  const minW = image.width / maxS;
  const maxW = image.width / minSFactor;
  const w = Math.max(minW, Math.min(maxW, rect.w));
  const h = w / aspect;
  const x = Math.max(0, Math.min(image.width - w, rect.x));
  const y = Math.max(0, Math.min(image.height - h, rect.y));
  return { x, y, w, h };
}
