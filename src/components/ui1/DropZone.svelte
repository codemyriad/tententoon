<script lang="ts">
  import Icon from './Icon.svelte';
  import { ui, doc, setImage } from '../../lib/ui1/state.svelte';
  import { loadFile, loadUrl } from '../../lib/ui1/file';
  import { publicAssetUrl } from '../../lib/asset-url';

  let dragOver = $state(false);
  let input: HTMLInputElement;
  let errorMsg = $state<string | null>(null);

  async function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    const r = await loadFile(files[0]);
    if (r.ok) {
      setImage(r.image, r.name);
      errorMsg = null;
    } else {
      errorMsg = r.reason;
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    handle(e.dataTransfer?.files ?? null);
  }

  async function trySample() {
    const r = await loadUrl(publicAssetUrl('Droste_1260359-nevit.jpg'));
    if (r.ok) {
      setImage(r.image, r.name);
      // Tuned rect for the bundled Droste sample — lands near the
      // photograph's natural focal point so the spiral preview has a
      // sensible starting frame instead of a 0×0 rect.
      doc.rect = { x: 340, y: 327, w: 595, h: 478 };
    } else {
      errorMsg = r.reason;
    }
  }

  function onPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) {
          const files = new DataTransfer();
          files.items.add(f);
          handle(files.files);
          return;
        }
      }
    }
  }

  $effect(() => {
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });
</script>

<div
  class="drop"
  class:over={dragOver}
  ondragover={(e) => { e.preventDefault(); dragOver = true; }}
  ondragleave={() => (dragOver = false)}
  ondrop={onDrop}
  role="region"
  aria-label="Image drop zone"
>
  <span class="bigicon"><Icon name="uploadBig" size={28} stroke={1.8} /></span>
  <div class="h">Drop an image to start</div>
  <div class="s">or paste from clipboard · click to choose · JPG, PNG, WebP up to 20 MB</div>
  <div class="actions">
    <button class="btn primary" onclick={() => input.click()}>
      <Icon name="upload" size={14} />Choose file
    </button>
    <button class="btn ghost" onclick={trySample}>Try with sample</button>
  </div>
  <span class="footnote mono">Stays in your browser. Nothing uploaded.</span>
  {#if errorMsg}
    <span class="error mono">· {errorMsg}</span>
  {/if}
  <input
    bind:this={input}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    hidden
    onchange={(e) => handle((e.currentTarget as HTMLInputElement).files)}
  />
</div>

<style>
  .drop {
    width: 78%;
    max-width: 640px;
    aspect-ratio: 16 / 10;
    border: 2px dashed var(--border-strong);
    border-radius: 14px;
    background: var(--panel);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    color: var(--ink-2);
    padding: 24px;
    margin: 32px auto;
    transition: border-color 120ms, background-color 120ms;
  }
  .drop.over {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .bigicon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: var(--accent-soft);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .h { font-size: 22px; font-weight: 600; color: var(--ink); }
  .s { font-size: 14px; color: var(--muted); text-align: center; }
  .actions { display: flex; gap: 8px; margin-top: 6px; }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--ink);
  }
  .btn:hover { background: var(--panel-2); }
  .btn.primary {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .btn.ghost { background: transparent; border-color: transparent; }
  .footnote { font-size: 11px; color: var(--muted); margin-top: 6px; font-family: var(--font-mono); }
  .error { font-size: 11px; color: var(--accent); margin-top: 4px; font-family: var(--font-mono); }
  .mono { font-family: var(--font-mono); }
</style>
