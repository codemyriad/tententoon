/**
 * Generated test patterns for understanding the Droste → Escher geometry.
 *
 * The pipeline maps an image around the limit point c. Two patterns make the
 * map legible when c sits at the image centre (use a centred square nest):
 *
 *   polar  — concentric circles + radial spokes. In the log panel a circle
 *            (r = const → u = const) is a VERTICAL line and a spoke
 *            (θ = const → v = const) is a HORIZONTAL line, so the whole
 *            pattern becomes a clean cartesian grid. The tententoon turns it
 *            into the spiral grid.
 *   grid   — a cartesian grid. Straight lines warp into the log-polar shape,
 *            showing how the transform bends space.
 *
 * Drawn to a square canvas and returned as an ImageBitmap (same type as a
 * loaded photo), so the rest of the pipeline is unchanged.
 */

export type PatternKind = 'polar' | 'grid';

export const PATTERN_SIZE = 1024;

/** A centred square nest whose limit point lands exactly at the image
 *  centre (centred nest on a square image → c = centre), so the polar
 *  pattern maps to an axis-aligned grid in the log panel. S ≈ 2.4. */
export function patternNest(size = PATTERN_SIZE) {
  const w = Math.round(size * 0.42);
  const o = Math.round((size - w) / 2);
  return { x: o, y: o, w, h: w };
}

const BG = '#f3efe6';
const INK = '#2b3a42';

export async function makeTestPattern(kind: PatternKind, size = PATTERN_SIZE): Promise<ImageBitmap> {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);
  if (kind === 'polar') drawPolar(ctx, size);
  else drawGrid(ctx, size);
  return createImageBitmap(c);
}

function drawGrid(ctx: CanvasRenderingContext2D, size: number): void {
  const step = size / 16;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(43,58,66,0.35)';
  for (let i = 1; i < 16; i++) {
    const p = Math.round(i * step) + 0.5;
    line(ctx, p, 0, p, size);
    line(ctx, 0, p, size, p);
  }
  // Bold coloured centre axes so orientation is trackable through the warp.
  const mid = size / 2;
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#d1495b';
  line(ctx, 0, mid, size, mid); // horizontal (x) axis — red
  ctx.strokeStyle = '#2e86ab';
  line(ctx, mid, 0, mid, size); // vertical (y) axis — blue
  // A few accent cells near the centre to read scale.
  ctx.fillStyle = 'rgba(46,134,171,0.18)';
  ctx.fillRect(mid, mid - step, step, step);
  ctx.fillStyle = 'rgba(209,73,91,0.18)';
  ctx.fillRect(mid - step, mid, step, step);
}

function drawPolar(ctx: CanvasRenderingContext2D, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.72; // reach into the corners
  const rings = 14;
  const spokes = 24; // every 15°

  // Alternating shaded rings — reads as horizontal bands in the log panel.
  for (let i = rings; i >= 1; i--) {
    const r = (i / rings) * maxR;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(38,109,120,0.10)' : BG;
    ctx.fill();
  }
  // Ring outlines.
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(38,109,120,0.55)';
  for (let i = 1; i <= rings; i++) {
    const r = (i / rings) * maxR;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Radial spokes.
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(43,58,66,0.4)';
  for (let s = 0; s < spokes; s++) {
    const a = (s / spokes) * Math.PI * 2;
    line(ctx, cx, cy, cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
  }
  // Coloured cardinal spokes — track angle through the rotation.
  const card: [number, string][] = [
    [0, '#d1495b'],            // +x red (θ = 0)
    [Math.PI / 2, '#2e86ab'],  // +y blue (θ = 90°)
    [Math.PI, '#e9a23b'],      // −x amber
    [(3 * Math.PI) / 2, '#6a994e'] // −y green
  ];
  ctx.lineWidth = 5;
  for (const [a, col] of card) {
    ctx.strokeStyle = col;
    line(ctx, cx, cy, cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
  }
  // Centre dot = the limit point when the nest is centred.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
