#!/usr/bin/env node
/**
 * Bootstrap smoke test.
 *
 * Catches the two regressions that ate this codebase's freshness story:
 *   1. The example image stops being served as image/jpeg (corrupted public asset,
 *      misconfigured plugin, etc.) — the loader can't decode it, page never renders.
 *   2. Vite's SPA fallback no longer returns text/html for missing assets — would
 *      mean our content-type guard in App.svelte's loader is solving a problem
 *      that no longer exists, so the guard could regress unnoticed.
 *
 * The test also asserts the example bytes are a real JPEG, not whatever HTML
 * Vite would substitute. That's the actual class of bug that surfaced
 * "could not be decoded" in incognito sessions.
 *
 * Usage: `bun run smoke` (assumes dev server on http://localhost:5173).
 *        Set SMOKE_URL to point elsewhere.
 */

const BASE = process.env.SMOKE_URL ?? 'http://localhost:5173';

let failures = 0;

function check(label, ok, detail) {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

async function head(path) {
  try {
    const res = await fetch(BASE + path, { method: 'HEAD' });
    return { status: res.status, contentType: res.headers.get('content-type') ?? '' };
  } catch (e) {
    return { status: 0, contentType: '', error: e.message };
  }
}

async function main() {
  console.log(`smoke @ ${BASE}`);

  // 1. The committed example must be served as a real image.
  const example = await head('/Droste_1260359-nevit.jpg');
  check(
    'example image is image/*',
    example.status === 200 && example.contentType.startsWith('image/'),
    `got ${example.status} ${example.contentType}`
  );

  // 2. Decode the bytes. A 200 with image/jpeg content-type but corrupted bytes
  //    would still break the app — check the JPEG SOI marker (FF D8).
  try {
    const res = await fetch(BASE + '/Droste_1260359-nevit.jpg');
    const buf = new Uint8Array(await res.arrayBuffer());
    check(
      'example bytes start with JPEG SOI marker',
      buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8,
      `length=${buf.length}, first bytes=${[...buf.slice(0, 4)].map((b) => b.toString(16)).join(' ')}`
    );
  } catch (e) {
    check('example bytes start with JPEG SOI marker', false, e.message);
  }

  // 3. The optional local override path must still trigger Vite's SPA fallback
  //    (text/html) when the file isn't there. The loader's content-type guard
  //    is the last line of defence against that fallback feeding HTML to
  //    createImageBitmap. If this assertion ever breaks, re-evaluate the guard.
  const local = await head('/droste-image.jpg');
  check(
    'missing local image returns SPA fallback (text/html)',
    local.status === 200 && local.contentType.startsWith('text/html'),
    `got ${local.status} ${local.contentType}`
  );

  // 4. The bootstrap effect must stay one-shot. Without the sentinel, a failed
  //    initial load flips `loading` back to false with `source` still null;
  //    the effect re-fires and relaunches the loader → freeze. The check is
  //    a static grep so a refactor that drops the sentinel fails the smoke
  //    test before it ships.
  const fs = await import('node:fs/promises');
  try {
    const src = await fs.readFile(new URL('../src/App.svelte', import.meta.url), 'utf8');
    check(
      'App.svelte bootstrap effect is one-shot (sentinel present)',
      /bootstrapped\s*=\s*true/.test(src) && /if\s*\(\s*bootstrapped/.test(src),
      'sentinel not found — regression risk: bootstrap effect can loop on errors'
    );
    check(
      'App.svelte still has a fallback path (local → example)',
      /loadImageFromUrl\(LOCAL_URL/.test(src) && /loadImageFromUrl\(EXAMPLE_URL/.test(src),
      'fallback chain missing — regression risk: missing local file leaves the page empty'
    );
  } catch (e) {
    check('App.svelte readable for static checks', false, e.message);
  }

  // 5. initSelection must NOT read selectionState after writing to it.
  //    A read-after-write makes the calling $effect track that property as
  //    a dependency, and the next call writes a fresh object reference,
  //    re-firing the effect → infinite loop → page freeze, F12 dead, full
  //    renderer crash. This bit us once; the pattern is subtle enough to
  //    warrant a lint-style guard.
  try {
    const sel = await fs.readFile(new URL('../src/lib/stores/selection.svelte.ts', import.meta.url), 'utf8');
    const initBody = sel.match(/export function initSelection\([^)]*\)\s*{([\s\S]*?)\n}/)?.[1] ?? '';
    // Find the first line that writes `selectionState.<prop> = ...`. After
    // that point, any non-assignment read of `selectionState.` is the bug.
    const lines = initBody.split('\n');
    const firstWriteIdx = lines.findIndex((l) => /\bselectionState\.\w+\s*=/.test(l));
    let badLine = -1;
    if (firstWriteIdx >= 0) {
      for (let i = firstWriteIdx + 1; i < lines.length; i++) {
        // Reads = `selectionState.X` not followed by `=` (and not `==`/`===`).
        // Writes = `selectionState.X = ...` (allowed).
        const stripped = lines[i].replace(/selectionState\.\w+\s*=(?!=)/g, '');
        if (/\bselectionState\./.test(stripped)) {
          badLine = i;
          break;
        }
      }
    }
    check(
      'initSelection has no read-after-write on selectionState',
      badLine === -1,
      badLine >= 0 ? `line ${badLine + 1} of initSelection reads selectionState after a write — see selection.svelte.ts` : ''
    );
  } catch (e) {
    check('selection.svelte.ts readable for read-after-write check', false, e.message);
  }

  // 6. Render-backend wiring. EscherZoomPanel must use the tier factory so
  //    WebGL2 → CPU demotion happens automatically. A panel that calls a
  //    backend constructor directly bypasses the fallback path and would
  //    crash on machines where WebGL2 returns null.
  try {
    const panel = await fs.readFile(
      new URL('../src/components/EscherZoomPanel.svelte', import.meta.url),
      'utf8'
    );
    check(
      'EscherZoomPanel routes through createEscherZoomRenderer (tier-aware)',
      /createEscherZoomRenderer\s*\(/.test(panel),
      'panel imports a backend directly — bypasses tier demotion'
    );
  } catch (e) {
    check('EscherZoomPanel.svelte readable', false, e.message);
  }

  // 7. Capability detection must refuse software WebGL2. Software-only
  //    contexts (SwiftShader, llvmpipe) are slower than the JS pixel loop
  //    for our shader; refusing them is the difference between "works
  //    poorly" and "works fast on a different tier".
  try {
    const caps = await fs.readFile(
      new URL('../src/lib/render/capabilities.ts', import.meta.url),
      'utf8'
    );
    check(
      'capability detection refuses software WebGL2',
      /SwiftShader|llvmpipe|software/i.test(caps),
      'software-renderer refusal not found — risk: slow rasteriser path is preferred over CPU JS'
    );
  } catch (e) {
    check('capabilities.ts readable', false, e.message);
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nsmoke ok');
}

main().catch((e) => {
  console.error('smoke crashed:', e);
  process.exit(2);
});
