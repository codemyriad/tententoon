# Tententoon

> *Een prentententoonstelling.* — M. C. Escher, 1956

A browser-native Droste machine. Drop in any photograph, frame the rectangle that should
contain a smaller copy of itself, and watch the image recurse into its own infinity — the
way the boy in Escher's *Print Gallery* stares into the picture he is standing inside of.

Everything runs locally. No uploads, no backend, no account. Just the canvas, the maths,
and your image.

---

## What it does

- **Drop or pick** any image — JPEG, PNG, anything the browser can decode.
- **Frame** a rectangle inside it. That rectangle becomes the next iteration of itself.
- **Zoom forever** — a continuous, seamless loop into (or out of) the nested copy.
- **Export** the result as a still PNG, a looping MP4, or a GIF. All produced in-browser.
- **Tweak** the spiral: pick the centre, the scale ratio, the rotation, the depth.
- **Two views**: a polished editor (top bar, tool rail, canvas, inspector, timeline) and a
  log-domain explorable for those who like to see the conformal map at work.

The geometry is the same one Escher's mathematicians used to "complete" the Print Gallery:
a log-polar warp that turns nested similarity into a straight line. We let you see both
sides of that mirror.

---

## Why "Tententoon"?

A contraction of *prentententoonstelling* — the Dutch word for "print gallery" — squeezed
the way Escher squeezed his canvas. Short enough to type, long enough to remember.

---

## Run it locally

```sh
bun install     # or: npm install
bun run dev     # or: npm run dev
```

Then open the URL Vite prints. The editor lives at `/`; the log-domain explorable lives
at `/ui1`.

### Build

```sh
bun run build       # → dist/
bun run preview     # serve dist/ locally
bun run smoke       # headless smoke test
```

---

## How it works, briefly

The Droste effect is a single operation applied to itself: take the outer image rectangle,
map it onto the user's inner rectangle, paint, repeat. After a few iterations the inner
copy is sub-pixel and we stop.

For the smooth infinite zoom, the inner rectangle's *scale ratio* `S` and rotation angle
`θ` define a logarithmic spiral. Mapping image coordinates through
`log(z - c) → log(z - c) + log(S) + iθ` turns that spiral into a translation in
log-space — which is why the loop is exactly seamless: translating by one full period
lands on the same picture.

The renderer is WebGL via [twgl.js](https://twgljs.org/), with a CPU fallback worker for
environments without a usable GL context. Supersampling adapts to the local Jacobian so
the spiral's tight centre stays sharp without paying for it across the whole frame.

---

## Tech

| Layer       | Choice |
|-------------|--------|
| UI          | Svelte 5 (runes) + Vite |
| Rendering   | WebGL (twgl.js), with worker-driven CPU fallback |
| State       | `$state` runes, plain CSS custom properties for theming |
| Exports     | `MediaRecorder` (MP4/WebM), `gifenc` (GIF), `<canvas>.toBlob` (PNG) |
| Storage     | `localStorage` for the last session's selection |
| Backend     | none — by design |

---

## Layout

```
src/
  App.svelte                  root: routing, bootstrap, panels
  components/
    EscherPanel.svelte        static Droste render
    EscherZoomPanel.svelte    animated spiral zoom (GPU + CPU fallback)
    LogPanel.svelte           log-domain view
    SourcePanel.svelte        the source-image picker with nested rect
    UiVariant1.svelte         the polished editor shell
    ui1/                      editor sub-components (tool rail, inspector, …)
  lib/
    math/                     Droste geometry, spiral, log map
    render/                   GL shaders, CPU worker
    stores/                   image + selection state
    persistence.ts            session restore
    ui1/                      editor state machine, exports
public/
  Droste_1260359-nevit.jpg    default sample image (CC BY-SA 3.0, Nevit Dilmen)
```

---

## Credits

- **The Print Gallery** — M. C. Escher, 1956. The lithograph that gave this its name and
  its blind spot.
- **The mathematical completion** — Bart de Smit and Hendrik Lenstra, 2003.
  *Artful Mathematics: The Heritage of M. C. Escher.* Notices of the AMS.
- **Default image** — *Droste effect* photograph by [Nevit Dilmen](https://commons.wikimedia.org/wiki/File:Droste_1260359-nevit.jpg),
  used under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

---

## Licence

The code is released under the MIT licence (see `LICENSE` once added). The default sample
image carries its own CC BY-SA licence; see `public/ATTRIBUTION.txt`.
