declare module 'gifenc' {
  type Format = 'rgb444' | 'rgb565' | 'rgba4444';

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: {
      format?: Format;
      clearAlpha?: boolean;
      clearAlphaColor?: number;
      clearAlphaThreshold?: number;
      oneBitAlpha?: boolean | number;
      useSqrt?: boolean;
    }
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: Format
  ): Uint8Array;

  export type GIFEncoderInstance = {
    reset(): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    readonly buffer: ArrayBuffer;
    writeHeader(): void;
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        transparent?: boolean;
        transparentIndex?: number;
        delay?: number;
        palette?: number[][] | null;
        repeat?: number;
        colorDepth?: number;
        dispose?: number;
        first?: boolean;
      }
    ): void;
  };

  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): GIFEncoderInstance;
}
