// Shared primitives: nested droste SVG, dashed marquee, scribble annotations.
// Globally exported via window.* so other babel scripts see them.

const Droste = ({ depth = 6, rect = [0.55, 0.30, 0.40, 0.55], showRect = true, rectStyle = 'marquee', label, photoStyle = 'house' }) => {
  // rect = [x, y, w, h] normalised 0..1 inside the image
  // Build nested rectangles by repeatedly applying the transform that maps
  // outer image to inner rect.
  const frames = [];
  let [x, y, w, h] = [0, 0, 1, 1];
  for (let i = 0; i < depth; i++) {
    frames.push({ x, y, w, h, i });
    // map inner rect into outer space
    const [rx, ry, rw, rh] = rect;
    const nx = x + rx * w;
    const ny = y + ry * h;
    const nw = rw * w;
    const nh = rh * h;
    x = nx; y = ny; w = nw; h = nh;
  }
  return (
    <svg className="droste-svg" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice">
      {/* base "photo" — simple sketchy scene */}
      {frames.map((f, idx) => {
        const op = 1 - idx * 0.05;
        const px = f.x * 100, py = f.y * 70, pw = f.w * 100, ph = f.h * 70;
        return (
          <g key={idx} opacity={op}>
            {photoStyle === 'house' && (
              <>
                <rect x={px} y={py} width={pw} height={ph} fill={idx % 2 === 0 ? '#f3ede0' : '#ebe3d3'} />
                {/* horizon */}
                <line x1={px} y1={py + ph * 0.65} x2={px + pw} y2={py + ph * 0.65} stroke="#8a8378" strokeWidth={0.2} />
                {/* sun */}
                <circle cx={px + pw * 0.78} cy={py + ph * 0.22} r={pw * 0.06} fill="#e9c673" />
                {/* house */}
                <rect x={px + pw * 0.18} y={py + ph * 0.45} width={pw * 0.30} height={ph * 0.20} fill="#fff" stroke="#1a1814" strokeWidth={0.25} />
                <polygon points={`${px + pw * 0.18},${py + ph * 0.45} ${px + pw * 0.33},${py + ph * 0.30} ${px + pw * 0.48},${py + ph * 0.45}`} fill="#c96442" stroke="#1a1814" strokeWidth={0.25} />
                <rect x={px + pw * 0.29} y={py + ph * 0.52} width={pw * 0.06} height={ph * 0.13} fill="#1a1814" />
                {/* tree */}
                <circle cx={px + pw * 0.62} cy={py + ph * 0.50} r={pw * 0.05} fill="#7a8a5a" />
                <rect x={px + pw * 0.615} y={py + ph * 0.50} width={pw * 0.01} height={ph * 0.15} fill="#6a4a2a" />
              </>
            )}
            {photoStyle === 'portrait' && (
              <>
                <rect x={px} y={py} width={pw} height={ph} fill={idx % 2 === 0 ? '#efe6d5' : '#e7dcc6'} />
                <circle cx={px + pw * 0.5} cy={py + ph * 0.42} r={pw * 0.13} fill="#f0d4ad" stroke="#1a1814" strokeWidth={0.3} />
                <path d={`M ${px + pw * 0.30} ${py + ph * 0.95} Q ${px + pw * 0.50} ${py + ph * 0.55} ${px + pw * 0.70} ${py + ph * 0.95}`} fill="#5b6b9e" stroke="#1a1814" strokeWidth={0.3} />
              </>
            )}
            {photoStyle === 'abstract' && (
              <>
                <rect x={px} y={py} width={pw} height={ph} fill={idx % 2 === 0 ? '#f3ede0' : '#e8dec9'} />
                <circle cx={px + pw * 0.35} cy={py + ph * 0.4} r={pw * 0.18} fill="none" stroke="#1a1814" strokeWidth={0.3} />
                <rect x={px + pw * 0.55} y={py + ph * 0.25} width={pw * 0.25} height={ph * 0.45} fill="none" stroke="#1a1814" strokeWidth={0.3} />
              </>
            )}
          </g>
        );
      })}
      {showRect && (() => {
        const [rx, ry, rw, rh] = rect;
        const px = rx * 100, py = ry * 70, pw = rw * 100, ph = rh * 70;
        return (
          <g>
            <rect x={px} y={py} width={pw} height={ph} fill="none" stroke="var(--accent)" strokeWidth={0.5} strokeDasharray={rectStyle === 'marquee' ? '1.2 1' : 'none'} />
            {rectStyle === 'marquee' && [[px, py], [px + pw, py], [px, py + ph], [px + pw, py + ph]].map((p, i) => (
              <rect key={i} x={p[0] - 0.8} y={p[1] - 0.8} width={1.6} height={1.6} fill="#fff" stroke="var(--accent)" strokeWidth={0.4} />
            ))}
            {label && (
              <text x={px + pw / 2} y={py + ph / 2 + 1} textAnchor="middle" fontSize="3" fontFamily="var(--font-display)" fill="var(--accent)">{label}</text>
            )}
          </g>
        );
      })()}
    </svg>
  );
};

// Hand-drawn arrow with a label, used for annotations on top of frames.
// from / to: {x, y} as percentages of the parent.
const Annot = ({ from, to, label, side = 'right', curve = 18 }) => {
  const labelOffset = side === 'right' ? 8 : -8;
  return (
    <div className="annotation" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
        <path
          d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2 + curve} ${(from.y + to.y) / 2 - curve} ${to.x} ${to.y}`}
          className="annot-line"
        />
        {/* arrow head */}
        <polygon points={`${to.x},${to.y} ${to.x - 4},${to.y - 6} ${to.x + 4},${to.y - 6}`} fill="var(--accent)" transform={`rotate(180 ${to.x} ${to.y})`} />
      </svg>
      <div className="annot" style={{ position: 'absolute', left: `${from.x + labelOffset}px`, top: `${from.y - 12}px`, maxWidth: 180, transform: side === 'left' ? 'translateX(-100%)' : '' }}>{label}</div>
    </div>
  );
};

const Stepper = ({ steps, active }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    {steps.map((s, i) => (
      <React.Fragment key={i}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          opacity: i === active ? 1 : 0.4
        }}>
          <span style={{
            width: 24, height: 24, borderRadius: 999,
            border: '1.5px solid var(--line)',
            background: i === active ? 'var(--accent)' : '#fff',
            color: i === active ? '#fff' : 'var(--ink)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontFamily: 'var(--font-display)',
          }}>{i + 1}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{s}</span>
        </div>
        {i < steps.length - 1 && <span style={{ flex: '0 0 22px', height: 0, borderTop: '1.5px dashed var(--line)' }} />}
      </React.Fragment>
    ))}
  </div>
);

const Scrubber = ({ progress = 0.42, playing = false, compact = false }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
    <button className="btn" style={{ width: 36, height: 36, padding: 0, borderRadius: 999 }}>
      {playing ? '❚❚' : '▶'}
    </button>
    <div style={{ flex: 1, position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'absolute', inset: '10px 0', borderTop: '1.5px solid var(--line)' }} />
      <div style={{ position: 'absolute', left: 0, top: '10px', height: 2, width: `${progress * 100}%`, background: 'var(--accent)' }} />
      <div style={{ position: 'absolute', left: `calc(${progress * 100}% - 7px)`, width: 14, height: 14, borderRadius: 999, background: '#fff', border: '1.5px solid var(--accent)', top: '4px' }} />
    </div>
    {!compact && (
      <>
        <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>0:04 / 0:10</span>
        <span className="chip">1x</span>
        <span className="chip">in →</span>
      </>
    )}
  </div>
);

// Drop zone — used in upload states
const DropZone = ({ small = false }) => (
  <div className="placeholder" style={{
    width: '100%', height: '100%',
    flexDirection: 'column', gap: 10,
    fontSize: small ? 16 : 22,
    fontFamily: 'var(--font-display)',
  }}>
    <div style={{ fontSize: small ? 28 : 40 }}>⤓</div>
    <div>Drop an image</div>
    <div className="mono" style={{ fontSize: small ? 12 : 14, color: 'var(--muted)' }}>or click to choose · jpg / png</div>
  </div>
);

Object.assign(window, { Droste, Annot, Stepper, Scrubber, DropZone });
