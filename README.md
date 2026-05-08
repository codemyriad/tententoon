# Droste Explorable

An interactive walkthrough of the conformal map behind M. C. Escher's
*Print Gallery* — the **log → rotate → exp** trick that turns a
self-similar zoom into a closed spiral loop.

You place a self-similar nest inside an image and the page renders the
intermediate stages of the pipeline side by side: the source with its
nest and crop, the log-polar unwrap, the rotated log strip, the Escher
deformation, an animated infinite spiral zoom, and a zoom preview at
the limit point.

## Quick start

Requires Node 18+ (or Bun). Install dependencies, start the dev
server, and open http://localhost:5173.

```sh
# Bun (matches the committed lockfile)
bun install
bun run dev

# or npm
npm install
npm run dev
```

The page boots with a default example image
(`public/Droste_1260359-nevit.jpg`, CC BY-SA 3.0 — see
`public/ATTRIBUTION.txt`). Drop your own image onto the uploader to
swap it in; the selection persists in `localStorage` per image.

## Scripts

| Command           | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `bun run dev`     | Vite dev server on `127.0.0.1:5173`.                                 |
| `bun run build`   | Production build to `dist/`.                                         |
| `bun run preview` | Serve the production build locally.                                  |
| `bun run check`   | `svelte-check` against `tsconfig.json`.                              |
| `bun run smoke`   | Bootstrap smoke test — needs the dev server running (see below).     |

`npm run …` works for all of the above.

## Smoke test

`scripts/smoke.mjs` is a small set of guard-rails for regressions that
have bitten this codebase before — example image being served as
HTML, the bootstrap effect looping on errors, the GPU/CPU tier wiring
being bypassed, etc. It assumes the dev server is already up:

```sh
bun run dev          # in one terminal
bun run smoke        # in another (defaults to http://localhost:5173)
SMOKE_URL=http://127.0.0.1:5173 bun run smoke   # override target
```

## Optional: AI source upscale (fal.ai)

The `EscherZoomPanel` can opt-in to a higher-resolution source by
calling a dev-only proxy at `/api/upscale`. The proxy lives in
`vite.config.ts` and forwards to [fal.run](https://fal.ai/) using a
key from the dev-server environment — the key never reaches the
browser. To enable it:

```sh
FAL_API_KEY=fal_… bun run dev
```

Without `FAL_API_KEY` the proxy returns 503 and the panel falls back
to the original source bitmap. The proxy is *deliberately* dev-only;
shipping this to production would need a real backend.

## Local image override

If `public/droste-image.jpg` exists, the bootstrap loader prefers it
over the bundled example. The path is gitignored so you can keep a
personal default without committing it. If the file is missing the
loader silently falls back to the example.

## Stack

- [Svelte 5](https://svelte.dev/) (runes-mode reactivity)
- [Vite 5](https://vitejs.dev/)
- [twgl.js](https://twgljs.org/) for the WebGL2 spiral-zoom backend
- TypeScript

The Escher zoom panel renders through a tiered backend
(`src/lib/render/escher-zoom`): WebGL2 in a Worker → WebGL2 on the
main thread → CPU pixel loop, with automatic demotion if a tier fails
to init or the GL context is lost. Software-only WebGL2
(SwiftShader/llvmpipe) is refused on purpose — the CPU JS path is
faster than a software rasteriser for this shader.

## Background reading

- `devnotes.txt` — the math, in increasing concreteness (shader
  view, complex-analysis view, Escher view).
- `architecture-attempt.txt` — design notes on the pipeline.
- `The print gallery.txt` — Lenstra's reconstruction paper, in plain
  text.
- `fea-escher.pdf` — the corresponding AMS Notices article.

## Attribution

The default example image is `Droste_1260359-nevit.jpg` by Nevit
Dilmen, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
Source: <https://commons.wikimedia.org/wiki/File:Droste_1260359-nevit.jpg>.
