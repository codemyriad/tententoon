<script lang="ts">
  import Icon from './Icon.svelte';
  import ExportMenu from './ExportMenu.svelte';
  import { ui, doc, setImage, commitNewRect } from '../../lib/ui1/state.svelte';
  import { loadFile } from '../../lib/ui1/file';

  type Props = {
    canvas: HTMLCanvasElement | null;
    renderFrame: (off: HTMLCanvasElement, t: number) => Promise<void> | void;
  };
  let { canvas, renderFrame }: Props = $props();

  let input: HTMLInputElement;

  function reset() {
    // Zero rect → commitNewRect also nulls doc.crop so the working
    // frame returns to "none" alongside the rect.
    commitNewRect({ x: 0, y: 0, w: 0, h: 0 });
  }

  async function replace() {
    input.click();
  }

  async function onFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const r = await loadFile(files[0]);
    if (r.ok) setImage(r.image, r.name);
    else ui.exportToast = r.reason;
  }
</script>

<header class="top">
  <div class="brand">
    <span class="logo">t</span>
    <span class="name">tententoon</span>
  </div>
  <span class="div"></span>
  {#if doc.image}
    <span class="file">
      <Icon name="image" size={14} />
      <span class="fname">{doc.imageName || 'image'}</span>
      <span class="dim mono">· {doc.image.width}×{doc.image.height}</span>
    </span>
  {:else}
    <span class="file empty">Untitled · no image</span>
  {/if}
  <span class="grow"></span>
  <button class="btn ghost" onclick={reset} disabled={!doc.image}>
    <Icon name="reset" size={14} />Reset
  </button>
  <button class="btn" onclick={replace}>
    <Icon name="upload" size={14} />Replace
  </button>
  <input
    bind:this={input}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    hidden
    onchange={(e) => onFile((e.currentTarget as HTMLInputElement).files)}
  />
  <div class="exp-wrap">
    <button
      class="btn primary"
      onclick={() => (ui.exportMenuOpen = !ui.exportMenuOpen)}
      disabled={!doc.image}
    >
      <Icon name="download" size={14} />Export
      <span class="caret"><Icon name="caret" size={12} /></span>
    </button>
    <ExportMenu {canvas} {renderFrame} />
  </div>
</header>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    position: relative;
    flex-shrink: 0;
  }
  .brand { display: flex; align-items: center; gap: 8px; }
  .logo {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    background: var(--accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 13px;
  }
  .name { font-size: 13px; font-weight: 600; }
  .div { width: 1px; height: 18px; background: var(--border); }
  .file {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-2);
  }
  .file.empty { color: var(--muted); }
  .fname { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dim { color: var(--muted); font-size: 11px; }
  .mono { font-family: var(--font-mono); }
  .grow { flex: 1; }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border-radius: 7px;
    background: var(--panel);
    color: var(--ink);
    border: 1px solid var(--border);
  }
  .btn:hover:not(:disabled) { background: var(--panel-2); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn.ghost { background: transparent; border-color: transparent; }
  .btn.ghost:hover:not(:disabled) { background: var(--panel-2); }
  .btn.primary {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
    box-shadow: 0 1px 0 rgba(0,0,0,0.05);
  }
  .btn.primary:hover:not(:disabled) {
    background: var(--accent);
    filter: brightness(1.08);
  }
  .caret { opacity: 0.7; margin-left: 2px; display: inline-flex; }
  .exp-wrap { position: relative; }
</style>
