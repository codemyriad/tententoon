<script lang="ts">
  import { ICON, type IconName } from '../../lib/ui1/icons';

  type Props = { name: IconName; size?: number; stroke?: number };
  let { name, size = 16, stroke = 1.6 }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
>
  {@html ICON[name]}
</svg>

<style>
  svg { display: inline-block; vertical-align: middle; }
</style>
