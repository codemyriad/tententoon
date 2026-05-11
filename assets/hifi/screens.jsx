// Hi-fi screens for Approach C — Tool App. Themed via CSS variables.

// ── Icon glyphs (kept minimal — devs swap for Lucide / Phosphor)
const Icon = ({ d, size = 16, stroke = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const ICON = {
  cursor: <Icon d={<path d="M5 3l13 7-6 1-2 7L5 3z" />} />,
  rect: <Icon d={<rect x="4" y="6" width="16" height="12" rx="1" />} />,
  hand: <Icon d={<path d="M7 13V6a2 2 0 014 0v6m0-2a2 2 0 014 0v3m0-1a2 2 0 014 0v4a6 6 0 01-6 6h-1a6 6 0 01-6-6v-1l-2-3a1.5 1.5 0 012.5-2L7 13z" />} />,
  play: <Icon d={<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />} />,
  pause: <Icon d={<g><rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none"/></g>} />,
  download: <Icon d={<g><path d="M12 4v12"/><path d="M6 12l6 6 6-6"/><path d="M4 21h16"/></g>} />,
  upload: <Icon d={<g><path d="M12 20V8"/><path d="M6 12l6-6 6 6"/><path d="M4 21h16"/></g>} />,
  expand: <Icon d={<g><path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/></g>} />,
  reset: <Icon d={<g><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></g>} />,
  caret: <Icon d={<path d="M6 9l6 6 6-6"/>} size={14} />,
  swap: <Icon d={<g><path d="M16 3l4 4-4 4"/><path d="M20 7H8"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h12"/></g>} size={14} />,
  loop: <Icon d={<g><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></g>} size={14} />,
  zoomIn: <Icon d={<g><circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6"/><path d="M21 21l-5-5"/></g>} size={14} />,
  zoomOut: <Icon d={<g><circle cx="11" cy="11" r="7"/><path d="M8 11h6"/><path d="M21 21l-5-5"/></g>} size={14} />,
  fullscreen: <Icon d={<g><path d="M3 9V3h6"/><path d="M21 9V3h-6"/><path d="M3 15v6h6"/><path d="M21 15v6h-6"/></g>} size={14} />,
  image: <Icon d={<g><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></g>} size={14} />,
  film: <Icon d={<g><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 15h18M9 4v16M15 4v16"/></g>} size={14} />,
  gif: <Icon d={<g><rect x="3" y="5" width="18" height="14" rx="2"/></g>} size={14} />,
};

// ── Reusable bits ──────────────────────────────────────────────

const ToolBtn = ({ glyph, label, active, mini }) => (
  <button title={label} style={{
    width: mini ? 28 : 36, height: mini ? 28 : 36, borderRadius: 8,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--ink-2)',
    border: '1px solid', borderColor: active ? 'var(--accent)' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', padding: 0,
  }}>{glyph}</button>
);

const NumField = ({ label, value, unit }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
    <span className="mono" style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    <span style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--panel-2)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '6px 8px', fontSize: 13, color: 'var(--ink)',
    }}>
      <span className="mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span className="mono" style={{ color: 'var(--muted)', fontSize: 10 }}>{unit}</span>
    </span>
  </label>
);

const Segmented = ({ options, active }) => (
  <div style={{
    display: 'inline-flex', padding: 2, background: 'var(--panel-2)',
    border: '1px solid var(--border)', borderRadius: 7, gap: 2,
  }}>
    {options.map((o, i) => (
      <span key={i} style={{
        padding: '4px 10px', fontSize: 12, borderRadius: 5,
        background: i === active ? 'var(--panel)' : 'transparent',
        boxShadow: i === active ? 'var(--shadow)' : 'none',
        color: i === active ? 'var(--ink)' : 'var(--muted)',
        fontWeight: i === active ? 600 : 500, cursor: 'pointer',
      }}>{o}</span>
    ))}
  </div>
);

const Btn = ({ children, primary, ghost, icon, caret, size = 'md', style = {} }) => (
  <button style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: size === 'sm' ? '5px 10px' : '7px 12px',
    fontSize: size === 'sm' ? 12 : 13, fontWeight: 500,
    fontFamily: 'inherit', cursor: 'pointer', borderRadius: 7,
    background: primary ? 'var(--accent)' : (ghost ? 'transparent' : 'var(--panel)'),
    color: primary ? '#fff' : 'var(--ink)',
    border: '1px solid', borderColor: primary ? 'var(--accent)' : 'var(--border)',
    boxShadow: primary ? '0 1px 0 rgba(0,0,0,0.05)' : 'none',
    ...style,
  }}>
    {icon}
    {children}
    {caret && <span style={{ marginLeft: 2, opacity: 0.7 }}>{ICON.caret}</span>}
  </button>
);

// ── 8-handle rectangle overlay ─────────────────────────────────

const RectOverlay = ({ rect, showHandles = true, dimMask = true }) => {
  const [x, y, w, h] = rect; // percentages
  const handles = [
    [0, 0, 'nw'], [50, 0, 'n'], [100, 0, 'ne'],
    [100, 50, 'e'], [100, 100, 'se'], [50, 100, 's'],
    [0, 100, 'sw'], [0, 50, 'w'],
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {dimMask && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="none">
          <defs>
            <mask id="rect-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={`${x}%`} y={`${y}%`} width={`${w}%`} height={`${h}%`} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.32)" mask="url(#rect-mask)" />
        </svg>
      )}
      <div style={{
        position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`,
        outline: '1.5px solid var(--accent)', outlineOffset: '-0.75px',
      }}>
        {/* rule-of-thirds gridlines */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
          <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, borderLeft: '1px dashed rgba(255,255,255,0.6)' }} />
          <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, borderLeft: '1px dashed rgba(255,255,255,0.6)' }} />
          <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.6)' }} />
          <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.6)' }} />
        </div>
        {showHandles && handles.map(([hx, hy, k]) => (
          <span key={k} style={{
            position: 'absolute', left: `${hx}%`, top: `${hy}%`, width: 9, height: 9,
            transform: 'translate(-50%, -50%)', background: '#fff',
            border: '1.5px solid var(--accent)', borderRadius: 2,
          }} />
        ))}
      </div>
    </div>
  );
};

// ── Inspector sections ─────────────────────────────────────────

const InspectorRect = ({ rect = [1320, 480, 870, 800] }) => (
  <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Rectangle</span>
      <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>SELECTED</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <NumField label="X" value={rect[0]} unit="px" />
      <NumField label="Y" value={rect[1]} unit="px" />
      <NumField label="W" value={rect[2]} unit="px" />
      <NumField label="H" value={rect[3]} unit="px" />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="mono" style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Aspect</span>
      <Segmented options={['Match image', 'Free', '1:1', '16:9']} active={0} />
    </div>
  </div>
);

const InspectorPlayback = ({ playing = false }) => (
  <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)' }}>
    <span style={{ fontSize: 13, fontWeight: 600 }}>Playback</span>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="mono" style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Speed</span>
      <Segmented options={['0.5×', '1×', '2×', '4×']} active={1} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="mono" style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Direction</span>
      <Segmented options={['Zoom in', 'Zoom out']} active={0} />
    </div>
    <NumField label="Loop length" value="10.0" unit="s" />
    <Btn icon={ICON.fullscreen} style={{ justifyContent: 'center' }}>Fullscreen preview</Btn>
  </div>
);

// ── Top bar ────────────────────────────────────────────────────

const TopBar = ({ filename = 'beach-house.jpg', showExportMenu = false }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 14px', background: 'var(--panel)',
    borderBottom: '1px solid var(--border)', position: 'relative',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 22, height: 22, borderRadius: 5, background: 'var(--accent)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13,
      }}>t</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>tententoon</span>
    </div>
    <span style={{ width: 1, height: 18, background: 'var(--border)' }} />
    {filename ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-2)' }}>
        {ICON.image}
        <span>{filename}</span>
        <span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>· 2400×1600</span>
      </span>
    ) : (
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>Untitled · no image</span>
    )}
    <span style={{ flex: 1 }} />
    <Btn ghost icon={ICON.reset} size="sm">Reset</Btn>
    <Btn icon={ICON.upload} size="sm">Replace</Btn>
    <div style={{ position: 'relative' }}>
      <Btn primary icon={ICON.download} caret size="sm">Export</Btn>
      {showExportMenu && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: 'var(--shadow)', minWidth: 240, padding: 6, zIndex: 10,
        }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', padding: '6px 10px 4px', letterSpacing: '0.06em' }}>EXPORT AS</div>
          {[
            { i: ICON.image, t: 'PNG', s: 'Still frame · 2048×1365' },
            { i: ICON.film, t: 'MP4', s: '10s loop · 1080p', hi: true },
            { i: ICON.gif, t: 'GIF', s: '~6 MB · 720p' },
          ].map((o, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 6, cursor: 'pointer',
              background: o.hi ? 'var(--accent-soft)' : 'transparent',
            }}>
              <span style={{ color: o.hi ? 'var(--accent)' : 'var(--ink-2)' }}>{o.i}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{o.t}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{o.s}</span>
              </div>
              <span style={{ flex: 1 }} />
              <span style={{ color: 'var(--muted)' }}>{ICON.download}</span>
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
          <div style={{ padding: '4px 10px 6px', fontSize: 11, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>All exports run locally</span>
            <span className="mono">⌘E</span>
          </div>
        </div>
      )}
    </div>
  </div>
);

// ── Tool rail ──────────────────────────────────────────────────

const ToolRail = ({ active = 'rect' }) => (
  <div style={{
    width: 48, background: 'var(--panel)', borderRight: '1px solid var(--border)',
    padding: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
  }}>
    <ToolBtn glyph={ICON.cursor} label="Select" active={active === 'select'} />
    <ToolBtn glyph={ICON.rect} label="Rectangle" active={active === 'rect'} />
    <ToolBtn glyph={ICON.hand} label="Pan" active={active === 'pan'} />
    <div style={{ flex: 1 }} />
    <div style={{ width: 24, height: 1, background: 'var(--border)' }} />
    <ToolBtn glyph={ICON.zoomIn} label="Zoom in" mini />
    <ToolBtn glyph={ICON.zoomOut} label="Zoom out" mini />
  </div>
);

// ── Timeline (bottom of canvas) ────────────────────────────────

const Timeline = ({ progress = 0.42, playing = false, expanded = true }) => (
  <div style={{
    padding: expanded ? '10px 12px' : '6px 12px',
    background: 'var(--panel)', borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', gap: 12,
  }}>
    <button style={{
      width: 32, height: 32, borderRadius: 999, border: '1px solid var(--border-strong)',
      background: playing ? 'var(--accent)' : 'var(--panel-2)',
      color: playing ? '#fff' : 'var(--ink)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    }}>{playing ? ICON.pause : ICON.play}</button>
    <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', minWidth: 80 }}>
      {(progress * 10).toFixed(1)}s / 10.0s
    </span>
    <div style={{ flex: 1, position: 'relative', height: 18 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 8, height: 2, background: 'var(--border-strong)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 0, top: 8, height: 2, width: `${progress * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
      {/* Tick marks */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 13, display: 'flex', justifyContent: 'space-between' }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
          <span key={i} style={{ width: 1, height: 5, background: 'var(--border-strong)', opacity: i % 5 === 0 ? 1 : 0.5 }} />
        ))}
      </div>
      {/* Playhead */}
      <div style={{
        position: 'absolute', left: `${progress * 100}%`, top: 2, width: 14, height: 14,
        background: 'var(--panel)', border: '2px solid var(--accent)', borderRadius: 999,
        transform: 'translateX(-50%)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      }} />
    </div>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
      {ICON.swap} 1×
    </span>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
      {ICON.loop} In
    </span>
  </div>
);

// ── Sample image content (themed photo placeholder) ────────────

const SampleImage = ({ depth = 1, rectPct, theme }) => {
  // We render a real droste (depth>1 for the "playing" screen). We use the
  // Droste primitive's "house" photoStyle which has decent contrast in dark.
  const rect = [rectPct[0] / 100, rectPct[1] / 100, rectPct[2] / 100, rectPct[3] / 100];
  return <Droste depth={depth} rect={rect} showRect={false} photoStyle="house" />;
};

// ── 3 Screens ──────────────────────────────────────────────────

const Screen = ({ theme, children, exportOpen, filename }) => (
  <div className={`theme-${theme}`} style={{
    width: '100%', height: '100%', background: 'var(--bg)',
    display: 'flex', flexDirection: 'column', color: 'var(--ink)',
    fontFamily: 'Inter, sans-serif',
  }}>
    <TopBar filename={filename} showExportMenu={exportOpen} />
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      {children}
    </div>
  </div>
);

const RectInPx = [22, 18, 56, 70]; // x, y, w, h percentages of canvas area

const ScreenEmpty = ({ theme }) => (
  <Screen theme={theme} filename={null}>
    <ToolRail active="rect" />
    <div style={{ flex: 1, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{
        width: '78%', maxWidth: 640, aspectRatio: '16/10',
        border: '2px dashed var(--border-strong)', borderRadius: 14,
        background: 'var(--panel)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--ink-2)',
      }}>
        <span style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon d={<g><path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/></g>} size={28} stroke={1.8} />
        </span>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>Drop an image to start</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>or paste from clipboard · click to choose · JPG, PNG, WebP up to 20 MB</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Btn primary icon={ICON.upload}>Choose file</Btn>
          <Btn ghost>Try with sample</Btn>
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Stays in your browser. Nothing uploaded.</span>
      </div>
    </div>
    {/* Inspector (empty state, dimmed) */}
    <aside style={{ width: 240, background: 'var(--panel)', borderLeft: '1px solid var(--border)', padding: 14, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Rectangle</span>
      <span style={{ fontSize: 12 }}>Load an image, then drag a rectangle on it.</span>
      <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Playback</span>
      <span style={{ fontSize: 12 }}>Available once a rectangle is set.</span>
    </aside>
  </Screen>
);

const ScreenRect = ({ theme }) => (
  <Screen theme={theme}>
    <ToolRail active="rect" />
    <div style={{ flex: 1, background: 'var(--canvas-bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Image */}
      <div style={{ position: 'absolute', inset: '5% 6%', borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
        <SampleImage depth={1} rectPct={RectInPx} theme={theme} />
        <RectOverlay rect={RectInPx} />
        {/* Dimension badge near rect */}
        <div style={{ position: 'absolute', left: `${RectInPx[0]}%`, top: `calc(${RectInPx[1] + RectInPx[3]}% + 6px)`, transform: 'translateX(0)' }}>
          <span className="mono" style={{
            display: 'inline-block', padding: '3px 6px', background: 'var(--accent)', color: '#fff',
            borderRadius: 4, fontSize: 11, fontVariantNumeric: 'tabular-nums',
          }}>870 × 800</span>
        </div>
      </div>
      {/* Canvas HUD */}
      <div style={{ position: 'absolute', bottom: 8, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.7)' }}>
        <span className="mono" style={{ fontSize: 11, background: 'rgba(0,0,0,0.5)', padding: '3px 6px', borderRadius: 4 }}>Fit · 42%</span>
        <span className="mono" style={{ fontSize: 11, background: 'rgba(0,0,0,0.5)', padding: '3px 6px', borderRadius: 4 }}>1320, 480 · 870×800</span>
      </div>
    </div>
    <aside style={{ width: 240, background: 'var(--panel)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      <InspectorRect />
      <InspectorPlayback />
    </aside>
  </Screen>
);

const ScreenPlay = ({ theme, exportOpen }) => (
  <Screen theme={theme} exportOpen={exportOpen}>
    <ToolRail active="rect" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--canvas-bg)' }}>
      <div style={{ flex: 1, position: 'relative', padding: '20px 24px' }}>
        <div style={{ position: 'absolute', inset: '20px 24px', borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
          <SampleImage depth={14} rectPct={RectInPx} theme={theme} />
        </div>
      </div>
      <Timeline progress={0.55} playing />
    </div>
    <aside style={{ width: 240, background: 'var(--panel)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      <InspectorRect />
      <InspectorPlayback playing />
    </aside>
  </Screen>
);

window.ScreenEmpty = ScreenEmpty;
window.ScreenRect = ScreenRect;
window.ScreenPlay = ScreenPlay;
window.RectOverlay = RectOverlay;
window.ICON = ICON;
window.Timeline = Timeline;
