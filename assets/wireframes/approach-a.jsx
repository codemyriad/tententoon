// Approach A — Linear Step Wizard
// Centered card, stepper at top, one task per screen, prev/next.

const A_STEPS = ['Upload', 'Frame', 'Preview', 'Export'];

const ACard = ({ active, children, mobile = false }) => (
  <div className="frame desk" style={{ width: '100%', height: '100%' }}>
    <div className="vp" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="chrome">
        <span className="dots"><i /><i /><i /></span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>droste.app</span>
        <span style={{ flex: 1 }} />
        <span className="display" style={{ fontSize: 22, color: 'var(--accent)' }}>tententoon</span>
      </div>
      <div style={{ flex: 1, padding: mobile ? '24px 16px' : '40px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <Stepper steps={A_STEPS} active={active} />
        {children}
      </div>
    </div>
  </div>
);

const ApproachA = () => ([
    /* Frame 1 — Upload step */
    <DCArtboard key="a-upload" id="a-upload" label="Step 1 · Upload" width={780} height={560}>
      <ACard active={0}>
        <h2 style={{ fontSize: 38, margin: '8px 0 0', textAlign: 'center' }}>Pick a picture to send <em style={{ color: 'var(--accent)' }}>down the rabbit hole</em>.</h2>
        <div style={{ width: '70%', height: 280 }}><DropZone /></div>
        <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
          <button className="btn ghost" disabled style={{ opacity: 0.3 }}>← back</button>
          <button className="btn primary">next →</button>
        </div>
      </ACard>
    </DCArtboard>

    ,
    /* Frame 2 — Frame the rectangle */
    <DCArtboard key="a-frame" id="a-frame" label="Step 2 · Frame the loop" width={780} height={560}>
      <ACard active={1}>
        <p style={{ fontSize: 18, color: 'var(--muted)', margin: 0, textAlign: 'center' }}>Drag a rectangle. That's where the copy goes.</p>
        <div style={{ position: 'relative', width: '85%', flex: 1 }}>
          <div className="box" style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
            <Droste depth={1} rect={[0.55, 0.30, 0.38, 0.50]} showRect={true} />
            {/* Hand-drawn cursor hint */}
            <div className="annotation" style={{ position: 'absolute', top: '20%', right: '12%', color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 18 }}>
              drag corners ↘
            </div>
          </div>
          {/* Aspect ratio chip overlay */}
          <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 6 }}>
            <span className="chip">free</span>
            <span className="chip" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>match image</span>
            <span className="chip">1:1</span>
            <span className="chip">16:9</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn ghost">← back</button>
          <button className="btn primary">next →</button>
        </div>
      </ACard>
    </DCArtboard>

    ,
    /* Frame 3 — Preview / zoom */
    <DCArtboard key="a-preview" id="a-preview" label="Step 3 · Preview" width={780} height={560}>
      <ACard active={2}>
        <p style={{ fontSize: 18, color: 'var(--muted)', margin: 0, textAlign: 'center' }}>Here's your droste. Play to fall in.</p>
        <div style={{ width: '85%', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="box" style={{ flex: 1, overflow: 'hidden' }}>
            <Droste depth={9} rect={[0.55, 0.30, 0.38, 0.50]} showRect={false} />
          </div>
          <div style={{ padding: '4px 0' }}>
            <Scrubber progress={0.42} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn ghost">← back</button>
          <button className="btn primary">export →</button>
        </div>
      </ACard>
    </DCArtboard>

    ,
    /* Frame 4 — Export */
    <DCArtboard key="a-export" id="a-export" label="Step 4 · Export" width={780} height={560}>
      <ACard active={3}>
        <h2 style={{ fontSize: 34, margin: 0 }}>Take it home.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, width: '85%' }}>
          {[
            { k: 'PNG', s: 'Still image · the droste frame', n: 'png · 2048×1365' },
            { k: 'MP4', s: 'Smooth infinite zoom video', n: '10s · 1080p · loops' },
            { k: 'GIF', s: 'Tiny shareable loop', n: '~6 MB · 720p' },
          ].map((o, i) => (
            <div key={i} className="box" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', background: i === 1 ? 'var(--accent-soft)' : '#fff', borderColor: i === 1 ? 'var(--accent)' : 'var(--line)' }}>
              <div className="display" style={{ fontSize: 32, color: 'var(--accent)' }}>{o.k}</div>
              <div style={{ fontSize: 16 }}>{o.s}</div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{o.n}</div>
              <button className="btn primary" style={{ marginTop: 'auto', alignSelf: 'stretch', justifyContent: 'center' }}>save {o.k.toLowerCase()}</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
          <button className="btn ghost">← edit again</button>
          <button className="btn ghost">↻ start over</button>
        </div>
      </ACard>
    </DCArtboard>

    ,
    /* Mobile frame — frame the loop step */
    <DCArtboard key="a-mob" id="a-mob" label="Mobile · step 2" width={300} height={560}>
      <div className="frame mob" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chrome" style={{ padding: '8px 12px' }}>
            <span className="display" style={{ fontSize: 18, color: 'var(--accent)' }}>tententoon</span>
            <span style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>2/4</span>
          </div>
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= 1 ? 'var(--accent)' : 'rgba(0,0,0,0.1)' }} />
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.1 }}>Frame the loop</div>
            <div className="box" style={{ flex: 1, overflow: 'hidden' }}>
              <Droste depth={1} rect={[0.50, 0.30, 0.42, 0.55]} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="chip" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>match img</span>
              <span className="chip">1:1</span>
              <span className="chip">free</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" style={{ flex: 1 }}>back</button>
              <button className="btn primary" style={{ flex: 2 }}>next →</button>
            </div>
          </div>
        </div>
      </div>
    </DCArtboard>
]);

window.ApproachA = ApproachA;
