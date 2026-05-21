<script lang="ts">
  /**
   * Share-to-system menu. Sits at the bottom of the tool rail and only
   * renders when navigator.canShare reports it can ship the relevant
   * file type — effectively iOS Safari + Android Chrome, hidden on
   * most desktops. Watermarks the produced asset (PNG or video) with
   * the tententoon URL before invoking the OS share sheet.
   *
   * Re-uses the export pipelines (exports/png.ts, exports/mp4.ts) with
   * output='share' + watermark — the heavy lifting (chunked PNG render,
   * MediaRecorder-driven MP4) is unchanged.
   */

  import Icon from './Icon.svelte';
  import { ui, doc, playback } from '../../lib/ui1/state.svelte';
  import { exportPng } from '../../lib/ui1/exports/png';
  import { exportVideo } from '../../lib/ui1/exports/mp4';
  import { shareCapability, WATERMARK_TEXT } from '../../lib/ui1/exports/share';

  type Props = {
    renderFrame: (off: HTMLCanvasElement, t: number) => Promise<void> | void;
  };
  let { renderFrame }: Props = $props();

  // Compute capability once on mount — navigator.canShare is sync so
  // a constant here is fine and avoids per-render probes.
  const cap = typeof window === 'undefined'
    ? { image: false, video: { mp4: false, webm: false } }
    : shareCapability();
  const available = cap.image || cap.video.mp4 || cap.video.webm;

  let open = $state(false);
  let busy = $state(false);
  // Same progress shape as ExportMenu so the user gets a consistent
  // overlay regardless of which menu kicked off the render.
  type ProgressKind = 'image' | 'video';
  let progress = $state<{ kind: ProgressKind; fraction: number } | null>(null);
  let cancelFlag: { cancelled: boolean } | null = null;

  function toggle() { open = !open; }
  function close() { open = false; }

  function basename(ext: string): string {
    // See ExportMenu: name the file after the view, not the source image.
    const stem = ui.view === 'droste' ? 'droste' : 'tententoon';
    return stem + ext;
  }

  function hideToastAfter() {
    setTimeout(() => { if (ui.exportToast) ui.exportToast = null; }, 4000);
  }

  async function doShareImage() {
    if (!doc.image || !doc.crop || busy) return;
    busy = true;
    open = false;
    progress = { kind: 'image', fraction: 0 };
    cancelFlag = { cancelled: false };
    playback.exporting = true;
    const useDroste = ui.view === 'droste';
    try {
      await exportPng(doc.image, doc.rect, doc.crop, {
        filename: basename('.png'),
        signal: cancelFlag,
        onProgress: (f) => { progress = { kind: 'image', fraction: f }; },
        watermark: WATERMARK_TEXT,
        output: 'share',
        ...(useDroste
          ? {
              renderFrame,
              t: playback.t,
              outputSize: { w: doc.image.width, h: doc.image.height }
            }
          : {})
      });
      ui.exportToast = 'Shared.';
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ui.exportToast = msg === 'cancelled'
        ? 'Share cancelled.'
        : `Share failed: ${msg}`;
    } finally {
      progress = null;
      cancelFlag = null;
      busy = false;
      playback.exporting = false;
      hideToastAfter();
    }
  }

  async function doShareVideo() {
    if (!doc.image || busy) return;
    busy = true;
    open = false;
    progress = { kind: 'video', fraction: 0 };
    cancelFlag = { cancelled: false };
    playback.exporting = true;
    try {
      await exportVideo({
        imageWidth: doc.image.width,
        imageHeight: doc.image.height,
        loopSeconds: playback.loopLength,
        renderFrame,
        filenameBase: basename(''),
        signal: cancelFlag,
        onProgress: (p) => { progress = { kind: 'video', fraction: p.fraction }; },
        watermark: WATERMARK_TEXT,
        output: 'share'
      });
      ui.exportToast = 'Shared.';
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ui.exportToast = msg === 'cancelled'
        ? 'Share cancelled.'
        : `Share failed: ${msg}`;
    } finally {
      progress = null;
      cancelFlag = null;
      busy = false;
      playback.exporting = false;
      hideToastAfter();
    }
  }

  function cancelExport() {
    if (cancelFlag) cancelFlag.cancelled = true;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }
  $effect(() => {
    if (!open) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

{#if available}
  <div class="share-wrap">
    <button
      class="tool"
      class:active={open}
      title="Share…"
      aria-label="Share"
      onclick={toggle}
      disabled={busy || !doc.image || !doc.crop}
    >
      <Icon name="share" />
    </button>
    {#if open}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="backdrop" onclick={close}></div>
      <div class="menu" role="menu">
        <div class="header">SHARE AS</div>
        {#if cap.image}
          <button class="item" disabled={busy} onclick={doShareImage}>
            <span class="ic"><Icon name="image" size={14} /></span>
            <span class="text">
              <span class="t">Image</span>
              <span class="s">A tententoon of your picture</span>
            </span>
          </button>
        {/if}
        {#if cap.video.mp4 || cap.video.webm}
          <button class="item" disabled={busy} onclick={doShareVideo}>
            <span class="ic"><Icon name="film" size={14} /></span>
            <span class="text">
              <span class="t">Video</span>
              <span class="s">A {playback.loopLength.toFixed(0)}s looping zoom</span>
            </span>
          </button>
        {/if}
        <div class="rule"></div>
        <div class="foot">Watermarked with {WATERMARK_TEXT}</div>
      </div>
    {/if}
  </div>

  <!-- Progress modal: same look as ExportMenu's. -->
  {#if progress !== null}
    <div class="recording-mask" role="dialog" aria-modal="true" aria-label="Sharing {progress.kind}">
      <div class="recording-card">
        <div class="rec-title">Preparing {progress.kind}…</div>
        <div class="rec-bar" role="progressbar" aria-valuenow={Math.round(progress.fraction * 100)} aria-valuemin="0" aria-valuemax="100">
          <div class="rec-bar-fill" style:width="{(progress.fraction * 100).toFixed(1)}%"></div>
        </div>
        <div class="rec-text mono">{(progress.fraction * 100).toFixed(0)}%</div>
        <button class="rec-cancel" onclick={cancelExport}>Cancel</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .share-wrap { position: relative; }
  /* Match the .tool styling from ToolRail so the button reads as a
     sibling of the view buttons. */
  .tool {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: transparent;
    color: var(--ink-2);
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }
  .tool:hover:not(:disabled) { background: var(--panel-2); }
  .tool.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .tool:disabled { opacity: 0.4; cursor: not-allowed; }
  @media (pointer: coarse) {
    .tool { width: 44px; height: 44px; }
  }

  /* Menu pops up to the RIGHT of the rail (rail is on the left edge
     of the viewport). Anchored to the bottom of the share button so
     the menu reads as flowing out of it. */
  .menu {
    position: absolute;
    left: calc(100% + 8px);
    bottom: 0;
    min-width: 240px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    padding: 6px;
    z-index: 20;
  }
  /* Click-outside dismissal. */
  .backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 15;
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
  .ic { color: var(--ink-2); display: inline-flex; }
  .text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .t { font-size: 13px; font-weight: 600; }
  .s { font-size: 11px; color: var(--muted); }
  .rule { height: 1px; background: var(--border); margin: 6px 0; }
  .foot {
    padding: 4px 10px 6px;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.35;
  }
  .mono { font-family: var(--font-mono); }

  /* Progress modal — mirrors ExportMenu's classes locally so the look
     is consistent without leaking global selectors. */
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
    min-width: 280px;
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
</style>
