<script lang="ts">
  import type { Rect } from '../lib/math/droste';
  import { selectionState, setNest, setCrop } from '../lib/stores/selection.svelte';
  import { pipeline } from '../lib/stores/pipeline.svelte';
  import { interactionState } from '../lib/stores/interaction.svelte';

  import type { Snippet } from 'svelte';
  type Props = { image: { width: number; height: number }; children?: Snippet };
  let { image, children }: Props = $props();

  let container: HTMLDivElement;

  // Drag state. There are two rectangles to manipulate (nest and crop) and
  // two operations on each (translate body, scale at corner). Body drags
  // capture the starting rect; corner drags capture the opposite corner
  // (which stays fixed) and the sign of the resize direction.
  type DragKind =
    | { target: 'nest' | 'crop'; kind: 'body'; startRect: Rect; startPx: { x: number; y: number } }
    | {
        target: 'nest' | 'crop';
        kind: 'corner';
        corner: 0 | 1 | 2 | 3;
        opposite: { x: number; y: number };
        signX: -1 | 1;
        signY: -1 | 1;
      }
    | null;
  let drag: DragKind = $state(null);

  const imageAspect = $derived(image.width / image.height);
  const nestAspect = $derived.by(() => {
    const r = selectionState.nest;
    return r ? r.w / r.h : imageAspect;
  });

  // We draw the limit-point crosshair on the ORIGINAL image, so use the
  // original-coord helper from the pipeline store.
  const geom = $derived(pipeline.geom);
  const limit = $derived(pipeline.limitInOriginal);

  const ghostRects = $derived.by(() => {
    const r = selectionState.nest;
    const crop = selectionState.crop;
    if (!r || !crop) return [] as { rect: Rect; opacity: number }[];
    // The shrink map is in CROP-RELATIVE coords, so iterate there and
    // translate back. f(p) = nestInCrop.topLeft + p/S where p is also
    // crop-relative. The first ghost is just the nest itself's "next
    // copy", placed at: cropTopLeft + (nestInCrop.topLeft + nestInCrop.topLeft/S)
    const out: { rect: Rect; opacity: number }[] = [];
    const S = crop.w / r.w;
    const nestInCrop = { x: r.x - crop.x, y: r.y - crop.y, w: r.w, h: r.h };
    let cur = nestInCrop;
    for (let i = 0; i < 2; i++) {
      const next = {
        x: nestInCrop.x + cur.x / S,
        y: nestInCrop.y + cur.y / S,
        w: cur.w / S,
        h: cur.h / S
      };
      out.push({
        rect: { x: next.x + crop.x, y: next.y + crop.y, w: next.w, h: next.h },
        opacity: 0.35 / (i + 1)
      });
      cur = next;
    }
    return out;
  });

  function clientToImage(e: PointerEvent | MouseEvent) {
    const rect = container.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * image.width,
      y: ((e.clientY - rect.top) / rect.height) * image.height
    };
  }

  function startBodyDrag(e: PointerEvent, target: 'nest' | 'crop', startRect: Rect) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { target, kind: 'body', startRect: { ...startRect }, startPx: clientToImage(e) };
    interactionState.active = true;
  }

  function startCornerDrag(
    e: PointerEvent,
    target: 'nest' | 'crop',
    rect: Rect,
    corner: 0 | 1 | 2 | 3
  ) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const opposite = {
      x: corner === 0 || corner === 3 ? rect.x + rect.w : rect.x,
      y: corner === 0 || corner === 1 ? rect.y + rect.h : rect.y
    };
    const signX: -1 | 1 = corner === 0 || corner === 3 ? -1 : 1;
    const signY: -1 | 1 = corner === 0 || corner === 1 ? -1 : 1;
    drag = { target, kind: 'corner', corner, opposite, signX, signY };
    interactionState.active = true;
    interactionState.focus = {
      x: rect.x + (corner === 1 || corner === 2 ? rect.w : 0),
      y: rect.y + (corner === 2 || corner === 3 ? rect.h : 0)
    };
  }

  function onPointerMove(e: PointerEvent) {
    const p = clientToImage(e);
    interactionState.focus = p;
    if (!drag) return;

    if (drag.kind === 'body') {
      const dx = p.x - drag.startPx.x;
      const dy = p.y - drag.startPx.y;
      const moved = {
        x: drag.startRect.x + dx,
        y: drag.startRect.y + dy,
        w: drag.startRect.w,
        h: drag.startRect.h
      };
      if (drag.target === 'nest') setNest(image, moved);
      else setCrop(image, moved);
      return;
    }

    // Corner resize. Aspect rule depends on which rect AND mode:
    //   nest, locked    → image aspect
    //   nest, unlocked  → free (independent w, h)
    //   crop, unlocked  → nest aspect (always)
    const dx = (p.x - drag.opposite.x) * drag.signX;
    const dy = (p.y - drag.opposite.y) * drag.signY;
    let w: number;
    let h: number;
    if (drag.target === 'nest' && !selectionState.aspectLocked) {
      w = Math.max(1, Math.abs(dx));
      h = Math.max(1, Math.abs(dy));
    } else {
      const a = drag.target === 'crop' ? nestAspect : imageAspect;
      w = Math.max(Math.abs(dx), Math.abs(dy) * a);
      h = w / a;
    }
    const x = drag.signX === 1 ? drag.opposite.x : drag.opposite.x - w;
    const y = drag.signY === 1 ? drag.opposite.y : drag.opposite.y - h;
    if (drag.target === 'nest') setNest(image, { x, y, w, h });
    else setCrop(image, { x, y, w, h });

    interactionState.focus = {
      x: drag.signX === 1 ? x + w : x,
      y: drag.signY === 1 ? y + h : y
    };
  }

  function onPointerUp(e: PointerEvent) {
    if (drag) {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {}
      drag = null;
    }
    interactionState.active = false;
  }

  function onPointerLeave() {
    if (!interactionState.active) interactionState.focus = null;
  }

  // Edge-arrow geometry for when c is outside the image.
  const limitOutside = $derived.by(() => {
    if (!limit) return null;
    const { x, y } = limit;
    if (x >= 0 && x <= image.width && y >= 0 && y <= image.height) return null;
    const cx = Math.max(0, Math.min(image.width, x));
    const cy = Math.max(0, Math.min(image.height, y));
    return { edge: { x: cx, y: cy }, offset: { x: x - cx, y: y - cy } };
  });

  const handleHit = $derived(Math.max(image.width, image.height) * 0.025);
  const handleDot = $derived(Math.max(image.width, image.height) * 0.007);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={container}
  class="picker"
  style="aspect-ratio: {image.width} / {image.height};"
  role="application"
  aria-label="Nest picker"
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onpointerleave={onPointerLeave}
>
  {@render children?.()}

  {#if selectionState.nest && selectionState.crop}
    {@const nest = selectionState.nest}
    {@const crop = selectionState.crop}
    {@const showCrop = !selectionState.aspectLocked}
    <svg
      class="overlay"
      viewBox="0 0 {image.width} {image.height}"
      preserveAspectRatio="none"
      role="application"
      aria-label="Nest picker"
    >
      <!--
        Dimming masks. Two layers when crop ≠ image:
          1. heavy dim outside the crop (those pixels are NOT in the working image)
          2. lighter dim outside the nest but inside the crop (the working image)
        With aspect-locked, crop ≡ image so layer 1 has no effect; visually
        identical to before.
      -->
      <defs>
        <mask id="crop-hole">
          <rect x="0" y="0" width={image.width} height={image.height} fill="white" />
          <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="black" />
        </mask>
        <mask id="nest-hole">
          <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="white" />
          <rect x={nest.x} y={nest.y} width={nest.w} height={nest.h} fill="black" />
        </mask>
      </defs>

      {#if showCrop}
        <!-- Outside crop: heavy dim, the "excluded" region. -->
        <rect
          x="0"
          y="0"
          width={image.width}
          height={image.height}
          fill="rgba(16,24,32,0.7)"
          mask="url(#crop-hole)"
          pointer-events="none"
        />
      {/if}
      <!-- Outside nest, inside crop: light dim. -->
      <rect
        x={crop.x}
        y={crop.y}
        width={crop.w}
        height={crop.h}
        fill="rgba(16,24,32,0.35)"
        mask="url(#nest-hole)"
        pointer-events="none"
      />

      <!-- ghost nesting rects -->
      {#each ghostRects as g}
        <rect
          x={g.rect.x}
          y={g.rect.y}
          width={g.rect.w}
          height={g.rect.h}
          fill="none"
          stroke="var(--teal)"
          stroke-width={1.2 / Math.max(1, image.width / 800)}
          vector-effect="non-scaling-stroke"
          opacity={g.opacity}
          pointer-events="none"
        />
      {/each}

      <!--
        Crop rectangle (only when unlocked). Dashed warm stroke so it reads
        differently from the nest. Drawn BEFORE the nest so the nest's
        handles overlay anything that might collide visually.
      -->
      {#if showCrop}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <rect
          class="body crop-body"
          x={crop.x}
          y={crop.y}
          width={crop.w}
          height={crop.h}
          fill="transparent"
          stroke="var(--warm)"
          stroke-width="1.25"
          stroke-dasharray="6 4"
          vector-effect="non-scaling-stroke"
          onpointerdown={(e) => startBodyDrag(e, 'crop', crop)}
        />
        {#each [{ cx: crop.x, cy: crop.y, i: 0, diag: 'nwse' }, { cx: crop.x + crop.w, cy: crop.y, i: 1, diag: 'nesw' }, { cx: crop.x + crop.w, cy: crop.y + crop.h, i: 2, diag: 'nwse' }, { cx: crop.x, cy: crop.y + crop.h, i: 3, diag: 'nesw' }] as h}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class="handle handle-{h.diag} crop-handle"
            onpointerdown={(e) => startCornerDrag(e, 'crop', crop, h.i as 0 | 1 | 2 | 3)}
            transform="translate({h.cx} {h.cy})"
          >
            <circle r={handleHit} fill="transparent" />
            <circle
              class="dot"
              r={handleDot}
              fill="var(--bg)"
              stroke="var(--warm)"
              stroke-width="1.25"
              vector-effect="non-scaling-stroke"
            />
          </g>
        {/each}
      {/if}

      <!-- nest body -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <rect
        class="body"
        x={nest.x}
        y={nest.y}
        width={nest.w}
        height={nest.h}
        fill="transparent"
        stroke="var(--teal)"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
        onpointerdown={(e) => startBodyDrag(e, 'nest', nest)}
      />

      <!-- nest corners -->
      {#each [{ cx: nest.x, cy: nest.y, i: 0, diag: 'nwse' }, { cx: nest.x + nest.w, cy: nest.y, i: 1, diag: 'nesw' }, { cx: nest.x + nest.w, cy: nest.y + nest.h, i: 2, diag: 'nwse' }, { cx: nest.x, cy: nest.y + nest.h, i: 3, diag: 'nesw' }] as h}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          class="handle handle-{h.diag}"
          onpointerdown={(e) => startCornerDrag(e, 'nest', nest, h.i as 0 | 1 | 2 | 3)}
          transform="translate({h.cx} {h.cy})"
        >
          <circle r={handleHit} fill="transparent" />
          <circle
            class="dot"
            r={handleDot}
            fill="var(--bg)"
            stroke="var(--teal)"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
          />
        </g>
      {/each}

      <!-- limit point crosshair -->
      {#if geom}
        {@const inside = !limitOutside}
        {@const cx = inside ? limit!.x : limitOutside!.edge.x}
        {@const cy = inside ? limit!.y : limitOutside!.edge.y}
        {@const arm = Math.max(image.width, image.height) * 0.015}
        <g class="limit" transform="translate({cx} {cy})" pointer-events="none">
          <circle
            r={arm * 0.7}
            fill="none"
            stroke={inside ? 'var(--warm)' : 'var(--green)'}
            stroke-width="1.25"
            vector-effect="non-scaling-stroke"
          />
          <line
            x1={-arm} y1="0" x2={arm} y2="0"
            stroke={inside ? 'var(--warm)' : 'var(--green)'}
            stroke-width="1.25"
            vector-effect="non-scaling-stroke"
          />
          <line
            x1="0" y1={-arm} x2="0" y2={arm}
            stroke={inside ? 'var(--warm)' : 'var(--green)'}
            stroke-width="1.25"
            vector-effect="non-scaling-stroke"
          />
          {#if !inside}
            {@const L = Math.hypot(limitOutside!.offset.x, limitOutside!.offset.y)}
            {@const ux = limitOutside!.offset.x / L}
            {@const uy = limitOutside!.offset.y / L}
            {@const tipX = ux * arm * 2.5}
            {@const tipY = uy * arm * 2.5}
            <line
              x1="0" y1="0" x2={tipX} y2={tipY}
              stroke="var(--green)"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
            <polygon
              points="{tipX},{tipY} {tipX - ux * arm - uy * arm * 0.5},{tipY - uy * arm + ux * arm * 0.5} {tipX - ux * arm + uy * arm * 0.5},{tipY - uy * arm - ux * arm * 0.5}"
              fill="var(--green)"
            />
          {/if}
        </g>
      {/if}
    </svg>
  {/if}
</div>

<style>
  .picker {
    position: relative;
    width: 100%;
    max-width: 960px;
    background: var(--bg);
    user-select: none;
    touch-action: none;
  }
  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .overlay :global(.body),
  .overlay :global(.handle) {
    pointer-events: auto;
  }
  .overlay :global(.body) {
    cursor: grab;
    transition: stroke-width 120ms var(--ease);
  }
  .overlay :global(.body:active) {
    cursor: grabbing;
  }
  .overlay :global(.handle .dot) {
    transition: r 120ms var(--ease), stroke-width 120ms var(--ease);
  }
  .overlay :global(.handle:hover .dot) {
    stroke-width: 2;
  }
  .overlay :global(.handle-nwse) { cursor: nwse-resize; }
  .overlay :global(.handle-nesw) { cursor: nesw-resize; }
</style>
