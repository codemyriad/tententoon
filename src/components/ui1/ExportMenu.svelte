<script lang="ts">
  import Icon from './Icon.svelte';
  import { ui, doc, playback } from '../../lib/ui1/state.svelte';
  import { exportPng } from '../../lib/ui1/exports/png';
  import { startRecording, pickMimeType } from '../../lib/ui1/exports/mp4';
  import { exportGif, type GifProgress } from '../../lib/ui1/exports/gif';

  // Caller passes the live canvas (used by the MP4 path), and a per-frame
  // render fn (used by the GIF path) so this component doesn't need to
  // know about the renderer.
  type Props = {
    canvas: HTMLCanvasElement | null;
    renderFrame: (off: HTMLCanvasElement, frame: number, total: number) => Promise<void> | void;
  };
  let { canvas, renderFrame }: Props = $props();

  let busy = $state(false);
  let progress = $state<{ kind: GifProgress['kind']; done: number; total: number } | null>(null);

  const mp4Ext = $derived.by(() => pickMimeType()?.ext ?? 'webm');

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
    if (!doc.image || !canvas || busy) return;
    busy = true;
    ui.exportMenuOpen = false;
    const wasPlaying = playback.playing;
    const startT = playback.t;
    playback.t = 0;
    playback.playing = true;
    try {
      const handle = startRecording(canvas, basename(''));
      // Wait for one full loop.
      await new Promise((r) => setTimeout(r, playback.loopLength * 1000));
      await handle.stop();
      ui.exportToast = `Saved .${handle.ext}.`;
    } catch (e) {
      ui.exportToast = `Video failed: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      playback.playing = wasPlaying;
      playback.t = startT;
      busy = false;
      hideToastAfter();
    }
  }

  async function doGif() {
    if (!doc.image || busy) return;
    busy = true;
    ui.exportMenuOpen = false;
    progress = { kind: 'render', done: 0, total: 1 };
    try {
      await exportGif({
        imageWidth: doc.image.width,
        imageHeight: doc.image.height,
        loopSeconds: playback.loopLength,
        renderFrame,
        filename: basename('.gif'),
        onProgress: (p) => {
          if (p.kind === 'done') progress = null;
          else if (p.kind === 'error') progress = null;
          else progress = { kind: p.kind, done: p.done, total: p.total };
        }
      });
      ui.exportToast = 'GIF saved.';
    } catch (e) {
      ui.exportToast = `GIF failed: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      progress = null;
      busy = false;
      hideToastAfter();
    }
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
    <button class="item hi" disabled={busy || !doc.image || !canvas} onclick={doVideo}>
      <span class="ic"><Icon name="film" size={14} /></span>
      <span class="text">
        <span class="t">{mp4Ext.toUpperCase()}</span>
        <span class="s">{playback.loopLength.toFixed(0)}s loop · captures live preview</span>
      </span>
      <span class="dl"><Icon name="download" size={14} /></span>
    </button>
    <button class="item" disabled={busy || !doc.image} onclick={doGif}>
      <span class="ic"><Icon name="gif" size={14} /></span>
      <span class="text">
        <span class="t">GIF</span>
        <span class="s">720p · ~18 fps · encoded in a worker</span>
      </span>
      <span class="dl"><Icon name="download" size={14} /></span>
    </button>
    <div class="rule"></div>
    <div class="foot">
      <span>All exports run locally</span>
      <span class="mono">⌘E</span>
    </div>
    {#if progress}
      <div class="progress mono">
        {progress.kind === 'render' ? 'Rendering' : 'Encoding'} · {progress.done}/{progress.total}
      </div>
    {/if}
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
  .progress {
    padding: 6px 10px;
    font-size: 11px;
    color: var(--muted);
    border-top: 1px solid var(--border);
    margin-top: 4px;
  }
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
