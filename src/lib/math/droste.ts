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

/**
 * Clamp a rectangle (aspect-locked to image aspect) so it stays inside the
 * image. Knobs:
 *   minSFactor — nest must be at least slightly smaller than the image
 *                (S ≥ 1.05) so there's a real Droste step to look at.
 *   maxS       — nest can be at most 1/maxS of the image. 200 gives ample
 *                headroom (a nest as small as 0.5% of the image's long
 *                side); the rest of the pipeline copes with arbitrary S.
 */
export function clampRect(
  image: { width: number; height: number },
  rect: Rect,
  minSFactor = 1.05,
  maxS = 200
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

/** Clamp a crop to image bounds (no aspect constraint). */
export function clampCrop(
  image: { width: number; height: number },
  crop: Rect
): Rect {
  const w = Math.max(1, Math.min(image.width, crop.w));
  const h = Math.max(1, Math.min(image.height, crop.h));
  const x = Math.max(0, Math.min(image.width - w, crop.x));
  const y = Math.max(0, Math.min(image.height - h, crop.y));
  return { x, y, w, h };
}

/**
 * Shift a nest minimally so it lies entirely inside the given crop.
 * Used to keep the nest constrained when the crop is treated as the
 * stable working frame (translating the nest doesn't move the crop).
 */
export function ensureNestInside(nest: Rect, crop: Rect): Rect {
  const x = Math.max(crop.x, Math.min(crop.x + crop.w - nest.w, nest.x));
  const y = Math.max(crop.y, Math.min(crop.y + crop.h - nest.h, nest.y));
  return { ...nest, x, y };
}

/**
 * Build the working-image crop for a free-aspect nest: the largest
 * rectangle inside the image with the nest's aspect, big enough to
 * contain the nest, anchored on `prev`'s centre (when resizing because
 * the aspect changed) or on the nest's centre (initial fit).
 *
 * This is what gives the Droste math something coherent to chew on
 * when the user picks a nest whose aspect doesn't match the image:
 * the renderer operates on the crop, not the full image, so the
 * shrink factor S = crop.w / nest.w is honoured in both dimensions.
 */
export function fitCropToNest(
  image: { width: number; height: number },
  nest: Rect,
  prev: Rect | null = null
): Rect {
  const aspect = nest.w / nest.h;
  let cw: number;
  let ch: number;
  if (image.width / image.height > aspect) {
    ch = image.height;
    cw = ch * aspect;
  } else {
    cw = image.width;
    ch = cw / aspect;
  }
  if (cw < nest.w || ch < nest.h) {
    const scale = Math.max(nest.w / cw, nest.h / ch);
    cw *= scale;
    ch *= scale;
  }
  const anchor = prev
    ? { x: prev.x + prev.w / 2, y: prev.y + prev.h / 2 }
    : { x: nest.x + nest.w / 2, y: nest.y + nest.h / 2 };
  return clampCrop(image, { x: anchor.x - cw / 2, y: anchor.y - ch / 2, w: cw, h: ch });
}
