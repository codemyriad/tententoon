<script lang="ts">
  import UiVariant1 from './components/UiVariant1.svelte';
  import { bootRestore } from './lib/ui1/tententoon.svelte';

  let bootstrapped = false;
  $effect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    void bootRestore();
  });
</script>

<UiVariant1 />
