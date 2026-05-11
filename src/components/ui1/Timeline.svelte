<script lang="ts">
  import Icon from './Icon.svelte';
  import { playback } from '../../lib/ui1/state.svelte';
  import { phase } from '../../lib/ui1/render';

  let trackEl: HTMLDivElement;
  let scrubbing = false;
  let wasPlaying = false;

  const enabled = $derived(phase() === 'edit' || phase() === 'playing');

  function toggle() {
    if (!enabled) return;
    playback.playing = !playback.playing;
  }

  function onTrackDown(e: PointerEvent) {
    if (!enabled) return;
    scrubbing = true;
    wasPlaying = playback.playing;
    playback.playing = false;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setFromEvent(e);
  }
  function onTrackMove(e: PointerEvent) {
    if (!scrubbing) return;
    setFromEvent(e);
  }
  function onTrackUp(e: PointerEvent) {
    if (!scrubbing) return;
    scrubbing = false;
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch {}
    playback.playing = wasPlaying;
  }
  function setFromEvent(e: PointerEvent) {
    const rect = trackEl.getBoundingClientRect();
    const r = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    playback.t = r;
  }

  const progressPct = $derived(`${(playback.t * 100).toFixed(2)}%`);
  const elapsed = $derived(playback.t * playback.loopLength);
</script>

<div class="timeline">
  <button class="play" class:on={playback.playing} disabled={!enabled} onclick={toggle} title="Play / pause">
    {#if playback.playing}
      <Icon name="pause" size={14} />
    {:else}
      <Icon name="play" size={14} />
    {/if}
  </button>
  <span class="clock mono">{elapsed.toFixed(1)}s / {playback.loopLength.toFixed(1)}s</span>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="track"
    bind:this={trackEl}
    onpointerdown={onTrackDown}
    onpointermove={onTrackMove}
    onpointerup={onTrackUp}
    onpointercancel={onTrackUp}
  >
    <div class="rail"></div>
    <div class="fill" style="width: {progressPct}"></div>
    <div class="ticks">
      {#each Array.from({ length: 11 }) as _, i (i)}
        <span class="tick" class:major={i % 5 === 0}></span>
      {/each}
    </div>
    <div class="head" style="left: {progressPct}"></div>
  </div>
  <span class="chip mono"><Icon name="swap" size={12} />{playback.speed}×</span>
  <span class="chip mono"><Icon name="loop" size={12} />{playback.direction === 'in' ? 'In' : 'Out'}</span>
</div>

<style>
  .timeline {
    padding: 10px 12px;
    background: var(--panel);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .play {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    border: 1px solid var(--border-strong);
    background: var(--panel-2);
    color: var(--ink);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .play.on {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .play:disabled { opacity: 0.4; cursor: not-allowed; }
  .clock {
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    min-width: 96px;
  }
  .track {
    flex: 1;
    position: relative;
    height: 18px;
    cursor: pointer;
    touch-action: none;
  }
  .rail {
    position: absolute;
    left: 0;
    right: 0;
    top: 8px;
    height: 2px;
    background: var(--border-strong);
    border-radius: 2px;
  }
  .fill {
    position: absolute;
    left: 0;
    top: 8px;
    height: 2px;
    background: var(--accent);
    border-radius: 2px;
  }
  .ticks {
    position: absolute;
    left: 0;
    right: 0;
    top: 13px;
    display: flex;
    justify-content: space-between;
  }
  .tick {
    width: 1px;
    height: 5px;
    background: var(--border-strong);
    opacity: 0.5;
  }
  .tick.major { opacity: 1; }
  .head {
    position: absolute;
    top: 2px;
    width: 14px;
    height: 14px;
    background: var(--panel);
    border: 2px solid var(--accent);
    border-radius: 999px;
    transform: translateX(-50%);
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    pointer-events: none;
  }
  .mono { font-family: var(--font-mono); }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--ink-2);
  }
</style>
