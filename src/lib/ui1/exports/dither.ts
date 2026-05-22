/**
 * Standalone Floyd-Steinberg error-diffusion dithering for high-quality GIF exports.
 * 
 * Replaces pure nearest-neighbor color snapping (which causes banding in gradients)
 * with pixel-by-pixel quantization error diffusion to neighboring pixels.
 */

export type DitherOptions = {
  /** Dithering intensity between 0 and 1. Default is 1.0 (full strength). */
  strength?: number;
};

/**
 * Optimized helper to find the closest RGB palette color by Euclidean distance squared.
 */
export function nearestColorIndexRGB(
  r: number,
  g: number,
  b: number,
  palette: number[][]
): number {
  let minDistance = Infinity;
  let minIndex = 0;
  
  for (let i = 0; i < palette.length; i++) {
    const pr = palette[i][0];
    const pg = palette[i][1];
    const pb = palette[i][2];
    
    const dr = pr - r;
    const dg = pg - g;
    const db = pb - b;
    
    const distSq = dr * dr + dg * dg + db * db;
    if (distSq < minDistance) {
      minDistance = distSq;
      minIndex = i;
    }
  }
  
  return minIndex;
}

/**
 * Applies a 256-color palette to an RGBA pixel buffer using Floyd-Steinberg error diffusion.
 * 
 * @param rgba The raw RGBA pixels (Uint8Array or Uint8ClampedArray).
 * @param palette The 256-color palette (array of RGB color coordinates [r,g,b]).
 * @param width The image width in pixels.
 * @param height The image height in pixels.
 * @param opts Options for dithering.
 * @returns An indexed Uint8Array suitable for writeFrame in gifenc.
 */
export function applyPaletteWithDither(
  rgba: Uint8Array | Uint8ClampedArray,
  palette: number[][],
  width: number,
  height: number,
  opts: DitherOptions = {}
): Uint8Array {
  const len = width * height;
  const indexed = new Uint8Array(len);
  const strength = opts.strength ?? 1.0;
  
  // Create a mutable floating-point buffer for color channels to prevent precision loss and clipping during diffusion.
  const pixels = new Float32Array(len * 3);
  for (let i = 0; i < len; i++) {
    pixels[i * 3 + 0] = rgba[i * 4 + 0]; // R
    pixels[i * 3 + 1] = rgba[i * 4 + 1]; // G
    pixels[i * 3 + 2] = rgba[i * 4 + 2]; // B
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const pxIdx = i * 3;
      
      // Extract color
      let r = pixels[pxIdx + 0];
      let g = pixels[pxIdx + 1];
      let b = pixels[pxIdx + 2];
      
      // Clamp values to [0, 255] range for quantization
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      
      // Find closest color in the palette
      const idx = nearestColorIndexRGB(r, g, b, palette);
      indexed[i] = idx;
      
      // Retrieve original color coordinates of the chosen color
      const pr = palette[idx][0];
      const pg = palette[idx][1];
      const pb = palette[idx][2];
      
      // Calculate quantization error multiplied by dither strength
      const er = (r - pr) * strength;
      const eg = (g - pg) * strength;
      const eb = (b - pb) * strength;
      
      // Diffuse the error to adjacent pixels (Floyd-Steinberg kernel coefficients)
      // x + 1, y      -> 7/16
      if (x + 1 < width) {
        const nIdx = (y * width + (x + 1)) * 3;
        pixels[nIdx + 0] += er * (7 / 16);
        pixels[nIdx + 1] += eg * (7 / 16);
        pixels[nIdx + 2] += eb * (7 / 16);
      }
      
      if (y + 1 < height) {
        // x - 1, y + 1  -> 3/16
        if (x - 1 >= 0) {
          const nIdx = ((y + 1) * width + (x - 1)) * 3;
          pixels[nIdx + 0] += er * (3 / 16);
          pixels[nIdx + 1] += eg * (3 / 16);
          pixels[nIdx + 2] += eb * (3 / 16);
        }
        
        // x, y + 1      -> 5/16
        {
          const nIdx = ((y + 1) * width + x) * 3;
          pixels[nIdx + 0] += er * (5 / 16);
          pixels[nIdx + 1] += eg * (5 / 16);
          pixels[nIdx + 2] += eb * (5 / 16);
        }
        
        // x + 1, y + 1  -> 1/16
        if (x + 1 < width) {
          const nIdx = ((y + 1) * width + (x + 1)) * 3;
          pixels[nIdx + 0] += er * (1 / 16);
          pixels[nIdx + 1] += eg * (1 / 16);
          pixels[nIdx + 2] += eb * (1 / 16);
        }
      }
    }
  }
  
  return indexed;
}
