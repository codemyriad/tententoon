<script lang="ts">
  import Icon from './Icon.svelte';
  import { ui, doc, playback } from '../../lib/ui1/state.svelte';
  import { exportPng } from '../../lib/ui1/exports/png';
  import { exportVideo, pickMimeType } from '../../lib/ui1/exports/mp4';

  // Caller passes a per-frame render fn (which renders to ANY canvas at
  // a given progress t ∈ [0,1)). The MP4 export now drives a hidden
  // canvas with this fn — the live preview is no longer captured, so the
  // user can scrub / click during a recording without corrupting it.
  type Props = {
    canvas: HTMLCanvasElement | null;
    renderFrame: (off: HTMLCanvasElement, t: number) => Promise<void> | void;
  };
  let { renderFrame }: Props = $props();

  let busy = $state(false);
  let videoProgress = $state<number | null>(null); // 0..1; null = idle
  // Cancellation flag handed to exportVideo so it can bail on next frame.
  let videoCancel: { cancelled: boolean } | null = null;

  const videoExt = $derived.by(() => pickMimeType()?.ext ?? 'webm');

  async function doPng() {
    if (!doc.image || busy) return;
    busy = true;
    ui.exportMenuOpen = false;
    try {
      await exportPng(doc.image, doc.rect, basename('.png'));
      ui.exportToast = 'PNG saved.';
    } catch (e) {
      ui.exportToast = `PNG failed: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      busy = false;
      hideToastAfter();
    }
  }

  async function doVideo() {
    if (!doc.image || busy) return;
    busy = true;
    ui.exportMenuOpen = false;
    videoProgress = 0;
    videoCancel = { cancelled: false };
    try {
      const { ext } = await exportVideo({
        imageWidth: doc.image.width,
        imageHeight: doc.image.height,
        loopSeconds: playback.loopLength,
        renderFrame,
        filenameBase: basename(''),
        signal: videoCancel,
        onProgress: (p) => { videoProgress = p.fraction; }
      });
      ui.exportToast = `Saved .${ext}.`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ui.exportToast = msg === 'cancelled' ? 'Export cancelled.' : `Video failed: ${msg}`;
    } finally {
      videoProgress = null;
      videoCancel = null;
      busy = false;
      hideToastAfter();
    }
  }

  function cancelVideo() {
    if (videoCancel) videoCancel.cancelled = true;
  }

  function basename(ext: string): string {
    const stem = doc.imageName ? doc.imageName.replace(/\.[^.]+$/, '') : 'tententoon';
    return stem + ext;
  }

  function hideToastAfter() {
    setTimeout(() => {
      if (ui.exportToast) ui.exportToast = null;
    }, 4000);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') ui.exportMenuOpen = false;
  }

  $effect(() => {
    if (!ui.exportMenuOpen) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

{#if ui.exportMenuOpen}
  <div class="menu" role="menu">
    <div class="header">EXPORT AS</div>
    <button class="item" disabled={busy || !doc.image} onclick={doPng}>
      <span class="ic"><Icon name="image" size={14} /></span>
      <span class="text">
        <span class="t">PNG</span>
        <span class="s">Still frame · {doc.image?.width ?? 0}×{doc.image?.height ?? 0}</span>
      </span>
      <span class="dl"><Icon name="download" size={14} /></span>
    </button>
    <button class="item hi" disabled={busy || !doc.image} onclick={doVideo}>
      <span class="ic"><Icon name="film" size={14} /></span>
      <span class="text">
        <span class="t">{videoExt.toUpperCase()}</span>
        <span class="s">{playback.loopLength.toFixed(0)}s loop · isolated render, can't be disturbed</span>
      </span>
      <span class="dl"><Icon name="download" size={14} /></span>
    </button>
    <div class="rule"></div>
    <div class="foot">
      <span>All exports run locally</span>
      <span class="mono">⌘E</span>
    </div>
  </div>
{/if}

<!--
  Modal overlay during a video export. Blocks UI clicks (covers the page)
  so the user can't drift attention into something they expect to affect
  the output; shows live progress so they know it's working; offers a
  Cancel button. The actual rendering is happening off-screen, so user
  panics don't corrupt anything either way — this is purely a clarity
  affordance.
-->
{#if videoProgress !== null}
  <div class="recording-mask" role="dialog" aria-modal="true" aria-label="Exporting video">
    <div class="recording-card">
      <div class="rec-title">Exporting {videoExt.toUpperCase()}…</div>
      <div class="rec-bar" role="progressbar" aria-valuenow={Math.round(videoProgress * 100)} aria-valuemin="0" aria-valuemax="100">
        <div class="rec-bar-fill" style:width="{(videoProgress * 100).toFixed(1)}%"></div>
      </div>
      <div class="rec-text mono">
        {(videoProgress * 100).toFixed(0)}% · {(videoProgress * playback.loopLength).toFixed(1)}s / {playback.loopLength.toFixed(1)}s
      </div>
      <button class="rec-cancel" onclick={cancelVideo}>Cancel</button>
    </div>
  </div>
{/if}

{#if ui.exportToast}
  <div class="toast">{ui.exportToast}</div>
{/if}

<style>
  .menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 6px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    min-width: 280px;
    padding: 6px;
    z-index: 10;
  }
  .header {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--muted);
    padding: 6px 10px 4px;
    letter-spacing: 0.06em;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    background: transparent;
    border: 0;
    width: 100%;
    text-align: left;
    color: var(--ink);
    font: inherit;
  }
  .item:hover:not(:disabled) { background: var(--panel-2); }
  .item:disabled { opacity: 0.5; cursor: not-allowed; }
  .item.hi { background: var(--accent-soft); }
  .item.hi .ic { color: var(--accent); }
  .ic { color: var(--ink-2); display: inline-flex; }
  .text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .t { font-size: 13px; font-weight: 600; }
  .s { font-size: 11px; color: var(--muted); }
  .dl { color: var(--muted); display: inline-flex; }
  .rule { height: 1px; background: var(--border); margin: 6px 0; }
  .foot {
    padding: 4px 10px 6px;
    font-size: 11px;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
  }
  .mono { font-family: var(--font-mono); }
  .recording-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(2px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .recording-card {
    background: var(--panel);
    color: var(--ink);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 20px 22px;
    min-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .rec-title { font-size: 14px; font-weight: 600; }
  .rec-bar {
    height: 8px;
    background: var(--panel-2);
    border-radius: 4px;
    overflow: hidden;
  }
  .rec-bar-fill {
    height: 100%;
    background: var(--accent);
    transition: width 80ms linear;
  }
  .rec-text {
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .rec-cancel {
    align-self: flex-end;
    padding: 5px 12px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    border-radius: 6px;
    background: transparent;
    color: var(--ink-2);
    border: 1px solid var(--border);
  }
  .rec-cancel:hover { background: var(--panel-2); color: var(--ink); }
  .toast {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--ink);
    color: var(--bg);
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 100;
    box-shadow: var(--shadow);
  }
</style>
