/**
 * GIF encoding worker.
 * 
 * Instead of quantizing and encoding each frame independently (which causes color flickering
 * and wastes the color budget), this worker accumulates all frames in memory, constructs
 * a single unified global palette from across the animation timeline, and then applies
 * Floyd-Steinberg error-diffusion dithering to each frame.
 */

import { GIFEncoder, quantize } from 'gifenc';
import { applyPaletteWithDither } from './dither';

type Inbound =
  | { type: 'start'; delayMs: number }
  | {
      type: 'frame';
      index: number;
      width: number;
      height: number;
      rgba: ArrayBuffer;
    }
  | { type: 'finish' };

type Outbound =
  | { type: 'frame-encoded'; index: number }
  | { type: 'done'; bytes: ArrayBuffer }
  | { type: 'error'; error: string };

type FrameData = {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  index: number;
};

let enc: ReturnType<typeof GIFEncoder> | null = null;
let delayMs = 80;
let frames: FrameData[] = [];

function post(msg: Outbound, transfer: Transferable[] = []): void {
  (self as unknown as Worker).postMessage(msg, transfer);
}

self.onmessage = (e: MessageEvent<Inbound>) => {
  const msg = e.data;
  try {
    if (msg.type === 'start') {
      enc = GIFEncoder();
      delayMs = msg.delayMs;
      frames = [];
    } else if (msg.type === 'frame') {
      if (!enc) throw new Error('encoder not started');
      
      // Store the frame data in memory for unified batch processing
      frames.push({
        rgba: new Uint8ClampedArray(msg.rgba),
        width: msg.width,
        height: msg.height,
        index: msg.index
      });
    } else if (msg.type === 'finish') {
      if (!enc) throw new Error('encoder not started');
      if (frames.length === 0) throw new Error('no frames to encode');
      
      // Sort frames by index to ensure correct chronological ordering
      frames.sort((a, b) => a.index - b.index);
      
      // 1. Construct a unified global palette
      // Sample pixels across a maximum of 10 evenly spaced frames to build a representative color table
      const sampleStep = Math.max(1, Math.floor(frames.length / 10));
      const samplePixels: number[] = [];
      
      for (let f = 0; f < frames.length; f += sampleStep) {
        const frame = frames[f];
        const rgba = frame.rgba;
        // Sample every 4th pixel (16 bytes stride: 4 channels * 4) to keep quantization fast but accurate
        for (let i = 0; i < rgba.length; i += 16) {
          samplePixels.push(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
        }
      }
      
      const sampleBuf = new Uint8Array(samplePixels);
      // 'rgb565' is the high-quality format with 65,536 color bins
      const globalPalette = quantize(sampleBuf, 256, { format: 'rgb565' });
      
      // 2. Dither and encode each frame sequentially
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        
        // Apply Floyd-Steinberg dithering with the global palette in rgb565 format
        const indexed = applyPaletteWithDither(
          frame.rgba,
          globalPalette,
          frame.width,
          frame.height,
          { strength: 0.8 }
        );
        
        // The first frame establishes the Global Color Table (global palette) in the GIF.
        // Subsequent frames pass `palette: null` so they reuse the global palette, saving space.
        enc.writeFrame(indexed, frame.width, frame.height, {
          palette: i === 0 ? globalPalette : null,
          delay: delayMs
        });
        
        // Notify the main thread of progress so the progress bar updates smoothly
        post({ type: 'frame-encoded', index: frame.index });
      }
      
      // 3. Finalize encoding and send back the results
      enc.finish();
      const bytes = enc.bytes();
      const buf = bytes.slice().buffer as ArrayBuffer;
      post({ type: 'done', bytes: buf }, [buf]);
      
      // Clean up references to free memory
      enc = null;
      frames = [];
    }
  } catch (err) {
    post({ type: 'error', error: err instanceof Error ? err.message : String(err) });
  }
};
