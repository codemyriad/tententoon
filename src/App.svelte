<script lang="ts">
  import Uploader from './components/Uploader.svelte';
  import SourcePanel from './components/SourcePanel.svelte';
  import LogPanel from './components/LogPanel.svelte';
  import RotatedLogPanel from './components/RotatedLogPanel.svelte';
  import EscherPanel from './components/EscherPanel.svelte';
  import EscherZoomPanel from './components/EscherZoomPanel.svelte';
  import ZoomPreview from './components/ZoomPreview.svelte';
  import { imageState, loadImageFromUrl, restoreLastSession } from './lib/stores/image.svelte';
  import { identityOf, readSelection, type StoredSelection } from './lib/persistence';

  const EXAMPLE_URL = `${import.meta.env.BASE_URL}Droste_1260359-nevit.jpg`;
  const LOCAL_URL = `${import.meta.env.BASE_URL}droste-image.jpg`;

  // Default starting selection for the example image (1280×960). The nest is
  // shifted slightly off image-aspect, the crop is the matching minimum
  // letterbox, and aspectLocked is off — chosen to land on a visually nice
  // S ≈ 2.11 / logS ≈ 0.747 with c near the photo's natural focal point.
  const EXAMPLE_DEFAULT: StoredSelection = {
    nest: {
      x: 343.20995532865345,
      y: 334.7223994894703,
      w: 583.5417996171027,
      h: 454.86917677089986
    },
    crop: { x: 24.21841241336756, y: 0, w: 1231.5631751732649, h: 960 },
    aspectLocked: false
  };

  // Derived from the loaded image — single source of truth for whether the
  // attribution footer should show. Replaces a manually-maintained boolean
  // that had to be set in three branches of the loader.
  const usingExample = $derived(imageState.source?.url === EXAMPLE_URL);

  // One-shot sentinel. The bootstrap effect tracks reactive state that the
  // loader itself mutates (source / loading / error), so without this it can
  // re-fire mid-load and relaunch the loader. A plain `let` is non-reactive,
  // so it doesn't add to the effect's dep set and can't trigger re-runs.
  let bootstrapped = false;

  // Hash-gated parked page. `#internals` shows the log-domain panels
  // (LogPanel + RotatedLogPanel) which were retired from the main view but
  // kept around for reuse — resurrection is one URL change away.
  let hash = $state(typeof window !== 'undefined' ? window.location.hash : '');
  $effect(() => {
    if (typeof window === 'undefined') return;
    const update = () => (hash = window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  });
  const showInternals = $derived(hash === '#internals');

  $effect(() => {
    if (bootstrapped || imageState.source) return;
    bootstrapped = true;
    (async () => {
      if (await restoreLastSession()) return;
      // Try the optional local override first. If it isn't present, Vite's
      // SPA fallback returns text/html — loadImageFromUrl will throw on
      // decode and set imageState.error. We clear and fall through. No HEAD
      // probe: HEAD doesn't disambiguate the SPA fallback any better than
      // GET, and a single round-trip is simpler.
      const localPreset = readSelection(identityOf(LOCAL_URL)) ?? undefined;
      await loadImageFromUrl(LOCAL_URL, localPreset);
      if (imageState.source?.url === LOCAL_URL) return;
      imageState.error = null;
      const examplePreset = readSelection(identityOf(EXAMPLE_URL)) ?? EXAMPLE_DEFAULT;
      await loadImageFromUrl(EXAMPLE_URL, examplePreset);
    })();
  });
</script>

<main>
  <header class="page-head">
    <h1>Droste Explorable</h1>
    <p class="muted sub">
      Place a self-similar nest inside an image. Watch the limit point emerge.
    </p>
  </header>

  {#if showInternals}
    <p class="muted nav">
      <button
        type="button"
        class="link"
        onclick={() => {
          history.pushState(null, '', window.location.pathname + window.location.search);
          hash = '';
        }}
      >← Back to main view</button>
    </p>

    <div class="row">
      <SourcePanel />
    </div>

    <div class="row">
      <LogPanel />
    </div>

    <div class="row">
      <RotatedLogPanel />
    </div>
  {:else}
    <div class="row"><Uploader /></div>

    <div class="row">
      <SourcePanel />
    </div>

    <div class="row">
      <EscherPanel />
    </div>

    <div class="row">
      <ZoomPreview />
    </div>

    <div class="row">
      <EscherZoomPanel />
    </div>

    <p class="muted nav"><a href="#internals">Internals: log-domain panels →</a></p>
  {/if}

  {#if usingExample}
    <footer class="credit muted">
      Example image:
      <a
        href="https://commons.wikimedia.org/wiki/File:Droste_1260359-nevit.jpg"
        target="_blank"
        rel="noopener noreferrer">Droste_1260359-nevit.jpg</a
      >
      by Nevit Dilmen ·
      <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer"
        >CC BY-SA 3.0</a
      >
    </footer>
  {/if}
</main>

<style>
  main {
    max-width: 1080px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .page-head {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 1rem;
  }
  .sub {
    font-size: 1rem;
    font-style: italic;
  }
  .row { width: 100%; }
  .credit {
    font-size: 0.8rem;
    border-top: 1px solid var(--border);
    padding-top: 0.75rem;
    margin-top: 1rem;
  }
  .credit a {
    color: var(--muted);
    text-decoration: underline;
    text-decoration-color: var(--border);
  }
  .credit a:hover { color: var(--teal); }
  .nav {
    font-size: 0.85rem;
    margin: 0;
  }
  .nav a {
    color: var(--muted);
    text-decoration: underline;
    text-decoration-color: var(--border);
  }
  .nav a:hover { color: var(--teal); }
  .nav .link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: var(--muted);
    text-decoration: underline;
    text-decoration-color: var(--border);
    cursor: pointer;
  }
  .nav .link:hover { color: var(--teal); }
</style>
