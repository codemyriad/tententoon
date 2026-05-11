<script lang="ts">
  /**
   * Editing stage for /ui1: image + rect overlay. Two layers inside a
   * fit-to-container viewport:
   *
   *   1. <imageCanvas>  2D-context. Shows the loaded source image.
   *   2. <svg>          Dim mask + rect outline + 8 handles + thirds grid +
   *                     dimension badge. Pure visual; the container owns
   *                     pointer events.
   *
   * The spiral output lives in PreviewStage (a separate pane). That way
   * dragging the rect doesn't repaint the same area the user is trying to
   * grab — you see the live result side by side instead.
   *
   * Pointer behaviour by tool:
   *   ui.tool === 'rect'   — marquee-drag on empty creates a rect; drag
   *                          inside the rect moves it; drag on a handle
   *                          resizes. Shift locks aspect to the active
   *                          chip; Alt resizes from centre.
   *   ui.tool === 'select' — drag the rect body / handles only.
   *   ui.tool === 'pan'    — drag scrolls the viewport (TODO; no-op).
   */

  import {
    doc,
    ui,
    chipAspect,
    type Rect
  } from '../../lib/ui1/state.svelte';
  import { snapRectToAspect, phase } from '../../lib/ui1/render';

  let viewport: HTMLDivElement | null = $state(null);
  let imageCanvas: HTMLCanvasElement | null = $state(null);
  let viewW = $state(0);
  let viewH = $state(0);

  /** Image area inside the viewport, in CSS px. Letterboxed to image aspect. */
  const fit = $derived.by(() => {
    if (!doc.image || viewW <= 0 || viewH <= 0) return null;
    const ia = doc.image.width / doc.image.height;
    const va = viewW / viewH;
    let w: number, h: number;
    if (va > ia) { h = viewH; w = h * ia; } else { w = viewW; h = w / ia; }
    return {
      w,
      h,
      offX: (viewW - w) / 2,
      offY: (viewH - h) / 2,
      scaleCss: w / doc.image.width
    };
  });

  const hasRect = $derived(doc.rect.w > 0 && doc.rect.h > 0);
  const ready = $derived(phase() !== 'empty');

  // 1. Track viewport size.
  $effect(() => {
    if (!viewport) return;
    const update = () => {
      const r = viewport!.getBoundingClientRect();
      viewW = r.width;
      viewH = r.height;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(viewport);
    return () => ro.disconnect();
  });

  // 2. Image-canvas: drawImage when image / size changes.
  $effect(() => {
    if (!imageCanvas || !doc.image || !fit) return;
    const dpr = window.devicePixelRatio || 1;
    imageCanvas.width = Math.max(1, Math.round(fit.w * dpr));
    imageCanvas.height = Math.max(1, Math.round(fit.h * dpr));
    const ctx = imageCanvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(doc.image, 0, 0, fit.w, fit.h);
  });

  // ---- pointer interaction ----

  type DragKind =
    | { kind: 'marquee'; startImg: { x: number; y: number } }
    | { kind: 'body'; startRect: Rect; startImg: { x: number; y: number } }
    | { kind: 'handle'; opposite: { x: number; y: number }; signX: -1 | 1; signY: -1 | 1; centerStart: { x: number; y: number } | null };
  let drag: DragKind | null = null;
  let dragMods = $state({ shift: false, alt: false });
  // Cursor follows hover state when not dragging: resize cursors over the
  // 8 handles, `move` over the rect body, crosshair (rect tool) or
  // default (other tools) elsewhere. During a drag we leave the cursor
  // alone so the gesture's affordance is stable.
  let cursor = $state('default');

  function handleCursor(name: string): string {
    if (name === 'nw' || name === 'se') return 'nwse-resize';
    if (name === 'ne' || name === 'sw') return 'nesw-resize';
    if (name === 'n' || name === 's') return 'ns-resize';
    if (name === 'e' || name === 'w') return 'ew-resize';
    return 'default';
  }

  function updateCursor(e: PointerEvent) {
    if (drag) return;
    if (!ready || !viewport) { cursor = 'default'; return; }
    const r = viewport.getBoundingClientRect();
    const cssX = e.clientX - r.left;
    const cssY = e.clientY - r.top;
    const h = hitHandle(cssX, cssY);
    if (h) { cursor = handleCursor(h); return; }
    const img = eventToImage(e);
    if (img && hasRect && inRect(img)) { cursor = 'move'; return; }
    cursor = ui.tool === 'rect' ? 'crosshair' : 'default';
  }

  /** Convert a pointer event into image-pixel coordinates. */
  function eventToImage(e: PointerEvent): { x: number; y: number } | null {
    if (!viewport || !doc.image || !fit) return null;
    const r = viewport.getBoundingClientRect();
    const cssX = e.clientX - r.left;
    const cssY = e.clientY - r.top;
    return {
      x: (cssX - fit.offX) / fit.scaleCss,
      y: (cssY - fit.offY) / fit.scaleCss
    };
  }

  /** Image-space → CSS-px helper for the SVG overlay. */
  function imgToCss(x: number, y: number): { x: number; y: number } {
    if (!fit) return { x: 0, y: 0 };
    return { x: fit.offX + x * fit.scaleCss, y: fit.offY + y * fit.scaleCss };
  }

  const handles: Array<{ corner: [number, number]; name: string }> = [
    { corner: [0, 0], name: 'nw' },
    { corner: [0.5, 0], name: 'n' },
    { corner: [1, 0], name: 'ne' },
    { corner: [1, 0.5], name: 'e' },
    { corner: [1, 1], name: 'se' },
    { corner: [0.5, 1], name: 's' },
    { corner: [0, 1], name: 'sw' },
    { corner: [0, 0.5], name: 'w' }
  ];

  /** Pick which handle (if any) is under a pointer position in CSS px, within ~10 CSS px tolerance. */
  function hitHandle(cssX: number, cssY: number): string | null {
    if (!hasRect || !fit) return null;
    const tol = 10;
    for (const h of handles) {
      const cx = doc.rect.x + doc.rect.w * h.corner[0];
      const cy = doc.rect.y + doc.rect.h * h.corner[1];
      const p = imgToCss(cx, cy);
      const dx = p.x - cssX;
      const dy = p.y - cssY;
      if (dx * dx + dy * dy <= tol * tol) return h.name;
    }
    return null;
  }

  function inRect(img: { x: number; y: number }): boolean {
    return img.x >= doc.rect.x && img.x <= doc.rect.x + doc.rect.w
      && img.y >= doc.rect.y && img.y <= doc.rect.y + doc.rect.h;
  }

  function clampImg(p: { x: number; y: number }): { x: number; y: number } {
    if (!doc.image) return p;
    return {
      x: Math.max(0, Math.min(doc.image.width, p.x)),
      y: Math.max(0, Math.min(doc.image.height, p.y))
    };
  }

  function applyMods(rect: Rect, e: PointerEvent): Rect {
    if (e.shiftKey) {
      const a = chipAspect();
      if (a) return snapRectToAspect(rect, a);
    }
    return rect;
  }

  function onPointerDown(e: PointerEvent) {
    if (!ready) return;
    const img = eventToImage(e);
    if (!img) return;
    const cssRect = viewport!.getBoundingClientRect();
    const cssX = e.clientX - cssRect.left;
    const cssY = e.clientY - cssRect.top;
    dragMods = { shift: e.shiftKey, alt: e.altKey };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    // Priority: handle > body > marquee. Tool only affects fallback.
    // Old logic re-marquee'd inside an existing rect under the rect tool,
    // wiping the rect to 0×0 the instant the user clicked on it.
    const handle = hitHandle(cssX, cssY);
    if (handle) {
      const r = doc.rect;
      const oppX = handle.includes('w') ? r.x + r.w : (handle.includes('e') ? r.x : r.x + r.w / 2);
      const oppY = handle.includes('n') ? r.y + r.h : (handle.includes('s') ? r.y : r.y + r.h / 2);
      const signX: -1 | 1 = handle.includes('e') ? 1 : -1;
      const signY: -1 | 1 = handle.includes('s') ? 1 : -1;
      const centerStart = e.altKey ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
      drag = { kind: 'handle', opposite: { x: oppX, y: oppY }, signX, signY, centerStart };
      return;
    }
    if (hasRect && inRect(img)) {
      drag = { kind: 'body', startRect: { ...doc.rect }, startImg: img };
      return;
    }
    if (ui.tool === 'rect') {
      drag = { kind: 'marquee', startImg: img };
      doc.rect = { x: img.x, y: img.y, w: 0, h: 0 };
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag) {
      updateCursor(e);
      return;
    }
    const img = eventToImage(e);
    if (!img) return;
    dragMods = { shift: e.shiftKey, alt: e.altKey };

    if (drag.kind === 'marquee') {
      const a = { x: Math.min(drag.startImg.x, img.x), y: Math.min(drag.startImg.y, img.y) };
      const b = { x: Math.max(drag.startImg.x, img.x), y: Math.max(drag.startImg.y, img.y) };
      let next: Rect = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
      next = applyMods(next, e);
      doc.rect = next;
      return;
    }
    if (drag.kind === 'body') {
      const dx = img.x - drag.startImg.x;
      const dy = img.y - drag.startImg.y;
      doc.rect = {
        x: drag.startRect.x + dx,
        y: drag.startRect.y + dy,
        w: drag.startRect.w,
        h: drag.startRect.h
      };
      return;
    }
    if (drag.kind === 'handle') {
      let nx: number, ny: number, nw: number, nh: number;
      if (drag.centerStart) {
        // Alt: resize from centre.
        const dx = Math.abs(img.x - drag.centerStart.x);
        const dy = Math.abs(img.y - drag.centerStart.y);
        nw = dx * 2;
        nh = dy * 2;
        nx = drag.centerStart.x - nw / 2;
        ny = drag.centerStart.y - nh / 2;
      } else {
        nw = Math.abs(img.x - drag.opposite.x);
        nh = Math.abs(img.y - drag.opposite.y);
        nx = drag.signX === 1 ? drag.opposite.x : drag.opposite.x - nw;
        ny = drag.signY === 1 ? drag.opposite.y : drag.opposite.y - nh;
      }
      let next: Rect = { x: nx, y: ny, w: nw, h: nh };
      next = applyMods(next, e);
      doc.rect = next;
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!drag) return;
    drag = null;
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch {}
    // Normalise: clamp to image and ensure min size.
    if (doc.image) {
      const minSide = 8;
      let r = doc.rect;
      r = { x: Math.max(0, r.x), y: Math.max(0, r.y), w: Math.min(doc.image.width - Math.max(0, r.x), r.w), h: Math.min(doc.image.height - Math.max(0, r.y), r.h) };
      if (r.w < minSide || r.h < minSide) {
        r = { x: 0, y: 0, w: 0, h: 0 };
      }
      doc.rect = r;
    }
  }

  // ---- visual derived data for the overlay ----

  const overlayRect = $derived.by(() => {
    if (!hasRect || !fit) return null;
    const tl = imgToCss(doc.rect.x, doc.rect.y);
    return { x: tl.x, y: tl.y, w: doc.rect.w * fit.scaleCss, h: doc.rect.h * fit.scaleCss };
  });
</script>

<section class="stage" class:has-image={!!doc.image}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="viewport"
    bind:this={viewport}
    style:cursor={cursor}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onpointerleave={() => { if (!drag) cursor = 'default'; }}
  >
    {#if doc.image}
      <canvas
        bind:this={imageCanvas}
        class="layer image"
        style:left="{fit?.offX ?? 0}px"
        style:top="{fit?.offY ?? 0}px"
        style:width="{fit?.w ?? 0}px"
        style:height="{fit?.h ?? 0}px"
      ></canvas>
      {#if overlayRect}
        <svg class="overlay" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="ui1-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={overlayRect.x}
                y={overlayRect.y}
                width={overlayRect.w}
                height={overlayRect.h}
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.32)" mask="url(#ui1-mask)" />
          <rect
            x={overlayRect.x + 0.5}
            y={overlayRect.y + 0.5}
            width={overlayRect.w - 1}
            height={overlayRect.h - 1}
            fill="none"
            stroke="var(--accent)"
            stroke-width="1.5"
          />
          <!-- thirds grid -->
          <g opacity="0.5" stroke="white" stroke-width="1" stroke-dasharray="4 4">
            <line x1={overlayRect.x + overlayRect.w / 3} y1={overlayRect.y} x2={overlayRect.x + overlayRect.w / 3} y2={overlayRect.y + overlayRect.h} />
            <line x1={overlayRect.x + (2 * overlayRect.w) / 3} y1={overlayRect.y} x2={overlayRect.x + (2 * overlayRect.w) / 3} y2={overlayRect.y + overlayRect.h} />
            <line x1={overlayRect.x} y1={overlayRect.y + overlayRect.h / 3} x2={overlayRect.x + overlayRect.w} y2={overlayRect.y + overlayRect.h / 3} />
            <line x1={overlayRect.x} y1={overlayRect.y + (2 * overlayRect.h) / 3} x2={overlayRect.x + overlayRect.w} y2={overlayRect.y + (2 * overlayRect.h) / 3} />
          </g>
          <!-- 8 handles -->
          {#each handles as h}
            {@const cx = overlayRect.x + overlayRect.w * h.corner[0]}
            {@const cy = overlayRect.y + overlayRect.h * h.corner[1]}
            <rect x={cx - 4.5} y={cy - 4.5} width="9" height="9" fill="white" stroke="var(--accent)" stroke-width="1.5" rx="2" />
          {/each}
        </svg>
        <!-- dimension badge -->
        <span
          class="badge mono"
          style:left="{overlayRect.x}px"
          style:top="{overlayRect.y + overlayRect.h + 6}px"
        >{Math.round(doc.rect.w)} × {Math.round(doc.rect.h)}</span>
      {/if}
      <!-- HUD: zoom-fit chip + coords (only once we have a fit ratio). -->
      {#if fit}
        <div class="hud-tl mono">Fit · {Math.round(fit.scaleCss * 100)}%</div>
        {#if hasRect}
          <div class="hud-br mono">{Math.round(doc.rect.x)}, {Math.round(doc.rect.y)} · {Math.round(doc.rect.w)}×{Math.round(doc.rect.h)}</div>
        {/if}
      {/if}
    {/if}
  </div>
</section>

<style>
  .stage {
    flex: 1;
    background: var(--canvas-bg);
    position: relative;
    overflow: hidden;
    display: flex;
  }
  .viewport {
    position: absolute;
    inset: 24px 24px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    touch-action: none;
    /* cursor is set dynamically via style:cursor in the markup — depends
       on whether the pointer is over a handle, the rect body, or empty. */
  }
  .stage:not(.has-image) .viewport { box-shadow: none; }
  .layer { position: absolute; display: block; }
  .overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .badge {
    position: absolute;
    background: var(--accent);
    color: #fff;
    padding: 3px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .hud-tl, .hud-br {
    position: absolute;
    background: rgba(0,0,0,0.5);
    color: rgba(255,255,255,0.85);
    padding: 3px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-family: var(--font-mono);
    pointer-events: none;
  }
  .hud-tl { top: 8px; left: 12px; }
  .hud-br { bottom: 8px; right: 12px; }
  .mono { font-family: var(--font-mono); }
</style>
