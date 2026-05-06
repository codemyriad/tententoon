/**
 * EscherZoom renderer factory with automatic tier demotion.
 *
 * The returned Renderer hides which backend is active. On WebGL2 init
 * failure or mid-session context loss, it disposes the failed backend and
 * promotes the next tier in line:
 *
 *   webgl2-worker  →  webgl2-main  →  cpu-main
 *
 * Demotion is one-way per session: we never try to "promote back" after a
 * fall, because whatever broke the GPU path is likely to break it again
 * and we'd start flapping. CPU is the absorbing state.
 *
 * The optional `onTier` callback fires whenever the active tier changes,
 * which lets the UI surface "Renderer: webgl2-worker" etc. for debugging.
 */

import { detectCapabilities, pickTier } from '../capabilities';
import type { BackendTier } from '../types';
import { CpuEscherZoomRenderer } from './cpu';
import { WebGL2EscherZoomRenderer } from './webgl2';
import { WorkerEscherZoomRenderer } from './worker-bridge';
import type { EscherZoomInput, EscherZoomRenderer } from './input';

const ORDER: BackendTier[] = ['webgl2-worker', 'webgl2-main', 'cpu-main'];

export type CreateOptions = {
  /** Override capability detection — useful for testing each tier. */
  forceTier?: BackendTier;
  /** Fired whenever the active tier changes (init, demotion). */
  onTier?: (tier: BackendTier) => void;
};

export function createEscherZoomRenderer(opts: CreateOptions = {}): EscherZoomRenderer {
  return new TieredEscherZoomRenderer(opts);
}

class TieredEscherZoomRenderer implements EscherZoomRenderer {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private active: EscherZoomRenderer | null = null;
  private activeTier: BackendTier | null = null;
  /** Pending input held while we re-init after a demotion mid-session. */
  private pending: EscherZoomInput | null = null;

  constructor(private opts: CreateOptions) {}

  async init(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<void> {
    this.canvas = canvas;
    const startTier = this.opts.forceTier ?? pickTier(detectCapabilities());
    await this.bringUpFrom(startTier);
  }

  render(input: EscherZoomInput): void {
    if (!this.active) {
      // Lost mid-init or mid-demotion. Stash the latest input so the next
      // backend can repaint with current state once it's up.
      this.pending = input;
      return;
    }
    this.active.render(input);
    this.pending = input;
  }

  dispose(): void {
    this.active?.dispose();
    this.active = null;
    this.activeTier = null;
    this.canvas = null;
  }

  private async bringUpFrom(tier: BackendTier): Promise<void> {
    const order = ORDER.slice(ORDER.indexOf(tier));
    for (const t of order) {
      try {
        const r = this.makeRenderer(t);
        if (!this.canvas) return; // disposed mid-init
        await Promise.resolve(r.init(this.canvas));
        this.active = r;
        this.activeTier = t;
        this.opts.onTier?.(t);
        if (this.pending) this.active.render(this.pending);
        return;
      } catch (e) {
        // Swallow and try the next tier. Last-tier failure throws.
        if (t === 'cpu-main') throw e;
      }
    }
  }

  private makeRenderer(tier: BackendTier): EscherZoomRenderer {
    switch (tier) {
      case 'webgl2-worker':
        return new WorkerEscherZoomRenderer({
          onFailure: () => this.demote('webgl2-worker')
        });
      case 'webgl2-main':
        return new WebGL2EscherZoomRenderer({
          onContextLost: () => this.demote('webgl2-main')
        });
      case 'cpu-main':
        return new CpuEscherZoomRenderer();
    }
  }

  private demote(failedTier: BackendTier): void {
    if (this.activeTier !== failedTier) return; // already moved on
    const idx = ORDER.indexOf(failedTier);
    const nextTier = ORDER[idx + 1];
    if (!nextTier) return; // already on cpu-main
    this.active?.dispose();
    this.active = null;
    this.activeTier = null;
    void this.bringUpFrom(nextTier);
  }
}

export type { EscherZoomInput } from './input';
