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
  import Timeline from './ui1/Timeline.svelte';
  import DropZone from './ui1/DropZone.svelte';
  import {
    ui, doc, playback, commitTranslate,
    applyTheme, readThemeOverride
  } from '../lib/ui1/state.svelte';
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

  // Theme: apply the user's override (localStorage) or, absent that, the
  // OS preference. Listen for OS changes and re-apply when no override
  // is set so the editor flips with the system at runtime.
  $effect(() => {
    applyTheme();
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (!readThemeOverride()) applyTheme(); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });
</script>

<div class="ui1-root theme-{ui.theme}">
  <TopBar {canvas} {renderFrame} />
  <div class="body">
    <ToolRail {renderFrame} />
    {#if phase() === 'empty'}
      <section class="empty"><DropZone /></section>
    {:else}
      <div class="canvas-col">
        <!--
          Both stages stay mounted in every view mode — PreviewStage
          owns the renderFrame binding the export menu relies on, so
          unmounting it on `source` would break export-from-source.
          The `view-*` class hides the inactive stage with display:none,
          which also short-circuits PreviewStage's render effect via
          its 0×0 ResizeObserver readout.
        -->
        <div class="stages view-{ui.view}">
          <CanvasStage />
          <PreviewStage
            bindCanvas={(c) => (canvas = c)}
            bindRenderFrame={(fn) => (renderFrame = fn)}
          />
        </div>
        <Timeline />
      </div>
    {/if}
  </div>
</div>

<style>
  .ui1-root {
    display: flex;
    flex-direction: column;
    /* 100vh on iOS Safari includes the dynamic URL bar — the bottom
       playback strip slides below the visible viewport. dvh sizes to
       what's actually on screen and re-flows when the URL bar shows
       or hides. Fallback for older browsers stays at vh. */
    height: 100vh;
    height: 100dvh;
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
    overflow-y: auto;
  }
  /* Phones: 32 px outer padding crowds a 360–390 viewport. Tighten and
     let the drop card hug the available width. */
  @media (max-width: 720px) {
    .empty { padding: 16px; }
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
  /* View-mode visibility. CanvasStage renders as <section class="stage">,
     PreviewStage as <section class="preview"> — hide the unwanted one
     by tag-class. */
  .stages.view-source :global(.preview) { display: none; }
  .stages.view-preview :global(.stage) { display: none; }
  /* Stack the split view vertically only when the viewport is *both*
     narrow AND portrait — phones in landscape have horizontal room
     and side-by-side reads fine there. Stacking on a 844×390 phone
     landscape would squeeze each stage to ~120 px tall, which is
     unusable for cropping. */
  @media (orientation: portrait) and (max-width: 900px) {
    .stages.view-split { flex-direction: column; }
  }
  /* Pure-narrow fallback for very small windows (devtools-open
     desktop) where orientation may not be reported reliably. */
  @media (max-width: 640px) {
    .stages.view-split { flex-direction: column; }
  }
</style>
