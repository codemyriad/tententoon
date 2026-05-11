// Hi-fi design canvas — 3 visual directions × 3 screens.
const THEMES = [
  { id: 'light-neutral', title: 'Light · neutral',    sub: 'Figma-y, calm. Whites + warm grays. Default direction.' },
  { id: 'light-warm',    title: 'Light · warm',       sub: 'Paper cream + browns. Friendlier, less clinical.' },
  { id: 'dark-warm',     title: 'Dark · warm',        sub: 'Deep ink, parchment text. Photo-editor mood.' },
];

const DESK_W = 1100, DESK_H = 680;

function HiFi() {
  return (
    <DesignCanvas>
      <DCSection id="intro" title="Tententoon · Tool App · hi-fi" subtitle="Approach C, three visual directions. Same component tree. Pick one (or mix tokens).">
        <DCArtboard key="readme" id="readme" label="Read me" width={420} height={560}>
          <div style={{ width: '100%', height: '100%', background: '#fff', border: '1px solid #e6e3dc', borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'Inter, sans-serif' }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em' }}>The hi-fi pass.</div>
            <div style={{ fontSize: 14, color: '#4a463f', lineHeight: 1.45 }}>
              Approach C, locked. Three colorways — same layout, same components, different tokens. The dev only ever ships one set; the others are here so you can pick the mood before code starts.
            </div>
            <div style={{ height: 1, background: '#e6e3dc' }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Per direction, 3 frames:</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#4a463f', lineHeight: 1.6 }}>
              <li><b>Empty</b> — drop zone, inspector dimmed</li>
              <li><b>Frame the loop</b> — image + 8-handle rectangle</li>
              <li><b>Zoom + Export</b> — playing, export dropdown open</li>
            </ul>
            <div style={{ height: 1, background: '#e6e3dc' }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>For devs</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#4a463f', lineHeight: 1.6 }}>
              <li>See <span className="mono" style={{ background: '#f4f2ec', padding: '1px 5px', borderRadius: 3 }}>HANDOFF.md</span> for the Svelte 5 brief.</li>
              <li>All tokens live in <span className="mono" style={{ background: '#f4f2ec', padding: '1px 5px', borderRadius: 3 }}>:root.theme-*</span> CSS classes &mdash; swap the class to swap the look.</li>
              <li>No effect knobs beyond the rectangle. Per spec.</li>
            </ul>
            <div style={{ marginTop: 'auto', fontSize: 11, color: '#8a857a' }} className="mono">v1 · ready for build</div>
          </div>
        </DCArtboard>
      </DCSection>

      {THEMES.map((th) => ([
        <DCSection key={th.id} id={th.id} title={th.title} subtitle={th.sub}>
          <DCArtboard key={`${th.id}-empty`} id={`${th.id}-empty`} label="Empty · drop zone" width={DESK_W} height={DESK_H}>
            <ScreenEmpty theme={th.id} />
          </DCArtboard>
          <DCArtboard key={`${th.id}-rect`} id={`${th.id}-rect`} label="Frame the loop" width={DESK_W} height={DESK_H}>
            <ScreenRect theme={th.id} />
          </DCArtboard>
          <DCArtboard key={`${th.id}-play`} id={`${th.id}-play`} label="Zoom + Export menu" width={DESK_W} height={DESK_H}>
            <ScreenPlay theme={th.id} exportOpen />
          </DCArtboard>
        </DCSection>
      ]))}

      <DCSection id="details" title="Component close-ups" subtitle="Pixel details for the build. Refer to these when in doubt.">
        <DCArtboard key="d-handle" id="d-handle" label="8-handle rectangle" width={520} height={420}>
          <div className="theme-light-neutral" style={{ width: '100%', height: '100%', background: 'var(--canvas-bg)', padding: 30, fontFamily: 'Inter, sans-serif' }}>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <div style={{ position: 'absolute', inset: 20, borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                <Droste depth={1} rect={[0.22, 0.18, 0.56, 0.70]} showRect={false} photoStyle="house" />
                <RectOverlay rect={[22, 18, 56, 70]} />
              </div>
              <span className="mono" style={{ position: 'absolute', top: 28, left: 28, padding: '3px 6px', background: 'var(--accent)', color: '#fff', borderRadius: 4, fontSize: 11 }}>870 × 800</span>
              <span style={{ position: 'absolute', bottom: 6, left: 24, color: '#fff', fontSize: 11, opacity: 0.8 }} className="mono">
                handles · 9px white square · 1.5px accent border · radius 2px · cursor matches edge
              </span>
            </div>
          </div>
        </DCArtboard>
        <DCArtboard key="d-timeline" id="d-timeline" label="Timeline strip" width={900} height={140}>
          <div className="theme-light-neutral" style={{ width: '100%', height: '100%', background: 'var(--bg)', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 12, gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }} className="mono">.timeline · 56 tall · play button 32 · playhead 14 · ticks every 1s, accent every 5s</span>
            <Timeline progress={0.55} playing />
          </div>
        </DCArtboard>
        <DCArtboard key="d-tokens" id="d-tokens" label="Color tokens" width={520} height={420}>
          <div style={{ width: '100%', height: '100%', background: '#fff', padding: 18, fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {THEMES.map(th => (
              <div key={th.id} className={`theme-${th.id}`} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>{th.title}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['--bg', '--panel', '--panel-2', '--border', '--ink', '--muted', '--accent', '--canvas-bg'].map(v => (
                    <div key={v} style={{ flex: 1 }}>
                      <div style={{ height: 28, background: `var(${v})`, border: '1px solid var(--border)', borderRadius: 4 }} />
                      <div className="mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3, textAlign: 'center', wordBreak: 'break-all' }}>{v.replace('--', '')}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#8a857a', marginTop: 'auto' }} className="mono">tokens live in src/styles/tokens.css · themed by .theme-* on &lt;html&gt;</div>
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<HiFi />);
