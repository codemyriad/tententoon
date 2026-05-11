/**
 * SVG icon path strings for the /ui1 chrome. Lucide-ish glyphs, kept as
 * inline strings so we don't pull in a whole icon library for the
 * twelve shapes we actually use.
 */

export const ICON = {
  cursor: '<path d="M5 3l13 7-6 1-2 7L5 3z"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  hand:
    '<path d="M7 13V6a2 2 0 014 0v6m0-2a2 2 0 014 0v3m0-1a2 2 0 014 0v4a6 6 0 01-6 6h-1a6 6 0 01-6-6v-1l-2-3a1.5 1.5 0 012.5-2L7 13z"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/>',
  pause:
    '<rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none"/>',
  download:
    '<path d="M12 4v12"/><path d="M6 12l6 6 6-6"/><path d="M4 21h16"/>',
  upload: '<path d="M12 20V8"/><path d="M6 12l6-6 6 6"/><path d="M4 21h16"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  caret: '<path d="M6 9l6 6 6-6"/>',
  swap:
    '<path d="M16 3l4 4-4 4"/><path d="M20 7H8"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h12"/>',
  loop:
    '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>',
  zoomIn:
    '<circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6"/><path d="M21 21l-5-5"/>',
  zoomOut:
    '<circle cx="11" cy="11" r="7"/><path d="M8 11h6"/><path d="M21 21l-5-5"/>',
  fullscreen:
    '<path d="M3 9V3h6"/><path d="M21 9V3h-6"/><path d="M3 15v6h6"/><path d="M21 15v6h-6"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  film:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 15h18M9 4v16M15 4v16"/>',
  gif: '<rect x="3" y="5" width="18" height="14" rx="2"/>',
  uploadBig:
    '<path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/>'
} as const;

export type IconName = keyof typeof ICON;
