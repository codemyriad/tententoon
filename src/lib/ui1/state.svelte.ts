/**
 * UI variant 1 — shared $state runes. Mirrors HANDOFF.md §3 (ui / doc /
 * playback). Scoped to /ui1; the main view's stores are untouched.
 *
 * State machine implied by the runes:
 *   Empty   doc.image == null
 *   Framing doc.image set, doc.rect zero
 *   Edit    doc.rect non-zero, playback.playing == false
 *   Playing playback.playing == true
 *   (Exporting is owned by export-* modules; the rune state is whatever it
 *    was when the export started.)
 */

export type Tool = 'select' | 'rect' | 'pan';
export type AspectKind = 'match-image' | 'free' | '1:1' | '16:9';
export type Direction = 'in' | 'out';
export type Theme = 'light-neutral' | 'light-warm' | 'dark-warm';

export type Rect = { x: number; y: number; w: number; h: number };

export const ui = $state<{
  tool: Tool;
  zoom: 'fit' | number;
  exportMenuOpen: boolean;
  theme: Theme;
  /** Hint shown briefly after an export completes. */
  exportToast: string | null;
}>({
  tool: 'rect',
  zoom: 'fit',
  exportMenuOpen: false,
  theme: 'light-neutral',
  exportToast: null
});

export const doc = $state<{
  image: ImageBitmap | null;
  imageName: string;
  rect: Rect;
  aspect: AspectKind;
}>({
  image: null,
  imageName: '',
  rect: { x: 0, y: 0, w: 0, h: 0 },
  aspect: 'match-image'
});

export const playback = $state<{
  playing: boolean;
  t: number;
  speed: 0.5 | 1 | 2 | 4;
  direction: Direction;
  loopLength: number;
  exporting: boolean;
}>({
  playing: false,
  t: 0,
  speed: 1,
  direction: 'in',
  loopLength: 10,
  exporting: false
});

/** Replace the working image and clear the rect. */
export function setImage(image: ImageBitmap | null, name = ''): void {
  doc.image?.close?.();
  doc.image = image;
  doc.imageName = name;
  doc.rect = { x: 0, y: 0, w: 0, h: 0 };
  playback.playing = false;
  playback.t = 0;
}

/** Image's aspect ratio (W/H) or 0 when no image. */
export function imageAspect(): number {
  return doc.image ? doc.image.width / doc.image.height : 0;
}

/** Aspect ratio implied by the current `doc.aspect` chip. */
export function chipAspect(): number | null {
  switch (doc.aspect) {
    case 'match-image':
      return imageAspect() || null;
    case '1:1':
      return 1;
    case '16:9':
      return 16 / 9;
    case 'free':
    default:
      return null;
  }
}
