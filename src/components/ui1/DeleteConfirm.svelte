<script lang="ts">
  /**
   * Confirm dialog for destructive tententoon delete. Names the entry
   * being deleted so the user can sanity-check before pulling the
   * trigger. No "undo this delete" — gone is gone.
   */
  import Icon from './Icon.svelte';

  type Props = {
    open: boolean;
    name: string;
    onClose: () => void;
    onConfirm: () => void;
  };
  let { open, name, onClose, onConfirm }: Props = $props();

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'Enter') onConfirm();
  }

  $effect(() => {
    if (!open) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scrim" onclick={onClose}></div>

  <div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="del-title">
    <header class="head">
      <h2 id="del-title">Delete tententoon?</h2>
      <button class="x" onclick={onClose} aria-label="Close">
        <Icon name="close" size={16} />
      </button>
    </header>
    <div class="body">
      <p>
        <strong class="name">{name}</strong> will be removed from this device.
        This can't be undone.
      </p>
      <div class="actions">
        <button class="btn ghost" onclick={onClose}>Cancel</button>
        <button class="btn danger" onclick={onConfirm}>Delete</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed; inset: 0;
    background: rgba(20, 14, 10, 0.42);
    backdrop-filter: blur(2px);
    z-index: 50;
    animation: fade 120ms ease-out;
  }
  .sheet {
    position: fixed;
    z-index: 51;
    left: 50%; top: 40%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - 32px));
    background: var(--panel);
    color: var(--ink);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    animation: rise 160ms cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
  @keyframes rise {
    from { opacity: 0; transform: translate(-50%, calc(-40% + 6px)); }
    to   { opacity: 1; transform: translate(-50%, -40%); }
  }
  .head {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--border);
  }
  h2 { margin: 0; flex: 1; font-size: 15px; font-weight: 600; }
  .x {
    width: 26px; height: 26px;
    padding: 0;
    box-sizing: border-box;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .x:hover { background: var(--panel-2); color: var(--ink); border-color: transparent; }
  .body { padding: 14px 16px 16px; }
  p { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--ink-2); }
  .name { color: var(--ink); word-break: break-word; }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 14px;
  }
  .btn {
    padding: 7px 12px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--panel-2);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .btn.ghost { background: transparent; }
  .btn.ghost:hover { background: var(--panel-2); }
  .btn.danger {
    background: #c84a4a;
    border-color: #c84a4a;
    color: #fff;
  }
  .btn.danger:hover { background: #b13e3e; border-color: #b13e3e; }
</style>
