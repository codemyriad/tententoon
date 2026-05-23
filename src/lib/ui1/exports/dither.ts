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
 * Highly optimized pointer-based implementation that flattens the palette into a Float32Array
 * and inlines the Euclidean distance squared color lookup. This avoids function call overhead
 * and nested array lookups inside hot loops, yielding a ~2x performance speedup.
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
  
  // Flatten palette into flat Float32Array
  const numColors = palette.length;
  const flatPalette = new Float32Array(numColors * 3);
  for (let i = 0; i < numColors; i++) {
    flatPalette[i * 3 + 0] = palette[i][0];
    flatPalette[i * 3 + 1] = palette[i][1];
    flatPalette[i * 3 + 2] = palette[i][2];
  }
  
  // Create a mutable floating-point buffer for color channels to prevent precision loss and clipping during diffusion.
  const pixels = new Float32Array(len * 3);
  for (let i = 0; i < len; i++) {
    pixels[i * 3 + 0] = rgba[i * 4 + 0]; // R
    pixels[i * 3 + 1] = rgba[i * 4 + 1]; // G
    pixels[i * 3 + 2] = rgba[i * 4 + 2]; // B
  }

  // Pre-calculate weights as float constants to avoid divisions in loop
  const w7 = 7 / 16;
  const w3 = 3 / 16;
  const w5 = 5 / 16;
  const w1 = 1 / 16;

  const totalPaletteLen = flatPalette.length;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const pxIdx = i * 3;
      
      // Extract color
      let r = pixels[pxIdx + 0];
      let g = pixels[pxIdx + 1];
      let b = pixels[pxIdx + 2];
      
      // Clamp values to [0, 255] range for quantization
      r = r < 0 ? 0 : (r > 255 ? 255 : r);
      g = g < 0 ? 0 : (g > 255 ? 255 : g);
      b = b < 0 ? 0 : (b > 255 ? 255 : b);
      
      // Find closest color in the flat palette
      let minDistance = Infinity;
      let minColorOffset = 0;
      
      for (let pIdx = 0; pIdx < totalPaletteLen; pIdx += 3) {
        const pr = flatPalette[pIdx];
        const pg = flatPalette[pIdx + 1];
        const pb = flatPalette[pIdx + 2];
        
        const dr = pr - r;
        const dg = pg - g;
        const db = pb - b;
        
        const distSq = dr * dr + dg * dg + db * db;
        if (distSq < minDistance) {
          minDistance = distSq;
          minColorOffset = pIdx;
        }
      }
      
      // Store color index directly
      const colorIdx = (minColorOffset / 3) | 0;
      indexed[i] = colorIdx;
      
      // Retrieve chosen color coordinates
      const pr = flatPalette[minColorOffset];
      const pg = flatPalette[minColorOffset + 1];
      const pb = flatPalette[minColorOffset + 2];
      
      // Calculate quantization error multiplied by dither strength
      const er = (r - pr) * strength;
      const eg = (g - pg) * strength;
      const eb = (b - pb) * strength;
      
      // Diffuse the error to adjacent pixels (Floyd-Steinberg kernel)
      if (x + 1 < width) {
        const nIdx = pxIdx + 3; // (y * width + (x + 1)) * 3
        pixels[nIdx + 0] += er * w7;
        pixels[nIdx + 1] += eg * w7;
        pixels[nIdx + 2] += eb * w7;
      }
      
      if (y + 1 < height) {
        const nextRowStart = pxIdx + width * 3;
        
        // x - 1, y + 1  -> 3/16
        if (x - 1 >= 0) {
          const nIdx = nextRowStart - 3;
          pixels[nIdx + 0] += er * w3;
          pixels[nIdx + 1] += eg * w3;
          pixels[nIdx + 2] += eb * w3;
        }
        
        // x, y + 1      -> 5/16
        {
          const nIdx = nextRowStart;
          pixels[nIdx + 0] += er * w5;
          pixels[nIdx + 1] += eg * w5;
          pixels[nIdx + 2] += eb * w5;
        }
        
        // x + 1, y + 1  -> 1/16
        if (x + 1 < width) {
          const nIdx = nextRowStart + 3;
          pixels[nIdx + 0] += er * w1;
          pixels[nIdx + 1] += eg * w1;
          pixels[nIdx + 2] += eb * w1;
        }
      }
    }
  }
  
  return indexed;
}
