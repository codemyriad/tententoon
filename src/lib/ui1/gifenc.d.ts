/**
 * Minimal type declarations for `gifenc`. The package ships JS only; we
 * lean on what we actually call. Bump these if we use more of the API.
 */
declare module 'gifenc' {
  export type Palette = Uint8Array | Uint8ClampedArray | number[][];

  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array | Uint8ClampedArray,
      width: number,
      height: number,
      opts?: { palette?: Palette; delay?: number; transparent?: boolean; transparentIndex?: number; dispose?: number; first?: boolean }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): GIFEncoderInstance;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors?: number, opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean; clearAlpha?: boolean }): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: 'rgb565' | 'rgb444' | 'rgba4444'): Uint8Array;
}
