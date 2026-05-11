// Approach B — Canvas-first.
// Full-bleed image. Floating panels: file pill (top-left), scrubber (bottom),
// export FAB (top-right). Rectangle drawn directly on image with handles.

const ApproachB = () => ([
    /* Frame 1 — Empty state with center drop hint */
    <DCArtboard key="b-empty" id="b-empty" label="Empty · drop here" width={920} height={560}>
      <div className="frame desk" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ position: 'relative', background: '#1a1814' }}>
          {/* Floating top-left logo pill */}
          <div style={{ position: 'absolute', top: 14, left: 14, padding: '6px 12px', background: '#fff', borderRadius: 999, fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--accent)', border: '1.5px solid var(--line)' }}>tententoon</div>
          {/* Center drop area */}
          <div style={{ position: 'absolute', inset: '15% 18%' }}>
            <div className="placeholder" style={{ width: '100%', height: '100%', background: '#fff', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-display)', fontSize: 30 }}>
              <div style={{ fontSize: 54 }}>⤓</div>
              drop a picture anywhere
              <div className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>or paste · or click</div>
            </div>
          </div>
        </div>
      </div>
    </DCArtboard>

    ,
    /* Frame 2 — Selecting rectangle on the image */
    <DCArtboard key="b-select" id="b-select" label="Marquee on canvas" width={920} height={560}>
      <div className="frame desk" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ position: 'relative', background: '#1a1814' }}>
          {/* Image fills viewport */}
          <div style={{ position: 'absolute', inset: 0 }}>
            <Droste depth={1} rect={[0.50, 0.28, 0.36, 0.50]} />
          </div>
          {/* Floating top-left file pill */}
          <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
            <div className="pill" style={{ background: '#fff' }}>
              <span style={{ width: 18, height: 18, background: 'var(--accent-soft)', borderRadius: 3, display: 'inline-block', border: '1.5px solid var(--accent)' }} />
              <span>beach-house.jpg</span>
              <span style={{ color: 'var(--muted)' }}>·</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>2400×1600</span>
              <span style={{ color: 'var(--muted)', cursor: 'pointer' }}>↻</span>
            </div>
          </div>
          {/* Floating top-right export FAB */}
          <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 6 }}>
            <button className="btn ghost" style={{ background: '#fff' }}>fullscreen ⤢</button>
            <button className="btn primary">export ↓</button>
          </div>
          {/* Floating bottom scrubber */}
          <div style={{ position: 'absolute', left: 30, right: 30, bottom: 18, background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Scrubber progress={0.0} />
          </div>
          {/* Annotation arrow */}
          <div className="annotation" style={{ position: 'absolute', top: 80, right: 60, color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 18, textAlign: 'right' }}>
            ↙ rectangle lives<br />right on the image
          </div>
        </div>
      </div>
    </DCArtboard>

    ,
    /* Frame 3 — Playing the zoom (rectangle hidden, scrubber active) */
    <DCArtboard key="b-play" id="b-play" label="Zooming · controls float" width={920} height={560}>
      <div className="frame desk" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ position: 'relative', background: '#1a1814' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Droste depth={12} rect={[0.50, 0.28, 0.36, 0.50]} showRect={false} />
          </div>
          {/* Hide rectangle while playing — show ghost outline */}
          <div style={{ position: 'absolute', top: 14, left: 14 }} className="pill">beach-house.jpg</div>
          {/* Scrubber + extended controls */}
          <div style={{ position: 'absolute', left: 30, right: 30, bottom: 18, background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Scrubber progress={0.62} playing />
          </div>
          {/* Export FAB expanded */}
          <div style={{ position: 'absolute', top: 14, right: 14, background: '#fff', border: '1.5px solid var(--line)', borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 8px' }}>EXPORT</div>
            <button className="btn ghost" style={{ justifyContent: 'flex-start' }}>↓ PNG · still frame</button>
            <button className="btn ghost" style={{ justifyContent: 'flex-start', background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>↓ MP4 · 10s loop</button>
            <button className="btn ghost" style={{ justifyContent: 'flex-start' }}>↓ GIF · 6mb</button>
          </div>
        </div>
      </div>
    </DCArtboard>

    ,
    /* Mobile */
    <DCArtboard key="b-mob" id="b-mob" label="Mobile · canvas-first" width={300} height={560}>
      <div className="frame mob" style={{ width: '100%', height: '100%' }}>
        <div className="vp" style={{ position: 'relative', background: '#1a1814' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Droste depth={1} rect={[0.46, 0.30, 0.45, 0.50]} />
          </div>
          {/* Top thin bar */}
          <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="pill" style={{ background: '#fff', fontSize: 12, padding: '3px 8px' }}>beach.jpg</div>
            <span style={{ flex: 1 }} />
            <button className="btn primary" style={{ padding: '5px 10px', fontSize: 13 }}>export</button>
          </div>
          {/* Bottom controls sheet */}
          <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1.5px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Scrubber progress={0.30} compact />
            <div style={{ display: 'flex', gap: 6, fontSize: 12 }}>
              <span className="chip" style={{ fontSize: 12 }}>1x</span>
              <span className="chip" style={{ fontSize: 12 }}>↻ in</span>
              <span style={{ flex: 1 }} />
              <span className="chip" style={{ fontSize: 12 }}>⤢</span>
            </div>
          </div>
        </div>
      </div>
    </DCArtboard>
]);

window.ApproachB = ApproachB;
