import { lazy, Suspense, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Landmark, Search, ArrowUpRight, MapPin, Box } from 'lucide-react';
import { monuments, getMonument } from '../features/monuments/data/monuments';
import { searchMonuments } from '../features/monuments/searchMonuments';
import MonumentDetails from '../features/monuments/components/MonumentDetails';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuth } from '../contexts/AuthContext';
import useMonumentLearning from '../features/monuments/useMonumentLearning';
import MonumentLearningStatus from '../features/monuments/components/MonumentLearningStatus';
import '../features/monuments/monuments.css';

const MonumentViewer = lazy(() => import('../features/monuments/components/MonumentViewer'));

function ViewerImportError() {
  return <div className="monument-import-error" role="alert"><h3>The 3D viewer could not start.</h3><p>Your historical notes are still available below.</p><button className="monument-button" onClick={()=>window.location.reload()}>Reload viewer</button></div>;
}

export default function MonumentExplorerPage() {
  const {user}=useAuth();
  return <Explorer key={user?.id || 'signed-out'} />;
}

function Explorer() {
  const learning=useMonumentLearning();
  const [savedOnly,setSavedOnly]=useState(false);
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const country = params.get('country') || '';
  const period = params.get('period') || '';
  const id = params.get('monument');
  const selected = getMonument(id);
  const matches = searchMonuments(monuments, query, {country,period});
  const results = savedOnly&&learning.ready ? matches.filter(m=>learning.favorites.some(row=>row.monument_id===m.id)) : matches;
  const [copyStatus, setCopyStatus] = useState('');
  const [fallback, setFallback] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const update = (key, value, replace = false) => {
    setParams(previous => {const next=new URLSearchParams(previous); if(value)next.set(key,value);else next.delete(key);return next;}, {replace});
    setCopyStatus(''); setFallback('');
  };
  const share = async () => {
    const url = new URL(window.location.href); url.search = ''; url.searchParams.set('monument',selected.id);
    setCopiedId(selected.id);
    try {await navigator.clipboard.writeText(url.href);setCopyStatus('Link copied. Sign in is required to open it.');setFallback('');}
    catch {setFallback(url.href);setCopyStatus('Copy this link manually. Sign in is required to open it.');}
  };

  return <main className="monuments-page">
    <header className="monuments-header"><div>
      <p className="monument-eyebrow"><Landmark size={15} aria-hidden="true" /> HISTOFACTS FIELD COLLECTION</p>
      <h1>History, in a new dimension<span>.</span></h1>
      <p>Choose a monument. Turn it around. Discover the stories its architecture holds.</p>
    </div><span className="monument-mode"><Box size={16} aria-hidden="true" /> 3D EXPLORER <span>Camera-free</span></span></header>

    <div className="monument-account-status" aria-live="polite">{learning.isPending ? 'Loading your saved monuments and tour progress…' : learning.isError ? <><span>Saved learning is unavailable. You can still explore every model.</span> <button className="monument-button secondary" onClick={()=>learning.refetch()}>Retry saved learning</button></> : `${learning.favorites.length} saved monuments · Tour completion is saved to your account.`}</div>
    <div className="monuments-workspace">
      <aside className="monuments-catalogue" aria-label="Monument catalogue">
        <div className="monument-catalogue-heading"><h2>The collection</h2><span>{monuments.length} MONUMENTS</span></div>
        <label className="monument-search-label" htmlFor="monument-query">Find a monument</label>
        <div className="monument-search"><Search size={17} aria-hidden="true"/><input id="monument-query" type="search" placeholder="Try Taj Mahal or Giza" value={query} onChange={e=>update('q',e.target.value,true)} /></div>
        <div className="monument-filters"><label>Country<select value={country} onChange={e=>update('country',e.target.value)}>
          <option value="">All countries</option>{[...new Set(monuments.map(m=>m.country))].map(c=><option key={c}>{c}</option>)}</select></label>
          <label>Period<select value={period} onChange={e=>update('period',e.target.value)}><option value="">All periods</option>{[...new Set(monuments.map(m=>m.period))].map(p=><option key={p}>{p}</option>)}</select></label></div>
        <label className="monument-saved-filter"><input type="checkbox" checked={savedOnly&&learning.ready} disabled={!learning.ready} onChange={e=>setSavedOnly(e.target.checked)}/> Saved monuments only</label>
        <p className="monument-results" aria-live="polite">{results.length} {results.length===1?'monument':'monuments'} available</p>
        {!results.length && <div className="monument-empty-result"><h3>{savedOnly&&learning.ready?'No saved matches':'Model not available'}</h3><p>{savedOnly&&learning.ready?'Save a monument while exploring, or show the full collection.':'Try Taj Mahal, Great Pyramid, or Qutub Minar. This collection uses prepared models, rather than generating a monument from a name.'}</p>
          <button className="monument-button secondary" onClick={()=>{setSavedOnly(false);setParams(selected?{monument:selected.id}:{});}}>Show the collection</button></div>}
        <div className="monument-cards">{results.map((m,i)=><button key={m.id} className={`monument-card ${id===m.id?'is-selected':''}`} aria-pressed={id===m.id} onClick={()=>update('monument',m.id)}>
          <div className="monument-card-image"><img src={m.poster} alt="" loading="lazy"/><span>{String(i+1).padStart(2,'0')}</span><ArrowUpRight size={18} aria-hidden="true"/></div>
          <div className="monument-card-text"><span>{m.period}</span><h3>{m.name}</h3><p><MapPin size={12} aria-hidden="true"/>{m.location}</p>
            {learning.ready&&<small>{learning.favorites.some(r=>r.monument_id===m.id)?'Saved · ':''}{learning.completions.some(r=>r.monument_id===m.id&&r.tour_revision===m.tour_revision)?'Tour complete':''}</small>}</div></button>)}</div>
        <p className="monument-catalogue-note">A small, carefully sourced collection.<br/>All models are simplified illustrations.</p>
      </aside>

      <section className="monument-preview" aria-label="Monument exploration">
        {selected ? <>
          <div className="monument-preview-heading"><div><span className="monument-eyebrow">NOW EXPLORING</span><h2>{selected.name}</h2></div><button className="monument-button secondary" onClick={share}>Copy monument link</button></div>
          <div role="status" className="monument-copy-status">{copiedId===selected.id ? copyStatus : ''}</div>
          {fallback && copiedId===selected.id && <label className="monument-share-fallback">Monument link<input value={fallback} readOnly onFocus={e=>e.target.select()}/></label>}
          <MonumentLearningStatus learning={learning} monument={selected}/>
          <ErrorBoundary key={selected.id} featureName="3D viewer" fallback={ViewerImportError}>
            <Suspense fallback={<div className="monument-viewer-placeholder" role="status">Loading 3D viewer…</div>}><MonumentViewer key={selected.id} monument={selected} onTourComplete={()=>learning.tour.mutate({monumentId:selected.id,tourRevision:selected.tour_revision})}/></Suspense>
          </ErrorBoundary>
          <MonumentDetails monument={selected}/>
          <section className="monument-study-actions" aria-label="Continue learning"><div><p className="monument-eyebrow">CONTINUE YOUR DISCOVERY</p><h3>Turn exploration into understanding</h3><p>Review a prepared topic or prompt on the next page. Generation starts only when you submit it.</p></div>
            <div><Link className="monument-button" to={`/quiz?tab=personalized&monument=${selected.id}`}>Prepare a quiz</Link>
              <Link className="monument-button secondary" to={`/notes?monument=${selected.id}`}>Prepare study notes</Link></div></section>
        </> : <div className="monument-intro">
          <div className="monument-intro-art"><img src={getMonument('taj-mahal').poster} alt="Illustrative silhouette of the Taj Mahal"/><span>YOUR WINDOW INTO THE PAST</span></div>
          <div><p className="monument-eyebrow">EXPLORE AT YOUR OWN PACE</p><h2>{id?'This monument is not in the collection.':'A closer look at extraordinary places.'}</h2>
            <p>{id?'Choose an available monument from the collection to continue.':'Select a monument to open its interactive model. Rotate the architecture, explore the details, and read its story—all from your laptop.'}</p>
            <button className="monument-button" onClick={()=>update('monument','taj-mahal')}>Explore the Taj Mahal <ArrowUpRight size={16} aria-hidden="true"/></button>
            <p className="monument-intro-note">No camera required. Actual AR placement is a future device-based extension.</p></div>
        </div>}
      </section>
    </div>
  </main>;
}
