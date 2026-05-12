<script lang="ts">
  import Uploader from './components/Uploader.svelte';
  import SourcePanel from './components/SourcePanel.svelte';
  import LogPanel from './components/LogPanel.svelte';
  import RotatedLogPanel from './components/RotatedLogPanel.svelte';
  import EscherPanel from './components/EscherPanel.svelte';
  import EscherZoomPanel from './components/EscherZoomPanel.svelte';
  import ZoomPreview from './components/ZoomPreview.svelte';
  import UiVariant1 from './components/UiVariant1.svelte';
  import { imageState, loadImageFromUrl, restoreLastSession } from './lib/stores/image.svelte';
  import { identityOf, readSelection, writeSelection, type StoredSelection } from './lib/persistence';
  import { publicAssetUrl } from './lib/asset-url';

  const EXAMPLE_URL = publicAssetUrl('Droste_1260359-nevit.jpg');
  const LOCAL_URL = publicAssetUrl('droste-image.jpg');

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

  // Routing.
  //   Root `/` serves the canonical UI (UiVariant1) — the editor with
  //     top bar / canvas / inspector / timeline. This is what the user
  //     lands on by default.
  //   `/ui1` is kept around as the legacy log-domain / source-panel
  //     view (the explorable that pre-dates the editor). The name is
  //     historical: this used to be the path of the new UI before the
  //     swap, and the generateVariantPages plugin in vite.config.ts
  //     still emits dist/ui1/index.html for it.
  //   Hash `#internals` is the legacy parked-panels page (LogPanel +
  //     RotatedLogPanel), reachable inside the legacy view. Kept as a
  //     hash route both because it pre-dates the path scheme and
  //     because hash routes work without SPA-fallback configuration on
  //     static hosts.
  //   Pathname matching is tail-based (`…/ui1` or `…/ui1/`) so the same
  //     code works at root, in a subdirectory deploy (e.g. GitHub Pages
  //     under `/<repo>/ui1/`), and regardless of whether the host added
  //     a trailing slash for the directory page. `popstate` covers
  //     Back/Forward; in-app navigation uses `<a href>` (full reload).
  let pathname = $state(typeof window !== 'undefined' ? window.location.pathname : '/');
  let hash = $state(typeof window !== 'undefined' ? window.location.hash : '');
  $effect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => (hash = window.location.hash);
    const onPop = () => (pathname = window.location.pathname);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onPop);
    };
  });
  const showInternals = $derived(hash === '#internals');
  const showLegacy = $derived(/(?:^|\/)ui1\/?$/.test(pathname));

  // Bootstrap the legacy image store only when the legacy view is
  // actually being shown. The new UI has its own DropZone + state and
  // doesn't read imageState; loading the demo into the legacy store on
  // every page view would be a wasted network round-trip.
  $effect(() => {
    if (!showLegacy) return;
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
      // Persist EXAMPLE_DEFAULT the first time we use it, so a subsequent
      // visit's restoreLastSession finds the same selection instead of
      // falling through to initSelection's generic centred default.
      const storedExample = readSelection(identityOf(EXAMPLE_URL));
      if (!storedExample) writeSelection(identityOf(EXAMPLE_URL), EXAMPLE_DEFAULT);
      const examplePreset = storedExample ?? EXAMPLE_DEFAULT;
      await loadImageFromUrl(EXAMPLE_URL, examplePreset);
    })();
  });
</script>

{#if !showLegacy}
  <!--
    Default view: the editor owns the full viewport — top bar / tool
    rail / canvas / inspector / timeline — so we skip the <main>
    chrome the legacy view uses.
  -->
  <UiVariant1 />
{:else}
<main>
  <header class="page-head">
    <h1>Tententoon generator</h1>
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

    <p class="muted nav">
      <a href="../">← Back to the editor</a>
      ·
      <a href="#internals">Internals: log-domain panels →</a>
    </p>
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
{/if}

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
