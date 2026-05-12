<script lang="ts">
  /**
   * UI variant 1 — Approach C "Tool App".
   *
   * Layout: top bar · left tool rail · canvas stage · right inspector ·
   * bottom timeline. Matches the design in assets/hifi/screens.jsx.
   *
   * State lives in src/lib/ui1/state.svelte.ts (ui / doc / playback runes).
   * The renderer is the project's existing tier-aware GPU spiral pipeline.
   * Exports (PNG / video / GIF) go through src/lib/ui1/exports/*.
   *
   * Reachable at `/ui1`. Independent from the main view's stores so the
   * two variants don't fight over state.
   */

  import './ui1/tokens.css';
  import TopBar from './ui1/TopBar.svelte';
  import ToolRail from './ui1/ToolRail.svelte';
  import CanvasStage from './ui1/CanvasStage.svelte';
  import PreviewStage from './ui1/PreviewStage.svelte';
  import Inspector from './ui1/Inspector.svelte';
  import Timeline from './ui1/Timeline.svelte';
  import DropZone from './ui1/DropZone.svelte';
  import { ui, doc, playback, commitTranslate } from '../lib/ui1/state.svelte';
  import { phase } from '../lib/ui1/render';

  // Plumbing the live canvas + a render-frame fn up to the export menu in
  // the top bar. Both are set by CanvasStage when it mounts.
  let canvas = $state<HTMLCanvasElement | null>(null);
  let renderFrame = $state<(off: HTMLCanvasElement, t: number) => Promise<void>>(
    async () => {}
  );

  // Keyboard shortcuts (HANDOFF §8): Space, [, ], ⌘E, Esc, arrows.
  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (inField) return;
    if (e.key === ' ') {
      if (phase() === 'edit' || phase() === 'playing') {
        e.preventDefault();
        playback.playing = !playback.playing;
      }
    } else if (e.key === '[') {
      playback.t = Math.max(0, playback.t - 0.02);
    } else if (e.key === ']') {
      playback.t = Math.min(1, playback.t + 0.02);
    } else if ((e.metaKey || e.ctrlKey) && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault();
      ui.exportMenuOpen = !ui.exportMenuOpen;
    } else if (e.key === 'Escape') {
      ui.exportMenuOpen = false;
    } else if (doc.rect.w > 0 && doc.rect.h > 0) {
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); commitTranslate({ ...doc.rect, x: doc.rect.x - step }); }
      if (e.key === 'ArrowRight') { e.preventDefault(); commitTranslate({ ...doc.rect, x: doc.rect.x + step }); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); commitTranslate({ ...doc.rect, y: doc.rect.y - step }); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); commitTranslate({ ...doc.rect, y: doc.rect.y + step }); }
    }
  }

  $effect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="ui1-root theme-{ui.theme}">
  <TopBar {canvas} {renderFrame} />
  <div class="body">
    <ToolRail />
    {#if phase() === 'empty'}
      <section class="empty"><DropZone /></section>
    {:else}
      <div class="canvas-col">
        <div class="stages">
          <CanvasStage />
          <PreviewStage
            bindCanvas={(c) => (canvas = c)}
            bindRenderFrame={(fn) => (renderFrame = fn)}
          />
        </div>
        <Timeline />
      </div>
    {/if}
    <Inspector />
  </div>
</div>

<style>
  .ui1-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg);
    color: var(--ink);
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }
  .canvas-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .stages {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  /* On narrow viewports the side-by-side split squeezes both panes to
     uselessly thin columns. Stack them vertically instead — image+rect
     on top, spiral preview below. The breakpoint is generous because
     even at 1000 px (devtools open) the side-by-side becomes painful. */
  @media (max-width: 1000px) {
    .stages { flex-direction: column; }
  }
</style>
