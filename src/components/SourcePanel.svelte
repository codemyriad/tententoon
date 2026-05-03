<script lang="ts">
  import { imageState, upscaleSource, clearSourceHQ } from '../lib/stores/image.svelte';
  import { selectionState, initSelection, setAspectLocked } from '../lib/stores/selection.svelte';
  import { pipeline } from '../lib/stores/pipeline.svelte';
  import RectanglePicker from './RectanglePicker.svelte';
  import Magnifier from './Magnifier.svelte';

  let canvas: HTMLCanvasElement | null = $state(null);

  // Re-init selection whenever a new image loads.
  $effect(() => {
    const src = imageState.source;
    if (src) initSelection({ width: src.width, height: src.height }, src.presetRect);
  });

  // Draw image onto the backing canvas once, in image-pixel space. CSS scales it.
  $effect(() => {
    const src = imageState.source;
    if (!src || !canvas) return;
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(src.bitmap, 0, 0);
  });

  // For the chips, we want c in ORIGINAL-image coords (not crop-relative)
  // since the user is looking at the original.
  const geom = $derived(pipeline.geom);
  const limit = $derived(pipeline.limitInOriginal);

  function onLockChange(e: Event) {
    const src = imageState.source;
    if (!src) return;
    const checked = (e.currentTarget as HTMLInputElement).checked;
    setAspectLocked({ width: src.width, height: src.height }, checked);
  }
</script>

<section class="source">
  <header>
    <h2>Source + nest</h2>
    {#if geom && limit}
      <div class="chips mono">
        <span class="chip" title="Scale factor">S = {geom.S.toFixed(2)}</span>
        <span class="chip" title="Natural log of S">log S = {geom.logS.toFixed(3)}</span>
        <span class="chip" class:outside={
          limit.x < 0 || limit.x > (imageState.source?.width ?? 0) ||
          limit.y < 0 || limit.y > (imageState.source?.height ?? 0)
        } title="Limit point (pixel coords)">
          c = ({limit.x.toFixed(0)}, {limit.y.toFixed(0)})
        </span>
        <label class="chip lock" title="When unlocked, the nest can have any aspect; the dashed crop rectangle picks which part of the image is used as the working source.">
          <input
            type="checkbox"
            checked={selectionState.aspectLocked}
            onchange={onLockChange}
          />
          Lock aspect to image
        </label>
        {#if imageState.sourceHQ}
          <span class="chip hq" title="Sampling from a {imageState.sourceHQ.scale.toFixed(0)}× upscaled source. Click to disable.">
            <button class="link" onclick={clearSourceHQ}>HQ ×{imageState.sourceHQ.scale.toFixed(0)} ✕</button>
          </span>
        {:else}
          <button
            class="chip hq-action"
            disabled={imageState.upscaling}
            onclick={() => upscaleSource()}
            title="Send the source to fal.ai's upscaler and resample from the result. The geometry stays the same; only the per-pixel detail changes."
          >
            {imageState.upscaling ? 'Upscaling…' : 'Upscale source (HQ)'}
          </button>
        {/if}
      </div>
    {/if}
    {#if imageState.upscaleError}
      <p class="error mono" title={imageState.upscaleError}>
        Upscale failed: {imageState.upscaleError}
      </p>
    {/if}
  </header>

  {#if imageState.source}
    {@const src = imageState.source}
    <div class="layout">
      <div class="picker-wrap">
        <RectanglePicker image={{ width: src.width, height: src.height }}>
          <canvas bind:this={canvas} class="img"></canvas>
        </RectanglePicker>
        <p class="hint muted">
          Drag the nest to translate · drag a corner to resize
          {#if !selectionState.aspectLocked}
            (free aspect) · the dashed
            <span class="dot warm"></span> rectangle is the crop — what's used
            as the working image
          {:else}
            (aspect-locked)
          {/if}
          · <span class="dot warm"></span> marks the limit point
        </p>
      </div>
      <Magnifier />
    </div>
  {:else if imageState.loading}
    <p class="muted">Loading image…</p>
  {:else}
    <p class="muted">No image yet. Upload one above.</p>
  {/if}
</section>

<style>
  .source {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 1240px;
  }
  .layout {
    display: flex;
    gap: 1.25rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .picker-wrap {
    flex: 1 1 480px;
    min-width: 0;
    max-width: 960px;
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .chips {
    display: flex;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .chip {
    padding: 0.2em 0.55em;
    border: 1px solid var(--border);
    color: var(--fg);
  }
  .chip.outside {
    border-color: var(--green);
    color: var(--green);
  }
  .chip.hq {
    border-color: var(--warm);
    color: var(--warm);
  }
  .chip.hq .link {
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .chip.hq-action {
    border: 1px solid var(--border);
    background: none;
    padding: 0.2em 0.55em;
    color: var(--fg);
    font: inherit;
    cursor: pointer;
  }
  .chip.hq-action:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  .error {
    margin: 0.4em 0 0;
    font-size: 0.8rem;
    color: var(--green);
    max-width: 60ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .hint {
    font-size: 0.85rem;
  }
  .dot {
    display: inline-block;
    width: 0.5em;
    height: 0.5em;
    border-radius: 50%;
    vertical-align: middle;
    margin: 0 0.2em;
  }
  .dot.warm { background: var(--warm); }
</style>
