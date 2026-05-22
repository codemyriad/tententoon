<script lang="ts">
  /**
   * Small modal for renaming a tententoon. Inline text input, Save +
   * Cancel. Save disabled while the name is empty/whitespace. Used by
   * the TopBar name display and the Gallery tile rename action.
   */
  import Icon from './Icon.svelte';

  type Props = {
    open: boolean;
    initial: string;
    onClose: () => void;
    onSave: (name: string) => void;
  };
  let { open, initial, onClose, onSave }: Props = $props();

  let value = $state('');
  let input: HTMLInputElement | null = $state(null);

  // Reset the field every time the modal opens so reuse doesn't leak
  // a stale draft from a previous rename target.
  $effect(() => {
    if (open) {
      value = initial;
      // setTimeout so focus runs after the input mounts in the DOM.
      setTimeout(() => input?.select(), 0);
    }
  });

  const canSave = $derived(value.trim().length > 0 && value !== initial);

  function save() {
    if (!canSave) return;
    onSave(value.trim());
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'Enter') save();
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

  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rename-title">
    <header class="head">
      <h2 id="rename-title">Rename</h2>
      <button class="x" onclick={onClose} aria-label="Close">
        <Icon name="close" size={16} />
      </button>
    </header>
    <div class="body">
      <input
        bind:this={input}
        bind:value
        class="field"
        type="text"
        placeholder="Tententoon name"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="actions">
        <button class="btn ghost" onclick={onClose}>Cancel</button>
        <button class="btn primary" onclick={save} disabled={!canSave}>Save</button>
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
    display: flex;
    align-items: center;
    gap: 12px;
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
  .field {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 9px 11px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel-2);
    color: var(--ink);
    font: inherit;
    font-size: 14px;
    outline: none;
    transition: border-color 120ms;
  }
  .field:focus { border-color: var(--accent); }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
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
  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .btn.primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
