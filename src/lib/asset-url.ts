/**
 * Resolve a runtime URL to a public-dir asset (e.g. the bundled demo
 * image), independent of which page loaded the bundle.
 *
 * Why this exists: vite.config.ts uses `base: './'` so the same build
 * works at host root, in a subdirectory deploy (GitHub Pages, etc.),
 * and via the per-variant index.html files emitted by
 * generateVariantPages. That makes HTML→assets references relative
 * to each HTML file — correct for the bundler's output, but a
 * runtime URL built from `import.meta.env.BASE_URL` (which is './'
 * in prod) resolves against `window.location`, so a variant page at
 * /ui1/ fetches /ui1/<filename> and 404s.
 *
 * Anchor on a stable location instead:
 *   - In production, the JS bundle always sits at <site-root>/assets/
 *     <hash>.js. `../<filename>` from import.meta.url lands in
 *     <site-root>/<filename>, regardless of which page (root, /ui1/,
 *     /<subdir>/, /<subdir>/ui1/) loaded it.
 *   - In dev, vite serves public/ from the server root, so an
 *     absolute /<filename> works from any page.
 */
export function publicAssetUrl(filename: string): string {
  if (import.meta.env.DEV) return '/' + filename;
  return new URL('../' + filename, import.meta.url).href;
}
