import { useEffect, useRef, useState } from 'react';
import '@google/model-viewer';
import MonumentTour from './MonumentTour';

// Keep recovered URLs across route exits: the renderer caches failures by URL.
const retryVersions = new Map();

export default function MonumentViewer({ monument, onTourComplete }) {
  const [attempt, setAttempt] = useState(() => retryVersions.get(monument.id) || 0);
  const source = attempt ? `${monument.model}?retry=${attempt}` : monument.model;
  const retry = () => {
    const next = (retryVersions.get(monument.id) || 0) + 1;
    retryVersions.set(monument.id, next);
    setAttempt(next);
  };
  return <ViewerSession key={`${monument.id}-${attempt}`} monument={monument} source={source} retry={retry} onTourComplete={onTourComplete} />;
}

function ViewerSession({ monument: m, source, retry, onTourComplete }) {
  const viewer = useRef(null);
  const [status, setStatus] = useState('loading');
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(null);
  const [rotate, setRotate] = useState(false);
  const [step, setStep] = useState(null);
  const [complete, setComplete] = useState(false);
  const reduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ready = status === 'ready';
  const hotspot = m.hotspots.find(h => h.id === active);
  const steps = m.tour.map(id => m.hotspots.find(h=>h.id===id));
  const selectHotspot = id => {setActive(id);setStep(null);setComplete(false);setRotate(false);};
  const tourStep = index => {setStep(index);setActive(steps[index].id);setRotate(false);setComplete(false);};

  useEffect(() => {
    const el = viewer.current;
    let disposed = false;
    const fail = () => { if (!disposed) setStatus('error'); };
    const timer = setTimeout(fail, 30000);
    const load = () => { clearTimeout(timer); if (!disposed) {setStatus('ready');setProgress(100);} };
    const update = e => { if (!disposed) setProgress(Math.round(e.detail.totalProgress * 100)); };
    el.addEventListener('load', load);
    el.addEventListener('error', fail);
    el.addEventListener('progress', update);
    el.setAttribute('src', source);
    return () => {
      disposed = true; clearTimeout(timer);
      el.removeEventListener('load', load); el.removeEventListener('error', fail); el.removeEventListener('progress', update);
      el.removeAttribute('src');
    };
  }, [source]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { reduced.current = media.matches; if (media.matches) setRotate(false); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    const el = viewer.current;
    if (!ready) return;
    el.cameraTarget = hotspot?.target || m.camera.target;
    el.cameraOrbit = hotspot?.orbit || m.camera.orbit;
    if (reduced.current) el.jumpCameraToGoal();
  }, [hotspot, m, ready]);

  const reset = () => {
    setActive(null); setRotate(false); setStep(null);
    const el = viewer.current;
    el.cameraTarget = m.camera.target; el.cameraOrbit = m.camera.orbit; el.fieldOfView = '30deg';
    el.jumpCameraToGoal();
  };

  return <div className="monument-experience">
    <div className="monument-stage" data-testid="monument-stage" data-status={status}>
      <div className="monument-stage-label"><span className="monument-dot" /> INTERACTIVE 3D PREVIEW</div>
      <model-viewer ref={viewer} alt={m.alt} poster={m.poster} camera-controls
        camera-orbit={m.camera.orbit} camera-target={m.camera.target} field-of-view="30deg"
        min-camera-orbit="auto 15deg auto" max-camera-orbit="auto 88deg auto"
        auto-rotate={rotate || undefined} auto-rotate-delay="0" rotation-per-second="12deg"
        shadow-intensity="1" exposure="1.1" environment-image="neutral" interaction-prompt="none"
        touch-action="pan-y" loading="eager" reveal="auto" style={{visibility: status === 'error' ? 'hidden' : 'visible'}}>
        {ready && m.hotspots.map((h, i) => <button key={h.id} slot={`hotspot-${h.id}`}
          data-position={h.position} data-normal={h.normal} className={`monument-hotspot ${active===h.id?'is-active':''}`}
          aria-label={`Explore ${h.title}`} aria-pressed={active===h.id} onClick={() => selectHotspot(h.id)}>{i + 1}</button>)}
      </model-viewer>
      <div className="monument-point-announcement" aria-live="polite" aria-atomic="true">
        {ready && hotspot && <aside key={hotspot.id} className="monument-point-card" aria-label="Selected monument detail">
          <button type="button" className="monument-point-close" aria-label="Close monument detail" onClick={()=>setActive(null)}>×</button>
          <p className="monument-eyebrow">POINT {String(m.hotspots.indexOf(hotspot)+1).padStart(2,'0')}</p>
          {hotspot.contextOnly && <p className="monument-point-context">Historical context · detail not modeled</p>}
          <h3>{hotspot.title}</h3><p>{hotspot.text}</p>
          <a href={m.sources.find(s=>s.id===hotspot.sourceId).url} target="_blank" rel="noopener noreferrer">Read the historical source ↗</a>
        </aside>}
      </div>
      {status === 'loading' && <div className="monument-loading" role="status">
        <span>Preparing {m.name}…</span><progress max="100" value={progress} aria-label="Model loading progress" />
      </div>}
      {status === 'error' && <div className="monument-viewer-error" role="alert"><h3>3D preview unavailable</h3>
        <p>The model could not load or this browser cannot render 3D. Try again or use a browser with WebGL enabled. The historical notes below remain available.</p>
        <button className="monument-button" onClick={retry}>Retry model</button></div>}
      <span className="monument-stage-caption">Original illustration · approximate scale</span>
    </div>
    <div className="monument-toolbar">
      <p>Drag to rotate · Scroll or pinch to zoom · Arrow keys when focused</p>
      <div><button className="monument-button secondary" disabled={!ready} onClick={reset}>Reset view</button>
        <button className="monument-button secondary" disabled={!ready} aria-pressed={rotate} onClick={() => setRotate(r => !r)}>{rotate?'Pause rotation':'Auto rotate'}</button></div>
    </div>
    <div className="monument-annotations">
      <p className="monument-eyebrow">LOOK A LITTLE CLOSER</p><h3>Stories in the architecture</h3>
      <p>{m.hotspots.length} points to explore · Select a number on the model or a topic below.</p>
      <div className="monument-hotspot-list">{m.hotspots.map((h,i)=><button key={h.id} aria-pressed={active===h.id}
        className={active===h.id?'is-active':''} onClick={()=>selectHotspot(h.id)}><span>{String(i+1).padStart(2,'0')}</span>{h.title}</button>)}</div>
      {hotspot && <div className="monument-story"><h4>{hotspot.title}</h4><p>{hotspot.text}</p>
        {hotspot.contextOnly && <p>Historical context · detail not modeled</p>}
        <a href={m.sources.find(s=>s.id===hotspot.sourceId).url} target="_blank" rel="noopener noreferrer">Read the historical source ↗</a></div>}
    </div>
    <MonumentTour steps={steps} step={step} complete={complete} enabled={ready} onStart={()=>tourStep(0)} onStep={tourStep}
      onExit={reset} onFinish={()=>{reset();setComplete(true);onTourComplete?.();}} />
  </div>;
}
