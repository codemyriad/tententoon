// Main app — DesignCanvas with 4 sections, plus the Tweaks panel.

const ACCENTS = ['#d94f2c', '#3a6ea5', '#2a8a4a', '#6c2ea0'];

function App() {
  const [t, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "accent": "#d94f2c",
    "font": "sketchy",
    "annotations": true
  }/*EDITMODE-END*/);

  React.useEffect(() => {
    document.documentElement.style.setProperty('--accent', t.accent);
    // Recompute soft accent (12% alpha) — convert hex to rgb
    const hex = t.accent.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    document.documentElement.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.12)`);
    document.body.classList.toggle('neat', t.font === 'neat');
    document.body.classList.toggle('no-annot', !t.annotations);
  }, [t.accent, t.font, t.annotations]);

  return (
    <>
      <DesignCanvas>
        <DCSection id="intro" title="Tententoon — Droste app wireframes" subtitle="4 layouts × upload→frame→zoom→export. Pick a vibe; mix & match.">
          <DCArtboard id="legend" label="Read me" width={420} height={560}>
            <div style={{ width: '100%', height: '100%', background: '#fff', border: '1.5px solid var(--line)', borderRadius: 8, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-body)' }}>
              <div className="display" style={{ fontSize: 30, color: 'var(--accent)' }}>The brief.</div>
              <div style={{ fontSize: 15, lineHeight: 1.35 }}>
                Upload a picture, frame a rectangle inside it, get a droste image &mdash; download as PNG, MP4 or GIF. All local, all in the browser.
              </div>
              <div className="display" style={{ fontSize: 24, marginTop: 8 }}>4 directions</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.5 }}>
                <li><b style={{ color: 'var(--accent)' }}>A · Wizard</b> &mdash; calm, guided, step-by-step.</li>
                <li><b style={{ color: 'var(--accent)' }}>B · Canvas-first</b> &mdash; image fills screen, controls float.</li>
                <li><b style={{ color: 'var(--accent)' }}>C · Tool app</b> &mdash; tools + inspector, Figma-y.</li>
                <li><b style={{ color: 'var(--accent)' }}>D · Long scroll</b> &mdash; stacked cards, mobile-native.</li>
              </ul>
              <div className="display" style={{ fontSize: 24, marginTop: 8 }}>Notes</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.5 }}>
                <li>Rect via marquee <i>and</i> handles &mdash; same picker, both styles supported.</li>
                <li>No extra effect knobs &mdash; just the rectangle.</li>
                <li>Playback: play/pause, scrubber, in/out, fullscreen.</li>
                <li>Tweaks panel (top right) swaps accent, font, & toggles annotations.</li>
              </ul>
              <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>v1 · sketches, not pixel decisions</div>
            </div>
          </DCArtboard>
        </DCSection>

        <DCSection id="A" title="A · Linear Wizard" subtitle="Stepper at top, one task per screen. Friendly for first-timers.">
          {ApproachA()}
        </DCSection>

        <DCSection id="B" title="B · Canvas-first" subtitle="The image is the UI. Controls float over it like sticky notes.">
          {ApproachB()}
        </DCSection>

        <DCSection id="C" title="C · Tool app" subtitle="Left tools · centre canvas · right inspector. Power-user shape.">
          {ApproachC()}
        </DCSection>

        <DCSection id="D" title="D · Long scroll" subtitle="Stacked cards you walk down. Same shape works on mobile native.">
          {ApproachD()}
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Accent">
          <TweakColor label="Marker" value={t.accent} onChange={(v) => setTweak('accent', v)} options={ACCENTS} />
        </TweakSection>
        <TweakSection label="Type">
          <TweakRadio label="Font feel" value={t.font} options={['sketchy', 'neat']} onChange={(v) => setTweak('font', v)} />
        </TweakSection>
        <TweakSection label="Display">
          <TweakToggle label="Annotations" value={t.annotations} onChange={(v) => setTweak('annotations', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
