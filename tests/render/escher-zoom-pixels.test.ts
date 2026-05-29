import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EscherZoomInput } from '../../src/lib/render/escher-zoom/input';
import { WebGL2EscherZoomRenderer } from '../../src/lib/render/escher-zoom/webgl2';
import { WorkerEscherZoomRenderer } from '../../src/lib/render/escher-zoom/worker-bridge';

vi.mock('twgl.js', () => ({
  createProgramInfo: () => ({ program: {} }),
  createBufferInfoFromArrays: () => ({
    attribs: { a_pos: { buffer: {} } },
    indices: undefined
  }),
  setBuffersAndAttributes: () => undefined,
  setUniforms: () => undefined,
  drawBufferInfo: () => undefined
}));

function makePixels(seed: number): ImageData {
  const data = new Uint8ClampedArray(2 * 2 * 4);
  data.fill(seed);
  return { width: 2, height: 2, data } as ImageData;
}

function makeInput(pixels: ImageData, t = 0): EscherZoomInput {
  return {
    pixels,
    ctx: {
      cx: 1,
      cy: 1,
      logS: Math.log(2),
      rMax: 3,
      W: 2,
      H: 2,
      cropX: 0,
      cropY: 0,
      sampleScale: 1
    },
    R0: 1,
    W: 4,
    H: 4,
    scale: 1,
    t
  };
}

function makeGl() {
  return {
    TEXTURE_2D: 0x0de1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR_MIPMAP_LINEAR: 0x2703,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    TRIANGLE_STRIP: 0x0005,
    getExtension: vi.fn(() => null),
    getParameter: vi.fn(() => 1),
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    pixelStorei: vi.fn(),
    texImage2D: vi.fn(),
    generateMipmap: vi.fn(),
    texParameteri: vi.fn(),
    viewport: vi.fn(),
    useProgram: vi.fn(),
    deleteTexture: vi.fn(),
    deleteProgram: vi.fn(),
    deleteBuffer: vi.fn()
  } as unknown as WebGL2RenderingContext & {
    texImage2D: ReturnType<typeof vi.fn>;
    deleteTexture: ReturnType<typeof vi.fn>;
  };
}

function makeCanvas(gl: WebGL2RenderingContext): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => gl),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as HTMLCanvasElement;
}

describe('WebGL2 Escher zoom pixel uploads', () => {
  it('uploads a new texture for a different same-size ImageData object', () => {
    const gl = makeGl();
    const renderer = new WebGL2EscherZoomRenderer();

    renderer.init(makeCanvas(gl));
    renderer.render(makeInput(makePixels(1)));
    renderer.render(makeInput(makePixels(2), 0.25));

    expect(gl.texImage2D).toHaveBeenCalledTimes(2);
  });

  it('keeps animation frames fast by reusing one uploaded ImageData object', () => {
    const gl = makeGl();
    const renderer = new WebGL2EscherZoomRenderer();
    const pixels = makePixels(1);

    renderer.init(makeCanvas(gl));
    renderer.render(makeInput(pixels));
    renderer.render(makeInput(pixels, 0.25));

    expect(gl.texImage2D).toHaveBeenCalledTimes(1);
  });
});

class FakeHTMLCanvasElement {
  transferControlToOffscreen = vi.fn(() => ({}));
}

type WorkerMessage = { type: string; [key: string]: unknown };

class FakeWorker {
  static instances: FakeWorker[] = [];

  readonly messages: WorkerMessage[] = [];
  readonly terminate = vi.fn();
  private readonly handlers = new Map<string, Array<(event: { data: WorkerMessage }) => void>>();

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, handler: (event: { data: WorkerMessage }) => void): void {
    const handlers = this.handlers.get(type) ?? [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }

  postMessage(message: WorkerMessage): void {
    this.messages.push(message);
    if (message.type === 'init') this.emit('message', { type: 'ready' });
  }

  private emit(type: string, data: WorkerMessage): void {
    this.handlers.get(type)?.forEach((handler) => handler({ data }));
  }
}

describe('worker Escher zoom pixel uploads', () => {
  afterEach(() => {
    FakeWorker.instances = [];
    vi.unstubAllGlobals();
  });

  it('sends pixels again for a different same-size ImageData object', async () => {
    vi.stubGlobal('HTMLCanvasElement', FakeHTMLCanvasElement);
    vi.stubGlobal('Worker', FakeWorker);
    const renderer = new WorkerEscherZoomRenderer({ onFailure: vi.fn() });

    await renderer.init(new FakeHTMLCanvasElement() as unknown as HTMLCanvasElement);
    renderer.render(makeInput(makePixels(1)));
    renderer.render(makeInput(makePixels(2), 0.25));

    const worker = FakeWorker.instances[0];
    expect(worker.messages.filter((message) => message.type === 'setPixels')).toHaveLength(2);
    expect(worker.messages.filter((message) => message.type === 'render')).toHaveLength(2);
  });

  it('does not resend pixels for animation-only worker renders', async () => {
    vi.stubGlobal('HTMLCanvasElement', FakeHTMLCanvasElement);
    vi.stubGlobal('Worker', FakeWorker);
    const renderer = new WorkerEscherZoomRenderer({ onFailure: vi.fn() });
    const pixels = makePixels(1);

    await renderer.init(new FakeHTMLCanvasElement() as unknown as HTMLCanvasElement);
    renderer.render(makeInput(pixels));
    renderer.render(makeInput(pixels, 0.25));

    const worker = FakeWorker.instances[0];
    expect(worker.messages.filter((message) => message.type === 'setPixels')).toHaveLength(1);
    expect(worker.messages.filter((message) => message.type === 'render')).toHaveLength(2);
  });
});
