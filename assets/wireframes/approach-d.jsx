// Approach D — Stacked Cards / Long Scroll.
// One long page, four big stacked sections you scroll through. Mobile-native.
// Desktop frame here shows a "snapshot" scrolled to the middle (frame card).

const StackCard = ({ idx, total, title, sub, badge, children, dim = false }) => (
  <div className="box" style={{
    padding: 20,
    display: 'flex', flexDirection: 'column', gap: 12,
    opacity: dim ? 0.55 : 1,
    boxShadow: dim ? 'none' : '0 6px 0 rgba(0,0,0,0.05)',
    background: dim ? '#faf7f1' : '#fff',
  }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{String(idx).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
      <div className="display" style={{ fontSize: 28, color: dim ? 'var(--muted)' : 'var(--ink)' }}>{title}</div>
      <span style={{ flex: 1 }} />
      {badge && <span className="chip" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)', fontSize: 12 }}>{badge}</span>}
    </div>
    {sub && <div style={{ fontSize: 14, color: 'var(--muted)' }}>{sub}</div>}
    {children}
  </div>
);

const ApproachD = () => ([
    /* Frame 1 — Hero / top of scroll */
    <DCArtboard key="d-hero" id="d-hero" label="Top of page" width={700} height={620}>
      <div className="frame desk" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chrome">
            <span className="dots"><i /><i /><i /></span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>droste.app</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>about · github</span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: '20px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="display" style={{ fontSize: 50, lineHeight: 0.95, color: 'var(--accent)' }}>tententoon.</div>
            <div style={{ fontSize: 18, maxWidth: 460 }}>Paint a picture inside itself. Forever. Make a still, a video, or a gif &mdash; right here in your browser.</div>
            <div className="box" style={{ height: 200, overflow: 'hidden' }}>
              <Droste depth={8} rect={[0.55, 0.30, 0.38, 0.50]} showRect={false} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn primary" style={{ fontSize: 18, padding: '12px 20px' }}>↓ drop a picture to start</button>
              <button className="btn ghost" style={{ fontSize: 14 }}>try with sample</button>
            </div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>nothing leaves your browser. promise.</div>
          </div>
        </div>
      </div>
    </DCArtboard>

    ,
    /* Frame 2 — Scrolled to "Frame it" card */
    <DCArtboard key="d-scroll" id="d-scroll" label="Mid-scroll · framing" width={700} height={620}>
      <div className="frame desk" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chrome">
            <span className="dots"><i /><i /><i /></span>
            <span style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4].map(i => (
                <span key={i} style={{ width: 18, height: 4, borderRadius: 2, background: i <= 2 ? 'var(--accent)' : 'rgba(0,0,0,0.1)' }} />
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: '14px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StackCard idx={1} total={4} title="Drop a picture" badge="done" dim>
              <div className="mono" style={{ fontSize: 12 }}>beach-house.jpg · 2400×1600 · <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>change</span></div>
            </StackCard>
            <StackCard idx={2} total={4} title="Frame the loop" sub="Drag a rectangle. We'll paint a smaller copy inside.">
              <div className="box" style={{ height: 220, overflow: 'hidden' }}>
                <Droste depth={1} rect={[0.55, 0.30, 0.38, 0.50]} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="chip" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>match img</span>
                <span className="chip">free</span>
                <span className="chip">1:1</span>
                <span style={{ flex: 1 }} />
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>1320, 480, 870×800</span>
              </div>
            </StackCard>
            {/* Peeking next card */}
            <div className="box" style={{ padding: '10px 20px', opacity: 0.45 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>03 / 04 &nbsp;&nbsp;</span>
              <span className="display" style={{ fontSize: 22 }}>Watch it zoom →</span>
            </div>
          </div>
        </div>
      </div>
    </DCArtboard>

    ,
    /* Frame 3 — Bottom: export card */
    <DCArtboard key="d-export" id="d-export" label="Bottom · take it home" width={700} height={620}>
      <div className="frame desk" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chrome">
            <span style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4].map(i => (
                <span key={i} style={{ width: 18, height: 4, borderRadius: 2, background: 'var(--accent)' }} />
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: '14px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StackCard idx={3} total={4} title="Watch it zoom" badge="playing" dim>
              <div className="box" style={{ height: 90, overflow: 'hidden' }}>
                <Droste depth={9} rect={[0.55, 0.30, 0.38, 0.50]} showRect={false} />
              </div>
            </StackCard>
            <StackCard idx={4} total={4} title="Take it home" sub="One click. Saves to your downloads.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { k: 'PNG', s: 'still frame', n: '~2 mb' },
                  { k: 'MP4', s: '10s loop', n: '~4 mb' },
                  { k: 'GIF', s: 'shareable', n: '~6 mb' },
                ].map((o, i) => (
                  <div key={i} className="box" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4, background: i === 1 ? 'var(--accent-soft)' : '#fff', borderColor: i === 1 ? 'var(--accent)' : 'var(--line)' }}>
                    <div className="display" style={{ fontSize: 22, color: 'var(--accent)' }}>{o.k}</div>
                    <div style={{ fontSize: 13 }}>{o.s}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{o.n}</div>
                    <button className="btn primary" style={{ marginTop: 4, padding: '5px 0', fontSize: 13, justifyContent: 'center' }}>save</button>
                  </div>
                ))}
              </div>
            </StackCard>
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>↑ scroll up to tweak anything</div>
          </div>
        </div>
      </div>
    </DCArtboard>

    ,
    /* Mobile */
    <DCArtboard key="d-mob" id="d-mob" label="Mobile · native" width={300} height={620}>
      <div className="frame mob" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="chrome" style={{ padding: '6px 10px' }}>
            <span className="display" style={{ fontSize: 17, color: 'var(--accent)' }}>tententoon</span>
            <span style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>2/4</span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="box" style={{ padding: '8px 10px', opacity: 0.55 }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>01 / 04</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginLeft: 6 }}>Drop a picture · done</span>
            </div>
            <div className="box" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>02 / 04</span>
              <div className="display" style={{ fontSize: 20 }}>Frame the loop</div>
              <div className="box" style={{ height: 130, overflow: 'hidden' }}>
                <Droste depth={1} rect={[0.50, 0.30, 0.42, 0.50]} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <span className="chip" style={{ fontSize: 11, background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>match</span>
                <span className="chip" style={{ fontSize: 11 }}>1:1</span>
                <span className="chip" style={{ fontSize: 11 }}>free</span>
              </div>
            </div>
            <div className="box" style={{ padding: '8px 10px', opacity: 0.45 }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>03 / 04</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginLeft: 6 }}>Watch it zoom →</span>
            </div>
          </div>
        </div>
      </div>
    </DCArtboard>
]);

window.ApproachD = ApproachD;
