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
    '<path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/>',
  sun:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4 12H2"/><path d="M22 12h-2"/><path d="M19.07 4.93l-1.41 1.41"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 19.07l-1.41-1.41"/><path d="M6.34 6.34L4.93 4.93"/>',
  moon:
    '<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>',
  viewSplit:
    '<rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/>',
  viewSource:
    '<rect x="3" y="5" width="18" height="14" rx="1"/><rect x="7" y="9" width="9" height="7" rx="0.5"/>',
  viewPreview:
    '<rect x="3" y="3" width="18" height="18" rx="1"/><rect x="7" y="7" width="10" height="10" rx="0.5"/><rect x="10" y="10" width="4" height="4" rx="0.5"/>',
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98"/><path d="M15.41 6.51l-6.82 3.98"/>'
} as const;

export type IconName = keyof typeof ICON;
