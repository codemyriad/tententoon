# Pre-plan guide — 4-panel pipeline explorable

**Status:** pre-plan (context + decisions to settle *before* writing the plan). Not a plan.

## 1. What we're building

A new view, separate from the editor, that splits the viewport into a 2×2 grid
showing the Droste→Escher math pipeline live:

```
┌─────────────────────┬─────────────────────┐
│  TOP-LEFT            │  TOP-RIGHT           │
│  source image +      │  log(z − c)          │
│  draggable/resizable │  (log-polar lattice) │
│  rectangle (nest)    │                      │
├─────────────────────┼─────────────────────┤
│  BOTTOM-LEFT         │  BOTTOM-RIGHT        │
│  rotated log         │  tententoon          │
│  log rotated by β    │  (final Escher spiral)│
└─────────────────────┴─────────────────────┘
```

Dragging/resizing the rect in top-left updates the other three panels live.
This is the spirit of the deleted `#internals` pipeline view, but **fresh,
efficient code** — not a restore of the old components.

## 2. What already exists and is reusable (do NOT rewrite)

All the math survived the old-UI deletion and lives in `src/lib/math/`:

| Piece | Location | Use |
|---|---|---|
| `drosteGeometry(image, rect)` → `{S, logS, limit, rMax}` | `math/droste.ts:37` | core geometry from rect |
| `DrosteCtx` type + `sampleDroste()` (fakes Droste-invariance by folding samples into the outer ring) | `math/transforms.ts:109,135` | source sampling for all panels |
| `renderMappedDroste(out, pixels, ctx, mapInv)` — inverse-map CPU rasterizer | `math/transforms.ts:207` | log & rotated-log panels |
| `ssOffsetsForFootprint()` + supersample offsets | `math/transforms.ts:180` | anti-aliasing if needed |
| `buildRenderInputs(pixels, rect, crop, W, H)` → renderer inputs (handles crop-local geometry + cropX/cropY) | `lib/ui1/render.ts:38` | tententoon panel feed |
| `createEscherZoomRenderer()` — tiered GPU(worker)→GPU(main)→CPU spiral renderer | `lib/render/escher-zoom/index.ts:34` | tententoon panel (GPU) |
| `extractPixels(bitmap)` → ImageData | `lib/ui1/render.ts:94` | one-shot pixel extraction on load |

**The exact inverse maps for the two log panels** (recovered from the deleted
`LogPanel.svelte` / `RotatedLogPanel.svelte`; these are just `mapInv` closures
fed to `renderMappedDroste`):

- **log panel:** for output pixel→`(u,v)`, `u = log|z−c|` horizontal (period
  `logS`), `v = arg(z−c)` vertical (period `2π`). Inverse: `s = c + e^u·(cos v, sin v)`.
- **rotated log:** `β = atan2(logS, 2π)`, `L = hypot(logS, 2π)`. Un-rotate the
  pixel `(u′,v′)` by `−β` to get `(u,v)`, then same inverse as above. Canvas
  exactly `L` tall → one Droste period, top/bottom rows coincide.
- **tententoon / Escher:** `w(z) = c + (z−c)^α`, `α = 1 − i·logS/(2π)`
  (`k = logS/2π`). Note the old `EscherPanel` used a **forward/scatter** map +
  footprint supersampling; the *production* spiral uses the GPU shader
  (`escher-zoom/shader.frag.glsl`) doing inverse mapping. Prefer the production
  renderer over porting the old forward-scatter code.

## 3. What is GONE and must not be assumed

- The old `pipeline.svelte` store the deleted panels imported — **gone**.
  Geometry must be computed directly from `doc.rect`/`doc.crop` via
  `drosteGeometry` (or `buildRenderInputs`, which already does crop-local math).
- The routing in old `App.svelte` (`/ui1`, `#internals`) — **gone**. Current
  `App.svelte` renders only `<UiVariant1 />`. We need a fresh mount strategy.
- The old `Panel.svelte` chrome / `SourcePanel` / `RectanglePicker` — gone.
  Don't restore; build minimal new chrome.

## 4. Key crop nuance (don't get burned)

`drosteGeometry` assumes the nest is **image-aspect-locked** (`S = W/w` works in
both axes only if `H/h = S` too). The current editor supports *free-aspect*
nests by introducing a **working crop** (`doc.crop`) whose aspect matches the
nest; all sampling is crop-local and translated back via `cropX/cropY`. Two
clean options for the new view (settle in §6):

- **(A) Lock the rect to image aspect** → no crop machinery, simplest math,
  `crop = whole image`. Cleanest explorable.
- **(B) Reuse the crop pipeline** (`commitNewRect`/`commitResize` +
  `buildRenderInputs`) → matches editor behaviour, more code, free-aspect.

## 5. Performance shape

- log + rotated-log are **CPU** (`renderMappedDroste`, per-pixel JS loop). At
  small panel sizes (each panel is ¼ viewport, and these can render at reduced
  internal resolution) this is fine. Must **rAF-coalesce** during drag (the old
  panels did exactly this) and ideally render at a capped internal width.
- tententoon: GPU renderer is smooth even animated; CPU fallback exists.
- Drag loop touches 3 panels per frame → coalesce all three into one rAF,
  render at device-appropriate internal resolution, debounce nothing else.

## 6. Decisions to settle before planning

1. **Mount / route.** New top-level route (re-add light routing in `App.svelte`)?
   A toggle/button from the editor? A standalone HTML entry (vite emits extra
   pages — see `vite.config.ts` `generateVariantPages`)? → affects scope most.
2. **State source.** Reuse `ui1/state.svelte` `doc`/`playback` runes (get
   image load, crop helpers, undo, persistence for free) vs. a fresh minimal
   `$state` (image + rect only, zero coupling)? Reuse = less code but couples
   to editor concerns.
3. **Aspect handling.** Option A (lock to image aspect, no crop) vs B (crop
   pipeline). Recommend A for a clean explorable unless free-aspect is required.
4. **Tententoon animation.** Static still (recompute on rect change only) vs
   the live zoom loop (`playback.t`, GPU renderer). Static is far simpler; the
   loop pulls in playback state + renderer lifecycle.
5. **Rect editor source.** `CanvasStage.svelte` is 744 lines (zoom/pan/crop/
   handles/thirds). The new top-left panel needs only marquee + move + resize.
   Build a slim ~150-line rect editor, or extract/reuse a subset of CanvasStage?
6. **Internal render resolution & supersampling.** Fixed cap (e.g. log panels
   ≤ ~480px wide) + `ssOffsetsForFootprint` on/off. Affects sharpness vs cost.
7. **Overlays.** Lattice dashed grid (log), period midline (rotated), limit-
   point marker, chips showing `S`, `logS`, `β`, `L`. Which to include.

## 7. Suggested default answers (for a tight first pass)

Lean, low-coupling explorable: **A4 standalone-ish**:
- New lightweight route or single component mounted via a query/hash, kept out
  of the editor's render path (mirror how the old `showLegacy` gate worked but
  minimal).
- Fresh minimal `$state` (image + rect), **image-aspect-locked rect** (no crop).
- Slim purpose-built rect editor for top-left.
- log + rotated-log via `renderMappedDroste`, rAF-coalesced, capped resolution.
- tententoon: **static** via `renderMappedDroste` Escher inverse map *or*
  `createEscherZoomRenderer` at `t` fixed — decide in plan based on whether we
  want the animated spiral.
- Overlays: lattice grid + limit-point dot + a small chip row per panel.

## 8. Open questions for the user

- Is the tententoon panel **animated** (zoom loop) or a **still**?
- Should this view **share the loaded image / selection with the editor**, or be
  fully standalone (own uploader)?
- How is it reached — its own URL, or a button inside the existing app?
- Free-aspect rect, or lock to image aspect (recommended)?
