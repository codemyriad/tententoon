<script lang="ts">
  import Icon from './Icon.svelte';
  import { doc, playback, type AspectKind, type Direction } from '../../lib/ui1/state.svelte';
  import { snapRectToAspect, phase } from '../../lib/ui1/render';

  const aspects: AspectKind[] = ['match-image', 'free', '1:1', '16:9'];
  const aspectLabels: Record<AspectKind, string> = {
    'match-image': 'Match image',
    free: 'Free',
    '1:1': '1:1',
    '16:9': '16:9'
  };
  const speeds: Array<0.5 | 1 | 2 | 4> = [0.5, 1, 2, 4];

  function setAspect(a: AspectKind) {
    doc.aspect = a;
    if (a === 'match-image' && doc.image) {
      doc.rect = snapRectToAspect(doc.rect, doc.image.width / doc.image.height);
    } else if (a === '1:1') {
      doc.rect = snapRectToAspect(doc.rect, 1);
    } else if (a === '16:9') {
      doc.rect = snapRectToAspect(doc.rect, 16 / 9);
    }
  }

  function setSpeed(s: 0.5 | 1 | 2 | 4) {
    playback.speed = s;
  }
  function setDirection(d: Direction) {
    playback.direction = d;
  }

  function fmtNum(n: number, digits = 0): string {
    return Number.isFinite(n) ? n.toFixed(digits) : '–';
  }

  const ready = $derived(phase() !== 'empty');
  const hasRect = $derived(phase() === 'edit' || phase() === 'playing');
</script>

<aside class="inspector">
  <section class="block">
    <div class="head">
      <span class="title">Rectangle</span>
      {#if hasRect}<span class="hint mono">SELECTED</span>{/if}
    </div>
    {#if hasRect}
      <div class="grid">
        <span class="cell">
          <span class="label">X</span>
          <span class="value mono">{fmtNum(doc.rect.x)}<span class="unit">px</span></span>
        </span>
        <span class="cell">
          <span class="label">Y</span>
          <span class="value mono">{fmtNum(doc.rect.y)}<span class="unit">px</span></span>
        </span>
        <span class="cell">
          <span class="label">W</span>
          <span class="value mono">{fmtNum(doc.rect.w)}<span class="unit">px</span></span>
        </span>
        <span class="cell">
          <span class="label">H</span>
          <span class="value mono">{fmtNum(doc.rect.h)}<span class="unit">px</span></span>
        </span>
      </div>
    {:else if ready}
      <p class="empty">Drag on the canvas to draw a rectangle.</p>
    {:else}
      <p class="empty">Load an image, then drag a rectangle on it.</p>
    {/if}
    <div class="seg-wrap">
      <span class="label">Aspect</span>
      <div class="segmented" role="radiogroup">
        {#each aspects as a}
          <button
            class="seg"
            class:active={doc.aspect === a}
            disabled={!ready}
            onclick={() => setAspect(a)}
          >{aspectLabels[a]}</button>
        {/each}
      </div>
    </div>
  </section>

  <section class="block">
    <span class="title">Playback</span>
    {#if !hasRect}
      <p class="empty">Available once a rectangle is set.</p>
    {/if}
    <div class="seg-wrap">
      <span class="label">Speed</span>
      <div class="segmented" role="radiogroup">
        {#each speeds as s}
          <button class="seg" class:active={playback.speed === s} disabled={!hasRect} onclick={() => setSpeed(s)}
            >{s}×</button>
        {/each}
      </div>
    </div>
    <div class="seg-wrap">
      <span class="label">Direction</span>
      <div class="segmented" role="radiogroup">
        <button class="seg" class:active={playback.direction === 'in'} disabled={!hasRect} onclick={() => setDirection('in')}>Zoom in</button>
        <button class="seg" class:active={playback.direction === 'out'} disabled={!hasRect} onclick={() => setDirection('out')}>Zoom out</button>
      </div>
    </div>
    <label class="num">
      <span class="label">Loop length</span>
      <span class="value-row">
        <input
          type="range"
          min="2"
          max="30"
          step="0.5"
          bind:value={playback.loopLength}
          disabled={!hasRect}
        />
        <span class="value mono">{playback.loopLength.toFixed(1)}<span class="unit">s</span></span>
      </span>
    </label>
  </section>
</aside>

<style>
  .inspector {
    width: 260px;
    background: var(--panel);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex-shrink: 0;
  }
  .block {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-bottom: 1px solid var(--border);
  }
  .block:last-child { border-bottom: 0; }
  .head { display: flex; align-items: center; justify-content: space-between; }
  .title { font-size: 13px; font-weight: 600; }
  .hint { font-size: 10px; color: var(--muted); }
  .mono { font-family: var(--font-mono); }
  .empty { font-size: 12px; color: var(--muted); margin: 0; }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .label {
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-family: var(--font-mono);
  }
  .value {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 13px;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .unit { color: var(--muted); font-size: 10px; margin-left: 6px; }
  .seg-wrap { display: flex; flex-direction: column; gap: 6px; }
  .segmented {
    display: inline-flex;
    padding: 2px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 7px;
    gap: 2px;
  }
  .seg {
    padding: 4px 10px;
    font-size: 12px;
    border-radius: 5px;
    background: transparent;
    border: 0;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
    flex: 1;
  }
  .seg:hover:not(:disabled) { color: var(--ink); }
  .seg.active {
    background: var(--panel);
    color: var(--ink);
    font-weight: 600;
    box-shadow: var(--shadow);
  }
  .seg:disabled { opacity: 0.5; cursor: not-allowed; }
  .num { display: flex; flex-direction: column; gap: 6px; }
  .value-row { display: flex; align-items: center; gap: 8px; }
  .value-row input[type='range'] { flex: 1; }
</style>
