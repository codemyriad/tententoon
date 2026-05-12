<script lang="ts">
  import Icon from './Icon.svelte';
  import { ui, stageController, type Tool } from '../../lib/ui1/state.svelte';

  function set(tool: Tool) {
    ui.tool = tool;
  }
  // Buttons go through the CanvasStage's stage controller — same code path
  // as wheel/pinch, anchored on the viewport centre.
  const zoomIn = () => stageController.zoomIn();
  const zoomOut = () => stageController.zoomOut();
</script>

<nav class="rail" aria-label="Tools">
  <button class="tool" class:active={ui.tool === 'select'} title="Select" onclick={() => set('select')}>
    <Icon name="cursor" />
  </button>
  <button class="tool" class:active={ui.tool === 'rect'} title="Rectangle" onclick={() => set('rect')}>
    <Icon name="rect" />
  </button>
  <button class="tool" class:active={ui.tool === 'pan'} title="Pan" onclick={() => set('pan')}>
    <Icon name="hand" />
  </button>
  <div class="spacer"></div>
  <div class="divider"></div>
  <button class="tool mini" title="Zoom in" onclick={zoomIn}><Icon name="zoomIn" size={14} /></button>
  <button class="tool mini" title="Zoom out" onclick={zoomOut}><Icon name="zoomOut" size={14} /></button>
</nav>

<style>
  .rail {
    width: 48px;
    background: var(--panel);
    border-right: 1px solid var(--border);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
    flex-shrink: 0;
  }
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
  .tool:hover { background: var(--panel-2); }
  .tool.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .tool.mini { width: 28px; height: 28px; }
  .spacer { flex: 1; }
  .divider { width: 24px; height: 1px; background: var(--border); margin: 4px 0; }
</style>
