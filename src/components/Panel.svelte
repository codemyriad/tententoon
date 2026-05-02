<script lang="ts">
  // Common chrome for the math pipeline panels.
  //
  // Pass `title` as a snippet for the heading, plus optional `chips` (right
  // side of header), `controls` (row above the body), and `hint` (caption
  // paragraph below). Whatever children the caller passes — typically a
  // canvas — render in the body. Single source of truth for spacing,
  // chip / control / hint styling. Everything else lives in caller styles.

  import type { Snippet } from 'svelte';

  type Props = {
    title: Snippet;
    chips?: Snippet;
    controls?: Snippet;
    hint?: Snippet;
    children: Snippet;
  };

  let { title, chips, controls, hint, children }: Props = $props();
</script>

<section class="panel">
  <header>
    <h2>{@render title()}</h2>
    {#if chips}{@render chips()}{/if}
  </header>
  {#if controls}{@render controls()}{/if}
  {@render children()}
  {#if hint}<p class="muted hint">{@render hint()}</p>{/if}
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 1240px;
  }
  .panel header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .panel header h2 { margin: 0; }
  .hint {
    font-size: 0.85rem;
    max-width: 720px;
  }

  /* Inner chip / control elements live in <slot>-passed markup, so we
     reach them through :global() here instead of redeclaring in every
     panel. Scoped to .panel so we don't bleed into the rest of the app. */
  .panel :global(.chips) {
    display: flex;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .panel :global(.chip) {
    padding: 0.2em 0.55em;
    border: 1px solid var(--border);
    color: var(--fg);
  }
  .panel :global(.controls) {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
    flex-wrap: wrap;
  }
  .panel :global(.controls label) {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted);
  }
  .panel :global(canvas) {
    display: block;
    border: 1px solid var(--border);
    background: var(--bg);
  }
</style>
