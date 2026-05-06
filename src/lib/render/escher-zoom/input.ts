import type { RenderInputBase, Renderer } from '../types';

/** EscherZoomPanel input: the base render state plus the animation phase. */
export type EscherZoomInput = RenderInputBase & {
  /** Animation phase in [0, 1). One full cycle = one Droste step. */
  t: number;
};

export type EscherZoomRenderer = Renderer<EscherZoomInput>;
