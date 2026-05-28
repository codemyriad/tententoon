/**
 * Shared, single-entry cache for the source image's pixel data.
 *
 * The pipeline view mounts three panels that all sample the same image. Each
 * extractPixels() is a full drawImage + getImageData of the (often large)
 * source, so without sharing we'd pay it three times on every image change.
 * Keyed by bitmap identity — a new image (or null) busts the cache.
 */

import { extractPixels } from './render';

let cachedBitmap: ImageBitmap | null = null;
let cachedPixels: ImageData | null = null;

export function pixelsFor(image: ImageBitmap): ImageData {
  if (cachedBitmap !== image || !cachedPixels) {
    cachedPixels = extractPixels(image);
    cachedBitmap = image;
  }
  return cachedPixels;
}
