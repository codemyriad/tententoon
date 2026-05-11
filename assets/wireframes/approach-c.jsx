// Approach C — Tool App.
// Left rail of tools, center canvas, right inspector, top menu bar.

const ToolIcon = ({ label, active }) => (
  <div title={label} style={{
    width: 36, height: 36, borderRadius: 6,
    border: '1.5px solid var(--line)',
    background: active ? 'var(--accent)' : '#fff',
    color: active ? '#fff' : 'var(--ink)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-display)', fontSize: 18, cursor: 'pointer',
  }}>{label}</div>
);

const NumberField = ({ label, value, unit = 'px' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
    <div className="box" style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span>{value}</span>
      <span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>{unit}</span>
    </div>
  </div>
);

const ApproachC = () => ([
    /* Frame 1 — Main editor view, rectangle being drawn */
    <DCArtboard key="c-edit" id="c-edit" label="Editor · rect selected" width={1000} height={620}>
      <div className="frame desk" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Top menu */}
          <div className="chrome" style={{ gap: 14 }}>
            <span className="display" style={{ fontSize: 22, color: 'var(--accent)' }}>tententoon</span>
            <span style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>untitled · beach-house.jpg</span>
            <span style={{ flex: 1 }} />
            <button className="btn ghost" style={{ padding: '4px 10px', fontSize: 13 }}>↻ reset</button>
            <button className="btn primary" style={{ padding: '6px 14px', fontSize: 14 }}>export ↓</button>
          </div>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* Left rail */}
            <div style={{ width: 56, borderRight: '1.5px solid var(--line)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#faf7f1' }}>
              <ToolIcon label="↖" />
              <ToolIcon label="▭" active />
              <ToolIcon label="✥" />
              <ToolIcon label="◎" />
              <div style={{ flex: 1 }} />
              <ToolIcon label="?" />
            </div>
            {/* Canvas */}
            <div style={{ flex: 1, background: '#1a1814', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: '8% 6%' }}>
                <div className="box" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                  <Droste depth={1} rect={[0.55, 0.32, 0.36, 0.50]} />
                </div>
              </div>
              {/* Canvas footer hud */}
              <div style={{ position: 'absolute', bottom: 8, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', fontSize: 12 }}>
                <span className="mono" style={{ background: 'rgba(0,0,0,0.4)', padding: '3px 6px', borderRadius: 4 }}>100% · fit</span>
                <span className="mono" style={{ background: 'rgba(0,0,0,0.4)', padding: '3px 6px', borderRadius: 4 }}>1320, 480 · 870×800</span>
              </div>
            </div>
            {/* Right inspector */}
            <div style={{ width: 220, borderLeft: '1.5px solid var(--line)', padding: 14, background: '#faf7f1', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="display" style={{ fontSize: 20 }}>Rectangle</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <NumberField label="x" value="1320" />
                  <NumberField label="y" value="480" />
                  <NumberField label="w" value="870" />
                  <NumberField label="h" value="800" />
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <span className="chip" style={{ fontSize: 11, background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>match img</span>
                  <span className="chip" style={{ fontSize: 11 }}>1:1</span>
                  <span className="chip" style={{ fontSize: 11 }}>free</span>
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(0,0,0,0.1)' }} />
              <div>
                <div className="display" style={{ fontSize: 20 }}>Preview</div>
                <div className="box" style={{ marginTop: 8, height: 110, overflow: 'hidden' }}>
                  <Droste depth={9} rect={[0.55, 0.32, 0.36, 0.50]} showRect={false} />
                </div>
                <button className="btn" style={{ marginTop: 8, width: '100%', justifyContent: 'center', fontSize: 13 }}>▶ play zoom</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DCArtboard>

    ,
    /* Frame 2 — Zoom playback expanded */
    <DCArtboard key="c-zoom" id="c-zoom" label="Zoom playback" width={1000} height={620}>
      <div className="frame desk" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chrome">
            <span className="display" style={{ fontSize: 22, color: 'var(--accent)' }}>tententoon</span>
            <span style={{ flex: 1 }} />
            <button className="btn primary" style={{ padding: '6px 14px', fontSize: 14 }}>export ↓</button>
          </div>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <div style={{ width: 56, borderRight: '1.5px solid var(--line)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#faf7f1' }}>
              <ToolIcon label="↖" />
              <ToolIcon label="▭" />
              <ToolIcon label="✥" />
              <ToolIcon label="◎" active />
            </div>
            <div style={{ flex: 1, background: '#1a1814', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, position: 'relative', padding: '24px 30px 0' }}>
                <div className="box" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                  <Droste depth={12} rect={[0.55, 0.32, 0.36, 0.50]} showRect={false} />
                </div>
              </div>
              {/* Timeline bar */}
              <div style={{ padding: '12px 20px', background: '#0f0d0a' }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: '8px 12px', border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Scrubber progress={0.55} playing />
                </div>
                {/* tick marks */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.6 }}>
                  {['0s', '2', '4', '6', '8', '10s'].map(t => <span key={t}>{t}</span>)}
                </div>
              </div>
            </div>
            <div style={{ width: 220, borderLeft: '1.5px solid var(--line)', padding: 14, background: '#faf7f1', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="display" style={{ fontSize: 20 }}>Playback</div>
              <div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>speed</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {['0.5x', '1x', '2x', '4x'].map((s, i) => (
                    <span key={s} className="chip" style={{ fontSize: 11, background: i === 1 ? 'var(--accent-soft)' : '#fff', borderColor: i === 1 ? 'var(--accent)' : 'var(--line)' }}>{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>direction</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <span className="chip" style={{ fontSize: 11, background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>↘ in</span>
                  <span className="chip" style={{ fontSize: 11 }}>↖ out</span>
                </div>
              </div>
              <div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>loop length</div>
                <div className="box" style={{ padding: '6px 10px', marginTop: 4, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                  <span>10.0</span><span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>sec</span>
                </div>
              </div>
              <button className="btn" style={{ width: '100%', justifyContent: 'center', fontSize: 13, marginTop: 'auto' }}>⤢ fullscreen</button>
            </div>
          </div>
        </div>
      </div>
    </DCArtboard>

    ,
    /* Mobile — bottom sheet */
    <DCArtboard key="c-mob" id="c-mob" label="Mobile · bottom sheet" width={300} height={560}>
      <div className="frame mob" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chrome" style={{ padding: '6px 10px' }}>
            <span className="display" style={{ fontSize: 17, color: 'var(--accent)' }}>tententoon</span>
            <span style={{ flex: 1 }} />
            <button className="btn primary" style={{ padding: '4px 8px', fontSize: 12 }}>export</button>
          </div>
          <div style={{ flex: 1, background: '#1a1814', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 8 }}>
              <Droste depth={1} rect={[0.50, 0.30, 0.40, 0.50]} />
            </div>
            {/* Tool tabs at bottom of canvas area */}
            <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, display: 'flex', gap: 4 }}>
              {['↖', '▭', '◎'].map((t, i) => (
                <div key={t} className="chip" style={{ flex: 1, justifyContent: 'center', fontSize: 14, background: i === 1 ? 'var(--accent)' : '#fff', color: i === 1 ? '#fff' : 'var(--ink)', borderColor: i === 1 ? 'var(--accent)' : 'var(--line)' }}>{t}</div>
              ))}
            </div>
          </div>
          {/* Bottom inspector sheet — peeking */}
          <div style={{ borderTop: '1.5px solid var(--line)', background: '#faf7f1', padding: 10 }}>
            <div style={{ width: 32, height: 3, background: 'rgba(0,0,0,0.2)', borderRadius: 2, margin: '0 auto 8px' }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>RECT</span>
              <span className="mono" style={{ fontSize: 11 }}>1320, 480, 870×800</span>
              <span style={{ flex: 1 }} />
              <span className="annot" style={{ fontSize: 16 }}>↑ drag for more</span>
            </div>
          </div>
        </div>
      </div>
    </DCArtboard>
]);

window.ApproachC = ApproachC;
