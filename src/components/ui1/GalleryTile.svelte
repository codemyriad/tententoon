<script lang="ts">
  /**
   * One tile in the Gallery grid. Placeholder thumbnail until V5 lands
   * real ones — a 2-stop gradient seeded by the tententoon id so the
   * placeholders are at least distinguishable from each other.
   */
  import type { IndexEntry } from '../../lib/ui1/persistence';

  type Props = {
    entry: IndexEntry;
    isCurrent: boolean;
    onPick: (id: string) => void;
  };
  let { entry, isCurrent, onPick }: Props = $props();

  function seedHue(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  function relTime(ts: number): string {
    const delta = Date.now() - ts;
    if (delta < 60_000) return 'now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
    if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  const hue = $derived(seedHue(entry.id));
  const stamp = $derived(relTime(entry.updatedAt));
</script>

<button class="tile" class:current={isCurrent} onclick={() => onPick(entry.id)}>
  <div
    class="thumb"
    style:--h={hue}
    aria-hidden="true"
  ></div>
  <div class="meta">
    <span class="name" title={entry.name}>{entry.name}</span>
    <span class="when mono">{stamp}</span>
  </div>
  {#if isCurrent}
    <span class="badge">Current</span>
  {/if}
</button>

<style>
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    text-align: left;
    padding: 0;
    background: var(--panel);
    color: var(--ink);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 120ms, transform 120ms;
  }
  .tile:hover { border-color: var(--accent); }
  .tile:active { transform: scale(0.99); }
  .tile.current {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .thumb {
    aspect-ratio: 4 / 3;
    background:
      linear-gradient(
        135deg,
        hsl(var(--h) 55% 70%) 0%,
        hsl(calc(var(--h) + 30) 60% 45%) 100%
      );
  }

  .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px 10px;
    min-width: 0;
  }
  .name {
    font-size: 12.5px;
    line-height: 1.3;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .when {
    font-size: 11px;
    color: var(--muted);
  }

  .badge {
    position: absolute;
    top: 6px;
    right: 6px;
    background: var(--accent);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 999px;
    letter-spacing: 0.04em;
  }
</style>
